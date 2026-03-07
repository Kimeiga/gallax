// Session helper utilities
interface Env {
  DB: D1Database;
}

interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string;
  coins: number;
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

export async function getSessionUser(context: any): Promise<User | null> {
  const { env, request } = context;
  
  const sessionId = getCookie(request, 'session');
  if (!sessionId) return null;
  
  try {
    // Get session and check expiry
    const session = await env.DB.prepare(`
      SELECT player_id, expires_at FROM sessions WHERE id = ?
    `).bind(sessionId).first<{ player_id: string; expires_at: string }>();
    
    if (!session) return null;
    
    if (new Date(session.expires_at) < new Date()) {
      // Session expired, delete it
      await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
      return null;
    }
    
    // Get player info
    const player = await env.DB.prepare(`
      SELECT id, email, name, avatar_url, coins
      FROM players WHERE id = ?
    `).bind(session.player_id).first<User>();
    
    return player || null;
  } catch (err) {
    console.error('Get session user error:', err);
    return null;
  }
}

