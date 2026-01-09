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
});
