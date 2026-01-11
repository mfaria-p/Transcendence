import { handleLogout } from '../utils-api.js';

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
  const { user, hasSession } = readSession();
  const body = document.body;

  // Ensure collapsed by default
  if (!body.classList.contains('menu-collapsed')) {
    body.classList.add('menu-collapsed');
  }

  const menuColumn = ensureMenuColumn(hasSession);
  wireMenu(menuColumn, body);
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

type MenuColor = 'cyan' | 'magenta' | 'green' | 'amber' | 'purple';

interface MenuEntry {
  label: string;
  href: string;
  color: MenuColor;
  iconClass: string;
}

function buildMenuEntries(hasSession: boolean): MenuEntry[] {
  const sessionEntry: MenuEntry = hasSession
    ? { label: 'PROFILE', href: './profile.html', color: 'cyan', iconClass: 'icon-user' }
    : { label: 'SIGN IN / UP', href: './login.html', color: 'cyan', iconClass: 'icon-user' };

  return [
    sessionEntry,
    { label: 'TOURNAMENTS', href: './tournaments.html', color: 'magenta', iconClass: 'icon-trophy' },
    { label: '1v1 MATCH', href: './multiplayer.html', color: 'green', iconClass: 'icon-gamepad' },
    { label: 'PLAY vs AI', href: './match.html', color: 'amber', iconClass: 'icon-robot' },
    { label: 'CHAT', href: './profile.html', color: 'purple', iconClass: 'icon-chat' },
  ];
}

function ensureMenuColumn(hasSession: boolean): HTMLElement {
  const existing = document.querySelector<HTMLElement>('.menu-column');
  if (existing) {
    hydrateMenuButtons(existing, hasSession);
    return existing;
  }

  const entries = buildMenuEntries(hasSession);
  const section = document.createElement('section');
  section.className = 'menu-column';
  section.innerHTML = `
    <button class="menu-toggle" type="button" aria-pressed="false" aria-label="Toggle menu">
      <span class="menu-icon icon-next" aria-hidden="true"></span>
    </button>
    <div class="menu-stack">
      <div class="menu">
        ${entries
          .map(
            (entry) => `
              <button class="menu-btn ${entry.color}" data-target="${entry.href}">
                <span class="menu-icon ${entry.iconClass}" aria-hidden="true"></span>
                <span>${entry.label}</span>
              </button>
            `,
          )
          .join('')}
      </div>
    </div>
  `;

  document.body.appendChild(section);
  return section;
}

function hydrateMenuButtons(menuColumn: HTMLElement, hasSession: boolean): void {
  const entries = buildMenuEntries(hasSession);
  const buttons = menuColumn.querySelectorAll<HTMLButtonElement>('.menu-btn');

  buttons.forEach((btn, idx) => {
    const entry = entries[idx];
    if (!entry) return;

    btn.dataset.target = entry.href;
    btn.classList.remove('cyan', 'magenta', 'green', 'amber', 'purple');
    btn.classList.add(entry.color);

    const label = btn.querySelector<HTMLElement>('span:last-child');
    if (label) label.textContent = entry.label;

    const icon = btn.querySelector<HTMLElement>('.menu-icon');
    if (icon) icon.className = `menu-icon ${entry.iconClass}`;
  });
}

function wireMenu(menuColumn: HTMLElement, body: HTMLElement): void {
  const toggle = menuColumn.querySelector<HTMLButtonElement>('.menu-toggle');
  if (toggle) {
    const sync = () => {
      const collapsed = body.classList.contains('menu-collapsed');
      toggle.setAttribute('aria-pressed', collapsed ? 'true' : 'false');
    };

    sync();
    toggle.addEventListener('click', () => {
      const collapsed = body.classList.toggle('menu-collapsed');
      toggle.setAttribute('aria-pressed', collapsed ? 'true' : 'false');
    });
  }

  const menuButtons = menuColumn.querySelectorAll<HTMLButtonElement>('.menu-btn[data-target]');
  menuButtons.forEach((btn) => {
    const target = btn.dataset.target;
    if (!target) return;
    btn.addEventListener('click', () => {
      window.location.href = target;
    });
  });
}
