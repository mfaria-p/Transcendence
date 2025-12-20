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
      this.loadFriendRequests();
      this.loadFriends();
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
      <span class="text-gray-300">Welcome, <a href="./profile.html" class="text-green-400 hover:text-green-300 font-bold underline transition duration-200">${this.currentUser.username}</a></span>
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

    // Password edit buttons
    document.getElementById('editPasswordBtn')?.addEventListener('click', () => this.startEditPassword());
    document.getElementById('savePasswordBtn')?.addEventListener('click', () => this.savePassword());
    document.getElementById('cancelPasswordBtn')?.addEventListener('click', () => this.cancelEditPassword());
    
    // Real-time password validation
    const newPasswordInput = document.getElementById('newPasswordInput') as HTMLInputElement;
    newPasswordInput?.addEventListener('input', () => this.updatePasswordRequirements());

    // Real-time user search
    const searchInput = document.getElementById('searchUserInput') as HTMLInputElement;
    let searchTimeout: number;
    searchInput?.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = window.setTimeout(() => this.searchUsers(), 300);
    });
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

  // Password edit methods
  private startEditPassword(): void {
    const passwordDisplay = document.getElementById('profilePassword');
    const passwordForm = document.getElementById('passwordEditForm');
    
    passwordDisplay?.classList.add('hidden');
    passwordForm?.classList.remove('hidden');
  }

  private cancelEditPassword(): void {
    const passwordDisplay = document.getElementById('profilePassword');
    const passwordForm = document.getElementById('passwordEditForm');
    const currentPasswordInput = document.getElementById('currentPasswordInput') as HTMLInputElement;
    const newPasswordInput = document.getElementById('newPasswordInput') as HTMLInputElement;
    const confirmNewPasswordInput = document.getElementById('confirmNewPasswordInput') as HTMLInputElement;
    
    if (currentPasswordInput) currentPasswordInput.value = '';
    if (newPasswordInput) newPasswordInput.value = '';
    if (confirmNewPasswordInput) confirmNewPasswordInput.value = '';
    
    passwordDisplay?.classList.remove('hidden');
    passwordForm?.classList.add('hidden');
  }

  private updatePasswordRequirements(): void {
    const newPasswordInput = document.getElementById('newPasswordInput') as HTMLInputElement;
    const password = newPasswordInput?.value || '';
    
    // Check each requirement
    const hasMinLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    
    // Update indicators
    this.updateRequirement('req-length-edit', hasMinLength);
    this.updateRequirement('req-uppercase-edit', hasUppercase);
    this.updateRequirement('req-lowercase-edit', hasLowercase);
    this.updateRequirement('req-number-edit', hasNumber);
  }

  private updateRequirement(id: string, isValid: boolean): void {
    const element = document.getElementById(id);
    if (!element) return;
    
    const indicator = element.querySelector('.indicator');
    const text = element.querySelector('span:last-child');
    
    if (indicator) {
      indicator.textContent = isValid ? '✅' : '❌';
    }
    
    if (text) {
      if (isValid) {
        text.classList.remove('text-gray-400');
        text.classList.add('text-green-400');
      } else {
        text.classList.remove('text-green-400');
        text.classList.add('text-gray-400');
      }
    }
  }

  private async savePassword(): Promise<void> {
    const currentPasswordInput = document.getElementById('currentPasswordInput') as HTMLInputElement;
    const newPasswordInput = document.getElementById('newPasswordInput') as HTMLInputElement;
    const confirmNewPasswordInput = document.getElementById('confirmNewPasswordInput') as HTMLInputElement;
    
    const currentPassword = currentPasswordInput?.value || '';
    const newPassword = newPasswordInput?.value || '';
    const confirmNewPassword = confirmNewPasswordInput?.value || '';

    // Validate inputs
    if (!currentPassword) {
      this.showMessage('Please enter your current password', 'error');
      return;
    }

    if (!newPassword) {
      this.showMessage('Please enter a new password', 'error');
      return;
    }

    // Validate new password requirements
    const hasMinLength = newPassword.length >= 8;
    const hasUppercase = /[A-Z]/.test(newPassword);
    const hasLowercase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);

    if (!hasMinLength || !hasUppercase || !hasLowercase || !hasNumber) {
      this.showMessage('New password does not meet all requirements', 'error');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      this.showMessage('New passwords do not match', 'error');
      return;
    }

    try {
      const response = await fetch('/api/auth/change-password', { //does not exist yet
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({
          currentPassword: currentPassword,
          newPassword: newPassword,
        }),
      });

      if (response.ok) {
        this.cancelEditPassword();
        this.showMessage('Password updated successfully!', 'success');
      } else {
        const data = await response.json();
        this.showMessage(data.message || 'Failed to update password', 'error');
      }
    } catch (error) {
      console.error('Save password error:', error);
      this.showMessage('Failed to update password', 'error');
    }
  }

  private async searchUsers(): Promise<void> {
    const searchInput = document.getElementById('searchUserInput') as HTMLInputElement;
    const searchResults = document.getElementById('searchResults');
    
    if (!searchInput || !searchResults) return;
    
    const searchTerm = searchInput.value.trim();
    
    // Clear results if search is empty
    if (!searchTerm) {
      searchResults.innerHTML = '';
      return;
    }

    try {
      const response = await fetch('/api/user/', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const allProfiles = data.profiles || [];
        
        // Filter profiles by search term (case-insensitive)
        const filteredProfiles = allProfiles.filter((profile: any) => {
          const searchLower = searchTerm.toLowerCase();
          return profile.name.toLowerCase().includes(searchLower) || 
                 profile.email.toLowerCase().includes(searchLower);
        });
        
        searchResults.innerHTML = '';
        
        if (filteredProfiles.length === 0) {
          searchResults.innerHTML = '<p class="text-gray-400 text-sm p-3 bg-gray-700 rounded-lg">No users found</p>';
          return;
        }

        filteredProfiles.forEach((profile: any) => {
          // Don't show current user in search results
          if (this.currentUser && profile.id === this.currentUser.id) return;
          
          const userDiv = document.createElement('div');
          userDiv.className = 'flex items-center p-3 bg-gray-700 rounded-lg mt-2 hover:bg-gray-600 transition cursor-pointer';
          
          // Show avatar image if exists, otherwise show initial
          const avatarHtml = profile.avatarUrl 
            ? `<img src="${profile.avatarUrl}" class="w-10 h-10 rounded-full object-cover mr-3" alt="${profile.name}'s avatar" />`
            : `<div class="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold mr-3">
                ${profile.name.charAt(0).toUpperCase()}
              </div>`;
          
          userDiv.innerHTML = `
            <div class="flex items-center">
              ${avatarHtml}
              <div>
                <p class="text-white font-semibold">${profile.name}</p>
                <p class="text-gray-400 text-sm">${profile.email}</p>
              </div>
            </div>
          `;
          
          // Make the whole div clickable to view user profile
          userDiv.addEventListener('click', () => {
            window.location.href = `./other-profiles.html?id=${profile.id}`;
          });
          
          searchResults.appendChild(userDiv);
        });
      } else {
        this.showMessage('Failed to search users', 'error');
      }
    } catch (error) {
      console.error('Search users error:', error);
      this.showMessage('Failed to search users', 'error');
    }
  }

  private async loadFriendRequests(): Promise<void> {
    const friendRequestsList = document.getElementById('friendRequestsList');
    if (!friendRequestsList) return;

    try {
      const response = await fetch('/api/user/friend-request', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Friend requests response:', data);
        const requests = data.requests || [];
        console.log('Requests array:', requests);
        
        friendRequestsList.innerHTML = '';
        
        if (requests.length === 0) {
          friendRequestsList.innerHTML = '<p class="text-gray-400 text-sm">No pending friend requests</p>';
          return;
        }

        // Fetch user profiles using fromUserId
        for (const request of requests) {
          console.log('Processing request:', request);
          
          // Always fetch the user profile using fromUserId
          try {
            const userResponse = await fetch(`/api/user/${request.fromUserId}`, {
              headers: {
                'Authorization': `Bearer ${this.accessToken}`,
              },
            });
            
            if (userResponse.ok) {
              const userData = await userResponse.json();
              request.fromUser = userData.profile;
            }
          } catch (error) {
            console.error('Failed to fetch user profile:', error);
            // Set a default fromUser if fetch fails
            request.fromUser = {
              name: 'Unknown User',
              email: '',
              avatarUrl: null
            };
          }
          
          const requestDiv = document.createElement('div');
          requestDiv.className = 'flex items-center justify-between p-4 bg-gray-700 rounded-lg mb-2';
          
          const avatarHtml = request.fromUser.avatarUrl 
            ? `<img src="${request.fromUser.avatarUrl}" class="w-12 h-12 rounded-full object-cover mr-4" alt="${request.fromUser.name}'s avatar" />`
            : `<div class="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold mr-4">
                ${request.fromUser.name.charAt(0).toUpperCase()}
              </div>`;
          
          requestDiv.innerHTML = `
            <div class="flex items-center">
              ${avatarHtml}
              <div>
                <p class="text-white font-semibold">${request.fromUser.name}</p>
                <p class="text-gray-400 text-sm">${request.fromUser.email}</p>
              </div>
            </div>
            <div class="flex gap-2">
              <button class="accept-btn px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition" data-user-id="${request.fromUserId}">
                Accept
              </button>
              <button class="decline-btn px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition" data-user-id="${request.fromUserId}">
                Decline
              </button>
            </div>
          `;
          
          const acceptBtn = requestDiv.querySelector('.accept-btn');
          const declineBtn = requestDiv.querySelector('.decline-btn');
          
          acceptBtn?.addEventListener('click', () => this.acceptFriendRequest(request.fromUserId));
          declineBtn?.addEventListener('click', () => this.declineFriendRequest(request.fromUserId));
          
          friendRequestsList.appendChild(requestDiv);
        }
      } else {
        this.showMessage('Failed to load friend requests', 'error');
      }
    } catch (error) {
      console.error('Load friend requests error:', error);
      this.showMessage('Failed to load friend requests', 'error');
    }
  }

  private async acceptFriendRequest(fromUserId: string): Promise<void> {
    try {
      const response = await fetch(`/api/user/friend-request/${fromUserId}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (response.ok) {
        this.showMessage('Friend request accepted!', 'success');
        await this.loadFriendRequests();
      } else {
        const data = await response.json();
        this.showMessage(data.message || 'Failed to accept friend request', 'error');
      }
    } catch (error) {
      console.error('Accept friend request error:', error);
      this.showMessage('Failed to accept friend request', 'error');
    }
  }

  private async declineFriendRequest(fromUserId: string): Promise<void> {
    try {
      const response = await fetch(`/api/user/friend-request/${fromUserId}/decline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (response.ok) {
        this.showMessage('Friend request declined', 'success');
        await this.loadFriendRequests();
      } else {
        const data = await response.json();
        this.showMessage(data.message || 'Failed to decline friend request', 'error');
      }
    } catch (error) {
      console.error('Decline friend request error:', error);
      this.showMessage('Failed to decline friend request', 'error');
    }
  }

  private async loadFriends(): Promise<void> {
    const friendsList = document.getElementById('friendsList');
    if (!friendsList) return;

    try {
      const response = await fetch('/api/user/friend', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const friendships = data.friendships || [];
        
        friendsList.innerHTML = '';
        
        if (friendships.length === 0) {
          friendsList.innerHTML = '<p class="text-gray-400 text-sm">No friends yet</p>';
          return;
        }

        // Fetch friend profiles
        for (const friendship of friendships) {
          // Determine which user is the friend (not current user)
          const friendId = friendship.userAId === this.currentUser?.id 
            ? friendship.userBId 
            : friendship.userAId;
          
          try {
            const userResponse = await fetch(`/api/user/${friendId}`, {
              headers: {
                'Authorization': `Bearer ${this.accessToken}`,
              },
            });
            
            if (userResponse.ok) {
              const userData = await userResponse.json();
              const friend = userData.profile;
              
              const friendDiv = document.createElement('div');
              friendDiv.className = 'flex items-center justify-between p-4 bg-gray-700 rounded-lg';
              
              const avatarHtml = friend.avatarUrl 
                ? `<img src="${friend.avatarUrl}" class="w-12 h-12 rounded-full object-cover mr-4" alt="${friend.name}'s avatar" />`
                : `<div class="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold mr-4">
                    ${friend.name.charAt(0).toUpperCase()}
                  </div>`;
              
              friendDiv.innerHTML = `
                <div class="flex items-center cursor-pointer flex-1" data-friend-id="${friendId}">
                  ${avatarHtml}
                  <div>
                    <p class="text-white font-semibold">${friend.name}</p>
                    <p class="text-gray-400 text-sm">${friend.email}</p>
                  </div>
                </div>
                <button class="remove-friend-btn px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition" data-friend-id="${friendId}">
                  Remove
                </button>
              `;
              
              // Make profile clickable
              const profileClick = friendDiv.querySelector('[data-friend-id]');
              profileClick?.addEventListener('click', () => {
                window.location.href = `./other-profiles.html?id=${friendId}`;
              });
              
              // Add remove button handler
              const removeBtn = friendDiv.querySelector('.remove-friend-btn');
              removeBtn?.addEventListener('click', () => this.removeFriend(friendId));
              
              friendsList.appendChild(friendDiv);
            }
          } catch (error) {
            console.error('Failed to fetch friend profile:', error);
          }
        }
      } else {
        this.showMessage('Failed to load friends', 'error');
      }
    } catch (error) {
      console.error('Load friends error:', error);
      this.showMessage('Failed to load friends', 'error');
    }
  }

  private async removeFriend(friendId: string): Promise<void> {
    if (!confirm('Are you sure you want to remove this friend?')) return;

    try {
      const response = await fetch(`/api/user/friend/${friendId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (response.ok) {
        this.showMessage('Friend removed', 'success');
        await this.loadFriends();
      } else {
        const data = await response.json();
        this.showMessage(data.message || 'Failed to remove friend', 'error');
      }
    } catch (error) {
      console.error('Remove friend error:', error);
      this.showMessage('Failed to remove friend', 'error');
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
