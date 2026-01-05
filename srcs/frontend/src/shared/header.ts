interface StoredUser {
  id: string;
  username: string;
  email: string;
}

export type HeaderActive = 'home' | 'quick' | 'tournaments' | 'profile' | 'match' | 'auth';

interface InitHeaderOptions {
  active?: HeaderActive;
}

export function initHeader(options: InitHeaderOptions = {}): void {
  const container = document.getElementById('globalHeader');
  if (!container) return;

  const resolvedActive = options.active === 'match' ? 'quick' : options.active;
  const { user, hasSession } = readSession();

  const navLinks = hasSession
    ? [
        { key: 'home' as const, label: 'Free play', href: './index.html' },
        { key: 'quick' as const, label: 'Quick match', href: './multiplayer.html' },
        { key: 'tournaments' as const, label: 'Tournaments', href: './tournaments.html' },
        { key: 'profile' as const, label: 'Profile', href: './profile.html' },
      ]
    : [];

  const navHtml = navLinks
    .map((link) => {
      const isActive = link.key === resolvedActive;
      const base = 'text-sm font-medium transition';
      const color = isActive ? 'text-green-400' : 'text-gray-300 hover:text-white';
      return `<a href="${link.href}" class="${base} ${color}">${link.label}</a>`;
    })
    .join('<span class="text-gray-600">|</span>');

  const authHtml = hasSession && user
    ? `
      <span class="text-gray-300 text-sm">Welcome, <a href="./profile.html" class="text-green-400 hover:text-green-300 font-semibold underline transition">${user.username}</a></span>
      <button id="globalLogoutButton" class="bg-red-600 hover:bg-red-700 text-white text-sm py-1.5 px-4 rounded transition">Logout</button>
    `
    : `
      <a href="./login.html" class="text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white py-1.5 px-4 rounded transition">Login</a>
      <a href="./signup.html" class="text-sm bg-green-600 hover:bg-green-700 text-white py-1.5 px-4 rounded transition">Sign Up</a>
    `;

  container.innerHTML = `
    <header class="sticky top-0 z-40 bg-gray-900/95 backdrop-blur border-b border-gray-800">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div class="flex items-center gap-6">
          <a href="./index.html" class="text-lg font-bold text-green-400 tracking-tight">PHONG</a>
          <nav class="flex items-center gap-4">${navHtml}</nav>
        </div>
        <div class="flex items-center gap-3">${authHtml}</div>
      </div>
    </header>
  `;

  const logoutButton = document.getElementById('globalLogoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      } catch (err) {
        console.error('Logout error', err);
      } finally {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        window.location.href = './login.html';
      }
    });
  }
}

function readSession(): { user: StoredUser | null; hasSession: boolean } {
  const userStr = localStorage.getItem('user');
  const token = localStorage.getItem('access_token');

  if (!userStr || !token) {
    return { user: null, hasSession: false };
  }

  try {
    const parsed = JSON.parse(userStr) as StoredUser;
    return { user: parsed, hasSession: true };
  } catch (err) {
    console.warn('Failed to parse stored user', err);
    localStorage.removeItem('user');
    return { user: null, hasSession: false };
  }
}
