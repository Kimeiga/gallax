// Territory API — H3 hexagonal cells: GET, POST claim, DELETE unclaim
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
  // Guest users can READ territory but not write
  const guestId = request.headers.get('X-Guest-ID');
  if (guestId && guestId.startsWith('guest_')) {
    const guest = await env.DB.prepare('SELECT id FROM players WHERE id = ?').bind(guestId).first();
    if (guest) return guestId;
  }
  return null;
}

function isValidH3(h3: string): boolean {
  return typeof h3 === 'string' && /^[0-9a-f]{15}$/.test(h3);
}

const DAILY_CLAIM_BUDGET = 8;
const MAX_TERRITORY_SERVER = 500;

/** Get today's midnight in ISO format for daily cap query */
function todayMidnightISO(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

// GET territory cells — all or by owner (?owner=)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const url = new URL(request.url);

  try {
    const owner = url.searchParams.get('owner');

    let query: string;
    let params: string[] = [];

    if (owner) {
      query = `SELECT t.h3_index, t.owner_id, t.color, t.claimed_at, t.last_visited,
                      p.name as owner_name
               FROM territory t LEFT JOIN players p ON t.owner_id = p.id
               WHERE t.owner_id = ?
               ORDER BY t.claimed_at DESC LIMIT 10000`;
      params = [owner];
    } else {
      query = `SELECT t.h3_index, t.owner_id, t.color, t.claimed_at, t.last_visited,
                      p.name as owner_name
               FROM territory t LEFT JOIN players p ON t.owner_id = p.id
               ORDER BY t.claimed_at DESC LIMIT 50000`;
    }

    const stmt = params.length > 0
      ? env.DB.prepare(query).bind(...params)
      : env.DB.prepare(query);

    const { results } = await stmt.all();
    return Response.json(results || []);
  } catch (err) {
    console.error('Get territory error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
};

// POST claim cells — body: { cells: string[], color: string }
// Also handles delete via POST: { action: 'delete', cells: string[] } (Safari drops body on DELETE)
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  const playerId = await getPlayerId(env, request);
  if (!playerId) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Block guest users
  if (playerId.startsWith('guest_')) {
    return Response.json({ error: 'Sign in with Google to claim territory' }, { status: 403 });
  }

  // Handle delete-via-POST (Safari workaround)
  try {
    const rawBody = await request.clone().json() as any;
    if (rawBody && rawBody.action === 'delete' && Array.isArray(rawBody.cells)) {
      const cells = rawBody.cells.filter(isValidH3);
      if (cells.length === 0) return Response.json({ error: 'No valid H3 indexes' }, { status: 400 });
      const stmts = cells.map((h3: string) =>
        env.DB.prepare('DELETE FROM territory WHERE h3_index = ? AND owner_id = ?').bind(h3, playerId)
      );
      await env.DB.batch(stmts);
      return Response.json({ success: true, count: cells.length });
    }
  } catch { /* not a delete action, continue to normal claim flow */ }

  try {
    const body = await request.json() as { cells?: string[]; color?: string };
    const cells: string[] = body.cells || [];
    const color: string = body.color || '#4ECDC4';

    if (cells.length === 0) {
      return Response.json({ error: 'No cells provided' }, { status: 400 });
    }
    if (cells.length > 200) {
      return Response.json({ error: 'Too many cells (max 200)' }, { status: 400 });
    }

    const validCells = cells.filter(isValidH3);
    if (validCells.length === 0) {
      return Response.json({ error: 'No valid H3 indexes' }, { status: 400 });
    }

    // Check total capacity
    const countResult = await env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM territory WHERE owner_id = ?'
    ).bind(playerId).first<{ cnt: number }>();
    const currentCount = countResult?.cnt || 0;
    if (currentCount + validCells.length > MAX_TERRITORY_SERVER) {
      return Response.json({
        error: `Territory limit exceeded (${currentCount}/${MAX_TERRITORY_SERVER})`,
      }, { status: 400 });
    }

    // Enforce daily claim budget (server-side)
    const todayCount = await env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM territory WHERE owner_id = ? AND claimed_at >= ?'
    ).bind(playerId, todayMidnightISO()).first<{ cnt: number }>();
    const claimedToday = todayCount?.cnt || 0;
    if (claimedToday + validCells.length > DAILY_CLAIM_BUDGET) {
      const remaining = Math.max(0, DAILY_CLAIM_BUDGET - claimedToday);
      return Response.json({
        error: `Daily limit: ${remaining} claims left today (${DAILY_CLAIM_BUDGET}/day)`,
      }, { status: 429 });
    }

    const now = new Date().toISOString();
    const stmts = validCells.map((h3) =>
      env.DB.prepare(
        `INSERT OR REPLACE INTO territory (h3_index, owner_id, color, claimed_at, last_visited)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(h3, playerId, color, now, now)
    );

    await env.DB.batch(stmts);

    return Response.json({ success: true, count: validCells.length, totalTerritory: currentCount + validCells.length });
  } catch (err) {
    console.error('Claim territory error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
};

// DELETE unclaim cells — body: string[] (H3 indexes)
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  const playerId = await getPlayerId(env, request);
  if (!playerId) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Block guest users
  if (playerId.startsWith('guest_')) {
    return Response.json({ error: 'Sign in with Google to manage territory' }, { status: 403 });
  }

  try {
    const body = await request.json() as string[];
    const cells: string[] = Array.isArray(body) ? body : [];

    if (cells.length === 0) {
      return Response.json({ error: 'No cells provided' }, { status: 400 });
    }

    const validCells = cells.filter(isValidH3);
    if (validCells.length === 0) {
      return Response.json({ error: 'No valid H3 indexes' }, { status: 400 });
    }

    const stmts = validCells.map((h3) =>
      env.DB.prepare(
        'DELETE FROM territory WHERE h3_index = ? AND owner_id = ?'
      ).bind(h3, playerId)
    );

    await env.DB.batch(stmts);

    return Response.json({ success: true, count: validCells.length });
  } catch (err) {
    console.error('Unclaim territory error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
};
