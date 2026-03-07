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
      top: 80px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    `;
    document.body.appendChild(this.container);
  }

  show(message: string, type: NotificationType = 'info', duration: number = 3000): void {
    if (!this.container) this.init();

    const id = `notif-${Date.now()}-${Math.random()}`;
    const notif = document.createElement('div');
    notif.className = `notification notification-${type}`;
    
    const emoji = this.getEmoji(type);
    notif.innerHTML = `<span class="notif-emoji">${emoji}</span><span class="notif-text">${message}</span>`;
    
    notif.style.cssText = `
      background: ${this.getBackground(type)};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      font-size: 14px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 10px;
      animation: slideIn 0.3s ease-out;
      pointer-events: auto;
      max-width: 300px;
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

  showXP(amount: number): void {
    this.show(`+${amount} XP`, 'xp', 2000);
  }

  showLevelUp(level: number): void {
    this.show(`Level Up! You are now level ${level}!`, 'levelup', 4000);
  }

  showCoins(amount: number): void {
    this.show(`+${amount} Coins`, 'coin', 2000);
  }
}

export const notificationSystem = new NotificationSystem();

