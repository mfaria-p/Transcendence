import { initHeader } from './shared/header.js';

function wireMenuButtons(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>('.menu-btn[data-target]');
  buttons.forEach((btn) => {
    const target = btn.dataset.target;
    if (!target) return;
    btn.addEventListener('click', () => {
      window.location.href = target;
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initHeader({ active: 'home' });
  wireMenuButtons();

  const toggle = document.querySelector<HTMLButtonElement>('.menu-toggle');
  const body = document.body;
  if (toggle) {
	// reflect initial collapsed state
	const isCollapsed = body.classList.contains('menu-collapsed');
	toggle.setAttribute('aria-pressed', isCollapsed ? 'true' : 'false');

    toggle.addEventListener('click', () => {
      const collapsed = body.classList.toggle('menu-collapsed');
      toggle.setAttribute('aria-pressed', collapsed ? 'true' : 'false');
    });
  }
});
