import { state } from './state.js';
import { pageHref } from './routes.js';
import { escapeHtml } from './shared.js';

const TABS = [
  { id: 'home', title: '首页', icon: '🏠' },
  { id: 'gallery', title: '小猫书', icon: '▦' },
  ...(import.meta.env.DEV ? [{ id: 'misc', title: '猫猫杂物', icon: '▤' }] : [])
];

// ============== Tab Navigation ==============

function renderSidebar() {
  const nav = document.getElementById('sidebarNav');
  if (!nav) return;
  const activePage = window.__catPage || state.activeTab;
  nav.innerHTML = TABS.map(tab => {
    const active = tab.id === activePage ? ' active' : '';
    return `<a class="sidebar-item${active}" data-tab="${tab.id}" href="${escapeHtml(pageHref(tab.id))}" aria-current="${tab.id === activePage ? 'page' : 'false'}" aria-label="${escapeHtml(tab.title)}">
      <span class="sidebar-icon">${sidebarNavIcon(tab.id)}</span>
      <span class="sidebar-item-label">${escapeHtml(tab.title)}</span>
    </a>`;
  }).join('');
}

function sidebarNavIcon(tabId) {
  const common = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  const icons = {
    home: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3.5 10 8.5-7 8.5 7v10H14v-6H10v6H3.5Z" ${common}/></svg>`,
    gallery: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="2" ${common}/><circle cx="8.5" cy="9" r="1.5" ${common}/><path d="m5.5 17 4.3-4.2 3.1 2.7 2.1-2.1 3.5 3.6" ${common}/></svg>`,
    timeline: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3.5h14v17H5zM8 8h8M8 12h8M8 16h5" ${common}/><path d="m7 3.5 1 2m8-2-1 2" ${common}/></svg>`,
    supplies: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 8 8-4 8 4v10l-8 4-8-4Z" ${common}/><path d="m4 8 8 4 8-4M12 12v10" ${common}/></svg>`,
    finance: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h9l3 3V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" ${common}/><path d="M14.5 3.5V7H18M8 11h8M8 14.5h5M8 18h3" ${common}/></svg>`,
    procurement: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10l1 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7Z" ${common}/><path d="M6 7h12M10 11h4" ${common}/></svg>`,
    knowledge: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5c3.2-1.5 5.9-1 8 1.1 2.1-2.1 4.8-2.6 8-1.1v13c-3.2-1.5-5.9-1-8 1.1-2.1-2.1-4.8-2.6-8-1.1Z" ${common}/><path d="M12 6.6v13" ${common}/></svg>`,
    misc: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5h16v11H4zM6 8.5V5h12v3.5M8 12h8M8 15.5h5" ${common}/></svg>`
  };
  return icons[tabId] || icons.home;
}

// ============== Sidebar Toggle ==============

const DESKTOP_SIDEBAR_BREAKPOINT = 720;
let desktopSidebarHovered = false;
let compactSidebarLayout = window.innerWidth < DESKTOP_SIDEBAR_BREAKPOINT;
let sidebarHoverCloseTimer = null;

function isCompactSidebarLayout() {
  return window.innerWidth < DESKTOP_SIDEBAR_BREAKPOINT;
}

function clearSidebarHoverCloseTimer() {
  if (sidebarHoverCloseTimer !== null) {
    window.clearTimeout(sidebarHoverCloseTimer);
    sidebarHoverCloseTimer = null;
  }
}

function updateSidebarToggleState(expanded) {
  const toggle = document.getElementById('sidebarToggle');
  if (!toggle) return;
  const label = expanded ? '侧边栏已展开' : '展开侧边栏';
  toggle.setAttribute('aria-expanded', String(expanded));
  toggle.setAttribute('aria-label', label);
  toggle.setAttribute('title', label);
}

function syncDesktopSidebar() {
  const expanded = desktopSidebarHovered;
  document.body.classList.toggle('sidebar-expanded', !compactSidebarLayout && expanded);
  document.body.classList.toggle('sidebar-collapsed', !compactSidebarLayout && !expanded);
  updateSidebarToggleState(compactSidebarLayout ? document.body.classList.contains('sidebar-open') : expanded);
}

function setDesktopSidebarHover(value) {
  clearSidebarHoverCloseTimer();
  desktopSidebarHovered = value;
  syncDesktopSidebar();
}

function scheduleDesktopSidebarClose() {
  clearSidebarHoverCloseTimer();
  sidebarHoverCloseTimer = window.setTimeout(() => {
    desktopSidebarHovered = false;
    syncDesktopSidebar();
  }, 120);
}

function closeSidebar() {
  document.body.classList.remove('sidebar-open');
  document.body.style.overflow = '';
  desktopSidebarHovered = false;
  clearSidebarHoverCloseTimer();
  syncDesktopSidebar();
}
function openSidebar() {
  document.body.classList.add('sidebar-open');
  document.body.style.overflow = 'hidden';
  updateSidebarToggleState(true);
}

(function initSidebarToggle() {
  const toggle = document.getElementById('sidebarToggle');
  const backdrop = document.getElementById('sidebarBackdrop');
  const close = document.getElementById('sidebarClose');
  const sidebar = document.getElementById('sidebar');

  if (toggle) {
    toggle.addEventListener('click', () => {
      if (compactSidebarLayout) {
        openSidebar();
      }
    });
  }
  if (backdrop) backdrop.addEventListener('click', closeSidebar);
  if (close) close.addEventListener('click', closeSidebar);
  if (sidebar) {
    sidebar.addEventListener('mouseenter', () => {
      if (!compactSidebarLayout) setDesktopSidebarHover(true);
    });
    sidebar.addEventListener('mouseleave', () => {
      if (!compactSidebarLayout) scheduleDesktopSidebarClose();
    });
    sidebar.addEventListener('focusin', () => {
      if (!compactSidebarLayout) setDesktopSidebarHover(true);
    });
    sidebar.addEventListener('focusout', event => {
      if (compactSidebarLayout) return;
      if (sidebar.contains(event.relatedTarget) || event.relatedTarget === toggle) return;
      scheduleDesktopSidebarClose();
    });
  }

  window.addEventListener('resize', () => {
    const nextCompactLayout = isCompactSidebarLayout();
    if (nextCompactLayout !== compactSidebarLayout) {
      compactSidebarLayout = nextCompactLayout;
      desktopSidebarHovered = false;
      clearSidebarHoverCloseTimer();
      closeSidebar();
    }
    syncDesktopSidebar();
  }, { passive: true });

  // Close sidebar on nav item click (mobile)
  const nav = document.getElementById('sidebarNav');
  if (nav) {
    nav.addEventListener('click', e => {
      if (e.target.closest('.sidebar-item') && window.innerWidth < 720) {
        closeSidebar();
      }
    });
  }

  syncDesktopSidebar();
})();

export { renderSidebar, closeSidebar };
