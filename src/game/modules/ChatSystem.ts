import { GeckosNetworkManager as NetworkManager, ChatMessage } from '../../network/GeckosNetworkManager';

export class ChatManager {
  private chatOpen = false;
  private unreadCount = 0;
  private chatMessages: ChatMessage[] = [];
  private maxChatMessages = 50;

  constructor(
    private network: NetworkManager,
    private playerName: string,
    private isMobile: () => boolean
  ) {}

  setPlayerName(name: string): void {
    this.playerName = name;
  }

  // Create chat UI with animated open/close
  createUI(): void {
    const chatContainer = document.createElement('div');
    chatContainer.id = 'chat-container';
    // Desktop: chat open by default. Mobile: closed.
    const isMobileDevice = window.matchMedia('(pointer: coarse)').matches;
    if (isMobileDevice) {
      chatContainer.style.display = 'none';
    } else {
      chatContainer.style.display = 'flex';
      this.chatOpen = true;
    }
    chatContainer.innerHTML = `
      <div id="chat-header" style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border-bottom:1px solid rgba(255,255,255,0.08);">
        <span style="font-size:12px;color:rgba(255,255,255,0.6);">💬 Chat</span>
        <button id="chat-close-btn" style="background:none;border:none;color:rgba(255,255,255,0.5);font-size:16px;cursor:pointer;padding:2px 6px;">✕</button>
      </div>
      <div id="chat-messages"></div>
      <div id="chat-input-row">
        <input type="text" id="chat-input" placeholder="Type a message..." maxlength="200">
        <button id="chat-send-btn">Send</button>
      </div>
    `;
    chatContainer.style.transition = 'opacity 0.2s, transform 0.2s';
    document.body.appendChild(chatContainer);

    const input = document.getElementById('chat-input') as HTMLInputElement;
    const sendBtn = document.getElementById('chat-send-btn') as HTMLButtonElement;
    const closeBtn = document.getElementById('chat-close-btn') as HTMLButtonElement;

    const sendMessage = () => {
      const message = input.value.trim();
      if (message) {
        this.network.sendChat(message);
        // Show own message immediately (don't wait for server echo)
        this.addMessage({
          playerId: this.network.getPlayerId() || '',
          playerName: this.playerName || 'You',
          message,
          timestamp: Date.now(),
        });
        input.value = '';
      }
    };

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
    });

    // Close button
    closeBtn.addEventListener('click', () => this.close());

    // Enter key opens chat on desktop (but not when typing in other inputs)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !this.isMobile() &&
          document.activeElement !== input &&
          !(document.activeElement instanceof HTMLInputElement)) {
        e.preventDefault();
        if (!this.chatOpen) this.open();
        input.focus();
      }
    });
  }

  open(): void {
    const chat = document.getElementById('chat-container');
    if (!chat) return;
    this.chatOpen = true;
    this.unreadCount = 0;
    this.updateChatBadge();
    chat.style.display = 'flex';
    chat.style.opacity = '0';
    chat.style.transform = 'translateY(10px)';
    requestAnimationFrame(() => {
      chat.style.opacity = '1';
      chat.style.transform = 'translateY(0)';
    });

    // On mobile iOS, use position:absolute to work with keyboard
    if (this.isMobile()) {
      chat.style.position = 'absolute';
      chat.style.bottom = '10px';
      // Scroll input into view after keyboard appears
      setTimeout(() => {
        const input = document.getElementById('chat-input');
        input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }

    // Hide the chat button
    const btn = document.getElementById('btn-chat');
    if (btn) btn.style.display = 'none';
  }

  close(): void {
    const chat = document.getElementById('chat-container');
    if (!chat) return;
    this.chatOpen = false;
    chat.style.opacity = '0';
    chat.style.transform = 'translateY(10px)';
    setTimeout(() => { chat.style.display = 'none'; }, 200);
    // Show the chat button
    const btn = document.getElementById('btn-chat');
    if (btn) btn.style.display = 'flex';
  }

  private updateChatBadge(): void {
    const btn = document.getElementById('btn-chat');
    if (!btn) return;
    let badge = btn.querySelector('.chat-badge') as HTMLElement;
    if (this.unreadCount > 0 && !this.chatOpen) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'chat-badge';
        badge.style.cssText = 'position:absolute;top:-4px;right:-4px;background:#ef4444;color:white;font-size:10px;min-width:16px;height:16px;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:0 4px;pointer-events:none;';
        // Don't change btn.style.position — it's already position:fixed
        btn.appendChild(badge);
      }
      badge.textContent = this.unreadCount > 9 ? '9+' : this.unreadCount.toString();
    } else if (badge) {
      badge.remove();
    }
  }

  // Add a chat message to the UI
  addMessage(message: ChatMessage): void {
    // Don't add duplicate of own message (already added locally in sendMessage)
    const myId = this.network.getPlayerId();
    if (message.playerId === myId) {
      // Check if we already have this exact message (local echo)
      const lastMsg = this.chatMessages[this.chatMessages.length - 1];
      if (lastMsg && lastMsg.playerId === myId && lastMsg.message === message.message) {
        return; // Skip duplicate
      }
    }

    this.chatMessages.push(message);

    while (this.chatMessages.length > this.maxChatMessages) {
      this.chatMessages.shift();
    }

    // Increment unread if chat is closed
    if (!this.chatOpen) {
      this.unreadCount++;
      this.updateChatBadge();
    }

    this.updateChatUI();
  }

  // Update chat messages display
  private updateChatUI(): void {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    const myPlayerId = this.network.getPlayerId();

    messagesContainer.innerHTML = this.chatMessages.map(msg => {
      const isMe = msg.playerId === myPlayerId;
      const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `<div class="chat-message ${isMe ? 'my-message' : ''}">
        <span class="chat-time">${time}</span>
        <span class="chat-name">${msg.playerName}:</span>
        <span class="chat-text">${this.escapeHtml(msg.message)}</span>
      </div>`;
    }).join('');

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Escape HTML to prevent XSS
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Create shared UI buttons (same on mobile and desktop)
  createChatButton(): void {
    // Chat button in bottom-right
    const btnChat = document.createElement('button');
    btnChat.id = 'btn-chat';
    btnChat.className = 'action-btn';
    btnChat.innerHTML = '💬';
    btnChat.title = 'Open Chat';
    btnChat.style.cssText = 'position:fixed;bottom:20px;right:10px;z-index:200;';

    // On desktop, chat starts open so hide the button initially
    if (!this.isMobile() && this.chatOpen) {
      btnChat.style.display = 'none';
    }

    btnChat.addEventListener('click', () => {
      this.open();
      const input = document.getElementById('chat-input') as HTMLInputElement;
      if (input) input.focus();
    });

    document.body.appendChild(btnChat);
  }
}
