import { getSessionUser } from '../../lib/session';

interface Env {
  DB: D1Database;
  SESSION_SECRET: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'level';

  try {
    // Get user from session
    const user = await getSessionUser(request, env.SESSION_SECRET);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build query based on type
    let orderBy = 'level DESC, xp DESC';
    let compareField = 'level';
    switch (type) {
      case 'coins':
        orderBy = 'total_coins DESC';
        compareField = 'total_coins';
        break;
      case 'resources':
        orderBy = 'total_resources_collected DESC';
        compareField = 'total_resources_collected';
        break;
      case 'buildings':
        orderBy = 'total_buildings_placed DESC';
        compareField = 'total_buildings_placed';
        break;
      case 'missions':
        orderBy = 'total_missions_completed DESC';
        compareField = 'total_missions_completed';
        break;
    }

    // Get player's rank using a subquery
    const result = await env.DB.prepare(`
      SELECT COUNT(*) + 1 as rank
      FROM player_stats p1
      CROSS JOIN player_stats p2
      WHERE p2.user_id = ?
        AND p1.${compareField} > p2.${compareField}
    `).bind(user.id).first();

    return new Response(JSON.stringify({ rank: result?.rank || null }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Rank error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

