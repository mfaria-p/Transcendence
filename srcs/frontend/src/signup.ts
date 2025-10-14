interface SignupCredentials {
  username: string;
  password: string;
  confirmPassword: string;
}

interface SignupResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: { id: string; username: string };
}

class SignupManager {
  private form: HTMLFormElement;
  private usernameInput: HTMLInputElement;
  private passwordInput: HTMLInputElement;
  private confirmPasswordInput: HTMLInputElement;
  private signupButton: HTMLButtonElement;
  private errorMessage: HTMLElement;
  private successMessage: HTMLElement;
  
  constructor() {
    this.form = document.getElementById('signupForm') as HTMLFormElement;
    this.usernameInput = document.getElementById('username') as HTMLInputElement;
    this.passwordInput = document.getElementById('password') as HTMLInputElement;
    this.confirmPasswordInput = document.getElementById('confirmPassword') as HTMLInputElement;
    this.signupButton = document.getElementById('signupButton') as HTMLButtonElement;
    this.errorMessage = document.getElementById('errorMessage') as HTMLElement;
    this.successMessage = document.getElementById('successMessage') as HTMLElement;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSignup();
    });
  }

  private async handleSignup(): Promise<void> {
    const credentials: SignupCredentials = {
      username: this.usernameInput.value.trim(),
      password: this.passwordInput.value,
      confirmPassword: this.confirmPasswordInput.value
    };

    // Validate all fields
    const isUsernameValid = this.validateUsername();
    const isPasswordValid = this.validatePassword();
    const isPasswordMatchValid = this.validatePasswordMatch();

    if (!isUsernameValid || !isPasswordValid || !isPasswordMatchValid) {
      this.showError('Please fix the errors above');
      return;
    }

    this.setLoading(true);
    this.hideMessages();
    
    try {
      //  backend call later
      const response = await this.signupWithBackend({
          username: credentials.username,
          password: credentials.password
      });
      
      if (response.success) {
        
        // Store user info (for future use)
        if (response.token && response.user) {
          localStorage.setItem('authToken', response.token);
          localStorage.setItem('user', JSON.stringify(response.user));
        }

        this.showSuccess(response.message || 'Account created successfully!');

        // Redirect to game after 2 seconds
        setTimeout(() => {
          window.location.href = './index.html';
        }, 2000);
      } else {
        this.showError(response.message || 'Signup failed');
      }
    } catch (error) {
      console.error('Signup error:', error);
      this.showError('Connection error. Please try again.');
    } finally {
      this.setLoading(false);
    }
  }

  private validateUsername(): boolean {
    const username = this.usernameInput.value.trim();
    
    if (username.length < 3) {
      this.setInputError(this.usernameInput, 'Username must be at least 3 characters');
      return false;
    }
    
    if (username.length > 20) {
      this.setInputError(this.usernameInput, 'Username must be less than 20 characters');
      return false;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      this.setInputError(this.usernameInput, 'Username can only contain letters, numbers, and underscores');
      return false;
    }
    
    this.clearInputError(this.usernameInput);
    return true;
  }

  private validatePassword(): boolean {
    const password = this.passwordInput.value;

    if (password.length < 8) {
      this.setInputError(this.passwordInput, 'Password must be at least 8 characters');
      return false;
    }
    
    this.clearInputError(this.passwordInput);
    return true;
  }

  private validatePasswordMatch(): boolean {
    const password = this.passwordInput.value;
    const confirmPassword = this.confirmPasswordInput.value;
    
    if (password !== confirmPassword) {
      this.setInputError(this.confirmPasswordInput, 'Passwords do not match');
      return false;
    }
    
    this.clearInputError(this.confirmPasswordInput);
    return true;
  }

  private setInputError(input: HTMLInputElement, message: string): void {
    input.classList.add('border-red-500');
    input.classList.remove('border-gray-600');
    
    // Remove existing error message
    const existingError = input.parentElement?.querySelector('.error-message');
    if (existingError) {
      existingError.remove();
    }
    
    // Add new error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message text-red-400 text-xs mt-1';
    errorDiv.textContent = message;
    input.parentElement?.appendChild(errorDiv);
  }

  private clearInputError(input: HTMLInputElement): void {
    input.classList.remove('border-red-500');
    input.classList.add('border-gray-600');
    
    const existingError = input.parentElement?.querySelector('.error-message');
    if (existingError) {
      existingError.remove();
    }
  }

  private showError(message: string): void {
    this.errorMessage.textContent = message;
    this.errorMessage.classList.remove('hidden');
    this.successMessage.classList.add('hidden');
  }

  private setLoading(loading: boolean): void {
    this.signupButton.disabled = loading;
    this.signupButton.textContent = loading ? 'Creating Account...' : 'Sign Up';
    
    if (loading) {
      this.signupButton.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
      this.signupButton.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }

  private showSuccess(message: string): void {
    this.successMessage.textContent = message;
    this.successMessage.classList.remove('hidden');
    this.errorMessage.classList.add('hidden');
  }

  private hideMessages(): void {
    this.errorMessage.classList.add('hidden');
    this.successMessage.classList.add('hidden');
  }

  private async simulateSignup(credentials: SignupCredentials): Promise<SignupResponse> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    // Simulate existing user check
    if (credentials.username.toLowerCase() === 'admin' || credentials.username.toLowerCase() === 'test') {
      return {
        success: false,
        message: 'Username already taken. Please choose another one.'
      };
    }
    // Simulate successful signup
    return {
      success: true,
      message: 'Account created successfully!',
      token: 'signup-token-' + Date.now(),
      user: {
        id: Date.now().toString(),
        username: credentials.username
      }
    };
  }

    private async signupWithBackend(
        payload: { username: string; password: string }
    ): Promise<SignupResponse> {
        const url = '/api/auth/signup';
        const controller = new AbortController();
        const timeoutMs = 10_000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                credentials: 'include',
                body: JSON.stringify(payload),
                signal: controller.signal,
            });

            let data: any = null;
            try {
                data = await res.json();
            } catch {
                const text = await res.text();
                data = {message: text || null};
            }

            // 🔸 Caso o backend devolva só um token simples
            const token =
                typeof data === 'string'
                    ? data
                    : data?.token || data?.accessToken || null;

            if (token) {
                localStorage.setItem('authToken', token);
            }

            if (!res.ok) {
                const message = data?.message || `Signup failed (${res.status})`;
                return {success: false, message};
            }

            return {success: true, message: data?.message ?? 'Signup successful'};
        } catch (err: any) {
            if (err.name === 'AbortError') {
                throw new Error('Request timed out. Please try again.');
            }
            throw new Error(err?.message || 'Network error');
        } finally {
            clearTimeout(timeoutId);
        }
    }
}



document.addEventListener('DOMContentLoaded', () => {
  new SignupManager();
});
