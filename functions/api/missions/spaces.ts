// GET /api/missions/spaces - Get all public spaces
export async function onRequestGet(context: any) {
  try {
    const db = context.env.DB;
    
    const { results } = await db.prepare(`
      SELECT id, name, lng, lat, radius, description
      FROM public_spaces
      ORDER BY name
    `).all();

    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Error fetching public spaces:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

