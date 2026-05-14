// Buildings API - GET all, POST new
interface Env {
  DB: D1Database;
}

interface Building {
  id: string;
  type: string;
  lng: number;
  lat: number;
  rotation: number;
  owner_id: string;
  created_at: string;
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
  // Try session cookie first (authenticated users)
  const sessionId = getCookie(request, 'session');
  if (sessionId) {
    const session = await env.DB.prepare(`
      SELECT player_id, expires_at FROM sessions WHERE id = ?
    `).bind(sessionId).first<{ player_id: string; expires_at: string }>();

    if (session && new Date(session.expires_at) >= new Date()) {
      return session.player_id;
    }
  }

  // Fall back to X-Guest-ID header (guest users)
  const guestId = request.headers.get('X-Guest-ID');
  if (guestId && guestId.startsWith('guest_')) {
    // Verify guest exists in database
    const guest = await env.DB.prepare(
      'SELECT id FROM players WHERE id = ?'
    ).bind(guestId).first();
    if (guest) return guestId;
  }

  return null;
}

// GET all buildings
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  
  try {
    const { results } = await env.DB.prepare(`
      SELECT b.*, p.name as owner_name
      FROM buildings b
      LEFT JOIN players p ON b.owner_id = p.id
    `).all<Building & { owner_name: string }>();
    
    return Response.json(results || []);
  } catch (err) {
    console.error('Get buildings error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
};

// POST new building
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  const playerId = await getPlayerId(env, request);
  if (!playerId) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json() as { id: string; type: string; lng: number; lat: number; rotation?: number };

    if (!body.id || !body.type || body.lng === undefined || body.lat === undefined) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await env.DB.prepare(`
      INSERT INTO buildings (id, type, lng, lat, rotation, owner_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(body.id, body.type, body.lng, body.lat, body.rotation || 0, playerId).run();

    return Response.json({ success: true, id: body.id, owner: playerId });
  } catch (err) {
    console.error('Create building error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
};

