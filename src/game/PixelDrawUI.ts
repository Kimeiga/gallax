// Pixel Drawing UI - r/place-style drawing toolbar for placing pixels on the map
import Pickr from '@simonwep/pickr';
import '@simonwep/pickr/dist/themes/nano.min.css';

export class PixelDrawUI {
  private pickrInstance: Pickr | null = null;
  private toggleButton: HTMLElement | null = null;
  private toolbar: HTMLElement | null = null;
  private pixelInfoTooltip: HTMLElement | null = null;

  private colorSwatches: HTMLElement[] = [];
  private pencilButton: HTMLElement | null = null;
  private eraserButton: HTMLElement | null = null;
  private gridCheckbox: HTMLInputElement | null = null;
  private pixelCountEl: HTMLElement | null = null;

  private selectedColor = '#000000';
  private selectedTool: 'pencil' | 'eraser' = 'pencil';
  private brushSize: number = 1; // 1, 2, or 3
  private gridVisible = false;
  private visible = false;

  private toggleDrawModeCallbacks: ((active: boolean) => void)[] = [];
  private colorChangeCallbacks: ((color: string) => void)[] = [];
  private toolChangeCallbacks: ((tool: 'pencil' | 'eraser') => void)[] = [];
  private undoCallbacks: (() => void)[] = [];
  private gridToggleCallbacks: ((visible: boolean) => void)[] = [];

  private readonly COLORS = [
    '#000000', '#ffffff', '#ff0000', '#ff8800',
    '#ffff00', '#00cc00', '#0066ff', '#9933ff',
    '#ff66cc', '#884400', '#888888', '#66ccff',
    '#88ff00', '#00ffcc', '#ff00ff', '#ffcc88',
  ];

  constructor() {
    this.injectStyles();
    this.createToggleButton();
    this.createToolbar();
    this.createPixelInfoTooltip();
  }

  // --- Public API ---

  show(): void {
    if (this.visible) return;
    this.visible = true;
    if (this.toolbar) {
      this.toolbar.style.display = 'flex';
      this.toolbar.style.animation = 'pixelDrawSlideUp 0.25s ease-out forwards';
    }
    this.updateToggleButtonState();
    for (const cb of this.toggleDrawModeCallbacks) cb(true);
  }

  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    if (this.toolbar) {
      this.toolbar.style.animation = 'pixelDrawSlideDown 0.2s ease-in forwards';
      setTimeout(() => {
        if (!this.visible && this.toolbar) {
          this.toolbar.style.display = 'none';
        }
      }, 200);
    }
    this.hidePixelInfo();
    this.updateToggleButtonState();
    for (const cb of this.toggleDrawModeCallbacks) cb(false);
  }

  toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  isVisible(): boolean {
    return this.visible;
  }

  getSelectedColor(): string {
    return this.selectedColor;
  }

  getSelectedTool(): 'pencil' | 'eraser' {
    return this.selectedTool;
  }

  isGridVisible(): boolean {
    return this.gridVisible;
  }

  setPixelCount(count: number): void {
    if (this.pixelCountEl) {
      this.pixelCountEl.textContent = `\u{1F3A8} ${count.toLocaleString()} pixels placed`;
    }
  }

  showPixelInfo(
    screenX: number,
    screenY: number,
    authorName: string,
    color: string,
    timestamp: number
  ): void {
    if (!this.pixelInfoTooltip) return;

    const relativeTime = this.formatRelativeTime(timestamp);

    this.pixelInfoTooltip.innerHTML = '';

    // Color swatch
    const swatch = document.createElement('div');
    swatch.style.cssText = `
      width: 16px;
      height: 16px;
      border-radius: 4px;
      background: ${color};
      border: 1px solid rgba(255,255,255,0.3);
      flex-shrink: 0;
    `;

    // Text content
    const textWrap = document.createElement('div');
    textWrap.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 2px;
    `;

    const authorEl = document.createElement('div');
    authorEl.style.cssText = `
      font-size: 12px;
      font-weight: 600;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    authorEl.textContent = `Placed by ${authorName}`;

    const timeEl = document.createElement('div');
    timeEl.style.cssText = `
      font-size: 11px;
      color: rgba(255,255,255,0.6);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    timeEl.textContent = relativeTime;

    textWrap.appendChild(authorEl);
    textWrap.appendChild(timeEl);

    this.pixelInfoTooltip.appendChild(swatch);
    this.pixelInfoTooltip.appendChild(textWrap);

    // Position the tooltip above the tap point
    const tooltipWidth = 180;
    const tooltipHeight = 52;
    let x = screenX - tooltipWidth / 2;
    let y = screenY - tooltipHeight - 12;

    // Clamp to viewport
    const vw = window.innerWidth;
    x = Math.max(8, Math.min(vw - tooltipWidth - 8, x));
    if (y < 8) y = screenY + 16;

    this.pixelInfoTooltip.style.left = `${x}px`;
    this.pixelInfoTooltip.style.top = `${y}px`;
    this.pixelInfoTooltip.style.display = 'flex';
    this.pixelInfoTooltip.style.animation = 'pixelDrawFadeIn 0.15s ease-out forwards';
  }

  hidePixelInfo(): void {
    if (this.pixelInfoTooltip) {
      this.pixelInfoTooltip.style.display = 'none';
    }
  }

  onToggleDrawMode(callback: (active: boolean) => void): void {
    this.toggleDrawModeCallbacks.push(callback);
  }

  onColorChange(callback: (color: string) => void): void {
    this.colorChangeCallbacks.push(callback);
  }

  onToolChange(callback: (tool: 'pencil' | 'eraser') => void): void {
    this.toolChangeCallbacks.push(callback);
  }

  onUndo(callback: () => void): void {
    this.undoCallbacks.push(callback);
  }

  onGridToggle(callback: (visible: boolean) => void): void {
    this.gridToggleCallbacks.push(callback);
  }

  // --- Internal ---

  private formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  }

  private updateToggleButtonState(): void {
    if (!this.toggleButton) return;
    if (this.visible) {
      this.toggleButton.classList.add('active');
    } else {
      this.toggleButton.classList.remove('active');
    }
  }

  private selectColor(color: string): void {
    this.selectedColor = color;
    this.updateColorSwatchStates();
    for (const cb of this.colorChangeCallbacks) cb(color);
  }

  getBrushSize(): number {
    return this.brushSize;
  }

  private selectTool(tool: 'pencil' | 'eraser'): void {
    if (this.selectedTool === tool) {
      // Cycle brush size: 1 → 2 → 3 → 1
      this.brushSize = (this.brushSize % 3) + 1;
    } else {
      this.selectedTool = tool;
      this.brushSize = 1;
    }
    this.updateToolButtonStates();
    for (const cb of this.toolChangeCallbacks) cb(tool);
  }

  private updateColorSwatchStates(): void {
    this.colorSwatches.forEach((swatch, i) => {
      const color = this.COLORS[i];
      if (color === this.selectedColor) {
        swatch.style.outline = '2px solid white';
        swatch.style.outlineOffset = '2px';
        swatch.style.transform = 'scale(1.1)';
      } else {
        swatch.style.outline = 'none';
        swatch.style.outlineOffset = '0';
        swatch.style.transform = 'scale(1)';
      }
    });
  }

  private updateToolButtonStates(): void {
    const pencilSize = this.selectedTool === 'pencil' && this.brushSize > 1;
    const eraserSize = this.selectedTool === 'eraser' && this.brushSize > 1;

    if (this.pencilButton) {
      this.pencilButton.innerHTML = pencilSize
        ? `✏️<span style="color:white;font-size:11px;margin-left:1px;">${this.brushSize}</span>`
        : '✏️';
      this.pencilButton.style.whiteSpace = 'nowrap';
      this.pencilButton.style.width = pencilSize ? '40px' : '28px';
      if (this.selectedTool === 'pencil') {
        this.pencilButton.style.background = 'rgba(59,130,246,0.5)';
        this.pencilButton.style.borderColor = 'rgba(59,130,246,0.8)';
      } else {
        this.pencilButton.style.background = 'rgba(255,255,255,0.1)';
        this.pencilButton.style.borderColor = 'rgba(255,255,255,0.2)';
      }
    }
    if (this.eraserButton) {
      this.eraserButton.innerHTML = eraserSize
        ? `🧽<span style="color:white;font-size:11px;margin-left:1px;">${this.brushSize}</span>`
        : '🧽';
      this.eraserButton.style.whiteSpace = 'nowrap';
      this.eraserButton.style.width = eraserSize ? '40px' : '28px';
      if (this.selectedTool === 'eraser') {
        this.eraserButton.style.background = 'rgba(59,130,246,0.5)';
        this.eraserButton.style.borderColor = 'rgba(59,130,246,0.8)';
      } else {
        this.eraserButton.style.background = 'rgba(255,255,255,0.1)';
        this.eraserButton.style.borderColor = 'rgba(255,255,255,0.2)';
      }
    }
  }

  private injectStyles(): void {
    if (document.getElementById('pixel-draw-ui-styles')) return;

    const style = document.createElement('style');
    style.id = 'pixel-draw-ui-styles';
    style.textContent = `
      @keyframes pixelDrawSlideUp {
        0% {
          opacity: 0;
          transform: translateX(-50%) translateY(20px);
        }
        100% {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }

      @keyframes pixelDrawSlideDown {
        0% {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
        100% {
          opacity: 0;
          transform: translateX(-50%) translateY(20px);
        }
      }

      @keyframes pixelDrawFadeIn {
        0% {
          opacity: 0;
          transform: scale(0.95);
        }
        100% {
          opacity: 1;
          transform: scale(1);
        }
      }

      @keyframes pixelDrawBtnPress {
        0% { transform: scale(1); }
        50% { transform: scale(0.9); }
        100% { transform: scale(1); }
      }

      .pixel-draw-toggle:active {
        animation: pixelDrawBtnPress 0.15s ease-out;
      }

      .pixel-draw-tool-btn:active {
        animation: pixelDrawBtnPress 0.15s ease-out;
      }

      .pixel-draw-swatch:active {
        animation: pixelDrawBtnPress 0.1s ease-out;
      }
    `;
    document.head.appendChild(style);
  }

  private createToggleButton(): void {
    const btn = document.createElement('div');
    btn.className = 'pixel-draw-toggle action-btn';
    btn.style.fontSize = '20px';
    btn.textContent = '\u{1F3A8}';

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    this.toggleButton = btn;
    // Append to bottom-left zone if available
    const zone = document.getElementById('zone-bottom-left');
    if (zone) zone.appendChild(btn);
    else document.body.appendChild(btn);
  }

  private createToolbar(): void {
    const toolbar = document.createElement('div');
    toolbar.style.cssText = `
      position: fixed;
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);
      display: none;
      flex-direction: row;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      background: rgba(30, 30, 40, 0.6);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-radius: 12px;
      z-index: 300;
      pointer-events: auto;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.08);
      max-width: calc(100vw - 20px);
      flex-wrap: nowrap;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // --- Color palette: 3 rows (2 preset + 1 custom), as many colors as fit ---
    const CUSTOM_SLOT_COUNT = 8;
    const cols = Math.max(Math.ceil(this.COLORS.length / 2), CUSTOM_SLOT_COUNT);
    const paletteWrap = document.createElement('div');
    paletteWrap.style.cssText = `
      display: grid;
      grid-template-columns: repeat(${cols}, 1fr);
      grid-template-rows: 1fr 1fr 1fr;
      gap: 3px;
      flex: 1;
    `;

    // Load saved custom colors
    const savedCustom: string[] = JSON.parse(localStorage.getItem('gallax_custom_colors') || '[]');

    this.COLORS.forEach((color) => {
      const swatch = document.createElement('div');
      swatch.className = 'pixel-draw-swatch';
      swatch.style.cssText = `
        width: 24px; height: 24px; border-radius: 4px;
        background: ${color}; cursor: pointer;
        border: 1px solid rgba(255,255,255,0.15);
        transition: transform 0.1s; user-select: none;
      `;
      if (color === '#ffffff' || color === '#ffff00' || color === '#ffcc88') {
        swatch.style.border = '1px solid rgba(0,0,0,0.25)';
      }
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectColor(color);
      });
      paletteWrap.appendChild(swatch);
      this.colorSwatches.push(swatch);
    });

    // Custom color slots (third row)
    for (let i = 0; i < CUSTOM_SLOT_COUNT; i++) {
      const customColor = savedCustom[i] || '';
      const slot = document.createElement('div');
      slot.className = 'pixel-draw-swatch';
      slot.style.cssText = `
        width: 24px; height: 24px; border-radius: 4px;
        background: ${customColor || 'rgba(255,255,255,0.06)'};
        cursor: pointer;
        border: 1px dashed rgba(255,255,255,${customColor ? '0.15' : '0.25'});
        transition: transform 0.1s; user-select: none;
        display: flex; align-items: center; justify-content: center;
        font-size: 10px; color: rgba(255,255,255,0.3);
      `;
      if (!customColor) slot.textContent = '+';

      const slotIndex = i;
      slot.addEventListener('click', (e) => {
        e.stopPropagation();
        if (customColor) {
          // Use the saved custom color
          this.selectColor(customColor);
        } else {
          // Open Pickr color picker
          this.openPickr(slot, (c: string) => {
            slot.style.background = c;
            slot.style.border = '1px solid rgba(255,255,255,0.15)';
            slot.textContent = '';
            savedCustom[slotIndex] = c;
            localStorage.setItem('gallax_custom_colors', JSON.stringify(savedCustom));
            if (!this.COLORS.includes(c)) this.COLORS.push(c);
            if (!this.colorSwatches.includes(slot)) this.colorSwatches.push(slot);
            this.selectColor(c);
          });
        }
      });

      paletteWrap.appendChild(slot);
      if (customColor) this.colorSwatches.push(slot);
    }

    // --- Tool buttons section (vertically stacked, right of palette) ---
    const toolsWrap = document.createElement('div');
    toolsWrap.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 3px;
      flex-shrink: 0;
    `;

    // Pencil button
    const pencilBtn = document.createElement('div');
    pencilBtn.className = 'pixel-draw-tool-btn';
    pencilBtn.style.cssText = `
      width: 28px; height: 28px; border-radius: 6px;
      background: rgba(99,102,241,0.6); border: 2px solid rgba(99,102,241,0.9);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; font-size: 14px; user-select: none;
      transition: background 0.15s;
    `;
    pencilBtn.textContent = '✏️';

    pencilBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectTool('pencil');
    });

    // Eraser button (using eraser emoji, not broom)
    const eraserBtn = document.createElement('div');
    eraserBtn.className = 'pixel-draw-tool-btn';
    eraserBtn.style.cssText = `
      width: 28px; height: 28px; border-radius: 6px;
      background: rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; font-size: 14px; user-select: none;
      transition: background 0.15s;
    `;
    eraserBtn.textContent = '🧽';

    eraserBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectTool('eraser');
    });

    this.pencilButton = pencilBtn;
    this.eraserButton = eraserBtn;

    toolsWrap.appendChild(pencilBtn);
    toolsWrap.appendChild(eraserBtn);

    // Undo button
    const undoBtn = document.createElement('div');
    undoBtn.style.cssText = `
      width: 28px; height: 28px; border-radius: 6px;
      background: rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; font-size: 14px; user-select: none;
      transition: background 0.15s;
    `;
    undoBtn.textContent = '↩️';
    undoBtn.title = 'Undo last stroke';
    undoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      for (const cb of this.undoCallbacks) cb();
    });
    toolsWrap.appendChild(undoBtn);

    // --- Assemble toolbar: [colors 3 rows] [pencil/eraser/undo stacked] ---
    toolbar.appendChild(paletteWrap);
    toolbar.appendChild(toolsWrap);

    this.toolbar = toolbar;
    document.body.appendChild(toolbar);

    // Set initial selected states
    this.updateColorSwatchStates();
    this.updateToolButtonStates();
  }

  private openPickr(anchorEl: HTMLElement, onSave: (hex: string) => void): void {
    // Destroy previous instance
    if (this.pickrInstance) {
      this.pickrInstance.destroyAndRemove();
      this.pickrInstance = null;
    }

    // Create a temporary anchor for Pickr
    const anchor = document.createElement('div');
    anchor.style.cssText = `position:fixed;left:${anchorEl.getBoundingClientRect().left}px;top:${anchorEl.getBoundingClientRect().top - 10}px;width:1px;height:1px;z-index:10000;`;
    document.body.appendChild(anchor);

    this.pickrInstance = Pickr.create({
      el: anchor,
      theme: 'nano',
      default: '#ff0000',
      position: 'top-middle',
      components: {
        preview: true,
        opacity: false,
        hue: true,
        interaction: {
          hex: true,
          input: true,
          save: true,
        },
      },
    });

    this.pickrInstance.on('save', (color: any) => {
      if (color) {
        const hex = color.toHEXA().toString().slice(0, 7); // #RRGGBB only
        onSave(hex);
      }
      this.pickrInstance?.hide();
      setTimeout(() => {
        this.pickrInstance?.destroyAndRemove();
        this.pickrInstance = null;
        anchor.remove();
      }, 100);
    });

    this.pickrInstance.show();
  }

  private createPixelInfoTooltip(): void {
    const tooltip = document.createElement('div');
    tooltip.style.cssText = `
      position: fixed;
      display: none;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: rgba(0, 0, 0, 0.9);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border-radius: 10px;
      z-index: 1101;
      pointer-events: none;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.1);
      min-width: 140px;
    `;

    this.pixelInfoTooltip = tooltip;
    document.body.appendChild(tooltip);
  }
}
