// Pixels API - GET all pixels, POST new pixel(s), DELETE pixel
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

// GET all pixels (optionally filtered by bounding box)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const url = new URL(request.url);

  try {
    // Optional bounding box filter: ?minX=0&maxX=100&minY=0&maxY=100
    const minX = url.searchParams.get('minX');
    const maxX = url.searchParams.get('maxX');
    const minY = url.searchParams.get('minY');
    const maxY = url.searchParams.get('maxY');

    let query: string;
    let params: any[] = [];

    if (minX && maxX && minY && maxY) {
      query = `SELECT p.x, p.y, p.color, p.author_id, pl.name as author_name, p.created_at
               FROM pixels p LEFT JOIN players pl ON p.author_id = pl.id
               WHERE p.x >= ? AND p.x <= ? AND p.y >= ? AND p.y <= ?
               ORDER BY p.created_at DESC LIMIT 50000`;
      params = [parseInt(minX), parseInt(maxX), parseInt(minY), parseInt(maxY)];
    } else {
      query = `SELECT p.x, p.y, p.color, p.author_id, pl.name as author_name, p.created_at
               FROM pixels p LEFT JOIN players pl ON p.author_id = pl.id
               ORDER BY p.created_at DESC LIMIT 50000`;
    }

    const stmt = params.length > 0
      ? env.DB.prepare(query).bind(...params)
      : env.DB.prepare(query);

    const { results } = await stmt.all();
    return Response.json(results || []);
  } catch (err) {
    console.error('Get pixels error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
};

// POST new pixel(s) - accepts single pixel or batch array
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  const playerId = await getPlayerId(env, request);
  if (!playerId) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json() as any;

    // Handle erase via POST (Safari drops body on DELETE requests)
    if (body && body.action === 'delete' && Array.isArray(body.pixels)) {
      const pixels = body.pixels;
      if (pixels.length === 0) return Response.json({ error: 'No pixels' }, { status: 400 });
      if (pixels.length > 500) return Response.json({ error: 'Too many pixels' }, { status: 400 });
      const validPixels = pixels.filter((p: any) =>
        p && typeof p.x === 'number' && typeof p.y === 'number' &&
        Number.isFinite(p.x) && Number.isFinite(p.y)
      );
      if (validPixels.length === 0) return Response.json({ error: 'No valid pixels' }, { status: 400 });
      const stmts = validPixels.map((p: any) =>
        env.DB.prepare('DELETE FROM pixels WHERE x = ? AND y = ?').bind(p.x, p.y)
      );
      await env.DB.batch(stmts);
      return Response.json({ success: true, count: stmts.length });
    }

    // Normal pixel placement
    const pixels = Array.isArray(body) ? body : [body];

    if (pixels.length === 0) {
      return Response.json({ error: 'No pixels provided' }, { status: 400 });
    }

    if (pixels.length > 500) {
      return Response.json({ error: 'Too many pixels (max 500)' }, { status: 400 });
    }

    // Use batch insert with INSERT OR REPLACE (upsert)
    const stmts = pixels.map((p: { x: number; y: number; color: string }) => {
      if (p.x === undefined || p.y === undefined || !p.color) {
        return null;
      }
      return env.DB.prepare(
        'INSERT OR REPLACE INTO pixels (x, y, color, author_id) VALUES (?, ?, ?, ?)'
      ).bind(p.x, p.y, p.color, playerId);
    }).filter(Boolean);

    if (stmts.length > 0) {
      await env.DB.batch(stmts as any);
    }

    return Response.json({ success: true, count: stmts.length });
  } catch (err) {
    console.error('Create pixel error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
};

// DELETE pixel(s) - supports single {x,y} or batch [{x,y},...]
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  const playerId = await getPlayerId(env, request);
  if (!playerId) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch (parseErr) {
    console.error('Delete pixel JSON parse error:', parseErr);
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const pixels = Array.isArray(body) ? body : [body];

    if (pixels.length === 0) {
      return Response.json({ error: 'No pixels provided' }, { status: 400 });
    }

    if (pixels.length > 500) {
      return Response.json({ error: 'Too many pixels (max 500)' }, { status: 400 });
    }

    const validPixels = pixels.filter((p: any) =>
      p !== null && typeof p === 'object' &&
      typeof p.x === 'number' && typeof p.y === 'number' &&
      Number.isFinite(p.x) && Number.isFinite(p.y)
    );

    if (validPixels.length === 0) {
      console.error('Delete pixel: no valid pixels in batch. Received:', JSON.stringify(pixels).slice(0, 200));
      return Response.json({ error: 'No valid pixel coordinates' }, { status: 400 });
    }

    if (validPixels.length !== pixels.length) {
      console.warn(`Delete pixel: filtered ${pixels.length - validPixels.length} invalid entries from batch`);
    }

    const stmts = validPixels.map((p: any) =>
      env.DB.prepare('DELETE FROM pixels WHERE x = ? AND y = ?').bind(p.x, p.y)
    );

    await env.DB.batch(stmts);

    return Response.json({ success: true, count: stmts.length });
  } catch (err) {
    console.error('Delete pixel batch error:', err, '| playerId:', playerId);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
};
