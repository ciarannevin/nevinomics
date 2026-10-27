'use strict';

(function () {
  const pages = [
    { href: 'index.html', label: 'Home' },
    { href: 'output.html', label: 'Output' },
    { href: 'labour.html', label: 'Labour' },
    { href: 'inflation.html', label: 'Inflation' },
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
      '<a class="wordmark" href="index.html">nevin<span>omics</span></a>' +
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
      '<span>nevinomics — your window to the Irish economy</span>' +
      '</div>';
    document.body.append(footer);
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderNav();
    renderFooter();
  });
})();
