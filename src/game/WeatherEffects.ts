// Visual weather effects rendered as an HTML/CSS overlay
// No PixiJS dependency - pure DOM + CSS animations

const STYLE_ID = 'weather-effects-styles';
const CONTAINER_ID = 'weather-effects-container';

const RAIN_COUNT = 70;
const SNOW_COUNT = 45;
const CLOUD_COUNT = 4;

export class WeatherEffects {
  private container: HTMLDivElement;
  private tintOverlay: HTMLDivElement;
  private particleContainer: HTMLDivElement;
  private currentEffect: string = 'clear';
  private styleElement: HTMLStyleElement;

  constructor() {
    this.injectStyles();
    this.container = this.createContainer();
    this.tintOverlay = this.createTintOverlay();
    this.particleContainer = this.createParticleContainer();
    this.container.appendChild(this.tintOverlay);
    this.container.appendChild(this.particleContainer);
    document.body.appendChild(this.container);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  setWeather(type: string): void {
    if (type === this.currentEffect) return;

    // Fade out current effects
    this.container.style.opacity = '0';

    setTimeout(() => {
      this.clearParticles();
      this.applyEffect(type);
      this.currentEffect = type;
      // Fade in new effects
      this.container.style.opacity = '1';
    }, 500); // half of the 1s transition
  }

  clear(): void {
    this.setWeather('clear');
  }

  getCurrentEffect(): string {
    return this.currentEffect;
  }

  // ---------------------------------------------------------------------------
  // Container setup
  // ---------------------------------------------------------------------------

  private createContainer(): HTMLDivElement {
    // Remove existing if present (hot-reload safety)
    const existing = document.getElementById(CONTAINER_ID);
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.id = CONTAINER_ID;
    Object.assign(el.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '3',
      overflow: 'hidden',
      transition: 'opacity 0.5s ease',
      opacity: '1',
    } as Partial<CSSStyleDeclaration>);
    return el;
  }

  private createTintOverlay(): HTMLDivElement {
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      transition: 'background 0.5s ease',
    } as Partial<CSSStyleDeclaration>);
    return el;
  }

  private createParticleContainer(): HTMLDivElement {
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
    } as Partial<CSSStyleDeclaration>);
    return el;
  }

  // ---------------------------------------------------------------------------
  // CSS keyframe injection
  // ---------------------------------------------------------------------------

  private injectStyles(): void {
    const existing = document.getElementById(STYLE_ID);
    if (existing) {
      this.styleElement = existing as HTMLStyleElement;
      return;
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* ---- Rain ---- */
      @keyframes we-rain-fall {
        0% {
          transform: translate(0, -20px) rotate(20deg);
          opacity: 0;
        }
        10% {
          opacity: 1;
        }
        90% {
          opacity: 1;
        }
        100% {
          transform: translate(-30px, 105vh) rotate(20deg);
          opacity: 0;
        }
      }

      .we-raindrop {
        position: absolute;
        top: 0;
        background: linear-gradient(to bottom, rgba(180, 200, 255, 0.5), rgba(255, 255, 255, 0.2));
        border-radius: 0 0 2px 2px;
        pointer-events: none;
        will-change: transform;
        animation-name: we-rain-fall;
        animation-timing-function: linear;
        animation-iteration-count: infinite;
      }

      /* ---- Snow ---- */
      @keyframes we-snow-fall {
        0% {
          transform: translate(0, -10px);
          opacity: 0;
        }
        10% {
          opacity: 1;
        }
        90% {
          opacity: 1;
        }
        100% {
          transform: translate(0, 105vh);
          opacity: 0;
        }
      }

      @keyframes we-snow-sway {
        0%, 100% {
          margin-left: 0;
        }
        25% {
          margin-left: 15px;
        }
        75% {
          margin-left: -15px;
        }
      }

      .we-snowflake {
        position: absolute;
        top: 0;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.85);
        pointer-events: none;
        will-change: transform, margin-left;
        animation-timing-function: linear;
        animation-iteration-count: infinite;
      }

      /* ---- Clouds ---- */
      @keyframes we-cloud-drift {
        0% {
          transform: translateX(100vw);
        }
        100% {
          transform: translateX(-250px);
        }
      }

      .we-cloud {
        position: absolute;
        pointer-events: none;
        will-change: transform;
        animation-name: we-cloud-drift;
        animation-timing-function: linear;
        animation-iteration-count: infinite;
        user-select: none;
        line-height: 1;
      }

      /* ---- Fog ---- */
      @keyframes we-fog-pulse {
        0%, 100% {
          opacity: 0.6;
        }
        50% {
          opacity: 1;
        }
      }

      .we-fog-vignette {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        will-change: opacity;
        animation: we-fog-pulse 6s ease-in-out infinite;
      }

      /* ---- Storm (enhanced rain) ---- */
      @keyframes we-storm-flash {
        0%, 90%, 100% {
          opacity: 0;
        }
        92% {
          opacity: 0.3;
        }
        94% {
          opacity: 0;
        }
        96% {
          opacity: 0.15;
        }
      }

      .we-storm-flash {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: white;
        pointer-events: none;
        animation: we-storm-flash 8s ease-in-out infinite;
      }
    `;
    document.head.appendChild(style);
    this.styleElement = style;
  }

  // ---------------------------------------------------------------------------
  // Effect application
  // ---------------------------------------------------------------------------

  private applyEffect(type: string): void {
    switch (type) {
      case 'rain':
        this.applyRain();
        break;
      case 'snow':
        this.applySnow();
        break;
      case 'cloudy':
      case 'overcast':
        this.applyClouds();
        break;
      case 'fog':
        this.applyFog();
        break;
      case 'storm':
        this.applyStorm();
        break;
      case 'clear':
      case 'sunny':
      default:
        this.tintOverlay.style.background = 'transparent';
        break;
    }
  }

  // ---- Rain ----------------------------------------------------------------

  private applyRain(): void {
    this.tintOverlay.style.background = 'rgba(0, 20, 60, 0.15)';

    for (let i = 0; i < RAIN_COUNT; i++) {
      const drop = document.createElement('div');
      drop.className = 'we-raindrop';

      const width = 1 + Math.random();       // 1-2px
      const height = 10 + Math.random() * 10; // 10-20px
      const left = Math.random() * 100;       // 0-100%
      const duration = 0.6 + Math.random() * 0.6; // 0.6-1.2s
      const delay = Math.random() * duration * -1;  // negative so they start staggered
      const opacity = 0.3 + Math.random() * 0.2;    // 0.3-0.5

      Object.assign(drop.style, {
        left: `${left}%`,
        width: `${width}px`,
        height: `${height}px`,
        opacity: `${opacity}`,
        animationDuration: `${duration}s`,
        animationDelay: `${delay}s`,
      });

      this.particleContainer.appendChild(drop);
    }
  }

  // ---- Snow ----------------------------------------------------------------

  private applySnow(): void {
    this.tintOverlay.style.background = 'rgba(200, 200, 220, 0.1)';

    for (let i = 0; i < SNOW_COUNT; i++) {
      const flake = document.createElement('div');
      flake.className = 'we-snowflake';

      const size = 2 + Math.random() * 3;         // 2-5px
      const left = Math.random() * 100;            // 0-100%
      const fallDuration = 5 + Math.random() * 7;  // 5-12s (slow gentle fall)
      const swayDuration = 3 + Math.random() * 4;  // 3-7s
      const delay = Math.random() * fallDuration * -1;
      const opacity = 0.5 + Math.random() * 0.4;   // 0.5-0.9

      Object.assign(flake.style, {
        left: `${left}%`,
        width: `${size}px`,
        height: `${size}px`,
        opacity: `${opacity}`,
        animationName: 'we-snow-fall, we-snow-sway',
        animationDuration: `${fallDuration}s, ${swayDuration}s`,
        animationDelay: `${delay}s, ${delay}s`,
      });

      this.particleContainer.appendChild(flake);
    }
  }

  // ---- Clouds --------------------------------------------------------------

  private applyClouds(): void {
    this.tintOverlay.style.background = 'transparent';

    for (let i = 0; i < CLOUD_COUNT; i++) {
      const cloud = document.createElement('div');
      cloud.className = 'we-cloud';

      const size = 100 + Math.random() * 100;     // 100-200px
      const top = 5 + Math.random() * 40;          // 5-45% from top
      const duration = 40 + Math.random() * 40;    // 40-80s (very slow drift)
      const delay = Math.random() * duration * -1;
      const opacity = 0.1 + Math.random() * 0.05;  // 0.1-0.15

      Object.assign(cloud.style, {
        top: `${top}%`,
        fontSize: `${size}px`,
        opacity: `${opacity}`,
        animationDuration: `${duration}s`,
        animationDelay: `${delay}s`,
      });

      cloud.textContent = '\u2601\uFE0F'; // cloud emoji

      this.particleContainer.appendChild(cloud);
    }
  }

  // ---- Fog -----------------------------------------------------------------

  private applyFog(): void {
    this.tintOverlay.style.background = 'transparent';

    const vignette = document.createElement('div');
    vignette.className = 'we-fog-vignette';
    vignette.style.background =
      'radial-gradient(ellipse at center, transparent 40%, rgba(220, 220, 230, 0.35) 100%)';

    this.particleContainer.appendChild(vignette);
  }

  // ---- Storm (heavy rain + lightning flashes) ------------------------------

  private applyStorm(): void {
    this.tintOverlay.style.background = 'rgba(0, 10, 40, 0.25)';

    // Heavy rain (full 80 particles, faster)
    for (let i = 0; i < 80; i++) {
      const drop = document.createElement('div');
      drop.className = 'we-raindrop';

      const width = 1 + Math.random() * 1.2;
      const height = 12 + Math.random() * 12;
      const left = Math.random() * 100;
      const duration = 0.4 + Math.random() * 0.4; // faster than normal rain
      const delay = Math.random() * duration * -1;
      const opacity = 0.35 + Math.random() * 0.25;

      Object.assign(drop.style, {
        left: `${left}%`,
        width: `${width}px`,
        height: `${height}px`,
        opacity: `${opacity}`,
        animationDuration: `${duration}s`,
        animationDelay: `${delay}s`,
      });

      this.particleContainer.appendChild(drop);
    }

    // Lightning flash overlay
    const flash = document.createElement('div');
    flash.className = 'we-storm-flash';
    // Randomize animation offset so flashes aren't synchronized across sessions
    flash.style.animationDelay = `${Math.random() * -8}s`;
    this.particleContainer.appendChild(flash);
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  private clearParticles(): void {
    this.particleContainer.innerHTML = '';
    this.tintOverlay.style.background = 'transparent';
  }
}
