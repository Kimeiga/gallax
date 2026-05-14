// Toast notification system
export type NotificationType = 'success' | 'info' | 'warning' | 'error' | 'xp' | 'levelup' | 'coin';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration: number;
}

export class NotificationSystem {
  private container: HTMLElement | null = null;
  private notifications: Map<string, HTMLElement> = new Map();

  init(): void {
    // Create notification container
    this.container = document.createElement('div');
    this.container.id = 'notification-container';
    this.container.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      pointer-events: none;
    `;
    document.body.appendChild(this.container);
  }

  show(message: string, type: NotificationType = 'info', duration: number = 3000): void {
    if (!this.container) this.init();

    const id = `notif-${Date.now()}-${Math.random()}`;
    const notif = document.createElement('div');
    notif.className = `notification notification-${type}`;
    
    notif.innerHTML = `<span class="notif-text">${message}</span>`;

    notif.style.cssText = `
      background: rgba(30, 30, 40, 0.7);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.08);
      color: white;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      animation: slideIn 0.3s ease-out;
      pointer-events: auto;
      max-width: 250px;
    `;

    this.container?.appendChild(notif);
    this.notifications.set(id, notif);

    // Auto-remove after duration
    setTimeout(() => {
      notif.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => {
        notif.remove();
        this.notifications.delete(id);
      }, 300);
    }, duration);
  }

  private getEmoji(type: NotificationType): string {
    const emojis: Record<NotificationType, string> = {
      success: '✅',
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      xp: '⭐',
      levelup: '🎉',
      coin: '💰',
    };
    return emojis[type] || 'ℹ️';
  }

  private getBackground(type: NotificationType): string {
    const colors: Record<NotificationType, string> = {
      success: '#10b981',
      info: '#3b82f6',
      warning: '#f59e0b',
      error: '#ef4444',
      xp: '#8b5cf6',
      levelup: '#ec4899',
      coin: '#f59e0b',
    };
    return colors[type] || '#3b82f6';
  }

  private activeXP: { el: HTMLElement; total: number; timer: number } | null = null;

  showXP(amount: number): void {
    // Collapse: if there's already an XP notification, add to it
    if (this.activeXP && this.activeXP.el.parentElement) {
      this.activeXP.total += amount;
      const text = this.activeXP.el.querySelector('.notif-text');
      if (text) text.textContent = `+${this.activeXP.total} XP`;
      // Bump animation
      this.activeXP.el.style.transform = 'scale(1.05)';
      setTimeout(() => { if (this.activeXP) this.activeXP.el.style.transform = ''; }, 100);
      // Reset dismiss timer
      clearTimeout(this.activeXP.timer);
      this.activeXP.timer = window.setTimeout(() => {
        if (this.activeXP) {
          this.activeXP.el.style.animation = 'slideOut 0.3s ease-out';
          setTimeout(() => { this.activeXP?.el.remove(); this.activeXP = null; }, 300);
        }
      }, 2000);
      return;
    }

    // Create new XP notification
    if (!this.container) this.init();
    const notif = document.createElement('div');
    notif.className = 'notification notification-xp';
    notif.innerHTML = `<span class="notif-text">+${amount} XP</span>`;
    notif.style.cssText = `
      background: rgba(30, 30, 40, 0.7);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.08);
      color: #fbbf24; padding: 6px 12px; border-radius: 8px;
      font-size: 12px;
      animation: slideIn 0.3s ease-out; pointer-events: auto; max-width: 250px;
      transition: transform 0.1s;
    `;
    this.container?.appendChild(notif);

    const timer = window.setTimeout(() => {
      notif.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => { notif.remove(); this.activeXP = null; }, 300);
    }, 2000);

    this.activeXP = { el: notif, total: amount, timer };
  }

  showLevelUp(level: number): void {
    this.show(`Level Up! You are now level ${level}!`, 'levelup', 4000);
  }

  showCoins(amount: number): void {
    this.show(`+${amount} Coins`, 'coin', 2000);
  }
}

export const notificationSystem = new NotificationSystem();

