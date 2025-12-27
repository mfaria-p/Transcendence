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

async function handleGoogleCallback() {
  const errorMessageEl = document.getElementById('errorMessage');
  
  try {
    // Get URL parameters sent by backend
    const urlParams = new URLSearchParams(window.location.search);
    // Check if there's an error from Google or backend
    const error = urlParams.get('error');
    if (error) {
        throw new Error(error);
    }
    const at = urlParams.get('at'); // JWT token
    const accountData = urlParams.get('account'); // User info
    
    if (at && accountData) {
        //Parse user data    
        const account = JSON.parse(decodeURIComponent(accountData));
        // Store access token
        localStorage.setItem('access_token', at); 
        // Store user info
        localStorage.setItem('user', JSON.stringify({
        id: account.id,
        username: account.username,
        email: account.email,
        }));

        // Provision profile in user service
        await provisionProfile(at);

        // Redirect to game
        window.location.href = './index.html';
        return;
    }
    // If we reach here and nothing happened, show error
    throw new Error('Google authentication failed - no credentials received');

  } catch (error: any) {
    console.error('Google callback error:', error);
    
    if (errorMessageEl) {
      errorMessageEl.textContent = error.message || 'Google authentication failed';
      errorMessageEl.classList.remove('hidden');
    }

    // Redirect back to login after 3 seconds
    setTimeout(() => {
      window.location.href = './login.html';
    }, 3000);
  }
}

async function provisionProfile(accessToken: string): Promise<void> {
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
      console.warn('Profile provision failed:', response.status);
    }
  } catch (error) {
    console.error('Profile provision error:', error);
  }
}

// Run on page load
document.addEventListener('DOMContentLoaded', handleGoogleCallback);