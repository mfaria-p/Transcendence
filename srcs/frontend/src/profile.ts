import { connectPresenceSocket, disconnectPresenceSocket } from './utils-ws.js';
import { verifySession, clearSessionAndRedirect, handleApiCall, showMessage, handleLogout } from './utils-api.js';

interface User {
  id: string;
  username: string;
  email: string;
}

interface Profile {
  id: string;
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
    const userStr = localStorage.getItem('user');
    this.accessToken = localStorage.getItem('access_token');

    if (!userStr || !this.accessToken) {
      window.location.href = './login.html';
      return;
    }

    try {
      this.currentUser = JSON.parse(userStr);
      await verifySession(this.accessToken);
      this.setupAuthContainer();
      connectPresenceSocket();
      
      await this.loadProfile();
      this.setupEventListeners();
      this.loadFriendRequests();
      this.loadFriends();
    } catch (error) {
      console.error('Init error:', error);
      showMessage('Session expired. Redirecting to login...', 'error');
      
      setTimeout(() => {
        clearSessionAndRedirect();
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

    document.getElementById('logoutButton')?.addEventListener('click', () => handleLogout());
  }

  private async loadProfile(): Promise<void> {
    try {
      const response = await handleApiCall(this.accessToken, '/api/user/me');

      if (response.ok) {
        const data = await response.json();
        this.currentProfile = data.profile;
        this.displayProfile();
      } else if (response.status === 404) {
        throw new Error('Profile not found');
      } else {
        throw new Error(`Failed to load profile: ${response.status}`);
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'Session expired') {
        return;
      }
      console.error('Load profile error:', error);
      throw error;
    }
  }

  private displayProfile(): void {
    if (!this.currentUser) return;

    const usernameEl = document.getElementById('profileUsername');
    const emailEl = document.getElementById('profileEmail');
    const avatarEl = document.getElementById('avatarPlaceholder');
    const avatarImg = document.getElementById('avatarImage') as HTMLImageElement;

    if (usernameEl) usernameEl.textContent = this.currentUser.username;
    if (emailEl) emailEl.textContent = this.currentUser.email;
    
    if (this.currentProfile?.avatarUrl && avatarImg) {
      avatarImg.src = this.currentProfile.avatarUrl;
      avatarImg.classList.remove('hidden');
      avatarEl?.classList.add('hidden');
    } else if (avatarEl) {
      avatarImg?.classList.add('hidden');
      avatarEl.classList.remove('hidden');
      avatarEl.textContent = this.currentUser.username.charAt(0).toUpperCase();
    }
  }

  private setupEventListeners(): void {
    document.getElementById('changePhotoBtn')?.addEventListener('click', () => this.openAvatarModal());
    document.getElementById('cancelAvatarBtn')?.addEventListener('click', () => this.closeAvatarModal());
    document.getElementById('avatarForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveAvatar();
    });

    document.getElementById('avatarUrlInput')?.addEventListener('input', (e) => {
      const input = e.target as HTMLInputElement;
      const url = input.value.trim();
      if (url) {
        this.previewAvatar(url);
      }
    });

    document.getElementById('editUsernameBtn')?.addEventListener('click', () => this.startEditUsername());
    document.getElementById('cancelUsernameBtn')?.addEventListener('click', () => this.cancelEditUsername());
    document.getElementById('saveUsernameBtn')?.addEventListener('click', () => this.saveUsername());

    document.getElementById('editEmailBtn')?.addEventListener('click', () => this.startEditEmail());
    document.getElementById('cancelEmailBtn')?.addEventListener('click', () => this.cancelEditEmail());
    document.getElementById('saveEmailBtn')?.addEventListener('click', () => this.saveEmail());

    document.getElementById('editPasswordBtn')?.addEventListener('click', () => this.startEditPassword());
    document.getElementById('cancelPasswordBtn')?.addEventListener('click', () => this.cancelEditPassword());
    document.getElementById('savePasswordBtn')?.addEventListener('click', () => this.savePassword());

    document.getElementById('newPasswordInput')?.addEventListener('input', () => this.updatePasswordRequirements());

    const searchInput = document.getElementById('searchUserInput');
    searchInput?.addEventListener('input', () => this.searchUsers());
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
      showMessage('Invalid image URL', 'error');
    };
    testImg.src = url;
  }

  private async saveAvatar(): Promise<void> {
    const avatarUrlInput = document.getElementById('avatarUrlInput') as HTMLInputElement;
    const url = avatarUrlInput?.value.trim();

    if (!url) {
      showMessage('Please enter an image URL', 'error');
      return;
    }

    try {
      const response = await handleApiCall(this.accessToken, '/api/user/provision', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          avatarUrl: url,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        this.currentProfile = data.profile;
        this.displayProfile();
        this.closeAvatarModal();
        showMessage('Profile picture updated!', 'success');
      } else {
        const data = await response.json();
        showMessage(data.message || 'Failed to update profile picture', 'error');
      }
    } catch (error) {
      if (error instanceof Error && error.message !== 'Session expired') {
        console.error('Save avatar error:', error);
        showMessage('Failed to update profile picture', 'error');
      }
    }
  }

  // Username edit methods
  private startEditUsername(): void {
    const usernameDisplay = document.getElementById('profileUsername');
    const usernameForm = document.getElementById('usernameEditForm');
    const usernameInput = document.getElementById('usernameInput') as HTMLInputElement;
    
    if (usernameInput && this.currentUser) {
      usernameInput.value = this.currentUser.username;
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
      showMessage('Username cannot be empty', 'error');
      return;
    }

    if (newUsername.length < 3 || newUsername.length > 20) {
      showMessage('Username must be between 3 and 20 characters', 'error');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
      showMessage('Username can only contain letters, numbers, and underscores', 'error');
      return;
    }

    try {
      const response = await handleApiCall(this.accessToken, '/api/auth/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: newUsername,
          email: this.currentUser?.email,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        if (this.currentUser) {
          this.currentUser.username = data.account.username;
          localStorage.setItem('user', JSON.stringify(this.currentUser));
        }
        
        this.displayProfile();
        this.cancelEditUsername();
        showMessage('Username updated successfully!', 'success');
        this.setupAuthContainer();
      } else {
        const data = await response.json();
        const message = response.status === 409 
          ? 'Username already taken' 
          : (data.message || 'Failed to update username');
        showMessage(message, 'error');
      }
    } catch (error) {
      if (error instanceof Error && error.message !== 'Session expired') {
        console.error('Save username error:', error);
        showMessage('Failed to update username', 'error');
      }
    }
  }

  // Email edit methods
  private startEditEmail(): void {
    const emailDisplay = document.getElementById('profileEmail');
    const emailForm = document.getElementById('emailEditForm');
    const emailInput = document.getElementById('emailInput') as HTMLInputElement;
    
    if (emailInput && this.currentUser) {
      emailInput.value = this.currentUser.email;
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
      showMessage('Email cannot be empty', 'error');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      showMessage('Please enter a valid email address', 'error');
      return;
    }

    try {
      const response = await handleApiCall(this.accessToken, '/api/auth/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: this.currentUser?.username,
          email: newEmail,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        if (this.currentUser) {
          this.currentUser.email = data.account.email;
          localStorage.setItem('user', JSON.stringify(this.currentUser));
        }

        this.displayProfile();
        this.cancelEditEmail();
        showMessage('Email updated successfully!', 'success');
      } else {
        const data = await response.json();
        const message = response.status === 409 
          ? 'Email already in use' 
          : (data.message || 'Failed to update email');
        showMessage(message, 'error');
      }
    } catch (error) {
      if (error instanceof Error && error.message !== 'Session expired') {
        console.error('Save email error:', error);
        showMessage('Failed to update email', 'error');
      }
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
      showMessage('Please enter your current password', 'error');
      return;
    }

    if (!newPassword) {
      showMessage('Please enter a new password', 'error');
      return;
    }

    // Validate new password requirements
    const hasMinLength = newPassword.length >= 8;
    const hasUppercase = /[A-Z]/.test(newPassword);
    const hasLowercase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);

    if (!hasMinLength || !hasUppercase || !hasLowercase || !hasNumber) {
      showMessage('New password does not meet all requirements', 'error');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      showMessage('New passwords do not match', 'error');
      return;
    }

    try {
      const response = await handleApiCall(this.accessToken, '/api/auth/me/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: currentPassword,
          password: newPassword,
        }),
      });

      if (response.ok) {
        this.cancelEditPassword();
        showMessage('Password updated successfully!', 'success');
      } else {
        const data = await response.json();
        showMessage(data.message || 'Failed to update password', 'error');
      }
    } catch (error) {
      if (error instanceof Error && error.message !== 'Session expired') {
        console.error('Save password error:', error);
        showMessage('Failed to update password', 'error');
      }
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
      const response = await handleApiCall(this.accessToken, `/api/auth/search?prefix=${encodeURIComponent(searchTerm)}`);

      if (response.ok) {
        const data = await response.json();
        const accounts = data.accounts || [];
        
        searchResults.innerHTML = '';
        
        if (accounts.length === 0) {
          searchResults.innerHTML = '<p class="text-gray-400 text-sm p-3 bg-gray-700 rounded-lg">No users found</p>';
          return;
        }

        // Fetch avatars for filtered accounts
        for (const account of accounts) {
          // Don't show current user in search results
          if (this.currentUser && account.id === this.currentUser.id) continue;
          
          // Try to fetch avatar from user service
          let avatarUrl = null;
          try {
            const profileRes = await handleApiCall(this.accessToken, `/api/user/${account.id}`);
            if (profileRes.ok) {
              const profileData = await profileRes.json();
              avatarUrl = profileData.profile?.avatarUrl;
            }
          } catch (error) {
            console.log('No avatar for user:', account.id);
          }
          
          const userDiv = document.createElement('div');
          userDiv.className = 'flex items-center p-3 bg-gray-700 rounded-lg mt-2 hover:bg-gray-600 transition cursor-pointer';
          
          // Show avatar image if exists, otherwise show initial
          const avatarHtml = avatarUrl
            ? `<img src="${avatarUrl}" class="w-10 h-10 rounded-full object-cover mr-3" alt="${account.username}'s avatar" />`
            : `<div class="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold mr-3">
                ${account.username.charAt(0).toUpperCase()}
              </div>`;
          
          userDiv.innerHTML = `
            <div class="flex items-center">
              ${avatarHtml}
              <div>
                <p class="text-white font-semibold">${account.username}</p>
                <p class="text-gray-400 text-sm">${account.email}</p>
              </div>
            </div>
          `;
          
          // Make the whole div clickable to view user profile
          userDiv.addEventListener('click', () => {
            window.location.href = `./other-profiles.html?id=${account.id}`;
          });
          
          searchResults.appendChild(userDiv);
        }
      } else {
        showMessage('Failed to search users', 'error');
      }
    } catch (error) {
      if (error instanceof Error && error.message !== 'Session expired') {
        console.error('Search users error:', error);
        showMessage('Failed to search users', 'error');
      }
    }
  }

  private async loadFriendRequests(): Promise<void> {
    const friendRequestsList = document.getElementById('friendRequestsList');
    if (!friendRequestsList) return;

    try {
      const response = await handleApiCall(this.accessToken, '/api/user/friend-request/received');

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

        // Fetch user profiles for each request
        for (const request of requests) {
          const fromProfileId = request.fromProfileId;
          
          try {
            const authResponse = await handleApiCall(this.accessToken, `/api/auth/${fromProfileId}`);
            
            let username = 'Unknown User';
            let email = '';
            
            if (authResponse.ok) {
              const authData = await authResponse.json();
              username = authData.account.username;
              email = authData.account.email;
            }
            
            // Fetch profile from user service for avatar
            let avatarUrl: string | null = null;
            try {
              const profileResponse = await handleApiCall(this.accessToken, `/api/user/${fromProfileId}`);
              
              if (profileResponse.ok) {
                const profileData = await profileResponse.json();
                avatarUrl = profileData.profile?.avatarUrl || null;
              }
            } catch (error) {
              console.log('No avatar for user:', fromProfileId);
            }
            
            // Create request card
            const requestDiv = document.createElement('div');
            requestDiv.className = 'flex items-center justify-between p-4 bg-gray-700 rounded-lg mb-2';
            
            const avatarHtml = avatarUrl
              ? `<img src="${avatarUrl}" class="w-12 h-12 rounded-full object-cover mr-4" alt="${username}'s avatar" />`
              : `<div class="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold mr-4">
                  ${username.charAt(0).toUpperCase()}
                </div>`;
            
            requestDiv.innerHTML = `
              <div class="flex items-center cursor-pointer flex-1" data-profile-id="${fromProfileId}">
                ${avatarHtml}
                <div>
                  <p class="text-white font-semibold">${username}</p>
                  <p class="text-gray-400 text-sm">${email}</p>
                </div>
              </div>
              <div class="flex gap-2">
                <button class="accept-btn px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition" data-profile-id="${fromProfileId}">
                  Accept
                </button>
                <button class="decline-btn px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition" data-profile-id="${fromProfileId}">
                  Decline
                </button>
              </div>
            `;

            // Make profile info clickable
            const profileClick = requestDiv.querySelector('.flex.items-center.cursor-pointer');
            profileClick?.addEventListener('click', () => {
              window.location.href = `./other-profiles.html?id=${fromProfileId}`;
            });
            
            const acceptBtn = requestDiv.querySelector('.accept-btn');
            const declineBtn = requestDiv.querySelector('.decline-btn');
            
            acceptBtn?.addEventListener('click', (e) => {
              e.stopPropagation(); // Prevent profile click
              this.acceptFriendRequest(fromProfileId);
            });
            
            declineBtn?.addEventListener('click', (e) => {
              e.stopPropagation(); // Prevent profile click
              this.declineFriendRequest(fromProfileId);
            });

            friendRequestsList.appendChild(requestDiv);
          } catch (error) {
            console.error('Failed to fetch user info:', error);
          }
        }
      } else {
        showMessage('Failed to load friend requests', 'error');
      }
    } catch (error) {
      if (error instanceof Error && error.message !== 'Session expired') {
        console.error('Load friend requests error:', error);
        showMessage('Failed to load friend requests', 'error');
      }
    }
  }

  private async acceptFriendRequest(fromProfileId: string): Promise<void> {
    try {
      const response = await handleApiCall(this.accessToken, `/api/user/friend-request/${fromProfileId}/accept`, {
        method: 'POST',
      });

      if (response.ok) {
        showMessage('Friend request accepted!', 'success');
        await this.loadFriendRequests();
        await this.loadFriends();
      } else {
        const data = await response.json();
        showMessage(data.message || 'Failed to accept friend request', 'error');
      }
    } catch (error) {
      if (error instanceof Error && error.message !== 'Session expired') {
        console.error('Accept friend request error:', error);
        showMessage('Failed to accept friend request', 'error');
      }
    }
  }

  private async declineFriendRequest(fromProfileId: string): Promise<void> {
    try {
      const response = await handleApiCall(this.accessToken, `/api/user/friend-request/${fromProfileId}/decline`, {
        method: 'POST',
      });

      if (response.ok) {
        showMessage('Friend request declined', 'success');
        await this.loadFriendRequests();
      } else {
        const data = await response.json();
        showMessage(data.message || 'Failed to decline friend request', 'error');
      }
    } catch (error) {
      if (error instanceof Error && error.message !== 'Session expired') {
        console.error('Decline friend request error:', error);
        showMessage('Failed to decline friend request', 'error');
      }
    }
  }

  private async loadFriends(): Promise<void> {
    const friendsList = document.getElementById('friendsList');
    if (!friendsList) return;

    try {
      const response = await handleApiCall(this.accessToken, '/api/user/friend');

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
          // Determine which profile is the friend (not current user)
          const friendId = friendship.profileAId === this.currentUser?.id 
            ? friendship.profileBId 
            : friendship.profileAId;
          
          try {
            const authResponse = await handleApiCall(this.accessToken, `/api/auth/${friendId}`);
            
            if (!authResponse.ok) continue;
            
            const authData = await authResponse.json();
            const account = authData.account;
            
            // Fetch profile from user service for avatar
            let avatarUrl: string | null = null;
            try {
              const profileResponse = await handleApiCall(this.accessToken, `/api/user/${friendId}`);
              
              if (profileResponse.ok) {
                const profileData = await profileResponse.json();
                avatarUrl = profileData.profile?.avatarUrl || null;
              }
            } catch (error) {
              console.log('No avatar for friend:', friendId);
            }
            
            // Fetch online status from ws service
            let isOnline = false;
            try {
              const presenceResponse = await handleApiCall(this.accessToken, `/api/realtime/presence/${friendId}`);
              
              if (presenceResponse.ok) {
                const presenceData = await presenceResponse.json();
                isOnline = presenceData.online || false;
              }
            } catch (error) {
              console.log('Could not check online status for friend:', friendId);
            }
            
            const friendDiv = document.createElement('div');
            friendDiv.className = 'flex items-center justify-between p-4 bg-gray-700 rounded-lg';

            // Avatar with status badge
            const avatarHtml = avatarUrl
              ? `<div class="relative inline-block mr-4">
                  <img src="${avatarUrl}" class="w-12 h-12 rounded-full object-cover" alt="${account.username}'s avatar" />
                  <div class="absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-gray-700 ${isOnline ? 'bg-green-500' : 'bg-gray-500'}" title="${isOnline ? 'Online' : 'Offline'}"></div>
                </div>`
              : `<div class="relative inline-block mr-4">
                  <div class="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                    ${account.username.charAt(0).toUpperCase()}
                  </div>
                  <div class="absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-gray-700 ${isOnline ? 'bg-green-500' : 'bg-gray-500'}" title="${isOnline ? 'Online' : 'Offline'}"></div>
                </div>`;
            
            friendDiv.innerHTML = `
              <div class="flex items-center cursor-pointer flex-1" data-friend-id="${friendId}">
                ${avatarHtml}
                <div>
                  <p class="text-white font-semibold">${account.username}</p>
                  <p class="text-gray-400 text-sm">${account.email}</p>
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
            removeBtn?.addEventListener('click', (e) => {
              e.stopPropagation(); // Prevent profile click
              this.removeFriend(friendId);
            });
            
            friendsList.appendChild(friendDiv);
          } catch (error) {
            console.error('Failed to fetch friend profile:', error);
          }
        }
      } else {
        showMessage('Failed to load friends', 'error');
      }
    } catch (error) {
      if (error instanceof Error && error.message !== 'Session expired') {
        console.error('Load friends error:', error);
        showMessage('Failed to load friends', 'error');
      }
    }
  }

  private async removeFriend(friendId: string): Promise<void> {
    if (!confirm('Are you sure you want to remove this friend?')) return;

    try {
      const response = await handleApiCall(this.accessToken, `/api/user/friend/${friendId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showMessage('Friend removed', 'success');
        await this.loadFriends();
      } else {
        const data = await response.json();
        showMessage(data.message || 'Failed to remove friend', 'error');
      }
    } catch (error) {
      if (error instanceof Error && error.message !== 'Session expired') {
        console.error('Remove friend error:', error);
        showMessage('Failed to remove friend', 'error');
      }
    }
  }

}

document.addEventListener('DOMContentLoaded', () => {
  new ProfileManager();
});