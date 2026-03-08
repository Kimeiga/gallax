// POST /api/auth/guest - Register a guest user
export async function onRequestPost(context: any) {
  try {
    const { env, request } = context;
    const { guestId } = await request.json();

    if (!guestId || !guestId.startsWith('guest_')) {
      return new Response(JSON.stringify({ error: 'Invalid guest ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if guest already exists
    const existing = await env.DB.prepare(
      'SELECT id FROM players WHERE id = ?'
    ).bind(guestId).first();

    if (existing) {
      return new Response(JSON.stringify({ success: true, existing: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create guest player
    await env.DB.prepare(`
      INSERT INTO players (id, email, name, avatar_url, is_guest)
      VALUES (?, '', 'Guest Player', '', 1)
    `).bind(guestId).run();

    return new Response(JSON.stringify({ success: true, guestId }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Guest registration error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

