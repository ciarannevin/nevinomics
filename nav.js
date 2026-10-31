'use strict';

(function () {
  const pages = [
    { href: 'index.html', label: 'Home' },
    { href: 'output.html', label: 'Output' },
    { href: 'labour.html', label: 'Labour' },
    { href: 'prices.html', label: 'Prices' },
    { href: 'fiscal.html', label: 'Fiscal' },
    { href: 'financial.html', label: 'Financial' },
    { href: 'global.html', label: 'Global' },
    { href: 'about.html', label: 'About' },
  ];

  function currentPage() {
    const path = location.pathname.split('/').pop() || 'index.html';
    return path === '' || path === 'nevinomics' ? 'index.html' : path;
  }

  function renderNav() {
    const bar = document.createElement('div');
    bar.className = 'topbar';
    const current = currentPage();
    bar.innerHTML =
      '<div class="topbar-inner">' +
      '<a class="wordmark" href="index.html">' +
      '<svg class="brand-mark" width="22" height="22" viewBox="0 0 30 30" aria-hidden="true">' +
      '<path d="M8 25 V5 L22 25 V5" fill="none" stroke="#1a1a1a" stroke-width="3.6" stroke-linecap="square"/>' +
      '<circle cx="19.6" cy="7.4" r="3.4" fill="rgba(62,124,89,0.6)"/>' +
      '<circle cx="22.4" cy="5.2" r="3.4" fill="rgba(140,90,122,0.6)"/>' +
      '</svg>' +
      'nevin<span>omics</span></a>' +
      '<nav class="site-nav">' +
      pages
        .map(
          (p) =>
            `<a href="${p.href}"${p.href === current ? ' class="active"' : ''}>${p.label}</a>`
        )
        .join('') +
      '</nav></div>';
    document.body.prepend(bar);
  }

  function renderFooter() {
    const footer = document.createElement('footer');
    footer.className = 'site-footer';
    footer.innerHTML =
      '<div class="inner">' +
      '<span class="footer-brand">' +
      '<svg class="brand-mark" width="18" height="18" viewBox="0 0 30 30" aria-hidden="true">' +
      '<path d="M8 25 V5 L22 25 V5" fill="none" stroke="#1a1a1a" stroke-width="3.6" stroke-linecap="square"/>' +
      '<circle cx="19.6" cy="7.4" r="3.4" fill="rgba(62,124,89,0.6)"/>' +
      '<circle cx="22.4" cy="5.2" r="3.4" fill="rgba(140,90,122,0.6)"/>' +
      '</svg>' +
      'nevin<span>omics</span> | Irish economic data — carefully selected, clearly presented, freely available.' +
      '</span>' +
      '</div>';
    document.body.append(footer);
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderNav();
    renderFooter();
  });
})();
