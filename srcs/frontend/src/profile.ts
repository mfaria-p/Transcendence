interface User {
  id: string;
  username: string;
  email: string;
}

interface Profile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

class ProfileManager {
  private currentUser: User | null = null;
  private currentProfile: Profile | null = null;
  private accessToken: string | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    // Check authentication
    const userStr = localStorage.getItem('user');
    this.accessToken = localStorage.getItem('access_token');

    if (!userStr || !this.accessToken) {
      window.location.href = './login.html';
      return;
    }

    try {
      this.currentUser = JSON.parse(userStr);
      this.setupAuthContainer();
      
      // Load profile from backend (required)
      await this.loadProfile();
      
      this.setupEventListeners();
    } catch (error) {
      console.error('Init error:', error);
      this.showMessage('Session expired or profile not found. Redirecting to login...', 'error');
      
      // Clear local storage and redirect to login after 2 seconds
      setTimeout(() => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        window.location.href = './login.html';
      }, 2000);
    }
  }

  private setupAuthContainer(): void {
    const authContainer = document.getElementById('authContainer');
    if (!authContainer || !this.currentUser) return;

    authContainer.innerHTML = `
      <a href="./index.html" class="text-gray-300 hover:text-white transition">Game</a>
      <span class="text-gray-400">|</span>
      <span class="text-gray-300">Welcome, <strong class="text-green-400">${this.currentUser.username}</strong></span>
      <button id="logoutButton" class="bg-red-600 hover:bg-red-700 text-white text-sm py-1.5 px-4 rounded transition duration-200">
        Logout
      </button>
    `;

    document.getElementById('logoutButton')?.addEventListener('click', () => this.handleLogout());
  }

  private async loadProfile(): Promise<void> {
    try {
      const response = await fetch('/api/user/me', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        this.currentProfile = data.profile;
        this.displayProfile();
        console.log('Profile loaded from backend:', this.currentProfile);
      } else if (response.status === 404) {
        // Profile doesn't exist - this shouldn't happen if provision works
        throw new Error('Profile not found. Please log out and log in again.');
      } else {
        throw new Error(`Failed to load profile: ${response.status}`);
      }
    } catch (error) {
      console.error('Load profile error:', error);
      throw error; // Propagate error to init()
    }
  }

  private displayProfile(): void {
    if (!this.currentProfile) return;

    const usernameEl = document.getElementById('profileUsername');
    const emailEl = document.getElementById('profileEmail');
    const avatarEl = document.getElementById('avatarPlaceholder');

    if (usernameEl) usernameEl.textContent = this.currentProfile.name;
    if (emailEl) emailEl.textContent = this.currentProfile.email;
    if (avatarEl) avatarEl.textContent = this.currentProfile.name.charAt(0).toUpperCase();
  }

  private setupEventListeners(): void {

    document.getElementById('changePhotoBtn')?.addEventListener('click', () => {
      this.showMessage('Photo upload feature coming soon!', 'success');
    });
  }

  private showMessage(message: string, type: 'success' | 'error'): void {
    const container = document.getElementById('messageContainer');
    if (!container) return;

    const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600';
    const messageEl = document.createElement('div');
    messageEl.className = `${bgColor} text-white px-4 py-3 rounded shadow-lg mb-2 transition-opacity`;
    messageEl.textContent = message;

    container.appendChild(messageEl);

    setTimeout(() => {
      messageEl.style.opacity = '0';
      setTimeout(() => messageEl.remove(), 300);
    }, 3000);
  }

  private async handleLogout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = './login.html';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ProfileManager();
});
