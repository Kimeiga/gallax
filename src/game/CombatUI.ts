// Combat HUD overlay for mob encounters
// Renders health bars, ability buttons, damage numbers, and combat banners

export class CombatUI {
  private container: HTMLElement | null = null;
  private mobHealthBar: HTMLElement | null = null;
  private playerHealthBar: HTMLElement | null = null;
  private abilityContainer: HTMLElement | null = null;
  private fleeButton: HTMLElement | null = null;
  private bannerEl: HTMLElement | null = null;

  private abilityButtons: HTMLElement[] = [];
  private abilityCooldownOverlays: HTMLElement[] = [];
  private abilityCallbacks: ((slot: number) => void)[] = [];
  private fleeCallbacks: (() => void)[] = [];

  private mobHpFill: HTMLElement | null = null;
  private mobHpText: HTMLElement | null = null;
  private mobNameEl: HTMLElement | null = null;
  private mobLevelEl: HTMLElement | null = null;
  private playerHpFill: HTMLElement | null = null;
  private playerHpText: HTMLElement | null = null;

  private visible = false;
  private rafId: number | null = null;
  private bannerTimeout: number | null = null;

  private readonly ABILITIES = [
    { emoji: '⚔️', name: 'Power Strike' },
    { emoji: '🛡️', name: 'Block' },
    { emoji: '✨', name: 'Heal' },
  ];

  constructor() {
    this.injectStyles();
    this.createElements();
  }

  // --- Public API ---

  show(
    mobEmoji: string,
    mobName: string,
    mobHp: number,
    mobMaxHp: number,
    playerHp: number,
    playerMaxHp: number
  ): void {
    if (!this.container) return;
    this.visible = true;
    this.container.style.display = 'block';

    // Set mob info
    if (this.mobNameEl) this.mobNameEl.textContent = `${mobEmoji} ${mobName}`;
    this.updateMobHp(mobHp, mobMaxHp);
    this.updatePlayerHp(playerHp, playerMaxHp);

    // Reset ability states
    for (let i = 0; i < 3; i++) {
      this.setAbilityEnabled(i, true);
      this.updateAbilityCooldown(i, 0, 0);
    }

    // Show sub-elements
    if (this.mobHealthBar) this.mobHealthBar.style.display = 'flex';
    if (this.playerHealthBar) this.playerHealthBar.style.display = 'flex';
    if (this.abilityContainer) this.abilityContainer.style.display = 'flex';
    if (this.fleeButton) this.fleeButton.style.display = 'flex';
  }

  hide(): void {
    this.visible = false;
    if (this.container) this.container.style.display = 'none';
    this.stopPositionTracking();
  }

  updateMobHp(current: number, max: number): void {
    const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
    if (this.mobHpFill) {
      this.mobHpFill.style.width = `${pct * 100}%`;
      this.mobHpFill.style.background = this.hpGradient(pct);
    }
    if (this.mobHpText) {
      this.mobHpText.textContent = `${Math.ceil(current)}/${max}`;
    }
  }

  updatePlayerHp(current: number, max: number): void {
    const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
    if (this.playerHpFill) {
      this.playerHpFill.style.width = `${pct * 100}%`;
      this.playerHpFill.style.background = this.hpGradient(pct);
    }
    if (this.playerHpText) {
      this.playerHpText.textContent = `${Math.ceil(current)}/${max}`;
    }
  }

  updateMobPosition(screenX: number, screenY: number): void {
    if (!this.mobHealthBar) return;
    this.mobHealthBar.style.left = `${screenX}px`;
    this.mobHealthBar.style.top = `${screenY - 60}px`;
    this.mobHealthBar.style.transform = 'translateX(-50%)';
  }

  showDamageNumber(
    x: number,
    y: number,
    amount: number,
    target: 'mob' | 'player',
    isCrit: boolean
  ): void {
    const el = document.createElement('div');
    el.className = 'combat-damage-number';
    const critSuffix = isCrit ? ' CRIT!' : '';
    const displayAmount = Math.ceil(amount);

    el.textContent = `${displayAmount}${critSuffix}`;
    el.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      transform: translateX(-50%);
      font-size: ${isCrit ? '28px' : '22px'};
      font-weight: 900;
      color: ${target === 'mob' ? '#ffd700' : '#ff4444'};
      text-shadow: 0 2px 6px rgba(0,0,0,0.7), 0 0 12px ${target === 'mob' ? 'rgba(255,215,0,0.5)' : 'rgba(255,0,0,0.5)'};
      pointer-events: none;
      z-index: 1002;
      animation: combatDmgFloat 0.9s ease-out forwards;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    document.body.appendChild(el);

    setTimeout(() => el.remove(), 950);
  }

  updateAbilityCooldown(slot: number, remainingMs: number, totalMs: number): void {
    const overlay = this.abilityCooldownOverlays[slot];
    if (!overlay) return;

    if (remainingMs <= 0 || totalMs <= 0) {
      overlay.style.display = 'none';
      return;
    }

    const pct = Math.min(1, remainingMs / totalMs);
    // Conic gradient for radial sweep effect
    const deg = pct * 360;
    overlay.style.display = 'block';
    overlay.style.background = `conic-gradient(rgba(0,0,0,0.65) ${deg}deg, transparent ${deg}deg)`;
  }

  setAbilityEnabled(slot: number, enabled: boolean): void {
    const btn = this.abilityButtons[slot];
    if (!btn) return;

    if (enabled) {
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
      btn.style.filter = 'none';
    } else {
      btn.style.opacity = '0.4';
      btn.style.pointerEvents = 'none';
      btn.style.filter = 'grayscale(100%)';
    }
  }

  showBanner(text: string, type: 'fight' | 'victory' | 'defeat'): void {
    if (this.bannerTimeout !== null) {
      clearTimeout(this.bannerTimeout);
      this.bannerTimeout = null;
    }
    if (this.bannerEl) this.bannerEl.remove();

    const colors: Record<string, string> = {
      fight: 'linear-gradient(135deg, #ef4444, #f97316)',
      victory: 'linear-gradient(135deg, #10b981, #fbbf24)',
      defeat: 'linear-gradient(135deg, #6b7280, #374151)',
    };

    const el = document.createElement('div');
    el.className = 'combat-banner';
    el.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.8);
      background: ${colors[type] || colors.fight};
      color: white;
      font-size: 28px;
      font-weight: 900;
      padding: 18px 48px;
      border-radius: 16px;
      z-index: 1003;
      pointer-events: none;
      text-align: center;
      white-space: nowrap;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      text-shadow: 0 2px 6px rgba(0,0,0,0.4);
      animation: combatBannerIn 0.35s ease-out forwards;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    el.textContent = text;
    document.body.appendChild(el);
    this.bannerEl = el;

    const duration = type === 'fight' ? 1500 : 2500;
    this.bannerTimeout = window.setTimeout(() => {
      el.style.animation = 'combatBannerOut 0.4s ease-in forwards';
      setTimeout(() => el.remove(), 450);
      this.bannerEl = null;
      this.bannerTimeout = null;
    }, duration);
  }

  onAbilityClick(callback: (slot: number) => void): void {
    this.abilityCallbacks.push(callback);
  }

  onFleeClick(callback: () => void): void {
    this.fleeCallbacks.push(callback);
  }

  isVisible(): boolean {
    return this.visible;
  }

  // --- Internal ---

  private hpGradient(pct: number): string {
    // Green at full, yellow at half, red at low
    if (pct > 0.5) {
      return `linear-gradient(90deg, #22c55e, #4ade80)`;
    } else if (pct > 0.25) {
      return `linear-gradient(90deg, #f59e0b, #fbbf24)`;
    } else {
      return `linear-gradient(90deg, #dc2626, #ef4444)`;
    }
  }

  private stopPositionTracking(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private injectStyles(): void {
    if (document.getElementById('combat-ui-styles')) return;

    const style = document.createElement('style');
    style.id = 'combat-ui-styles';
    style.textContent = `
      @keyframes combatDmgFloat {
        0% {
          opacity: 1;
          transform: translateX(-50%) translateY(0) scale(1);
        }
        20% {
          transform: translateX(-50%) translateY(-12px) scale(1.15);
        }
        100% {
          opacity: 0;
          transform: translateX(-50%) translateY(-60px) scale(0.8);
        }
      }

      @keyframes combatBannerIn {
        0% {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.6);
        }
        60% {
          transform: translate(-50%, -50%) scale(1.08);
        }
        100% {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1);
        }
      }

      @keyframes combatBannerOut {
        0% {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1);
        }
        100% {
          opacity: 0;
          transform: translate(-50%, -50%) scale(1.2);
        }
      }

      @keyframes combatAbilityPress {
        0% { transform: scale(1); }
        50% { transform: scale(0.88); }
        100% { transform: scale(1); }
      }

      .combat-ability-btn:active {
        animation: combatAbilityPress 0.15s ease-out;
      }

      .combat-ability-btn .combat-tooltip {
        position: absolute;
        right: 62px;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(0,0,0,0.9);
        color: white;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.15s;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      }

      .combat-ability-btn .combat-tooltip::after {
        content: '';
        position: absolute;
        left: 100%;
        top: 50%;
        transform: translateY(-50%);
        border: 5px solid transparent;
        border-left-color: rgba(0,0,0,0.9);
      }

      @media (hover: hover) {
        .combat-ability-btn:hover .combat-tooltip {
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }

  private createElements(): void {
    // Root container (visibility toggled)
    this.container = document.createElement('div');
    this.container.id = 'combat-ui';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1000;
      display: none;
    `;
    document.body.appendChild(this.container);

    this.createMobHealthBar();
    this.createPlayerHealthBar();
    this.createAbilityButtons();
    this.createFleeButton();
  }

  private createMobHealthBar(): void {
    const bar = document.createElement('div');
    bar.style.cssText = `
      position: fixed;
      display: none;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      pointer-events: none;
      z-index: 1001;
      min-width: 120px;
    `;

    // Name + level row
    const nameRow = document.createElement('div');
    nameRow.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(0,0,0,0.75);
      padding: 3px 10px;
      border-radius: 8px 8px 0 0;
      width: 100%;
      justify-content: center;
    `;

    this.mobNameEl = document.createElement('span');
    this.mobNameEl.style.cssText = `
      color: white;
      font-size: 13px;
      font-weight: 700;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    this.mobNameEl.textContent = '';

    this.mobLevelEl = document.createElement('span');
    this.mobLevelEl.style.cssText = `
      color: #fbbf24;
      font-size: 11px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    nameRow.appendChild(this.mobNameEl);
    nameRow.appendChild(this.mobLevelEl);

    // HP bar track
    const track = document.createElement('div');
    track.style.cssText = `
      width: 100%;
      height: 10px;
      background: rgba(0,0,0,0.75);
      border-radius: 0 0 8px 8px;
      overflow: hidden;
      padding: 2px;
    `;

    this.mobHpFill = document.createElement('div');
    this.mobHpFill.style.cssText = `
      height: 100%;
      width: 100%;
      background: linear-gradient(90deg, #22c55e, #4ade80);
      border-radius: 4px;
      transition: width 0.3s ease-out;
    `;
    track.appendChild(this.mobHpFill);

    // HP text
    this.mobHpText = document.createElement('div');
    this.mobHpText.style.cssText = `
      color: rgba(255,255,255,0.9);
      font-size: 11px;
      font-weight: 600;
      text-shadow: 0 1px 3px rgba(0,0,0,0.8);
      margin-top: 1px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    bar.appendChild(nameRow);
    bar.appendChild(track);
    bar.appendChild(this.mobHpText);

    this.mobHealthBar = bar;
    this.container!.appendChild(bar);
  }

  private createPlayerHealthBar(): void {
    const bar = document.createElement('div');
    bar.style.cssText = `
      position: fixed;
      bottom: 150px;
      left: 50%;
      transform: translateX(-50%);
      display: none;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      pointer-events: none;
      z-index: 1001;
      width: 220px;
    `;

    // HP bar track
    const track = document.createElement('div');
    track.style.cssText = `
      width: 100%;
      height: 14px;
      background: rgba(0,0,0,0.75);
      border-radius: 12px;
      overflow: hidden;
      padding: 2px;
      border: 1px solid rgba(255,255,255,0.15);
    `;

    this.playerHpFill = document.createElement('div');
    this.playerHpFill.style.cssText = `
      height: 100%;
      width: 100%;
      background: linear-gradient(90deg, #22c55e, #4ade80);
      border-radius: 10px;
      transition: width 0.3s ease-out;
    `;
    track.appendChild(this.playerHpFill);

    // HP text (overlaid on bar)
    this.playerHpText = document.createElement('div');
    this.playerHpText.style.cssText = `
      color: white;
      font-size: 12px;
      font-weight: 700;
      text-shadow: 0 1px 4px rgba(0,0,0,0.9);
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Wrapper to allow absolute positioning of text over bar
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      position: relative;
      width: 100%;
    `;
    wrapper.appendChild(track);
    wrapper.appendChild(this.playerHpText);

    bar.appendChild(wrapper);

    this.playerHealthBar = bar;
    this.container!.appendChild(bar);
  }

  private createAbilityButtons(): void {
    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed;
      right: 16px;
      top: 50%;
      transform: translateY(-50%);
      display: none;
      flex-direction: column;
      gap: 12px;
      z-index: 1001;
      pointer-events: auto;
    `;

    this.ABILITIES.forEach((ability, slot) => {
      const btn = document.createElement('div');
      btn.className = 'combat-ability-btn';
      btn.style.cssText = `
        position: relative;
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: rgba(0,0,0,0.75);
        border: 2px solid rgba(255,255,255,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 24px;
        user-select: none;
        -webkit-user-select: none;
        transition: border-color 0.15s, background 0.15s, opacity 0.2s, filter 0.2s;
        backdrop-filter: blur(8px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      `;

      // Emoji label
      const emoji = document.createElement('span');
      emoji.style.cssText = `
        pointer-events: none;
        line-height: 1;
      `;
      emoji.textContent = ability.emoji;

      // Cooldown overlay
      const cooldown = document.createElement('div');
      cooldown.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        display: none;
        pointer-events: none;
      `;

      // Tooltip
      const tooltip = document.createElement('div');
      tooltip.className = 'combat-tooltip';
      tooltip.textContent = ability.name;

      btn.appendChild(emoji);
      btn.appendChild(cooldown);
      btn.appendChild(tooltip);

      // Click / touch handling
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        for (const cb of this.abilityCallbacks) cb(slot);
      });

      // Hover effect (desktop)
      btn.addEventListener('mouseenter', () => {
        if (btn.style.opacity !== '0.4') {
          btn.style.borderColor = 'rgba(255,255,255,0.7)';
          btn.style.background = 'rgba(255,255,255,0.15)';
        }
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.borderColor = 'rgba(255,255,255,0.3)';
        btn.style.background = 'rgba(0,0,0,0.75)';
      });

      container.appendChild(btn);
      this.abilityButtons.push(btn);
      this.abilityCooldownOverlays.push(cooldown);
    });

    this.abilityContainer = container;
    this.container!.appendChild(container);
  }

  private createFleeButton(): void {
    const btn = document.createElement('div');
    btn.style.cssText = `
      position: fixed;
      bottom: 150px;
      left: 16px;
      display: none;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 10px 18px;
      min-width: 44px;
      min-height: 44px;
      background: rgba(0,0,0,0.75);
      border: 2px solid rgba(239,68,68,0.5);
      border-radius: 12px;
      color: white;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      pointer-events: auto;
      z-index: 1001;
      backdrop-filter: blur(8px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      transition: background 0.15s, border-color 0.15s;
      user-select: none;
      -webkit-user-select: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    btn.textContent = '🏃 Run';

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      for (const cb of this.fleeCallbacks) cb();
    });

    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(239,68,68,0.3)';
      btn.style.borderColor = 'rgba(239,68,68,0.8)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(0,0,0,0.75)';
      btn.style.borderColor = 'rgba(239,68,68,0.5)';
    });

    this.fleeButton = btn;
    this.container!.appendChild(btn);
  }
}
