// UI Layout Manager - prevents overlapping UI elements
// Standardizes z-index tiers and manages modal stacking

export enum UIZone {
  TOP_LEFT = 'top-left',
  TOP_RIGHT = 'top-right',
  BOTTOM_LEFT = 'bottom-left',
  BOTTOM_RIGHT = 'bottom-right',
  BOTTOM_CENTER = 'bottom-center',
  CENTER = 'center',
}

export enum ZTier {
  GAME = 0,
  HUD = 100,
  PANELS = 200,
  FLOATING = 300,
  OVERLAY = 1000,
  DIALOGUE = 5000,
  MODAL = 9000,
  CRITICAL = 9500,
}

interface UIElement {
  id: string;
  zone: UIZone;
  tier: ZTier;
  visible: boolean;
  isModal: boolean;
}

export class UILayoutManager {
  private elements: Map<string, UIElement> = new Map();
  private modalStack: string[] = [];

  // Register a UI element
  register(id: string, zone: UIZone, tier: ZTier, isModal = false): void {
    this.elements.set(id, { id, zone, tier, visible: false, isModal });
  }

  // Show an element
  show(id: string): void {
    const el = this.elements.get(id);
    if (el) {
      el.visible = true;
    }
  }

  // Hide an element
  hide(id: string): void {
    const el = this.elements.get(id);
    if (el) {
      el.visible = false;
      if (el.isModal) {
        this.modalStack = this.modalStack.filter(m => m !== id);
      }
    }
  }

  // Check if element is visible
  isVisible(id: string): boolean {
    return this.elements.get(id)?.visible ?? false;
  }

  // Get all visible elements in a zone
  getVisibleInZone(zone: UIZone): UIElement[] {
    return [...this.elements.values()].filter(el => el.zone === zone && el.visible);
  }

  // Show a modal (hides any other modal at same tier or lower)
  showModal(id: string): void {
    const el = this.elements.get(id);
    if (!el || !el.isModal) return;

    // Hide other modals at same tier
    for (const otherId of this.modalStack) {
      const other = this.elements.get(otherId);
      if (other && other.tier <= el.tier) {
        other.visible = false;
        const domEl = document.getElementById(otherId);
        if (domEl) domEl.style.display = 'none';
      }
    }

    // Remove hidden modals from stack
    this.modalStack = this.modalStack.filter(m => this.elements.get(m)?.visible ?? false);

    // Show this modal
    el.visible = true;
    this.modalStack.push(id);
    const domEl = document.getElementById(id);
    if (domEl) domEl.style.display = 'block';
  }

  // Hide a modal
  hideModal(id: string): void {
    this.hide(id);
    const domEl = document.getElementById(id);
    if (domEl) domEl.style.display = 'none';
  }

  // Get z-index for a tier with optional offset
  getZIndex(tier: ZTier, offset = 0): number {
    return tier + offset;
  }

  // Check if any modal is currently shown
  hasActiveModal(): boolean {
    return this.modalStack.length > 0;
  }

  // Get current active modal ID
  getActiveModal(): string | null {
    return this.modalStack.length > 0 ? this.modalStack[this.modalStack.length - 1] : null;
  }

  // Hide all modals
  hideAllModals(): void {
    for (const id of [...this.modalStack]) {
      this.hideModal(id);
    }
  }
}

export const uiLayout = new UILayoutManager();
