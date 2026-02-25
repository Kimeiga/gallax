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
}

export type AuthCallback = (user: User | null) => void;

class AuthService {
  private user: User | null = null;
  private callbacks: AuthCallback[] = [];
  private initialized = false;

  async init(): Promise<User | null> {
    if (this.initialized) return this.user;
    
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        this.user = await response.json();
        console.log('User authenticated:', this.user?.name);
      } else {
        this.user = null;
        console.log('Not authenticated');
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      this.user = null;
    }
    
    this.initialized = true;
    this.notifyCallbacks();
    return this.user;
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

