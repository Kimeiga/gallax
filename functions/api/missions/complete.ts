import { getSessionUser } from '../auth/session';

// POST /api/missions/complete - Mark mission as complete and claim reward
export async function onRequestPost(context: any) {
  try {
    const user = await getSessionUser(context);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { playerMissionId } = await context.request.json();
    if (!playerMissionId) {
      return new Response(JSON.stringify({ error: 'playerMissionId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = context.env.DB;
    
    // Get player mission with mission details
    const playerMission = await db.prepare(`
      SELECT pm.*, m.reward_coins
      FROM player_missions pm
      JOIN missions m ON pm.mission_id = m.id
      WHERE pm.id = ? AND pm.player_id = ?
    `).bind(playerMissionId, user.id).first();

    if (!playerMission) {
      return new Response(JSON.stringify({ error: 'Mission not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (playerMission.status === 'claimed') {
      return new Response(JSON.stringify({ error: 'Mission already claimed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const now = new Date().toISOString();
    
    // Update mission status and award coins
    await db.batch([
      db.prepare(`
        UPDATE player_missions
        SET status = 'claimed', completed_at = ?, claimed_at = ?
        WHERE id = ?
      `).bind(now, now, playerMissionId),
      
      db.prepare(`
        UPDATE players
        SET coins = coins + ?
        WHERE id = ?
      `).bind(playerMission.reward_coins, user.id),
    ]);

    return new Response(JSON.stringify({ 
      success: true, 
      coinsAwarded: playerMission.reward_coins 
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Error completing mission:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

