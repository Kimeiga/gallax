// Buildings API - GET one, PUT update, DELETE
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
    const guest = await env.DB.prepare(
      'SELECT id FROM players WHERE id = ?'
    ).bind(guestId).first();
    if (guest) return guestId;
  }

  return null;
}

async function isPlayerAdmin(env: Env, playerId: string): Promise<boolean> {
  const row = await env.DB.prepare('SELECT is_admin FROM players WHERE id = ?').bind(playerId).first<{ is_admin: number }>();
  return row?.is_admin === 1;
}

// PUT update building (position/rotation)
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { env, request, params } = context;
  const buildingId = params.id as string;
  
  const playerId = await getPlayerId(env, request);
  if (!playerId) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }
  
  try {
    const building = await env.DB.prepare(`
      SELECT owner_id FROM buildings WHERE id = ?
    `).bind(buildingId).first<{ owner_id: string }>();

    if (!building) {
      return Response.json({ error: 'Building not found' }, { status: 404 });
    }

    const admin = await isPlayerAdmin(env, playerId);
    if (building.owner_id !== playerId && !admin) {
      return Response.json({ error: 'Not your building' }, { status: 403 });
    }

    const body = await request.json() as { lng?: number; lat?: number; rotation?: number };
    
    const updates: string[] = [];
    const values: (number | string)[] = [];
    
    if (body.lng !== undefined) {
      updates.push('lng = ?');
      values.push(body.lng);
    }
    if (body.lat !== undefined) {
      updates.push('lat = ?');
      values.push(body.lat);
    }
    if (body.rotation !== undefined) {
      updates.push('rotation = ?');
      values.push(body.rotation);
    }
    
    if (updates.length === 0) {
      return Response.json({ error: 'No updates provided' }, { status: 400 });
    }
    
    values.push(buildingId);
    
    await env.DB.prepare(`
      UPDATE buildings SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run();
    
    return Response.json({ success: true });
  } catch (err) {
    console.error('Update building error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
};

// DELETE building
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, request, params } = context;
  const buildingId = params.id as string;
  
  const playerId = await getPlayerId(env, request);
  if (!playerId) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }
  
  try {
    // Check ownership
    const building = await env.DB.prepare(`
      SELECT owner_id FROM buildings WHERE id = ?
    `).bind(buildingId).first<{ owner_id: string }>();
    
    if (!building) {
      return Response.json({ error: 'Building not found' }, { status: 404 });
    }

    const admin = await isPlayerAdmin(env, playerId);
    if (building.owner_id !== playerId && !admin) {
      return Response.json({ error: 'Not your building' }, { status: 403 });
    }

    await env.DB.prepare('DELETE FROM buildings WHERE id = ?').bind(buildingId).run();
    
    return Response.json({ success: true });
  } catch (err) {
    console.error('Delete building error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
};

