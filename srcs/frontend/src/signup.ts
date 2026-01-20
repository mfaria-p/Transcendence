import { initHeader } from './shared/header.js';
import { provisionProfile } from './utils-api.js';

interface SignupCredentials {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface SignupResponse {
  success: boolean;
  message: string;
  account?: { id: string; username: string; email: string };  
  at?: string;
}

class SignupManager {
  private form: HTMLFormElement;
  private usernameInput: HTMLInputElement;
  private emailInput: HTMLInputElement;
  private passwordInput: HTMLInputElement;
  private confirmPasswordInput: HTMLInputElement;
  private signupButton: HTMLButtonElement;
  private errorMessage: HTMLElement;
  private successMessage: HTMLElement;
  private passwordRequirements: HTMLElement;
  
  constructor() {
    initHeader({ active: 'auth' });

    this.form = document.getElementById('signupForm') as HTMLFormElement;
    this.usernameInput = document.getElementById('username') as HTMLInputElement;
    this.emailInput = document.getElementById('email') as HTMLInputElement;
    this.passwordInput = document.getElementById('password') as HTMLInputElement;
    this.confirmPasswordInput = document.getElementById('confirmPassword') as HTMLInputElement;
    this.signupButton = document.getElementById('signupButton') as HTMLButtonElement;
    this.errorMessage = document.getElementById('errorMessage') as HTMLElement;
    this.successMessage = document.getElementById('successMessage') as HTMLElement;
    this.passwordRequirements = document.getElementById('passwordRequirements') as HTMLElement;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSignup();
    });

    // Real-time password validation
    this.passwordInput.addEventListener('input', () => {
      this.updatePasswordRequirements();
      // Also check if passwords match when changing the first password
      if (this.confirmPasswordInput.value) {
        this.validatePasswordMatch();
      }
    });
    this.passwordInput.addEventListener('focus', () => {
      this.passwordRequirements.classList.remove('hidden');
    });
    this.confirmPasswordInput.addEventListener('input', () => this.validatePasswordMatch());

    // Clear errors when user starts typing
    this.usernameInput.addEventListener('input', () => {
      this.clearInputError(this.usernameInput);
      this.hideMessages(); 
    });
    
    this.emailInput.addEventListener('input', () => {
      this.clearInputError(this.emailInput);
      this.hideMessages(); 
    });

    this.passwordInput.addEventListener('input', () => {
      this.hideMessages(); // Hide general error message
    });
    
    this.confirmPasswordInput.addEventListener('input', () => {
      this.hideMessages(); // Hide general error message
    });
  }

  private async handleSignup(): Promise<void> {
    const credentials: SignupCredentials = {
      username: this.usernameInput.value.trim(),
      email: this.emailInput.value.trim(),
      password: this.passwordInput.value,
      confirmPassword: this.confirmPasswordInput.value
    };

    // Validate all fields
    const isUsernameValid = this.validateUsername();
    const isEmailValid = this.validateEmail();
    const isPasswordValid = this.validatePassword();
    const isPasswordMatchValid = this.validatePasswordMatch();

    if (!isUsernameValid || !isEmailValid || !isPasswordValid || !isPasswordMatchValid) {
      this.showError('Please fix the errors above');
      return;
    }

    this.setLoading(true);
    this.hideMessages();
    
    try {
      const response = await this.signupWithBackend({
        username: credentials.username,
        email: credentials.email,
        password: credentials.password
      });
      
      console.log('Signup response:', response);
      
      if (response.success) {
        console.log('Signup successful! Now logging in automatically...');
        
        try {
          const loginResponse = await this.loginAfterSignup(credentials.username, credentials.password);
          
          if (loginResponse.success && loginResponse.at) {
            localStorage.setItem('access_token', loginResponse.at);
            console.log('Stored access_token from login:', loginResponse.at);
            
            if (loginResponse.account) {
              localStorage.setItem('user', JSON.stringify({
                id: loginResponse.account.id,
                username: loginResponse.account.username,
                email: loginResponse.account.email
              }));
              console.log('Stored user from login');
              
              provisionProfile(loginResponse.at).catch(() => {});
            }
            
            this.showSuccess('Account created successfully! Redirecting...');
            
            setTimeout(() => {
              window.location.replace('./index.html');
            }, 2000);
          } else {
            this.showSuccess('Account created! Please log in to continue.');
            setTimeout(() => {
              window.location.replace('./login.html');
            }, 2000);
          }
        } catch (loginError: any) {
          this.showSuccess('Account created! Please log in to continue.');
          setTimeout(() => {
            window.location.replace('./login.html');
          }, 2000);
        }
      } else {
        const errorMessage = response.message || 'Signup failed';
        if (errorMessage.toLowerCase().includes('email')) {
          this.setInputError(this.emailInput, errorMessage);
        } else if (errorMessage.toLowerCase().includes('username')) {
          this.setInputError(this.usernameInput, errorMessage);
        }
        this.showError(errorMessage);
      }
    } catch (error: any) {
      this.showError(error.message || 'Connection error. Please try again.');
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

  private validateEmail(): boolean {
    const email = this.emailInput.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!email) {
      this.setInputError(this.emailInput, 'Email is required');
      return false;
    }
    
    if (!emailRegex.test(email)) {
      this.setInputError(this.emailInput, 'Please enter a valid email address');
      return false;
    }
    
    this.clearInputError(this.emailInput);
    return true;
  }

  private validatePassword(): boolean {
    const password = this.passwordInput.value;
    
    const hasMinLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasMinLength || !hasUppercase || !hasLowercase || !hasNumber) {
      this.setInputError(this.passwordInput, 'Password does not meet all requirements');
      return false;
    }
    
    this.clearInputError(this.passwordInput);
    return true;
  }

  private updatePasswordRequirements(): void {
    const password = this.passwordInput.value;
    
    // Check each requirement
    const hasMinLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    
    // Update indicators
    this.updateRequirement('req-length', hasMinLength);
    this.updateRequirement('req-uppercase', hasUppercase);
    this.updateRequirement('req-lowercase', hasLowercase);
    this.updateRequirement('req-number', hasNumber);

    // Clear any existing error if all requirements are met
    if (hasMinLength && hasUppercase && hasLowercase && hasNumber) {
      this.clearInputError(this.passwordInput);
    }
  }

  private updateRequirement(id: string, isValid: boolean): void {
    const element = document.getElementById(id);
    if (!element) return;
    
    const indicator = element.querySelector('.auth-req-indicator');
    const text = element.querySelector('span:last-child');
    
    if (indicator) {
      indicator.textContent = isValid ? '✅' : '❌';
    }
    
    if (text) {
      if (isValid) {
        text.classList.remove('text-gray-400');
        text.classList.add('text-green-400');
      } else {
        text.classList.remove('text-green-400');
        text.classList.add('text-gray-400');
      }
    }
  }

  private validatePasswordMatch(): boolean {
    const password = this.passwordInput.value;
    const confirmPassword = this.confirmPasswordInput.value;
    
    // Only validate if confirmPassword has been entered
    if (!confirmPassword) {
      this.clearInputError(this.confirmPasswordInput);
      return false;
    }

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

  private async signupWithBackend(payload: { username: string; email: string; password: string }): Promise<SignupResponse> {
    const url = '/api/auth/signup';
    const controller = new AbortController();
    const timeoutMs = 10_000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        const text = await res.text();
        data = { message: text || 'Unknown error' };
      }

      if (!res.ok) {
        const message = data?.message || `Signup failed (${res.status})`;
        return { success: false, message };
      }

      return data as SignupResponse;
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          throw new Error('Request timed out. Please try again.');
        }
        throw new Error(err.message || 'Network error');
      }
      throw new Error('Network error');
}
  }

  private async loginAfterSignup(username: string, password: string): Promise<any> {
    const url = '/api/auth/login';
    const controller = new AbortController();
    const timeoutMs = 10_000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          ident: username,
          password: password
        }),
        signal: controller.signal,
      });
      
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        const text = await res.text();
        data = { message: text || 'Unknown error' };
      }

      if (!res.ok) {
        const message = data?.message || `Login failed (${res.status})`;
        return { success: false, message };
      }

      return data;
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          throw new Error('Request timed out. Please try again.');
        }
        throw new Error(err.message || 'Network error');
      }
      throw new Error('Network error');
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
}

document.addEventListener('DOMContentLoaded', () => {
  new SignupManager();
});
