// Logout - clear session
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

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  
  const sessionId = getCookie(request, 'session');
  
  if (sessionId) {
    // Delete session from database
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
  }
  
  const url = new URL(request.url);
  
  // Clear cookie and redirect
  return new Response(null, {
    status: 302,
    headers: {
      'Location': url.origin,
      'Set-Cookie': 'session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    },
  });
};

// Also support GET for easy logout links
export const onRequestGet = onRequestPost;

