// Get current game version for cache invalidation
interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  
  try {
    const version = await env.DB.prepare(
      "SELECT value FROM game_metadata WHERE key = 'buildings_version'"
    ).first<{ value: string }>();
    
    return Response.json({ 
      buildings_version: version?.value || '1'
    });
  } catch (err) {
    console.error('Get version error:', err);
    return Response.json({ 
      buildings_version: '1' 
    });
  }
};

