// GET /api/missions/available?spaceId=met - Get available missions at a public space
export async function onRequestGet(context: any) {
  try {
    const db = context.env.DB;
    const url = new URL(context.request.url);
    const spaceId = url.searchParams.get('spaceId');

    if (!spaceId) {
      return new Response(JSON.stringify({ error: 'spaceId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { results } = await db.prepare(`
      SELECT id, space_id, title, description, type, objective, reward_coins
      FROM missions
      WHERE space_id = ?
      ORDER BY reward_coins DESC
    `).bind(spaceId).all();

    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Error fetching missions:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

