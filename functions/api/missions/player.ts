import { getSessionUser } from '../auth/session';

// GET /api/missions/player - Get player's active missions
// POST /api/missions/player - Accept a new mission
export async function onRequestGet(context: any) {
  try {
    const user = await getSessionUser(context);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = context.env.DB;
    const { results } = await db.prepare(`
      SELECT 
        pm.id,
        pm.mission_id,
        pm.status,
        pm.progress,
        pm.started_at,
        pm.completed_at,
        m.title,
        m.description,
        m.type,
        m.objective,
        m.reward_coins,
        m.space_id,
        ps.name as space_name
      FROM player_missions pm
      JOIN missions m ON pm.mission_id = m.id
      JOIN public_spaces ps ON m.space_id = ps.id
      WHERE pm.player_id = ?
      ORDER BY pm.started_at DESC
    `).bind(user.id).all();

    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Error fetching player missions:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestPost(context: any) {
  try {
    const user = await getSessionUser(context);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { missionId } = await context.request.json();
    if (!missionId) {
      return new Response(JSON.stringify({ error: 'missionId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = context.env.DB;
    
    // Check if mission exists
    const mission = await db.prepare('SELECT * FROM missions WHERE id = ?').bind(missionId).first();
    if (!mission) {
      return new Response(JSON.stringify({ error: 'Mission not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if player already has this mission
    const existing = await db.prepare(
      'SELECT * FROM player_missions WHERE player_id = ? AND mission_id = ? AND status != ?'
    ).bind(user.id, missionId, 'claimed').first();

    if (existing) {
      return new Response(JSON.stringify({ error: 'Mission already accepted' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create player mission
    const id = `pm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    await db.prepare(`
      INSERT INTO player_missions (id, player_id, mission_id, status, progress)
      VALUES (?, ?, ?, 'active', '{}')
    `).bind(id, user.id, missionId).run();

    return new Response(JSON.stringify({ success: true, id }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Error accepting mission:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

