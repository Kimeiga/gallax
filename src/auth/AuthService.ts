// Auth Service - handles Google OAuth login/logout and user state

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  resources: Record<string, number>;
  lng: number;
  lat: number;
  createdAt: string;
  isGuest?: boolean;
}

export type AuthCallback = (user: User | null) => void;

class AuthService {
  private user: User | null = null;
  private callbacks: AuthCallback[] = [];
  private initialized = false;
  private readonly GUEST_ID_KEY = 'gallax_guest_id';

  async init(): Promise<User | null> {
    if (this.initialized) return this.user;

    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        this.user = await response.json();
        console.log('User authenticated:', this.user?.name);

        // If user just logged in and had a guest ID, migrate data
        const guestId = this.getGuestId();
        if (guestId && !this.user?.isGuest) {
          await this.migrateGuestData(guestId);
          this.clearGuestId();
        }
      } else {
        // Not authenticated - create or use guest account
        this.user = await this.initGuestUser();
        console.log('Guest user:', this.user?.name);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      this.user = await this.initGuestUser();
    }

    this.initialized = true;
    this.notifyCallbacks();
    return this.user;
  }

  private async initGuestUser(): Promise<User> {
    let guestId = this.getGuestId();

    if (!guestId) {
      // Generate new guest ID
      guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      this.setGuestId(guestId);

      // Register guest user with server
      try {
        await fetch('/api/auth/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guestId }),
        });
      } catch (err) {
        console.error('Failed to register guest user:', err);
      }
    }

    return {
      id: guestId,
      email: '',
      name: 'Guest Player',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=guest',
      resources: {},
      lng: -73.965,
      lat: 40.782,
      createdAt: new Date().toISOString(),
      isGuest: true,
    };
  }

  private async migrateGuestData(guestId: string): Promise<void> {
    try {
      console.log('🔄 Migrating guest data to authenticated account...');
      const response = await fetch('/api/auth/migrate-guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId }),
      });

      if (response.ok) {
        console.log('✅ Guest data migrated successfully!');
      } else {
        console.error('Failed to migrate guest data:', await response.text());
      }
    } catch (err) {
      console.error('Migration error:', err);
    }
  }

  private getGuestId(): string | null {
    return localStorage.getItem(this.GUEST_ID_KEY);
  }

  private setGuestId(id: string): void {
    localStorage.setItem(this.GUEST_ID_KEY, id);
  }

  private clearGuestId(): void {
    localStorage.removeItem(this.GUEST_ID_KEY);
  }

  login() {
    window.location.href = '/api/auth/google';
  }

  async logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout failed:', err);
    }
    this.user = null;
    this.notifyCallbacks();
    window.location.reload();
  }

  getUser(): User | null {
    return this.user;
  }

  isAuthenticated(): boolean {
    return this.user !== null && !this.user.isGuest;
  }

  isGuest(): boolean {
    return this.user?.isGuest === true;
  }

  hasUser(): boolean {
    return this.user !== null;
  }

  onAuthChange(callback: AuthCallback) {
    this.callbacks.push(callback);
    // Immediately call with current state if already initialized
    if (this.initialized) {
      callback(this.user);
    }
  }

  private notifyCallbacks() {
    for (const cb of this.callbacks) {
      cb(this.user);
    }
  }
}

// Singleton instance
export const authService = new AuthService();

