import { disconnectPresenceSocket } from './utils-ws.js';

//Verify if the current session is still valid
export async function verifySession(accessToken: string): Promise<void> {
  try {
    const response = await fetch('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (response.status === 401) {
      throw new Error('Session expired');
    }

    if (!response.ok) {
      throw new Error(`Auth check failed (${response.status})`);
    }
  } catch (error) {
    throw error;
  }
}

//Clear session data and redirect to login page
export function clearSessionAndRedirect(): void {
  disconnectPresenceSocket();
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
  window.location.href = './login.html';
}

//Enhanced API call wrapper that handles authorization and session expiration
export async function handleApiCall(
  accessToken: string | null,
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  // Handle 401 Unauthorized - token expired
  if (response.status === 401) {
    showMessage('Session expired. Please log in again.', 'error');
    setTimeout(() => {
      clearSessionAndRedirect();
    }, 1500);
    throw new Error('Session expired');
  }

  return response;
}

//Show a temporary message notification to the user
export function showMessage(message: string, type: 'success' | 'error'): void {
  const container = document.getElementById('messageContainer');
  if (!container) {
    return;
  }

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

//Logout user by calling backend logout endpoint and clearing local data
export async function handleLogout(): Promise<void> {
  disconnectPresenceSocket();
  
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch (error) {
  } finally {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    window.location.href = './login.html';
  }
}

//Provision user profile in user service after authentication
export async function provisionProfile(accessToken: string): Promise<void> {
  try {
    const response = await fetch('/api/user/provision', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
    }
  } catch (error) {
  }
}