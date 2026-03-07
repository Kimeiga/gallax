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
    this.loadWeather();
    this.startWeatherCycle();
  }

  private loadWeather(): void {
    const saved = localStorage.getItem('gallax_current_weather');
    if (saved) {
      const data = JSON.parse(saved);
      this.currentWeather = data.weather || 'clear';
      this.lastWeatherChange = data.lastChange || Date.now();
    }
  }

  private saveWeather(): void {
    localStorage.setItem('gallax_current_weather', JSON.stringify({
      weather: this.currentWeather,
      lastChange: this.lastWeatherChange,
    }));
  }

  private startWeatherCycle(): void {
    setInterval(() => {
      const now = Date.now();
      if (now - this.lastWeatherChange >= this.weatherChangeInterval) {
        this.changeWeather();
      }
    }, 60000); // Check every minute
  }

  private changeWeather(): void {
    const weatherTypes: WeatherType[] = ['clear', 'rain', 'snow', 'fog', 'storm'];
    const weights = [40, 25, 15, 15, 5]; // Clear is most common, storm is rare
    
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < weatherTypes.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        this.currentWeather = weatherTypes[i];
        break;
      }
    }

    this.lastWeatherChange = Date.now();
    this.saveWeather();

    // Notify about weather change
    const effect = this.WEATHER_EFFECTS[this.currentWeather];
    const notificationSystem = (window as any).notificationSystem;
    if (notificationSystem) {
      notificationSystem.show(
        `${effect.emoji} Weather changed to ${effect.name}! ${effect.description}`,
        'info',
        5000
      );
    }
  }

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
    this.saveWeather();
  }
}

export const weatherSystem = new WeatherSystem();

