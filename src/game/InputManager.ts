export class InputManager {
  private keys: Set<string> = new Set();
  private touchDirection = { x: 0, y: 0 };
  private joystickActive = false;
  private joystickCenter = { x: 0, y: 0 };

  constructor() {
    this.setupKeyboard();
    this.setupTouch();
  }

  private setupKeyboard(): void {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
  }

  private setupTouch(): void {
    const joystickZone = document.getElementById('joystick-zone');
    if (!joystickZone) return;

    joystickZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = joystickZone.getBoundingClientRect();
      this.joystickCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
      this.joystickActive = true;
      this.updateTouchDirection(touch.clientX, touch.clientY);
    });

    joystickZone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!this.joystickActive) return;
      const touch = e.touches[0];
      this.updateTouchDirection(touch.clientX, touch.clientY);
    });

    joystickZone.addEventListener('touchend', () => {
      this.joystickActive = false;
      this.touchDirection = { x: 0, y: 0 };
    });

    joystickZone.addEventListener('touchcancel', () => {
      this.joystickActive = false;
      this.touchDirection = { x: 0, y: 0 };
    });
  }

  private updateTouchDirection(touchX: number, touchY: number): void {
    const dx = touchX - this.joystickCenter.x;
    const dy = touchY - this.joystickCenter.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = 50; // Max joystick range

    if (distance > 0) {
      const normalizedDistance = Math.min(distance, maxDistance) / maxDistance;
      this.touchDirection = {
        x: (dx / distance) * normalizedDistance,
        y: (dy / distance) * normalizedDistance
      };
    }
  }

  getDirection(): { x: number; y: number } {
    // Keyboard input
    let x = 0;
    let y = 0;

    if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;

    // Normalize diagonal movement
    if (x !== 0 && y !== 0) {
      const len = Math.sqrt(x * x + y * y);
      x /= len;
      y /= len;
    }

    // Combine with touch input (touch takes priority if active)
    if (this.joystickActive) {
      return this.touchDirection;
    }

    return { x, y };
  }

  isKeyPressed(key: string): boolean {
    return this.keys.has(key.toLowerCase());
  }
}

