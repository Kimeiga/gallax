// Admin API to clear all buildings and increment version
// This forces all clients to refresh their cache

interface Env {
  DB: D1Database;
  ADMIN_SECRET: string; // Set via: wrangler secret put ADMIN_SECRET
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  
  // Check admin authorization
  const authHeader = request.headers.get('Authorization');
  const adminSecret = env.ADMIN_SECRET || 'change-me-in-production';
  
  if (!authHeader || authHeader !== `Bearer ${adminSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    // Delete all buildings
    await env.DB.prepare('DELETE FROM buildings').run();
    
    // Increment game version to invalidate client caches
    await env.DB.prepare(`
      INSERT INTO game_metadata (key, value, updated_at)
      VALUES ('buildings_version', '1', CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET 
        value = CAST((CAST(value AS INTEGER) + 1) AS TEXT),
        updated_at = CURRENT_TIMESTAMP
    `).run();
    
    // Get new version
    const version = await env.DB.prepare(
      "SELECT value FROM game_metadata WHERE key = 'buildings_version'"
    ).first<{ value: string }>();
    
    return Response.json({ 
      success: true, 
      message: 'All buildings cleared',
      new_version: version?.value || '1'
    });
  } catch (err) {
    console.error('Clear buildings error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
};

