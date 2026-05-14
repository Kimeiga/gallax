// Buildings API - sync buildings with D1 database

export interface Building {
  id: string;
  type: string;
  lng: number;
  lat: number;
  rotation: number;
  owner_id: string;
  owner_name?: string;
  created_at: string;
}

class BuildingsAPI {
  // Get auth headers and fetch options (includes guest ID + credentials for session cookies)
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const guestId = localStorage.getItem('gallax_guest_id');
    if (guestId) {
      headers['X-Guest-ID'] = guestId;
    }
    return headers;
  }

  private getFetchOpts(): { headers: Record<string, string>; credentials: RequestCredentials } {
    return { headers: this.getAuthHeaders(), credentials: 'include' };
  }

  // Fetch all buildings from D1
  async getAll(): Promise<Building[]> {
    try {
      const response = await fetch('/api/buildings', {
        ...this.getFetchOpts(),
      });
      if (!response.ok) {
        console.error('Failed to fetch buildings:', response.status);
        return [];
      }
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        console.error('Failed to fetch buildings: not JSON response');
        return [];
      }
      return await response.json();
    } catch (err) {
      console.error('Failed to fetch buildings:', err);
      return [];
    }
  }

  // Save a new building to D1
  async create(building: { id: string; type: string; lng: number; lat: number; rotation?: number }): Promise<boolean> {
    try {
      const response = await fetch('/api/buildings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() }, credentials: 'include' as RequestCredentials,
        body: JSON.stringify(building),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        console.error('Failed to create building:', data.error || response.status);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Failed to create building:', err);
      return false;
    }
  }

  // Update building position/rotation in D1
  async update(buildingId: string, updates: { lng?: number; lat?: number; rotation?: number }): Promise<boolean> {
    try {
      const response = await fetch(`/api/buildings/${buildingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() }, credentials: 'include' as RequestCredentials,
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        console.error('Failed to update building:', data.error || response.status);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Failed to update building:', err);
      return false;
    }
  }

  // Delete a building from D1
  async delete(buildingId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/buildings/${buildingId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        console.error('Failed to delete building:', data.error || response.status);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Failed to delete building:', err);
      return false;
    }
  }
}

export const buildingsAPI = new BuildingsAPI();

