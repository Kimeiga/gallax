// Handle Google OAuth callback
interface Env {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  DB: D1Database;
}

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  refresh_token?: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture: string;
}

function generateSessionId(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const url = new URL(request.url);
  
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  
  if (error) {
    return Response.redirect(`${url.origin}/?error=${error}`, 302);
  }
  
  if (!code) {
    return Response.redirect(`${url.origin}/?error=no_code`, 302);
  }
  
  const redirectUri = `${url.origin}/api/auth/callback`;
  
  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return Response.redirect(`${url.origin}/?error=token_exchange_failed`, 302);
    }
    
    const tokens: GoogleTokenResponse = await tokenResponse.json();
    
    // Get user info
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    
    if (!userResponse.ok) {
      return Response.redirect(`${url.origin}/?error=user_info_failed`, 302);
    }
    
    const userInfo: GoogleUserInfo = await userResponse.json();
    
    // Upsert player in database
    await env.DB.prepare(`
      INSERT INTO players (id, email, name, avatar_url)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        name = excluded.name,
        avatar_url = excluded.avatar_url,
        updated_at = CURRENT_TIMESTAMP
    `).bind(userInfo.id, userInfo.email, userInfo.name, userInfo.picture).run();
    
    // Create session
    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
    
    await env.DB.prepare(`
      INSERT INTO sessions (id, player_id, expires_at)
      VALUES (?, ?, ?)
    `).bind(sessionId, userInfo.id, expiresAt).run();
    
    // Set session cookie and redirect
    const response = Response.redirect(`${url.origin}/?login=success`, 302);
    
    // Create new response with cookie header
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${url.origin}/?login=success`,
        'Set-Cookie': `session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`,
      },
    });
  } catch (err) {
    console.error('OAuth callback error:', err);
    return Response.redirect(`${url.origin}/?error=internal_error`, 302);
  }
};

