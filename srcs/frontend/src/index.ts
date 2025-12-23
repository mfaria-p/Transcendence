import { connectPresenceSocket, disconnectPresenceSocket } from './presence-ws.js';

interface User {
  id: string;
  username: string;
  email: string;
}

let accessToken: string | null = null;

document.addEventListener('DOMContentLoaded', async () => {
  const authContainer = document.getElementById('authContainer');
  
  if (!authContainer) {
    console.error('Auth container not found!');
    return;
  }

  const userStr = localStorage.getItem('user');
  accessToken = localStorage.getItem('access_token');
  
  console.log('Auth check - userStr:', userStr);
  console.log('Auth check - accessToken:', accessToken);
  
  if (userStr && accessToken) {
    try {
      const user: User = JSON.parse(userStr);
      
      // Verify session is still valid
      const isValid = await verifySession(accessToken);
      
      if (isValid) {
        console.log('User logged in:', user);
        connectPresenceSocket();
        showLoggedInState(authContainer, user);
      } else {
        console.log('Session expired, showing logged out state');
        clearSessionAndShowLoggedOut(authContainer);
      }
    } catch (error) {
      console.error('Error parsing user data or verifying session:', error);
      clearSessionAndShowLoggedOut(authContainer);
    }
  } else {
    console.log('No user found, showing logged out state');
    showLoggedOutState(authContainer);
  }
});

async function verifySession(token: string): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    return response.ok;
  } catch (error) {
    console.error('Session verification failed:', error);
    return false;
  }
}

function clearSessionAndShowLoggedOut(container: HTMLElement): void {
  disconnectPresenceSocket();
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
  showLoggedOutState(container);
}

function showLoggedInState(container: HTMLElement, user: User): void {
  container.innerHTML = `
    <div class="flex items-center gap-3">
      <span class="text-gray-300">Welcome, <a href="./profile.html" class="text-green-400 hover:text-green-300 font-bold underline transition duration-200">${user.username}</a></span>
      <button 
        id="logoutButton"
        class="bg-red-600 hover:bg-red-700 text-white text-sm py-1.5 px-4 rounded transition duration-200"
      >
        Logout
      </button>
    </div>
  `;
  
  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', handleLogout);
  }
}

function showLoggedOutState(container: HTMLElement): void {
  console.log('Rendering logged OUT state');
  container.innerHTML = `
    <a href="./login.html" class="bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white text-sm py-1.5 px-4 rounded transition duration-200">
      Login
    </a>
    <a href="./signup.html" class="bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white text-sm py-1.5 px-4 rounded transition duration-200">
      Sign Up
    </a>
  `;
}

async function handleLogout(): Promise<void> {
  disconnectPresenceSocket();
  
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
    
    console.log('Logged out, refreshing UI...');
    window.location.reload();
  }
}