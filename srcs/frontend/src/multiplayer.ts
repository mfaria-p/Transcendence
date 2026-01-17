import { initHeader } from './shared/header.js';
import { verifySession, clearSessionAndRedirect, showMessage } from './utils-api.js';

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

    try {
      await verifySession(token);
    } catch (error) {
      if (error instanceof Error && error.message === 'Session expired') {
        showMessage('Session expired. Redirecting to login...', 'error');
        setTimeout(() => {
          clearSessionAndRedirect();
        }, 2000);
        return;
      }
      console.warn('Session check failed, redirecting to login:', error);
      showMessage('Authentication error. Please login again.', 'error');
      setTimeout(() => {
        clearSessionAndRedirect();
      }, 2000);
      return;
    }

    this.quickButton = document.getElementById('quickPlayButton') as HTMLButtonElement | null;
    this.statusEl = document.getElementById('quickStatus');
    initHeader({ active: 'quick' });
    this.bindEvents();
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