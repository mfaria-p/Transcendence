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
    const avatarImg = document.getElementById('avatarImage') as HTMLImageElement;

    if (usernameEl) usernameEl.textContent = this.currentProfile.name;
    if (emailEl) emailEl.textContent = this.currentProfile.email;
    
    // Display avatar image if URL exists, otherwise show initials
    if (this.currentProfile.avatarUrl && avatarImg) {
      avatarImg.src = this.currentProfile.avatarUrl;
      avatarImg.classList.remove('hidden');
      avatarEl?.classList.add('hidden');
    } else if (avatarEl) {
      avatarImg?.classList.add('hidden');
      avatarEl.classList.remove('hidden');
      const displayName = this.currentProfile.name || this.currentUser?.username || '?';
      avatarEl.textContent = displayName.charAt(0).toUpperCase();
    }
  }

  private setupEventListeners(): void {
    // Avatar change button
    document.getElementById('changePhotoBtn')?.addEventListener('click', () => this.openAvatarModal());
    document.getElementById('cancelAvatarBtn')?.addEventListener('click', () => this.closeAvatarModal());
    document.getElementById('avatarForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveAvatar();
    });

    // Preview avatar as user types
    const avatarUrlInput = document.getElementById('avatarUrlInput') as HTMLInputElement;
    avatarUrlInput?.addEventListener('input', () => {
      const url = avatarUrlInput.value.trim();
      if (url) {
        this.previewAvatar(url);
      } else {
        document.getElementById('avatarPreview')?.classList.add('hidden');
      }
    });

    // Username edit buttons
    document.getElementById('editUsernameBtn')?.addEventListener('click', () => this.startEditUsername());
    document.getElementById('saveUsernameBtn')?.addEventListener('click', () => this.saveUsername());
    document.getElementById('cancelUsernameBtn')?.addEventListener('click', () => this.cancelEditUsername());

    // Email edit buttons
    document.getElementById('editEmailBtn')?.addEventListener('click', () => this.startEditEmail());
    document.getElementById('saveEmailBtn')?.addEventListener('click', () => this.saveEmail());
    document.getElementById('cancelEmailBtn')?.addEventListener('click', () => this.cancelEditEmail());
  }

  private openAvatarModal(): void {
    const modal = document.getElementById('avatarModal');
    const avatarUrlInput = document.getElementById('avatarUrlInput') as HTMLInputElement;
    
    // Pre-fill with current avatar URL if it exists
    if (avatarUrlInput && this.currentProfile?.avatarUrl) {
      avatarUrlInput.value = this.currentProfile.avatarUrl;
      this.previewAvatar(this.currentProfile.avatarUrl);
    }
    
    if (modal) {
      modal.classList.remove('hidden');
      modal.style.display = 'block';
    }
  }

  private closeAvatarModal(): void {
    const modal = document.getElementById('avatarModal');
    const avatarUrlInput = document.getElementById('avatarUrlInput') as HTMLInputElement;
    const preview = document.getElementById('avatarPreview');
    
    if (avatarUrlInput) avatarUrlInput.value = '';
    preview?.classList.add('hidden');
    
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
  }

  private previewAvatar(url: string): void {
    const preview = document.getElementById('avatarPreview');
    const previewImg = document.getElementById('previewImage') as HTMLImageElement;
    
    if (!previewImg) return;
    
    // Test if image loads
    const testImg = new Image();
    testImg.onload = () => {
      previewImg.src = url;
      preview?.classList.remove('hidden');
    };
    testImg.onerror = () => {
      preview?.classList.add('hidden');
      this.showMessage('Invalid image URL', 'error');
    };
    testImg.src = url;
  }

  private async saveAvatar(): Promise<void> {
    const avatarUrlInput = document.getElementById('avatarUrlInput') as HTMLInputElement;
    const url = avatarUrlInput?.value.trim();

    if (!url) {
      this.showMessage('Please enter an image URL', 'error');
      return;
    }

    console.log('Saving avatar with data:', {
      username: this.currentProfile?.name || this.currentUser?.username || '',
      email: this.currentProfile?.email || this.currentUser?.email || '',
      avatarUrl: url,
    });

    try {
      const response = await fetch('/api/user/provision', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({
          username: this.currentProfile?.name || this.currentUser?.username || '',
          email: this.currentProfile?.email || this.currentUser?.email || '',
          avatarUrl: url,
        }),
      });

      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Response data:', data);
        this.currentProfile = data.profile;
        this.displayProfile();
        this.closeAvatarModal();
        this.showMessage('Profile picture updated!', 'success');
      } else {
        const data = await response.json();
        console.error('Error response:', data);
        this.showMessage(data.message || 'Failed to update avatar', 'error');
      }
    } catch (error) {
      console.error('Save avatar error:', error);
      this.showMessage('Failed to update avatar', 'error');
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

  // Username edit methods
  private startEditUsername(): void {
    const usernameDisplay = document.getElementById('profileUsername');
    const usernameForm = document.getElementById('usernameEditForm');
    const usernameInput = document.getElementById('usernameInput') as HTMLInputElement;
    
    if (usernameInput && this.currentProfile) {
      usernameInput.value = this.currentProfile.name;
    }
    
    usernameDisplay?.classList.add('hidden');
    usernameForm?.classList.remove('hidden');
  }

  private cancelEditUsername(): void {
    const usernameDisplay = document.getElementById('profileUsername');
    const usernameForm = document.getElementById('usernameEditForm');
    
    usernameDisplay?.classList.remove('hidden');
    usernameForm?.classList.add('hidden');
  }

  private async saveUsername(): Promise<void> {
    const usernameInput = document.getElementById('usernameInput') as HTMLInputElement;
    const newUsername = usernameInput?.value.trim();

    if (!newUsername) {
      this.showMessage('Username cannot be empty', 'error');
      return;
    }

    if (newUsername.length < 3 || newUsername.length > 20) {
      this.showMessage('Username must be between 3 and 20 characters', 'error');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
      this.showMessage('Username can only contain letters, numbers, and underscores', 'error');
      return;
    }

    try {
      const response = await fetch('/api/user/provision', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({
          username: newUsername,
          email: this.currentProfile?.email || this.currentUser?.email || '',
          avatarUrl: this.currentProfile?.avatarUrl,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        this.currentProfile = data.profile;
        this.displayProfile();
        this.cancelEditUsername();
        this.showMessage('Username updated successfully!', 'success');
      } else {
        const data = await response.json();
        this.showMessage(data.message || 'Failed to update username', 'error');
      }
    } catch (error) {
      console.error('Save username error:', error);
      this.showMessage('Failed to update username', 'error');
    }
  }

  // Email edit methods
  private startEditEmail(): void {
    const emailDisplay = document.getElementById('profileEmail');
    const emailForm = document.getElementById('emailEditForm');
    const emailInput = document.getElementById('emailInput') as HTMLInputElement;
    
    if (emailInput && this.currentProfile) {
      emailInput.value = this.currentProfile.email;
    }
    
    emailDisplay?.classList.add('hidden');
    emailForm?.classList.remove('hidden');
  }

  private cancelEditEmail(): void {
    const emailDisplay = document.getElementById('profileEmail');
    const emailForm = document.getElementById('emailEditForm');
    
    emailDisplay?.classList.remove('hidden');
    emailForm?.classList.add('hidden');
  }

  private async saveEmail(): Promise<void> {
    const emailInput = document.getElementById('emailInput') as HTMLInputElement;
    const newEmail = emailInput?.value.trim();

    if (!newEmail) {
      this.showMessage('Email cannot be empty', 'error');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      this.showMessage('Please enter a valid email address', 'error');
      return;
    }

    try {
      const response = await fetch('/api/user/provision', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({
          username: this.currentProfile?.name || this.currentUser?.username || '',
          email: newEmail,
          avatarUrl: this.currentProfile?.avatarUrl,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        this.currentProfile = data.profile;
        this.displayProfile();
        this.cancelEditEmail();
        this.showMessage('Email updated successfully!', 'success');
      } else {
        const data = await response.json();
        this.showMessage(data.message || 'Failed to update email', 'error');
      }
    } catch (error) {
      console.error('Save email error:', error);
      this.showMessage('Failed to update email', 'error');
    }
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
