import { provisionProfile } from './utils-api.js';

interface GoogleCallbackResponse {
  success: boolean;
  message: string;
  account?: {
    id: string;
    username: string;
    email: string;
    avatarUrl?: string;
  };
  at?: string;
}

// ...existing code...
async function handleGoogleCallback() {
  const errorMessageEl = document.getElementById('errorMessage');
  const loadingSpinner = document.getElementById('loadingSpinner');
  const statusText = document.getElementById('statusText');
  const redirectMessage = document.getElementById('redirectMessage');
  
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    
    if (error) {
      throw new Error(decodeURIComponent(error));
    }
    
    const at = urlParams.get('at');
    const accountData = urlParams.get('account');
    
    if (at && accountData) {
      const account = JSON.parse(decodeURIComponent(accountData));
      
      localStorage.setItem('access_token', at); 
      localStorage.setItem('user', JSON.stringify({
        id: account.id,
        username: account.username,
        email: account.email,
      }));

      await provisionProfile(at);

      window.location.href = './index.html';
      return;
    }
    
    throw new Error('Google authentication failed - no credentials received');

  } catch (error: any) {
    console.error('Google callback error:', error);
    
    if (loadingSpinner) loadingSpinner.classList.add('hidden');
    if (statusText) statusText.classList.add('hidden');
    
    if (errorMessageEl) {
      errorMessageEl.textContent = error.message || 'Google authentication failed';
      errorMessageEl.classList.remove('hidden');
    }
    
    if (redirectMessage) redirectMessage.classList.remove('hidden');

    setTimeout(() => {
      window.location.href = './login.html';
    }, 2000);
  }
}

// Run on page load
document.addEventListener('DOMContentLoaded', handleGoogleCallback);
