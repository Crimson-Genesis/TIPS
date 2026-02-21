// ═══════════════════════════════════════════════════════════════
// TIPS Unified Frontend — router.js
// Hash-based SPA router with sidebar active state
// ═══════════════════════════════════════════════════════════════

const routes = {};

export function registerPage(name, renderFn) {
    routes[name] = renderFn;
}

export function navigateTo(page) {
    // Default to hub
    if (!page || !routes[page]) page = 'hub';

    // Update sidebar nav items
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
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

    // Close sidebar on mobile after navigation
    const sidebar = document.getElementById('sidebar');
    if (sidebar && window.innerWidth <= 860) {
        sidebar.classList.remove('open');
    }
}

export function initRouter() {
    // Sidebar item clicks
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
        item.addEventListener('click', () => navigateTo(item.dataset.page));
    });

    // Mobile sidebar toggle
    const toggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    if (toggle && sidebar) {
        toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
        // Close on outside click
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 860 && sidebar.classList.contains('open') &&
                !sidebar.contains(e.target) && e.target !== toggle) {
                sidebar.classList.remove('open');
            }
        });
    }

    // Hash on load
    const hash = window.location.hash.replace('#', '');
    navigateTo(hash || 'hub');
}
