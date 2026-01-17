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

  setupMenuAutoHide();
  preventArrowScroll();
});

function setupMenuAutoHide(): void {
  const gameCanvas = document.getElementById('gameCanvas');
  if (!gameCanvas) return;

  const mqMobile = window.matchMedia('(max-width: 900px)');
  const mqLandscape = window.matchMedia('(orientation: landscape)');
  const mqCoarse = window.matchMedia('(pointer: coarse)');

  let lastIntersecting = false;

  const compute = () => {
    const shouldHide = mqMobile.matches && mqLandscape.matches && mqCoarse.matches && lastIntersecting;
    document.body.classList.toggle('menu-hidden', shouldHide);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      lastIntersecting = entries.some((entry) => entry.isIntersecting);
      compute();
    },
    { threshold: 0.35 },
  );

  observer.observe(gameCanvas);

  const handleChange = () => compute();
  mqMobile.addEventListener('change', handleChange);
  mqLandscape.addEventListener('change', handleChange);
  mqCoarse.addEventListener('change', handleChange);

  window.addEventListener('beforeunload', () => {
    observer.disconnect();
    mqMobile.removeEventListener('change', handleChange);
    mqLandscape.removeEventListener('change', handleChange);
    mqCoarse.removeEventListener('change', handleChange);
  });
}

function preventArrowScroll(): void {
  const handler = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;

    // Allow typing/navigation inside form controls or contenteditable elements
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
      return;
    }

    if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
    }
  };

  window.addEventListener('keydown', handler, { passive: false });
  window.addEventListener('beforeunload', () => {
    window.removeEventListener('keydown', handler);
  });
}