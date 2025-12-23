interface LoginResponse {
  success: boolean;
  message: string;
  at?: string;  
  user?: { id: string; username: string; email: string };
}

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm') as HTMLFormElement;
  const identInput = document.getElementById('ident') as HTMLInputElement;
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

    const ident = identInput.value.trim();
    const password = passwordInput.value;

    if (!ident || !password) {
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
          ident: ident,  
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
          
          if (data.account) {
            provisionProfile(data.at).catch(err => {
              console.warn('Profile provision failed:', err);
            });
          }
        }

        if (data.account) {  
          localStorage.setItem('user', JSON.stringify({
            id: data.account.id,
            username: data.account.username,
            email: data.account.email
          }));
        }

        successMessage.textContent = data.message || 'Login successful! Redirecting...';
        successMessage.classList.remove('hidden');

        setTimeout(() => {
          window.location.href = './index.html';
        }, 1000);
      } else {
        const message = response.status === 401 
          ? (data?.message || 'Invalid email/username or password') 
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

  identInput.addEventListener('input', () => {
    errorMessage.classList.add('hidden');
  });

  passwordInput.addEventListener('input', () => {
    errorMessage.classList.add('hidden');
  });
});

async function provisionProfile(accessToken: string): Promise<void> {
  try {
    console.log('Provisioning profile in user service...');
    const response = await fetch('/api/user/provision', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}), // Empty body, ID comes from JWT
    });

    if (response.ok) {
      console.log('Profile provisioned successfully');
    } else {
      const errorText = await response.text();
      console.warn('Failed to provision profile:', response.status, errorText);
    }
  } catch (error) {
    console.error('Profile provision error:', error);
    throw error;
  }
}
