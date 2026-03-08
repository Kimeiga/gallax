import { getSessionUser } from './session';

// POST /api/auth/migrate-guest - Migrate guest data to authenticated user
export async function onRequestPost(context: any) {
  try {
    const { env, request } = context;
    
    // Get authenticated user
    const user = await getSessionUser(context);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { guestId } = await request.json();
    if (!guestId || !guestId.startsWith('guest_')) {
      return new Response(JSON.stringify({ error: 'Invalid guest ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get guest player data
    const guestPlayer = await env.DB.prepare(
      'SELECT * FROM players WHERE id = ? AND is_guest = 1'
    ).bind(guestId).first();

    if (!guestPlayer) {
      return new Response(JSON.stringify({ error: 'Guest not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Migrate data in a transaction
    await env.DB.batch([
      // Transfer coins
      env.DB.prepare(`
        UPDATE players 
        SET coins = coins + ?
        WHERE id = ?
      `).bind(guestPlayer.coins || 0, user.id),

      // Transfer buildings ownership
      env.DB.prepare(`
        UPDATE buildings 
        SET owner_id = ?
        WHERE owner_id = ?
      `).bind(user.id, guestId),

      // Transfer player missions
      env.DB.prepare(`
        UPDATE player_missions 
        SET player_id = ?
        WHERE player_id = ?
      `).bind(user.id, guestId),

      // Delete guest player
      env.DB.prepare('DELETE FROM players WHERE id = ?').bind(guestId),
    ]);

    return new Response(JSON.stringify({ 
      success: true,
      migrated: {
        coins: guestPlayer.coins || 0,
      }
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Migration error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

