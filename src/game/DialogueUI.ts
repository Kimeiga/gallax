// Dialogue UI for NPC conversations - Comic-style speech bubbles with tails and smart positioning

import { Conversation, DialogueNode, DialogueOption } from './DialogueSystem';
import { MapManager } from '../map/MapManager';

export type DialogueCallback = (action: string, missionId?: string) => void;

interface BubbleState {
  x: number; // Current screen X position (center of bubble)
  y: number; // Current screen Y position (center of bubble)
  width: number;
  height: number;
  anchorX: number; // Character screen X position
  anchorY: number; // Character screen Y position
}

export class DialogueUI {
  private npcBubble: HTMLElement | null = null;
  private playerBubble: HTMLElement | null = null;
  private npcTail: HTMLElement | null = null;
  private playerTail: HTMLElement | null = null;
  private currentConversation: Conversation | null = null;
  private currentNode: DialogueNode | null = null;
  private onActionCallback: DialogueCallback | null = null;
  private mapManager: MapManager | null = null;
  private npcPosition: { lng: number; lat: number } | null = null;
  private playerPosition: { lng: number; lat: number } | null = null;
  private rafId: number | null = null;

  // Bubble positioning state
  private npcBubbleState: BubbleState | null = null;
  private playerBubbleState: BubbleState | null = null;

  // Layout parameters
  private readonly VERTICAL_OFFSET = 100; // Default offset above character
  private readonly HORIZONTAL_SPREAD = 120; // How far apart to push bubbles horizontally
  private readonly MIN_BUBBLE_GAP = 16; // Minimum gap between bubbles
  private readonly CHAR_BBOX_HALF_W = 20; // Half-width of character bounding box
  private readonly CHAR_BBOX_HALF_H = 30; // Half-height of character bounding box

  constructor() {
    this.createBubbles();
  }

  private createBubbles(): void {
    // Inject shared styles for tails (pseudo-elements need stylesheet)
    if (!document.getElementById('dialogue-bubble-styles')) {
      const style = document.createElement('style');
      style.id = 'dialogue-bubble-styles';
      style.textContent = `
        .npc-speech-bubble, .player-speech-bubble {
          position: fixed;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          z-index: 9999;
          display: none;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
          transition: left 0.15s ease-out, top 0.15s ease-out;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .npc-speech-bubble {
          max-width: 300px;
          background: rgba(30, 30, 40, 0.7);
          padding: 14px 18px;
          color: white;
          font-size: 15px;
          line-height: 1.4;
          pointer-events: none;
        }
        .player-speech-bubble {
          max-width: 350px;
          background: rgba(30, 30, 40, 0.7);
          padding: 14px;
          z-index: 10000;
          color: white;
          font-size: 14px;
        }
        .bubble-tail {
          position: fixed;
          pointer-events: none;
          z-index: 9998;
          display: none;
        }
        .bubble-tail svg {
          position: absolute;
          width: 100%;
          height: 100%;
          overflow: visible;
        }
      `;
      document.head.appendChild(style);
    }

    // Create NPC tail (SVG path for curved connector)
    this.npcTail = document.createElement('div');
    this.npcTail.className = 'bubble-tail';
    this.npcTail.innerHTML = '<svg><path class="tail-fill"/><path class="tail-stroke"/></svg>';
    document.body.appendChild(this.npcTail);

    // Create NPC speech bubble
    this.npcBubble = document.createElement('div');
    this.npcBubble.className = 'npc-speech-bubble';
    document.body.appendChild(this.npcBubble);

    // Create Player tail
    this.playerTail = document.createElement('div');
    this.playerTail.className = 'bubble-tail';
    this.playerTail.innerHTML = '<svg><path class="tail-fill"/><path class="tail-stroke"/></svg>';
    document.body.appendChild(this.playerTail);

    // Create Player speech bubble with options
    this.playerBubble = document.createElement('div');
    this.playerBubble.className = 'player-speech-bubble';
    document.body.appendChild(this.playerBubble);
  }

  // Show a conversation with NPC and player positions
  show(
    conversation: Conversation,
    onAction: DialogueCallback,
    mapManager: MapManager,
    npcPos: { lng: number; lat: number },
    playerPos: { lng: number; lat: number }
  ): void {
    this.currentConversation = conversation;
    this.onActionCallback = onAction;
    this.mapManager = mapManager;
    this.npcPosition = npcPos;
    this.playerPosition = playerPos;

    // Find initial node
    const initialNode = conversation.nodes.find(n => n.id === conversation.initialNode);
    if (!initialNode) {
      console.error('Initial node not found:', conversation.initialNode);
      return;
    }

    this.showNode(initialNode);

    // Show bubbles and tails
    if (this.npcBubble) this.npcBubble.style.display = 'block';
    if (this.playerBubble) this.playerBubble.style.display = 'block';
    if (this.npcTail) this.npcTail.style.display = 'block';
    if (this.playerTail) this.playerTail.style.display = 'block';

    // Update positions continuously as map moves/zooms
    this.startPositionUpdates();
  }

  private showNode(node: DialogueNode): void {
    this.currentNode = node;

    if (!this.npcBubble || !this.playerBubble || !this.currentConversation) return;

    // Clear and set NPC bubble content
    this.npcBubble.innerHTML = '';
    this.npcBubble.textContent = node.npcText;

    // Clear player bubble
    this.playerBubble.innerHTML = '';

    // Add player response options
    node.options.forEach((option, index) => {
      const btn = document.createElement('button');
      btn.style.cssText = `
        background: rgba(255, 255, 255, 0.2);
        border: 2px solid rgba(255, 255, 255, 0.5);
        border-radius: 12px;
        padding: 10px 15px;
        color: white;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
        text-align: left;
        width: 100%;
        margin-bottom: ${index < node.options.length - 1 ? '8px' : '0'};
        pointer-events: auto;
      `;
      btn.textContent = option.text;

      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'rgba(255, 255, 255, 0.4)';
        btn.style.transform = 'scale(1.02)';
      });

      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'rgba(255, 255, 255, 0.2)';
        btn.style.transform = 'scale(1)';
      });

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleOptionClick(option);
      });

      this.playerBubble!.appendChild(btn);
    });

    // Initialize bubble states with smart positioning
    this.initializeBubbleStates();

    // Immediate position update (no transition on first frame)
    if (this.npcBubble) this.npcBubble.style.transition = 'none';
    if (this.playerBubble) this.playerBubble.style.transition = 'none';
    this.updateBubblePositions();

    // Re-enable transition after first paint
    requestAnimationFrame(() => {
      if (this.npcBubble) this.npcBubble.style.transition = '';
      if (this.playerBubble) this.playerBubble.style.transition = '';
    });
  }

  private handleOptionClick(option: DialogueOption): void {
    // Handle action
    if (option.action) {
      if (this.onActionCallback) {
        this.onActionCallback(option.action, option.missionId);
      }

      if (option.action === 'end') {
        this.hide();
        return;
      }
    }

    // Navigate to next node
    if (option.nextNode && this.currentConversation) {
      const nextNode = this.currentConversation.nodes.find(n => n.id === option.nextNode);
      if (nextNode) {
        this.showNode(nextNode);
      } else {
        console.error('Next node not found:', option.nextNode);
        this.hide();
      }
    } else if (!option.action || option.action === 'end') {
      this.hide();
    }
  }

  // Initialize bubble positions using left/right assignment to guarantee no overlap
  private initializeBubbleStates(): void {
    if (!this.mapManager || !this.npcPosition || !this.playerPosition) return;
    if (!this.npcBubble || !this.playerBubble) return;

    // Project character positions to screen space
    const npcScreen = this.mapManager.project(this.npcPosition);
    const playerScreen = this.mapManager.project(this.playerPosition);

    // Measure bubble dimensions
    const npcW = this.npcBubble.offsetWidth || 200;
    const npcH = this.npcBubble.offsetHeight || 60;
    const playerW = this.playerBubble.offsetWidth || 250;
    const playerH = this.playerBubble.offsetHeight || 80;

    // Determine side assignment: NPC on left, player on right
    // unless the NPC is already on the right side of the screen
    const midX = (npcScreen.x + playerScreen.x) / 2;
    const npcIsLeft = npcScreen.x <= playerScreen.x;

    // Compute horizontal offsets so bubbles don't overlap
    const spreadX = this.HORIZONTAL_SPREAD;
    let npcX: number, playerX: number;

    if (npcIsLeft) {
      npcX = midX - spreadX;
      playerX = midX + spreadX;
    } else {
      npcX = midX + spreadX;
      playerX = midX - spreadX;
    }

    // Vertical: stagger so NPC is higher, player is lower
    const baseY = Math.min(npcScreen.y, playerScreen.y) - this.VERTICAL_OFFSET;
    const npcY = baseY;
    const playerY = baseY + npcH / 2 + this.MIN_BUBBLE_GAP + playerH / 2;

    // Initialize states
    this.npcBubbleState = {
      x: npcX,
      y: npcY,
      width: npcW,
      height: npcH,
      anchorX: npcScreen.x,
      anchorY: npcScreen.y,
    };

    this.playerBubbleState = {
      x: playerX,
      y: playerY,
      width: playerW,
      height: playerH,
      anchorX: playerScreen.x,
      anchorY: playerScreen.y,
    };
  }

  // Update bubble positions based on world coordinates
  private updateBubblePositions(): void {
    if (!this.mapManager || !this.npcPosition || !this.playerPosition) return;
    if (!this.npcBubble || !this.playerBubble) return;
    if (!this.npcBubbleState || !this.playerBubbleState) return;

    // Update anchor positions (characters may have moved due to zoom/pan)
    const npcScreen = this.mapManager.project(this.npcPosition);
    const playerScreen = this.mapManager.project(this.playerPosition);

    this.npcBubbleState.anchorX = npcScreen.x;
    this.npcBubbleState.anchorY = npcScreen.y;
    this.playerBubbleState.anchorX = playerScreen.x;
    this.playerBubbleState.anchorY = playerScreen.y;

    // Recompute positions based on current character positions
    const midX = (npcScreen.x + playerScreen.x) / 2;
    const npcIsLeft = npcScreen.x <= playerScreen.x;
    const spreadX = this.HORIZONTAL_SPREAD;

    // Target positions
    let npcTargetX: number, playerTargetX: number;
    if (npcIsLeft) {
      npcTargetX = midX - spreadX;
      playerTargetX = midX + spreadX;
    } else {
      npcTargetX = midX + spreadX;
      playerTargetX = midX - spreadX;
    }

    const npcH = this.npcBubbleState.height || 60;
    const playerH = this.playerBubbleState.height || 80;
    const baseY = Math.min(npcScreen.y, playerScreen.y) - this.VERTICAL_OFFSET;

    this.npcBubbleState.x = npcTargetX;
    this.npcBubbleState.y = baseY;
    this.playerBubbleState.x = playerTargetX;
    this.playerBubbleState.y = baseY + npcH / 2 + this.MIN_BUBBLE_GAP + playerH / 2;

    // Update measured dimensions
    this.npcBubbleState.width = this.npcBubble.offsetWidth || 200;
    this.npcBubbleState.height = this.npcBubble.offsetHeight || 60;
    this.playerBubbleState.width = this.playerBubble.offsetWidth || 250;
    this.playerBubbleState.height = this.playerBubble.offsetHeight || 80;

    // Resolve any remaining overlap
    this.resolveOverlap();

    // Clamp to viewport
    this.clampToViewport(this.npcBubbleState);
    this.clampToViewport(this.playerBubbleState);

    // Apply positions
    this.npcBubble.style.left = `${this.npcBubbleState.x}px`;
    this.npcBubble.style.top = `${this.npcBubbleState.y}px`;
    this.npcBubble.style.transform = 'translate(-50%, -50%)';

    this.playerBubble.style.left = `${this.playerBubbleState.x}px`;
    this.playerBubble.style.top = `${this.playerBubbleState.y}px`;
    this.playerBubble.style.transform = 'translate(-50%, -50%)';

    // Draw tails pointing to top of character's head (not feet)
    // Characters are ~32px tall at base zoom, offset by ~30px above their base position
    const headOffset = 30;
    this.drawTail(this.npcTail, this.npcBubbleState, npcScreen.x, npcScreen.y - headOffset, 'rgba(30,30,40,0.7)');
    this.drawTail(this.playerTail, this.playerBubbleState, playerScreen.x, playerScreen.y - headOffset, 'rgba(30,30,40,0.7)');
  }

  // Push bubbles apart if they overlap each other or cover characters
  private resolveOverlap(): void {
    if (!this.npcBubbleState || !this.playerBubbleState) return;

    const b1 = this.npcBubbleState;
    const b2 = this.playerBubbleState;
    const gap = this.MIN_BUBBLE_GAP;

    // --- 1. Resolve bubble-vs-bubble overlap ---
    const halfW1 = b1.width / 2;
    const halfH1 = b1.height / 2;
    const halfW2 = b2.width / 2;
    const halfH2 = b2.height / 2;

    const overlapX = (halfW1 + halfW2 + gap) - Math.abs(b1.x - b2.x);
    const overlapY = (halfH1 + halfH2 + gap) - Math.abs(b1.y - b2.y);

    if (overlapX > 0 && overlapY > 0) {
      if (overlapX < overlapY) {
        const pushX = overlapX / 2;
        if (b1.x < b2.x) { b1.x -= pushX; b2.x += pushX; }
        else { b1.x += pushX; b2.x -= pushX; }
      } else {
        const pushY = overlapY / 2;
        if (b1.y < b2.y) { b1.y -= pushY; b2.y += pushY; }
        else { b1.y += pushY; b2.y -= pushY; }
      }
    }

    // --- 2. Resolve bubble-vs-character overlap ---
    // Both characters should remain visible (not covered by either bubble)
    const charHW = this.CHAR_BBOX_HALF_W;
    const charHH = this.CHAR_BBOX_HALF_H;

    for (const bubble of [b1, b2]) {
      for (const anchor of [b1, b2]) {
        const charX = anchor.anchorX;
        const charY = anchor.anchorY;
        const bHalfW = bubble.width / 2;
        const bHalfH = bubble.height / 2;

        const ox = (bHalfW + charHW + gap) - Math.abs(bubble.x - charX);
        const oy = (bHalfH + charHH + gap) - Math.abs(bubble.y - charY);

        if (ox > 0 && oy > 0) {
          // Push bubble away from character, preferring vertical (up)
          if (bubble.y > charY) {
            // Bubble is below char — unlikely, but push it down
            bubble.y += oy;
          } else {
            // Bubble is above char — push it further up
            bubble.y -= oy;
          }
        }
      }
    }
  }

  // Clamp a bubble state to stay within viewport
  private clampToViewport(state: BubbleState): void {
    const padding = 20;
    const topMargin = 60;
    const bottomMargin = 120;
    const rightMargin = 60;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const halfW = (state.width || 150) / 2;
    const halfH = (state.height || 60) / 2;
    state.x = Math.max(padding + halfW, Math.min(vw - rightMargin - halfW, state.x));
    state.y = Math.max(topMargin + halfH, Math.min(vh - bottomMargin - halfH, state.y));
  }

  // Draw a comic-style tail from bubble CENTER to character.
  // The base of the tail is hidden behind the bubble, so only the part
  // that extends beyond the bubble edge is visible — like a real speech bubble tail.
  private drawTail(
    tailEl: HTMLElement | null,
    bubble: BubbleState,
    charX: number,
    charY: number,
    fillColor: string
  ): void {
    if (!tailEl) return;

    const fillPath = tailEl.querySelector('.tail-fill') as SVGPathElement | null;
    const strokePath = tailEl.querySelector('.tail-stroke') as SVGPathElement | null;
    if (!fillPath || !strokePath) return;

    // Direction from bubble center to character
    const dx = charX - bubble.x;
    const dy = charY - bubble.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 5) {
      tailEl.style.display = 'none';
      return;
    }
    tailEl.style.display = 'block';

    // The tail starts at the bubble CENTER (hidden behind the bubble)
    const baseX = bubble.x;
    const baseY = bubble.y;

    // Tip goes to the character position
    const tipX = charX;
    const tipY = charY;

    // Tail base width (perpendicular to direction)
    const baseWidth = 14;
    const nx = -(dy / dist); // perpendicular unit vector
    const ny = (dx / dist);

    // Base points (spread around bubble center)
    const x1 = baseX + nx * baseWidth;
    const y1 = baseY + ny * baseWidth;
    const x2 = baseX - nx * baseWidth;
    const y2 = baseY - ny * baseWidth;

    // SVG bounding box
    const pad = 5;
    const minX = Math.min(x1, x2, tipX) - pad;
    const minY = Math.min(y1, y2, tipY) - pad;

    // Curved control points — slight asymmetric curve for natural look
    const cpX1 = (baseX + tipX) / 2 + nx * 6;
    const cpY1 = (baseY + tipY) / 2 + ny * 6;
    const cpX2 = (baseX + tipX) / 2 - nx * 6;
    const cpY2 = (baseY + tipY) / 2 - ny * 6;

    // Full filled shape (base → tip → base, closed) — no stroke, hidden behind bubble
    const fillD = [
      `M ${x1 - minX} ${y1 - minY}`,
      `Q ${cpX1 - minX} ${cpY1 - minY} ${tipX - minX} ${tipY - minY}`,
      `Q ${cpX2 - minX} ${cpY2 - minY} ${x2 - minX} ${y2 - minY}`,
      'Z',
    ].join(' ');

    fillPath.setAttribute('d', fillD);
    fillPath.setAttribute('fill', fillColor);
    fillPath.setAttribute('stroke', 'none');

    // Stroke-only path: just the two curved edges (no base line)
    // This way the stroke only appears on the visible part outside the bubble
    const strokeD = [
      `M ${x1 - minX} ${y1 - minY}`,
      `Q ${cpX1 - minX} ${cpY1 - minY} ${tipX - minX} ${tipY - minY}`,
      `Q ${cpX2 - minX} ${cpY2 - minY} ${x2 - minX} ${y2 - minY}`,
    ].join(' ');

    strokePath.setAttribute('d', strokeD);
    strokePath.setAttribute('fill', 'none');
    strokePath.setAttribute('stroke', '#333');
    strokePath.setAttribute('stroke-width', '2.5');
    strokePath.setAttribute('stroke-linejoin', 'round');

    const maxX = Math.max(x1, x2, tipX) + pad;
    const maxY = Math.max(y1, y2, tipY) + pad;
    tailEl.style.left = `${minX}px`;
    tailEl.style.top = `${minY}px`;
    tailEl.style.width = `${maxX - minX}px`;
    tailEl.style.height = `${maxY - minY}px`;
  }

  // Start continuous position updates using rAF
  private startPositionUpdates(): void {
    this.stopPositionUpdates();

    const loop = () => {
      this.updateBubblePositions();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  // Stop position updates
  private stopPositionUpdates(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  hide(): void {
    this.stopPositionUpdates();

    if (this.npcBubble) {
      this.npcBubble.style.display = 'none';
    }
    if (this.playerBubble) {
      this.playerBubble.style.display = 'none';
    }
    if (this.npcTail) {
      this.npcTail.style.display = 'none';
    }
    if (this.playerTail) {
      this.playerTail.style.display = 'none';
    }

    this.currentConversation = null;
    this.currentNode = null;
    this.onActionCallback = null;
    this.mapManager = null;
    this.npcPosition = null;
    this.playerPosition = null;
    this.npcBubbleState = null;
    this.playerBubbleState = null;
  }

  isVisible(): boolean {
    return this.npcBubble?.style.display === 'block' || false;
  }
}
