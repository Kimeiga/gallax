export interface PublicSpace {
  id: string;
  name: string;
  lng: number;
  lat: number;
  radius: number;
  description: string;
}

export interface Mission {
  id: string;
  space_id: string;
  title: string;
  description: string;
  type: string;
  objective: string; // JSON string
  reward_coins: number;
}

export interface PlayerMission {
  id: string;
  mission_id: string;
  status: 'active' | 'completed' | 'claimed';
  progress: string; // JSON string
  started_at: string;
  completed_at?: string;
  title: string;
  description: string;
  type: string;
  objective: string;
  reward_coins: number;
  space_id: string;
  space_name: string;
}

class MissionsAPI {
  private baseUrl = '/api/missions';

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };

    // Add guest ID header if user is a guest
    const guestId = localStorage.getItem('gallax_guest_id');
    if (guestId) {
      headers['X-Guest-ID'] = guestId;
    }

    return headers;
  }

  async getPublicSpaces(): Promise<PublicSpace[]> {
    const res = await fetch(`${this.baseUrl}/spaces`);
    if (!res.ok) throw new Error('Failed to fetch public spaces');
    return res.json();
  }

  async getAvailableMissions(spaceId: string): Promise<Mission[]> {
    const res = await fetch(`${this.baseUrl}/available?spaceId=${spaceId}`);
    if (!res.ok) throw new Error('Failed to fetch missions');
    return res.json();
  }

  async getPlayerMissions(): Promise<PlayerMission[]> {
    const res = await fetch(`${this.baseUrl}/player`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      // Return empty array if not authenticated (401) instead of throwing
      if (res.status === 401) {
        return [];
      }
      throw new Error('Failed to fetch player missions');
    }
    return res.json();
  }

  async acceptMission(missionId: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/player`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ missionId }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Failed to accept mission:', res.status, errorData);
      return false;
    }
    const data = await res.json();
    return data.success;
  }

  async completeMission(playerMissionId: string): Promise<{ success: boolean; coinsAwarded?: number }> {
    const res = await fetch(`${this.baseUrl}/complete`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ playerMissionId }),
    });
    if (!res.ok) return { success: false };
    return res.json();
  }
}

export const missionsAPI = new MissionsAPI();

