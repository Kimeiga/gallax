// Dynamic weather system affecting gameplay
export type WeatherType = 'clear' | 'rain' | 'snow' | 'fog' | 'storm';

export interface WeatherEffect {
  type: WeatherType;
  emoji: string;
  name: string;
  description: string;
  resourceBonus?: { type: string; multiplier: number };
  xpMultiplier: number;
}

export class WeatherSystem {
  private currentWeather: WeatherType = 'clear';
  private weatherChangeInterval: number = 10 * 60 * 1000; // 10 minutes
  private lastWeatherChange: number = Date.now();

  private readonly WEATHER_EFFECTS: Record<WeatherType, WeatherEffect> = {
    clear: {
      type: 'clear',
      emoji: '☀️',
      name: 'Clear Skies',
      description: 'Perfect weather for exploring!',
      xpMultiplier: 1.0,
    },
    rain: {
      type: 'rain',
      emoji: '🌧️',
      name: 'Rainy',
      description: 'Fish are more abundant!',
      resourceBonus: { type: 'fish', multiplier: 2.0 },
      xpMultiplier: 1.2,
    },
    snow: {
      type: 'snow',
      emoji: '❄️',
      name: 'Snowy',
      description: 'Gems sparkle in the snow!',
      resourceBonus: { type: 'gem', multiplier: 1.5 },
      xpMultiplier: 1.3,
    },
    fog: {
      type: 'fog',
      emoji: '🌫️',
      name: 'Foggy',
      description: 'Mysterious herbs appear!',
      resourceBonus: { type: 'herb', multiplier: 2.0 },
      xpMultiplier: 1.1,
    },
    storm: {
      type: 'storm',
      emoji: '⛈️',
      name: 'Stormy',
      description: 'Double XP but harder to navigate!',
      xpMultiplier: 2.0,
    },
  };

  constructor() {
    // Always compute weather from current time period (deterministic, synced across all clients)
    this.computeCurrentWeather();
    this.startWeatherCycle();
  }

  // Compute weather deterministically from the current time period
  private computeCurrentWeather(): void {
    const period = Math.floor(Date.now() / this.weatherChangeInterval);
    const weatherTypes: WeatherType[] = ['clear', 'rain', 'snow', 'fog', 'storm'];
    const weights = [40, 25, 15, 15, 5];
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = this.seededRandom(period) * totalWeight;

    for (let i = 0; i < weatherTypes.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        this.currentWeather = weatherTypes[i];
        break;
      }
    }
    this.lastWeatherChange = period * this.weatherChangeInterval;
  }

  private startWeatherCycle(): void {
    setInterval(() => {
      const prevWeather = this.currentWeather;
      this.computeCurrentWeather();

      // Notify on weather change
      if (prevWeather !== this.currentWeather) {
        const effect = this.WEATHER_EFFECTS[this.currentWeather];
        const notificationSystem = (window as any).notificationSystem;
        if (notificationSystem) {
          notificationSystem.show(
            `${effect.emoji} Weather changed to ${effect.name}! ${effect.description}`,
            'info', 5000
          );
        }
      }
    }, 60000);
  }

  // Seeded random so all players get the same weather at the same time
  private seededRandom(seed: number): number {
    let t = seed + 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  // changeWeather removed - now computed deterministically in computeCurrentWeather()

  getCurrentWeather(): WeatherEffect {
    return this.WEATHER_EFFECTS[this.currentWeather];
  }

  getXPMultiplier(): number {
    return this.WEATHER_EFFECTS[this.currentWeather].xpMultiplier;
  }

  getResourceMultiplier(resourceType: string): number {
    const effect = this.WEATHER_EFFECTS[this.currentWeather];
    if (effect.resourceBonus && effect.resourceBonus.type === resourceType) {
      return effect.resourceBonus.multiplier;
    }
    return 1.0;
  }

  forceWeatherChange(weather: WeatherType): void {
    this.currentWeather = weather;
    this.lastWeatherChange = Date.now();
  }
}

export const weatherSystem = new WeatherSystem();

