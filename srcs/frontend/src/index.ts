interface User {
  id: string;
  username: string;
  email: string;
}

document.addEventListener('DOMContentLoaded', () => {
  const authContainer = document.getElementById('authContainer');
  
  if (!authContainer) {
    console.error('Auth container not found!');
    return;
  }

  // STEP 1: Check if user is logged in
  const userStr = localStorage.getItem('user');
  const accessToken = localStorage.getItem('access_token');
  
  console.log('Auth check - userStr:', userStr);
  console.log('Auth check - accessToken:', accessToken);
  
  if (userStr && accessToken) {
    // User is logged in
    try {
      const user: User = JSON.parse(userStr);
      console.log('User logged in:', user);
      showLoggedInState(authContainer, user);
    } catch (error) {
      console.error('Error parsing user data:', error);
      showLoggedOutState(authContainer);
    }
  } else {
    // User is logged out
    console.log('No user found, showing logged out state');
    showLoggedOutState(authContainer);
  }
});

function showLoggedInState(container: HTMLElement, user: User): void {
  container.innerHTML = `
    <div class="flex items-center gap-3">
      <span class="text-gray-300">Welcome, <strong class="text-green-400">${user.username}</strong></span>
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
  try {
    // Call backend logout endpoint (clears refresh token cookie)
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include', // Send cookies
    });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    // Clear localStorage regardless of API success
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    
    console.log('Logged out, refreshing UI...');
    
    // Refresh the page to show logged out state
    window.location.reload();
  }
}