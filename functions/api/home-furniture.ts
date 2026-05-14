// Home furniture API - GET/POST/DELETE furniture for a home
interface Env {
  DB: D1Database;
}

function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map(c => c.trim());
  for (const cookie of cookies) {
    const [key, value] = cookie.split('=');
    if (key === name) return value;
  }
  return null;
}

async function getPlayerId(env: Env, request: Request): Promise<string | null> {
  const sessionId = getCookie(request, 'session');
  if (sessionId) {
    const session = await env.DB.prepare(
      'SELECT player_id, expires_at FROM sessions WHERE id = ?'
    ).bind(sessionId).first<{ player_id: string; expires_at: string }>();
    if (session && new Date(session.expires_at) >= new Date()) {
      return session.player_id;
    }
  }
  const guestId = request.headers.get('X-Guest-ID');
  if (guestId && guestId.startsWith('guest_')) {
    const guest = await env.DB.prepare('SELECT id FROM players WHERE id = ?').bind(guestId).first();
    if (guest) return guestId;
  }
  return null;
}

// GET furniture for a home (by homeId query param)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const url = new URL(request.url);
  const homeId = url.searchParams.get('homeId');
  if (!homeId) {
    return Response.json({ error: 'Missing homeId' }, { status: 400 });
  }

  try {
    const { results } = await env.DB.prepare(
      'SELECT id, emoji, x, y, placed_by AS placedBy, created_at AS createdAt FROM home_furniture WHERE home_id = ? ORDER BY created_at ASC'
    ).bind(homeId).all();

    return Response.json({ furniture: results ?? [] });
  } catch (err) {
    console.error('home-furniture GET error:', err);
    return Response.json({ furniture: [] });
  }
};

// POST save furniture for a home (upsert all items)
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  const playerId = await getPlayerId(env, request);
  if (!playerId) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json<{
      homeId: string;
      furniture: Array<{ id: string; emoji: string; x: number; y: number; placedBy?: string }>;
    }>();

    if (!body.homeId || !Array.isArray(body.furniture)) {
      return Response.json({ error: 'Invalid body' }, { status: 400 });
    }

    // Verify caller owns this home
    const home = await env.DB.prepare(
      'SELECT owner_id FROM buildings WHERE id = ? AND type = ?'
    ).bind(body.homeId, 'my_home').first<{ owner_id: string }>();
    if (!home || home.owner_id !== playerId) {
      return Response.json({ error: 'Not your home' }, { status: 403 });
    }

    const stmts: D1PreparedStatement[] = [];

    // Delete furniture no longer present (full sync)
    const incomingIds = body.furniture.map(f => f.id);
    if (incomingIds.length === 0) {
      // If empty array, delete all furniture for this home
      stmts.push(
        env.DB.prepare('DELETE FROM home_furniture WHERE home_id = ?').bind(body.homeId)
      );
    } else {
      // Delete items that are no longer in the list
      const placeholders = incomingIds.map(() => '?').join(',');
      stmts.push(
        env.DB.prepare(
          `DELETE FROM home_furniture WHERE home_id = ? AND id NOT IN (${placeholders})`
        ).bind(body.homeId, ...incomingIds)
      );
    }

    // Upsert each furniture item
    for (const item of body.furniture) {
      stmts.push(
        env.DB.prepare(
          'INSERT OR REPLACE INTO home_furniture (id, home_id, emoji, x, y, placed_by) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(item.id, body.homeId, item.emoji, item.x, item.y, item.placedBy ?? playerId)
      );
    }

    if (stmts.length > 0) {
      await env.DB.batch(stmts);
    }

    return Response.json({ success: true, count: body.furniture.length });
  } catch (err) {
    console.error('home-furniture POST error:', err);
    return Response.json({ error: 'Failed to save furniture' }, { status: 500 });
  }
};

// DELETE a single furniture item
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  const playerId = await getPlayerId(env, request);
  if (!playerId) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json<{ homeId: string; furnitureId: string }>();
    if (!body.homeId || !body.furnitureId) {
      return Response.json({ error: 'Missing homeId or furnitureId' }, { status: 400 });
    }

    // Verify caller owns this home
    const home = await env.DB.prepare(
      'SELECT owner_id FROM buildings WHERE id = ? AND type = ?'
    ).bind(body.homeId, 'my_home').first<{ owner_id: string }>();
    if (!home || home.owner_id !== playerId) {
      return Response.json({ error: 'Not your home' }, { status: 403 });
    }

    await env.DB.prepare(
      'DELETE FROM home_furniture WHERE id = ? AND home_id = ?'
    ).bind(body.furnitureId, body.homeId).run();

    return Response.json({ success: true });
  } catch (err) {
    console.error('home-furniture DELETE error:', err);
    return Response.json({ error: 'Failed to delete furniture' }, { status: 500 });
  }
};
