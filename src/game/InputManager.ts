export class InputManager {
  static keys: Record<string, boolean> = {};
  static virtualJoy: { x: number; y: number } = { x: 0, y: 0 };
  static virtualFire = false;
  static virtualBomb = false;
  static virtualCharge = false;

  // Edge-triggered pause request (keyboard Esc/P, gamepad Start). Kept separate
  // from `keys` so InputManager.reset() can't swallow it.
  private static pauseRequested = false;
  private static prevStartPressed = false;

  static init() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (!e.repeat && (e.code === 'Escape' || e.code === 'KeyP')) {
        this.pauseRequested = true;
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  static reset() {
    this.keys = {};
    this.virtualJoy = { x: 0, y: 0 };
    this.virtualFire = false;
    this.virtualBomb = false;
    this.virtualCharge = false;
  }

  /** Returns true once per pause press (keyboard or gamepad Start). Poll once per frame. */
  static consumePauseToggle(): boolean {
    const gp = this.getGamepad();
    const start = !!(gp && gp.buttons[9] && gp.buttons[9].pressed);
    if (start && !this.prevStartPressed) this.pauseRequested = true;
    this.prevStartPressed = start;

    const requested = this.pauseRequested;
    this.pauseRequested = false;
    return requested;
  }

  static getGamepad(): Gamepad | null {
    if (typeof navigator.getGamepads === 'function') {
      const gamepads = navigator.getGamepads();
      for (const gp of gamepads) {
        if (gp && gp.connected) return gp;
      }
    }
    return null;
  }

  static getAnalogMovement(): { dx: number, dy: number } {
    let dx = 0;
    let dy = 0;

    // 1. Virtual Joystick
    if (this.virtualJoy.x !== 0 || this.virtualJoy.y !== 0) {
      dx = this.virtualJoy.x;
      dy = -this.virtualJoy.y; // invert Y for HTML to THREE
    }

    // 2. Gamepad
    const gp = this.getGamepad();
    if (gp && gp.axes.length >= 2) {
      const ax = gp.axes[0];
      const ay = gp.axes[1]; // Gamepad Y is typically down-positive
      if (Math.abs(ax) > 0.1 || Math.abs(ay) > 0.1) {
        dx = ax;
        dy = -ay; // invert Y
      }
    }

    return { dx, dy };
  }

  static isActionPressed(action: 'up' | 'down' | 'left' | 'right' | 'fire' | 'bomb' | 'charge'): boolean {
    const gp = this.getGamepad();
    
    switch (action) {
      case 'up':
        return this.keys['ArrowUp'] || this.keys['KeyW'] || (gp && gp.buttons[12] && gp.buttons[12].pressed) || false;
      case 'down':
        return this.keys['ArrowDown'] || this.keys['KeyS'] || (gp && gp.buttons[13] && gp.buttons[13].pressed) || false;
      case 'left':
        return this.keys['ArrowLeft'] || this.keys['KeyA'] || (gp && gp.buttons[14] && gp.buttons[14].pressed) || false;
      case 'right':
        return this.keys['ArrowRight'] || this.keys['KeyD'] || (gp && gp.buttons[15] && gp.buttons[15].pressed) || false;
      case 'fire':
        return this.keys['Space'] || this.virtualFire || (gp && gp.buttons[0] && gp.buttons[0].pressed) || (gp && gp.buttons[7] && gp.buttons[7].pressed) || false;
      case 'charge':
        return this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.virtualCharge || (gp && gp.buttons[2] && gp.buttons[2].pressed) || false;
      case 'bomb':
        return this.keys['ControlLeft'] || this.keys['ControlRight'] || this.virtualBomb || (gp && gp.buttons[1] && gp.buttons[1].pressed) || false;
      default:
        return false;
    }
  }
}
