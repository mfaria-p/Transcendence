export interface FooterOptions {
  containerId?: string;
}

// Render a subtle global footer with terms link and attribution.
export function initFooter(options: FooterOptions = {}): void {
  const target = options.containerId
    ? document.getElementById(options.containerId) ?? document.body
    : document.body;

  // Avoid duplicating the footer if already rendered
  if (target.querySelector('#globalFooter')) return;

  const footer = document.createElement('footer');
  footer.id = 'globalFooter';
  footer.className = 'mt-6';

  const footerColor = 'rgba(42, 81, 175, 0.6)';
  footer.style.color = footerColor;

  const year = new Date().getFullYear();

  footer.innerHTML = `
    <div class="mx-auto w-full max-w-6xl px-4 py-6 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 text-sm" style="color:${footerColor};">
      <a href="./terms.html" class="transition-opacity hover:opacity-80" style="color:${footerColor};">Terms &amp; Conditions</a>
      <span>@ ${year}</span>
      <span>By Grupo maravilhoso</span>
    </div>
  `;

  target.appendChild(footer);
}
