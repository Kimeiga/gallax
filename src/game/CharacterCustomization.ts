export class CharacterCustomization {
  private selectedSprite: number;
  private onChangeCallback: ((spriteNum: number) => void) | null = null;

  constructor() {
    // Load saved sprite or default to random
    const saved = localStorage.getItem('gallax_player_sprite');
    this.selectedSprite = saved ? parseInt(saved, 10) : Math.floor(Math.random() * 125) + 1;
  }

  getSelectedSprite(): number {
    return this.selectedSprite;
  }

  setSelectedSprite(spriteNum: number): void {
    if (spriteNum < 1 || spriteNum > 125) {
      console.error('Invalid sprite number:', spriteNum);
      return;
    }

    this.selectedSprite = spriteNum;
    localStorage.setItem('gallax_player_sprite', spriteNum.toString());

    if (this.onChangeCallback) {
      this.onChangeCallback(spriteNum);
    }
  }

  onChange(callback: (spriteNum: number) => void): void {
    this.onChangeCallback = callback;
  }

  // Get a random sprite number
  randomize(): number {
    const random = Math.floor(Math.random() * 125) + 1;
    this.setSelectedSprite(random);
    return random;
  }
}

