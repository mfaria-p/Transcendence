import { connectPresenceSocket, disconnectPresenceSocket } from './utils-ws.js';
import { verifySession, clearSessionAndRedirect, handleApiCall, showMessage, handleLogout } from './utils-api.js';

interface User {
  id: string;
  username: string;
  email: string;
}

interface Account {
  id: string;
  username: string;
  email: string;
}

interface ViewedUser {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
}

class UserProfileViewer {
  private currentUser: User | null = null;
  private viewedUser: ViewedUser | null = null;
  private accessToken: string | null = null;
  private userId: string | null = null;
  private friendshipStatus: 'none' | 'friend' | 'pending_sent' | 'pending_received' = 'none';
  private isOnline: boolean = false;

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
      
      const urlParams = new URLSearchParams(window.location.search);
      this.userId = urlParams.get('id');

      if (!this.userId) {
        showMessage('No user ID provided', 'error');
        setTimeout(() => window.location.href = './profile.html', 2000);
        return;
      }

      await this.loadUserProfile(this.userId);
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

  private async loadUserProfile(userId: string): Promise<void> {
    try {
      const authResponse = await handleApiCall(this.accessToken, `/api/auth/${userId}`);

      if (!authResponse.ok) {
        if (authResponse.status === 404) {
          showMessage('User not found', 'error');
          setTimeout(() => window.location.href = './profile.html', 2000);
          return;
        }
        throw new Error('Failed to load user account');
      }

      const authData = await authResponse.json();
      const account: Account = authData.account;

      let avatarUrl: string | undefined = undefined;
      try {
        const profileResponse = await handleApiCall(this.accessToken, `/api/user/${userId}`);
        
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          avatarUrl = profileData.profile?.avatarUrl;
        }
      } catch (error) {
        console.log('No profile found for user, using defaults');
      }

      try {
        const presenceResponse = await handleApiCall(this.accessToken, `/api/realtime/presence/${userId}`);
        
        if (presenceResponse.ok) {
          const presenceData = await presenceResponse.json();
          this.isOnline = presenceData.online || false;
          console.log(`User ${userId} online status:`, this.isOnline);
        }
      } catch (error) {
        console.log('Could not check online status');
        this.isOnline = false;
      }

      this.viewedUser = {
        id: account.id,
        username: account.username,
        email: account.email,
        avatarUrl: avatarUrl,
      };

      await this.checkFriendshipStatus();
      this.displayProfile();
      this.displayFriendActions();
    } catch (error) {
      console.error('Load user profile error:', error);
      if (error instanceof Error && error.message === 'Session expired') {
        return;
      }
      
      showMessage('Failed to load user profile', 'error');
      setTimeout(() => window.location.href = './profile.html', 2000);
    }
  }

  private displayProfile(): void {
    if (!this.viewedUser) return;

    const usernameEl = document.getElementById('userUsername');
    const emailEl = document.getElementById('userEmail');
    const avatarEl = document.getElementById('userAvatarPlaceholder');
    const avatarImg = document.getElementById('userAvatarImage') as HTMLImageElement;
    const statusBadge = document.getElementById('statusBadge');

    console.log('=== Display Profile Debug ===');
    console.log('Username:', this.viewedUser.username);
    console.log('Is Online:', this.isOnline);
    console.log('Friendship Status:', this.friendshipStatus);

    if (usernameEl) usernameEl.textContent = this.viewedUser.username;
    if (emailEl) emailEl.textContent = this.viewedUser.email;
    
    if (this.viewedUser.avatarUrl && avatarImg) {
      avatarImg.src = this.viewedUser.avatarUrl;
      avatarImg.classList.remove('hidden');
      avatarEl?.classList.add('hidden');
    } else if (avatarEl) {
      avatarImg?.classList.add('hidden');
      avatarEl.classList.remove('hidden');
      avatarEl.textContent = this.viewedUser.username.charAt(0).toUpperCase();
    }

    if (statusBadge) {
      if (this.friendshipStatus === 'friend') {
        statusBadge.classList.remove('hidden', 'bg-gray-500', 'bg-green-500');

        if (this.isOnline) {
          statusBadge.classList.add('bg-green-500');
          statusBadge.title = 'Online';
          console.log('Friend is ONLINE (green badge)');
        } else {
          statusBadge.classList.add('bg-gray-500');
          statusBadge.title = 'Offline';
          console.log('Friend is OFFLINE (gray badge)');
        }
      } else {
        statusBadge.classList.add('hidden');
        console.log('Not friends, badge hidden');
      }
    }
  }

  private async checkFriendshipStatus(): Promise<void> {
    if (!this.userId) return;

    try {
      const friendsResponse = await handleApiCall(this.accessToken, '/api/user/friend');

      if (friendsResponse.ok) {
        const data = await friendsResponse.json();
        const friendships = data.friendships || [];
        const isFriend = friendships.some((friendship: any) => {
          return friendship.profileAId === this.userId || friendship.profileBId === this.userId;
        });

        if (isFriend) {
          this.friendshipStatus = 'friend';
          return;
        }
      }

      const receivedRequestsResponse = await handleApiCall(this.accessToken, '/api/user/friend-request/received');

      if (receivedRequestsResponse.ok) {
        const data = await receivedRequestsResponse.json();
        const requests = data.requests || [];
        
        const receivedRequest = requests.find((req: any) => 
          req.fromProfileId === this.userId && req.status === 'PENDING'
        );
        
        if (receivedRequest) {
          this.friendshipStatus = 'pending_received';
          return;
        }
      }

      const sentRequestsResponse = await handleApiCall(this.accessToken, '/api/user/friend-request/sent');

      if (sentRequestsResponse.ok) {
        const data = await sentRequestsResponse.json();
        const sentRequests = data.requests || [];
        
        const sentRequest = sentRequests.find((req: any) => 
          req.toProfileId === this.userId && req.status === 'PENDING'
        );
        
        if (sentRequest) {
          this.friendshipStatus = 'pending_sent';
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
          <div class="flex flex-col items-center gap-3">
            <p class="text-yellow-400 font-semibold">Friend request sent</p>
            <button id="cancelRequestBtn" class="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition">
              Cancel Request
            </button>
          </div>
        `;
        document.getElementById('cancelRequestBtn')?.addEventListener('click', () => this.cancelFriendRequest());
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
      const response = await handleApiCall(this.accessToken, `/api/user/friend-request/${this.userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: '', // Add empty message or optional message
        }),
      });

      if (response.ok) {
        showMessage('Friend request sent!', 'success');
        this.friendshipStatus = 'pending_sent';
        this.displayFriendActions();
      } else {
        const data = await response.json();
        showMessage(data.message || 'Failed to send friend request', 'error');
      }
    } catch (error) {
      if (error instanceof Error && error.message !== 'Session expired') {
        console.error('Send friend request error:', error);
        showMessage('Failed to send friend request', 'error');
      }
    }
  }

  private async cancelFriendRequest(): Promise<void> {
    if (!this.userId) return;

    try {
      const response = await handleApiCall(this.accessToken, `/api/user/friend-request/${this.userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showMessage('Friend request cancelled', 'success');
        this.friendshipStatus = 'none';
        this.displayFriendActions();
      } else {
        const data = await response.json();
        showMessage(data.message || 'Failed to cancel friend request', 'error');
      }
    } catch (error) {
      if (error instanceof Error && error.message !== 'Session expired') {
        console.error('Cancel friend request error:', error);
        showMessage('Failed to cancel friend request', 'error');
      }
    }
  }

  private async acceptFriendRequest(): Promise<void> {
    if (!this.userId) return;

    try {
      const response = await handleApiCall(this.accessToken, `/api/user/friend-request/${this.userId}/accept`, {
        method: 'POST',
      });

      if (response.ok) {
        showMessage('Friend request accepted!', 'success');
        this.friendshipStatus = 'friend';
        this.displayFriendActions();
        this.displayProfile();
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

  private async declineFriendRequest(): Promise<void> {
    if (!this.userId) return;

    try {
      const response = await handleApiCall(this.accessToken, `/api/user/friend-request/${this.userId}/decline`, {
        method: 'POST',
      });

      if (response.ok) {
        showMessage('Friend request declined', 'success');
        this.friendshipStatus = 'none';
        this.displayFriendActions();
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

  private async removeFriend(): Promise<void> {
    if (!this.userId) return;
    
    if (!confirm('Are you sure you want to remove this friend?')) return;

    try {
      const response = await handleApiCall(this.accessToken, `/api/user/friend/${this.userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showMessage('Friend removed', 'success');
        this.friendshipStatus = 'none';
        this.displayFriendActions();
        this.displayProfile();
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
  new UserProfileViewer();
});