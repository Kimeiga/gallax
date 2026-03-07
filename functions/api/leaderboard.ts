import { getSessionUser } from './auth/session';

interface Env {
  DB: D1Database;
  SESSION_SECRET: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'level';
  const limit = parseInt(url.searchParams.get('limit') || '10');

  try {
    // Get user from session
    const user = await getSessionUser(context);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build query based on type
    let orderBy = 'level DESC, xp DESC';
    switch (type) {
      case 'coins':
        orderBy = 'total_coins DESC';
        break;
      case 'resources':
        orderBy = 'total_resources_collected DESC';
        break;
      case 'buildings':
        orderBy = 'total_buildings_placed DESC';
        break;
      case 'missions':
        orderBy = 'total_missions_completed DESC';
        break;
    }

    const result = await env.DB.prepare(`
      SELECT 
        user_id,
        username,
        level,
        xp,
        total_coins,
        total_resources_collected,
        total_buildings_placed,
        total_missions_completed
      FROM player_stats
      ORDER BY ${orderBy}
      LIMIT ?
    `).bind(limit).all();

    return new Response(JSON.stringify({ leaderboard: result.results || [] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

