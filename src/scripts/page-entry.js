import { state } from './app/state.js';
import { renderFinanceTab, bindFinanceControls } from './app/finance.js';
import { bindProcurementControls } from './app/procurement.js';
import { renderSuppliesTab, renderTimelineTab, bindOperationsControls } from './app/operations.js';
import { renderMiscTab, bindMiscControls } from './app/misc.js';
import { renderScienceTab, bindKnowledgeControls, bindKnowledgeToc } from './app/knowledge.js';
import {
  renderHomeTab,
  scheduleDirectoryPageSizeSync,
  cancelDirectoryPageSizeSync,
  bindCatCards,
  bindSummaryCards,
  DIRECTORY_SORT_OPTIONS,
  setDirectoryRenderApp,
  closeDrawer
} from './app/directory.js';
import { renderSidebar, closeSidebar } from './app/navigation.js';

const PAGE_RENDERERS = {
  home: renderHomeTab,
  timeline: renderTimelineTab,
  misc: renderMiscTab,
  supplies: renderSuppliesTab,
  finance: renderFinanceTab,
  knowledge: renderScienceTab
};
const currentPage = PAGE_RENDERERS[window.__catPage] ? window.__catPage : 'home';
const app = document.getElementById('app');
const drawer = document.getElementById('catDrawer');
const drawerBackdrop = document.getElementById('drawerBackdrop');

let homeFeaturedRefreshTimer = null;
let directoryResizeBound = false;

state.activeTab = currentPage;
const pageQuery = new URLSearchParams(window.location.search);
if (currentPage === 'misc') {
  const miscView = pageQuery.get('view');
  if (['diary-list', 'diary-calendar', 'price', 'knowledge', 'supplies'].includes(miscView)) state.miscView = miscView;
  if (miscView === 'knowledge') state.knowledgeArticle = pageQuery.get('article') || null;
}
if (currentPage === 'timeline' && pageQuery.get('view') === 'finance') state.timelineView = 'finance';
if (currentPage === 'knowledge') state.knowledgeArticle = pageQuery.get('article') || null;

function renderApp() {
  cancelDirectoryPageSizeSync();
  if (homeFeaturedRefreshTimer) {
    window.clearTimeout(homeFeaturedRefreshTimer);
    homeFeaturedRefreshTimer = null;
  }

  const content = PAGE_RENDERERS[currentPage]();
  app.classList.toggle('knowledge-app-shell', currentPage === 'knowledge');
  app.classList.toggle('operations-app-shell', currentPage === 'supplies');
  app.classList.toggle('chronicle-app-shell', currentPage === 'timeline' || (currentPage === 'misc' && state.miscView === 'diary-calendar'));
  app.classList.toggle('misc-app-shell', currentPage === 'misc');
  app.classList.toggle('procurement-app-shell', currentPage === 'misc' && state.miscView === 'price');
  app.classList.toggle('finance-app-shell', currentPage === 'finance');
  app.classList.toggle('home-app-shell', currentPage === 'home');
  app.innerHTML = `<div class="tab-panel">${content}</div>`;

  renderSidebar();
  bindControls();
  bindProcurementControls(renderApp);
  bindFinanceControls(renderApp);
  bindOperationsControls(renderApp);
  bindMiscControls(renderApp);
  bindKnowledgeControls(renderApp);
  bindKnowledgeToc();

  if (!directoryResizeBound) {
    window.addEventListener('resize', () => {
      if (currentPage === 'home') scheduleDirectoryPageSizeSync();
    });
    directoryResizeBound = true;
  }

  if (currentPage === 'home') scheduleDirectoryPageSizeSync();
  if (currentPage === 'home') {
    const fifteenMinutes = 15 * 60 * 1000;
    const delay = fifteenMinutes - (Date.now() % fifteenMinutes) + 50;
    homeFeaturedRefreshTimer = window.setTimeout(renderApp, delay);
  }
}

function bindControls() {
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  if (searchInput) {
    function doSearch() {
      const value = searchInput.value.trim();
      if (value !== state.query) {
        state.query = value;
        state.directoryPage = 1;
        state.timelinePage = 1;
        renderApp();
      }
    }
    searchInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        doSearch();
      }
    });
    searchBtn?.addEventListener('click', doSearch);
  }

  document.querySelectorAll('#clearSearch, #clearSearchMobile').forEach(button => {
    button.addEventListener('click', () => {
      state.query = '';
      state.directoryPage = 1;
      state.timelinePage = 1;
      renderApp();
    });
  });

  bindCatCards();
  if (currentPage !== 'home') return;

  const filterToggle = document.getElementById('filterToggle');
  const filterPopover = document.getElementById('filterPopover');
  const sortToggle = document.getElementById('sortToggle');
  const sortPopover = document.getElementById('sortPopover');
  if (filterToggle && filterPopover) {
    filterToggle.addEventListener('click', () => {
      const isOpen = !filterPopover.hidden;
      filterPopover.hidden = isOpen;
      filterToggle.setAttribute('aria-expanded', String(!isOpen));
      if (!isOpen && sortPopover && sortToggle) {
        sortPopover.hidden = true;
        sortToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }
  if (sortToggle && sortPopover) {
    sortToggle.addEventListener('click', () => {
      const isOpen = !sortPopover.hidden;
      sortPopover.hidden = isOpen;
      sortToggle.setAttribute('aria-expanded', String(!isOpen));
      if (!isOpen && filterPopover && filterToggle) {
        filterPopover.hidden = true;
        filterToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  const closeSelectMenus = () => {
    document.querySelectorAll('.directory-select-menu').forEach(menu => { menu.hidden = true; });
    document.querySelectorAll('[data-select-toggle]').forEach(toggle => toggle.setAttribute('aria-expanded', 'false'));
  };
  document.querySelectorAll('[data-select-toggle]').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const menu = document.getElementById(toggle.getAttribute('aria-controls'));
      if (!menu) return;
      const willOpen = menu.hidden;
      closeSelectMenus();
      menu.hidden = !willOpen;
      toggle.setAttribute('aria-expanded', String(willOpen));
    });
  });
  document.querySelectorAll('[data-select-option]').forEach(option => {
    option.addEventListener('click', () => {
      state[option.dataset.selectFilter] = option.dataset.selectValue;
      state.directoryPage = 1;
      renderApp();
    });
  });
  document.querySelectorAll('[data-directory-sort]').forEach(option => {
    option.addEventListener('click', () => {
      const sort = option.dataset.directorySort;
      if (!DIRECTORY_SORT_OPTIONS.some(item => item.value === sort)) return;
      state.directorySort = sort;
      state.directoryPage = 1;
      renderApp();
    });
  });

  document.getElementById('resetFilters')?.addEventListener('click', () => {
    state.query = '';
    state.status = '全部';
    state.vaccine = '全部';
    state.sterilized = '全部';
    state.area = '全部';
    state.directoryPage = 1;
    renderApp();
  });

  bindSummaryCards();
  document.querySelectorAll('[data-directory-page]').forEach(button => {
    button.addEventListener('click', () => {
      if (button.disabled) return;
      const page = Number(button.dataset.directoryPage);
      if (!Number.isInteger(page) || page < 1 || page === state.directoryPage) return;
      state.directoryPage = page;
      renderApp();
    });
  });
}

setDirectoryRenderApp(renderApp);

drawerBackdrop?.addEventListener('click', closeDrawer);
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const photoViewer = document.querySelector('.photo-viewer');
  if (photoViewer) {
    photoViewer.remove();
    return;
  }
  if (drawer && !drawer.hidden) closeDrawer();
  closeSidebar();
});

function start() {
  renderApp();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
