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
  private friendshipStatus: 'none' | 'friend' | 'pending_sent' | 'pending_received' = 'none';

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
        await this.checkFriendshipStatus();
        this.displayFriendActions();
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

  private async checkFriendshipStatus(): Promise<void> {
    if (!this.userId) return;

    try {
      // Check if already friends
      const friendsResponse = await fetch('/api/user/friend', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (friendsResponse.ok) {
        const data = await friendsResponse.json();
        const friendships = data.friendships || [];
        const isFriend = friendships.some((friendship: any) => {
          return friendship.userAId === this.userId || friendship.userBId === this.userId;
        });

        if (isFriend) {
          this.friendshipStatus = 'friend';
          return;
        }
      }

      // Check pending requests
      const requestsResponse = await fetch('/api/user/friend-request', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (requestsResponse.ok) {
        const data = await requestsResponse.json();
        const requests = data.requests || [];
        
        // Check if we have a pending request to this user
        const hasSentRequest = requests.some((req: any) => req.toUserId === this.userId);
        
        if (hasSentRequest) {
          this.friendshipStatus = 'pending_sent';
          return;
        }

        // Check if this user sent us a request
        const hasReceivedRequest = requests.some((req: any) => req.fromUserId === this.userId);
        
        if (hasReceivedRequest) {
          this.friendshipStatus = 'pending_received';
          return;
        }
      }

      this.friendshipStatus = 'none';
    } catch (error) {
      console.error('Check friendship status error:', error);
      this.friendshipStatus = 'none';
    }
  }

  private displayFriendActions(): void {
    const friendActions = document.getElementById('friendActions');
    if (!friendActions) return;

    switch (this.friendshipStatus) {
      case 'friend':
        friendActions.innerHTML = `
          <button id="removeFriendBtn" class="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition">
            Remove Friend
          </button>
        `;
        document.getElementById('removeFriendBtn')?.addEventListener('click', () => this.removeFriend());
        break;

      case 'pending_sent':
        friendActions.innerHTML = `
          <p class="text-yellow-400">Friend request pending...</p>
        `;
        break;

      case 'pending_received':
        friendActions.innerHTML = `
          <div class="flex gap-3">
            <button id="acceptRequestBtn" class="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition">
              Accept Friend Request
            </button>
            <button id="declineRequestBtn" class="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition">
              Decline
            </button>
          </div>
        `;
        document.getElementById('acceptRequestBtn')?.addEventListener('click', () => this.acceptFriendRequest());
        document.getElementById('declineRequestBtn')?.addEventListener('click', () => this.declineFriendRequest());
        break;

      case 'none':
      default:
        friendActions.innerHTML = `
          <button id="sendFriendRequestBtn" class="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">
            Send Friend Request
          </button>
        `;
        document.getElementById('sendFriendRequestBtn')?.addEventListener('click', () => this.sendFriendRequest());
        break;
    }
  }

  private async sendFriendRequest(): Promise<void> {
    if (!this.userId) return;

    try {
      const response = await fetch(`/api/user/friend-request/${this.userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        this.showMessage('Friend request sent!', 'success');
        this.friendshipStatus = 'pending_sent';
        this.displayFriendActions();
      } else {
        const data = await response.json();
        this.showMessage(data.message || 'Failed to send friend request', 'error');
      }
    } catch (error) {
      console.error('Send friend request error:', error);
      this.showMessage('Failed to send friend request', 'error');
    }
  }

  private async acceptFriendRequest(): Promise<void> {
    if (!this.userId) return;

    try {
      const response = await fetch(`/api/user/friend-request/${this.userId}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (response.ok) {
        this.showMessage('Friend request accepted!', 'success');
        this.friendshipStatus = 'friend';
        this.displayFriendActions();
      } else {
        const data = await response.json();
        this.showMessage(data.message || 'Failed to accept friend request', 'error');
      }
    } catch (error) {
      console.error('Accept friend request error:', error);
      this.showMessage('Failed to accept friend request', 'error');
    }
  }

  private async declineFriendRequest(): Promise<void> {
    if (!this.userId) return;

    try {
      const response = await fetch(`/api/user/friend-request/${this.userId}/decline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (response.ok) {
        this.showMessage('Friend request declined', 'success');
        this.friendshipStatus = 'none';
        this.displayFriendActions();
      } else {
        const data = await response.json();
        this.showMessage(data.message || 'Failed to decline friend request', 'error');
      }
    } catch (error) {
      console.error('Decline friend request error:', error);
      this.showMessage('Failed to decline friend request', 'error');
    }
  }

  private async removeFriend(): Promise<void> {
    if (!this.userId) return;
    
    if (!confirm('Are you sure you want to remove this friend?')) return;

    try {
      const response = await fetch(`/api/user/friend/${this.userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (response.ok) {
        this.showMessage('Friend removed', 'success');
        this.friendshipStatus = 'none';
        this.displayFriendActions();
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
  new UserProfileViewer();
});
