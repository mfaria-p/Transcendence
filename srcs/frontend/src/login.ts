interface LoginResponse {
  success: boolean;
  message: string;
  at?: string;  
  user?: { id: string; username: string; email: string };
}

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm') as HTMLFormElement;
  const emailInput = document.getElementById('email') as HTMLInputElement;
  const passwordInput = document.getElementById('password') as HTMLInputElement;
  const loginButton = document.getElementById('loginButton') as HTMLButtonElement;
  const errorMessage = document.getElementById('errorMessage') as HTMLDivElement;
  const successMessage = document.getElementById('successMessage') as HTMLDivElement;

  errorMessage.classList.add('hidden');
  successMessage.classList.add('hidden');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    errorMessage.classList.add('hidden');
    successMessage.classList.add('hidden');

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      errorMessage.textContent = 'Please fill in all fields';
      errorMessage.classList.remove('hidden');
      return;
    }

    loginButton.disabled = true;
    loginButton.textContent = 'Logging in...';
    loginButton.classList.add('opacity-50', 'cursor-not-allowed');

    try {
      const controller = new AbortController();
      const timeoutMs = 10_000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          email: email,
          password: password,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        const text = await response.text();
        data = { message: text || 'Unknown error' };
      }

      if (response.ok && data.success) {
        // Store tokens and user info
        if (data.at) {
          localStorage.setItem('access_token', data.at);
          
          // Provision profile in user service (in case it doesn't exist)
          if (data.user) {
            await provisionProfile(data.at, data.user.username, data.user.email);
          }
        }
        
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }

        successMessage.textContent = data.message || 'Login successful! Redirecting...';
        successMessage.classList.remove('hidden');

        setTimeout(() => {
          window.location.href = './index.html';
        }, 1000);
      } else {
        // Only use response.message for 401 errors
        const message = response.status === 401 
          ? (data?.message || 'Invalid email or password') 
          : `Login failed (${response.status})`;
        
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
        
        loginButton.disabled = false;
        loginButton.textContent = 'Login';
        loginButton.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      
      const message = error.name === 'AbortError' 
        ? 'Request timed out. Please try again.' 
        : 'Network error. Please try again.';
      
      errorMessage.textContent = message;
      errorMessage.classList.remove('hidden');
      
      loginButton.disabled = false;
      loginButton.textContent = 'Login';
      loginButton.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  });

  emailInput.addEventListener('input', () => {
    errorMessage.classList.add('hidden');
  });

  passwordInput.addEventListener('input', () => {
    errorMessage.classList.add('hidden');
  });
});

async function provisionProfile(accessToken: string, username: string, email: string): Promise<void> {
  try {
    console.log('Provisioning profile in user service...');
    const response = await fetch('/api/user/provision', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        username: username,
        email: email,
      }),
    });

    if (response.ok) {
      console.log('Profile provisioned successfully');
    } else {
      console.warn('Failed to provision profile:', response.status);
    }
  } catch (error) {
    console.error('Profile provision error:', error);
    // Don't fail login if profile creation fails
  }
}
