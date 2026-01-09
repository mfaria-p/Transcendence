import { connectPresenceSocket, disconnectPresenceSocket } from './utils-ws.js';
import { verifySession } from './utils-api.js';
import { initHeader } from './shared/header.js';

document.addEventListener('DOMContentLoaded', async () => {
  const userStr = localStorage.getItem('user');
  const accessToken = localStorage.getItem('access_token');
  
  console.log('Auth check - userStr:', userStr);
  console.log('Auth check - accessToken:', accessToken);
  
  if (userStr && accessToken) {
    try {
      await verifySession(accessToken);
      
      console.log('User logged in');
      initHeader({ active: 'home' });
      connectPresenceSocket();
    } catch (error) {
      console.error('Error verifying session:', error);
      disconnectPresenceSocket();
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      // Re-initialize header without user data
      initHeader({ active: 'home' });
    }
  } else {
    console.log('No user found');
    // Initialize header for non-authenticated user
    initHeader({ active: 'home' });
  }
});