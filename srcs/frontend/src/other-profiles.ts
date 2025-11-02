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

class UserProfileViewer {
  private currentUser: User | null = null;
  private viewedProfile: Profile | null = null;
  private accessToken: string | null = null;
  private userId: string | null = null;

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
      
      // Get user ID from URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      this.userId = urlParams.get('id');

      if (!this.userId) {
        this.showMessage('No user ID provided', 'error');
        setTimeout(() => window.location.href = './profile.html', 2000);
        return;
      }

      // Load the user's profile
      await this.loadUserProfile(this.userId);
    } catch (error) {
      console.error('Init error:', error);
      this.showMessage('Failed to load user profile', 'error');
      setTimeout(() => window.location.href = './profile.html', 2000);
    }
  }

  private setupAuthContainer(): void {
    const authContainer = document.getElementById('authContainer');
    if (!authContainer || !this.currentUser) return;

    authContainer.innerHTML = `
      <a href="./index.html" class="text-gray-300 hover:text-white transition">Game</a>
      <span class="text-gray-400">|</span>
      <span class="text-gray-300">Welcome, <a href="./profile.html" class="text-green-400 hover:text-green-300 font-bold underline transition duration-200">${this.currentUser.username}</a></span>
      <button id="logoutButton" class="bg-red-600 hover:bg-red-700 text-white text-sm py-1.5 px-4 rounded transition duration-200">
        Logout
      </button>
    `;

    document.getElementById('logoutButton')?.addEventListener('click', () => this.handleLogout());
  }

  private async loadUserProfile(userId: string): Promise<void> {
    try {
      const response = await fetch(`/api/user/${userId}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        this.viewedProfile = data.profile;

        if (!this.viewedProfile) {
          this.showMessage('User not found', 'error');
          setTimeout(() => window.location.href = './profile.html', 2000);
          return;
        }

        this.displayProfile();
      } else if (response.status === 404) {
        this.showMessage('User not found', 'error');
        setTimeout(() => window.location.href = './profile.html', 2000);
      } else {
        throw new Error('Failed to load user profile');
      }
    } catch (error) {
      console.error('Load user profile error:', error);
      this.showMessage('Failed to load user profile', 'error');
      setTimeout(() => window.location.href = './profile.html', 2000);
    }
  }

  private displayProfile(): void {
    if (!this.viewedProfile) return;

    const usernameEl = document.getElementById('userUsername');
    const emailEl = document.getElementById('userEmail');
    const avatarEl = document.getElementById('userAvatarPlaceholder');
    const avatarImg = document.getElementById('userAvatarImage') as HTMLImageElement;

    if (usernameEl) usernameEl.textContent = this.viewedProfile.name;
    if (emailEl) emailEl.textContent = this.viewedProfile.email;
    
    // Display avatar image if URL exists, otherwise show initials
    if (this.viewedProfile.avatarUrl && avatarImg) {
      avatarImg.src = this.viewedProfile.avatarUrl;
      avatarImg.classList.remove('hidden');
      avatarEl?.classList.add('hidden');
    } else if (avatarEl) {
      avatarImg?.classList.add('hidden');
      avatarEl.classList.remove('hidden');
      avatarEl.textContent = this.viewedProfile.name.charAt(0).toUpperCase();
    }
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
  new UserProfileViewer();
});
