// ═══════════════════════════════════════════════════════════════
// TIPS Dashboard — router.js
// Simple hash-based router
// ═══════════════════════════════════════════════════════════════

const routes = {};

export function registerPage(name, renderFn) {
    routes[name] = renderFn;
}

export function navigateTo(page) {
    // Update nav tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.page === page);
    });

    // Update page views
    document.querySelectorAll('.page-view').forEach(view => {
        view.classList.toggle('active', view.id === `page-${page}`);
    });

    // Render page if registered
    const render = routes[page];
    const el = document.getElementById(`page-${page}`);
    if (render && el) {
        render(el);
    }

    window.location.hash = page;
}

export function initRouter() {
    // Tab clicks
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => navigateTo(tab.dataset.page));
    });

    // Hash on load
    const hash = window.location.hash.replace('#', '');
    navigateTo(hash || 'hub');
}
