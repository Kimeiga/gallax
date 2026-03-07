// Get current user info
interface Env {
  DB: D1Database;
}

interface Player {
  id: string;
  email: string;
  name: string;
  avatar_url: string;
  resources: string;
  lng: number;
  lat: number;
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

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  
  const sessionId = getCookie(request, 'session');
  
  if (!sessionId) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }
  
  try {
    // Get session and check expiry
    const session = await env.DB.prepare(`
      SELECT player_id, expires_at FROM sessions WHERE id = ?
    `).bind(sessionId).first<{ player_id: string; expires_at: string }>();
    
    if (!session) {
      return Response.json({ error: 'Invalid session' }, { status: 401 });
    }
    
    if (new Date(session.expires_at) < new Date()) {
      // Session expired, delete it
      await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
      return Response.json({ error: 'Session expired' }, { status: 401 });
    }
    
    // Get player info
    const player = await env.DB.prepare(`
      SELECT id, email, name, avatar_url, resources, coins, lng, lat, created_at
      FROM players WHERE id = ?
    `).bind(session.player_id).first<Player & { coins: number }>();
    
    if (!player) {
      return Response.json({ error: 'Player not found' }, { status: 404 });
    }
    
    return Response.json({
      id: player.id,
      email: player.email,
      name: player.name,
      avatarUrl: player.avatar_url,
      resources: JSON.parse(player.resources || '{}'),
      coins: player.coins || 0,
      lng: player.lng,
      lat: player.lat,
      createdAt: player.created_at,
    });
  } catch (err) {
    console.error('Get user error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
};

