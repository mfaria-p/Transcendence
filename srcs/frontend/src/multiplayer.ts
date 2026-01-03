interface User {
  id: string;
  username: string;
  email: string;
}

class QuickMatchPage {
  private currentUser: User | null = null;
  private token: string | null = null;
  private quickButton: HTMLButtonElement | null = null;
  private statusEl: HTMLElement | null = null;

  constructor() {
    void this.init();
  }

  private async init(): Promise<void> {
    const userStr = localStorage.getItem('user');
    const token = localStorage.getItem('access_token');

    if (!userStr || !token) {
      window.location.href = './login.html';
      return;
    }

    try {
      this.currentUser = JSON.parse(userStr) as User;
      this.token = token;
    } catch {
      localStorage.removeItem('user');
      localStorage.removeItem('access_token');
      window.location.href = './login.html';
      return;
    }

    this.quickButton = document.getElementById('quickPlayButton') as HTMLButtonElement | null;
    this.statusEl = document.getElementById('quickStatus');
    this.setupAuth();
    this.bindEvents();
  }

  private setupAuth(): void {
    const container = document.getElementById('authContainer');
    if (!container || !this.currentUser) return;

    container.innerHTML = `
      <span class="text-gray-300">Hi, <a href="./profile.html" class="text-green-400 hover:text-green-300 font-semibold underline transition">${this.currentUser.username}</a></span>
      <button id="logoutButton" class="bg-red-600 hover:bg-red-700 text-white text-sm py-1.5 px-4 rounded transition">Logout</button>
    `;

    document.getElementById('logoutButton')?.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      } catch (err) {
        console.error('logout error', err);
      } finally {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        window.location.href = './login.html';
      }
    });
  }

  private bindEvents(): void {
    if (this.quickButton) {
      this.quickButton.addEventListener('click', () => this.startQuickMatch());
    }
  }

  private startQuickMatch(): void {
    if (!this.quickButton) return;
    this.quickButton.disabled = true;
    this.quickButton.classList.add('opacity-70', 'cursor-wait');
    this.quickButton.textContent = 'Looking for an opponent...';
    this.setStatus('Connecting to the server and joining the queue.');
    window.location.href = './match.html?mode=quick';
  }

  private setStatus(text: string): void {
    if (this.statusEl) {
      this.statusEl.textContent = text;
    }
  }
}

function bootstrap(): void {
  // Avoid running twice if modules are hot reloaded
  if ((window as any).__quickMatchInitialized) return;
  (window as any).__quickMatchInitialized = true;
  new QuickMatchPage();
}

document.addEventListener('DOMContentLoaded', bootstrap);
