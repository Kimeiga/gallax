// Performance management for mobile and zoom-out optimization

export interface PerformanceConfig {
  // Zoom thresholds
  minZoomForEntities: number;      // Below this, hide all entities
  minZoomForMovement: number;      // Below this, freeze entity movement
  minZoomForSpawning: number;      // Below this, don't spawn new entities
  
  // Entity limits
  maxNPCs: number;
  maxWaterEntities: number;
  maxTerrainEntities: number;
  maxResources: number;
  
  // Update throttling
  updateInterval: number;          // ms between entity updates
  
  // Mobile adjustments
  isMobile: boolean;
  mobileMultiplier: number;        // Reduce limits on mobile
}

export class PerformanceManager {
  private config: PerformanceConfig;
  private lastUpdateTime: number = 0;
  
  constructor() {
    const isMobile = this.detectMobile();
    const mobileMultiplier = isMobile ? 0.4 : 1.0;
    
    this.config = {
      minZoomForEntities: 12,
      minZoomForMovement: 14,
      minZoomForSpawning: 13,
      
      maxNPCs: Math.floor(100 * mobileMultiplier),
      maxWaterEntities: Math.floor(80 * mobileMultiplier),
      maxTerrainEntities: Math.floor(60 * mobileMultiplier),
      maxResources: Math.floor(200 * mobileMultiplier),
      
      updateInterval: isMobile ? 50 : 16,
      
      isMobile,
      mobileMultiplier,
    };
    
    console.log(`📱 Performance: mobile=${isMobile}, limits multiplier=${mobileMultiplier}`);
  }
  
  private detectMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth < 768 ||
           'ontouchstart' in window;
  }
  
  getConfig(): PerformanceConfig {
    return this.config;
  }
  
  // Check if entities should be visible at current zoom
  shouldShowEntities(zoom: number): boolean {
    return zoom >= this.config.minZoomForEntities;
  }
  
  // Check if entity movement should be updated
  shouldUpdateMovement(zoom: number): boolean {
    return zoom >= this.config.minZoomForMovement;
  }
  
  // Check if we should spawn new entities
  shouldSpawnEntities(zoom: number): boolean {
    return zoom >= this.config.minZoomForSpawning;
  }
  
  // Check if it's time for an update (throttling)
  shouldUpdate(): boolean {
    const now = performance.now();
    if (now - this.lastUpdateTime >= this.config.updateInterval) {
      this.lastUpdateTime = now;
      return true;
    }
    return false;
  }
  
  // Check entity limits
  canSpawnNPC(currentCount: number): boolean {
    return currentCount < this.config.maxNPCs;
  }
  
  canSpawnWaterEntity(currentCount: number): boolean {
    return currentCount < this.config.maxWaterEntities;
  }
  
  canSpawnTerrainEntity(currentCount: number): boolean {
    return currentCount < this.config.maxTerrainEntities;
  }
  
  canSpawnResource(currentCount: number): boolean {
    return currentCount < this.config.maxResources;
  }
  
  isMobile(): boolean {
    return this.config.isMobile;
  }
}

// Singleton instance
let performanceManagerInstance: PerformanceManager | null = null;

export function getPerformanceManager(): PerformanceManager {
  if (!performanceManagerInstance) {
    performanceManagerInstance = new PerformanceManager();
  }
  return performanceManagerInstance;
}

