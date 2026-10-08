import { catProfiles } from '../../../js/cats.js';
import { deleteInspirationRecord, openInspirationEditor } from './gallery.js';
import { state } from './state.js';
import {
  escapeHtml,
  focusWithoutScrolling,
  isEmptyValue,
  normalize
} from './shared.js';

const BASE_URL = `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}`;
const STATUS_ORDER = ['全部', '就读中', '已毕业', '喵星或失踪'];
const VACCINE_OPTIONS = ['全部', '待补充', '零针', '一针', '两针', '疫苗毕业'];
const STERILIZED_OPTIONS = ['全部', '待补充', '已绝育', '未绝育'];
const DIRECTORY_SORT_OPTIONS = [
  { value: 'name', label: '名称排序' },
  { value: 'area', label: '区域排序' },
  { value: 'recent', label: '最近更新' }
];

let renderApp = () => {};
let activeSummaryTooltip = null;

export function setDirectoryRenderApp(callback) {
  renderApp = callback;
}

const app = document.getElementById('app');
const drawer = document.getElementById('catDrawer');
const drawerBackdrop = document.getElementById('drawerBackdrop');
const mainArea = document.querySelector('.main-area');
let mainAreaScrollLock = null;
let drawerScrollHideTimer = 0;
let drawerStoryScrollHideTimer = 0;
let drawerStoryScrollTarget = null;
let drawerViewportFrame = 0;

function syncDrawerViewportHeight() {
  if (!drawer || drawer.hidden || !window.matchMedia('(max-width: 719px)').matches) {
    document.documentElement.style.removeProperty('--drawer-viewport-height');
    return;
  }

  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return;
  document.documentElement.style.setProperty('--drawer-viewport-height', `${Math.round(viewportHeight)}px`);
}

function scheduleDrawerViewportSync() {
  if (drawerViewportFrame) return;
  drawerViewportFrame = window.requestAnimationFrame(() => {
    drawerViewportFrame = 0;
    syncDrawerViewportHeight();
  });
}

window.addEventListener('resize', scheduleDrawerViewportSync, { passive: true });
window.visualViewport?.addEventListener('resize', scheduleDrawerViewportSync, { passive: true });
window.visualViewport?.addEventListener('scroll', scheduleDrawerViewportSync, { passive: true });

function hideDrawerScrollIndicator() {
  drawer?.classList.remove('is-scrolling');
  if (drawerScrollHideTimer) {
    window.clearTimeout(drawerScrollHideTimer);
    drawerScrollHideTimer = 0;
  }
}

function showDrawerScrollIndicator() {
  if (!drawer || !window.matchMedia('(max-width: 980px)').matches) return;
  drawer.classList.add('is-scrolling');
  window.clearTimeout(drawerScrollHideTimer);
  drawerScrollHideTimer = window.setTimeout(() => {
    drawer.classList.remove('is-scrolling');
    drawerScrollHideTimer = 0;
  }, 700);
}

drawer?.addEventListener('scroll', showDrawerScrollIndicator, { passive: true });

function hideDrawerStoryScrollIndicator() {
  drawerStoryScrollTarget?.classList.remove('is-scrolling');
  drawerStoryScrollTarget = null;
  if (drawerStoryScrollHideTimer) {
    window.clearTimeout(drawerStoryScrollHideTimer);
    drawerStoryScrollHideTimer = 0;
  }
}

function showDrawerStoryScrollIndicator(event) {
  const story = event.currentTarget;
  if (!(story instanceof HTMLElement) || !window.matchMedia('(max-width: 980px)').matches) return;
  if (drawerStoryScrollTarget && drawerStoryScrollTarget !== story) {
    drawerStoryScrollTarget.classList.remove('is-scrolling');
  }
  drawerStoryScrollTarget = story;
  story.classList.add('is-scrolling');
  window.clearTimeout(drawerStoryScrollHideTimer);
  drawerStoryScrollHideTimer = window.setTimeout(() => {
    story.classList.remove('is-scrolling');
    if (drawerStoryScrollTarget === story) drawerStoryScrollTarget = null;
    drawerStoryScrollHideTimer = 0;
  }, 700);
}

function bindDrawerStoryScrollIndicators(container) {
  hideDrawerStoryScrollIndicator();
  container.querySelectorAll('.drawer-description .drawer-story').forEach(story => {
    story.addEventListener('scroll', showDrawerStoryScrollIndicator, { passive: true });
  });
}

function lockMainAreaScroll() {
  if (!mainArea || mainAreaScrollLock) return;
  mainAreaScrollLock = {
    scrollTop: mainArea.scrollTop,
    overflow: mainArea.style.overflow
  };
  mainArea.style.overflow = 'hidden';
}

function unlockMainAreaScroll() {
  if (!mainArea || !mainAreaScrollLock) return;
  const { scrollTop, overflow } = mainAreaScrollLock;
  mainArea.style.overflow = overflow;
  mainArea.scrollTop = scrollTop;
  mainAreaScrollLock = null;
}


function getVaccineBucket(cat) {
  if (isEmptyValue(cat.vaccine)) return '待补充';
  const text = `${cat.vaccine}`;
  const hasD1 = /一针\s*(202\d|✅)/.test(text);
  const hasD2 = /二针\s*(202\d|✅)/.test(text);
  const hasD3 = /三针\s*(202\d|已完成|✅)/.test(text);
  if (hasD3) return '疫苗毕业';
  if (hasD2) return '两针';
  if (hasD1) return '一针';
  return '零针';
}

function getVaccineSummary(cat) {
  return {
    零针: '未接种',
    一针: '已一针',
    两针: '已二针',
    疫苗毕业: '已三针',
    待补充: '待补充',
  }[getVaccineBucket(cat)] || '待补充';
}

function getSterilizedBucket(cat) {
  if (isEmptyValue(cat.sterilized)) return '待补充';
  return String(cat.sterilized).includes('未') ? '未绝育' : '已绝育';
}

function getSterilizedSummary(cat) {
  if (isEmptyValue(cat.sterilized)) return '待补充';
  return String(cat.sterilized).includes('未') ? '未绝育' : '已绝育';
}

function getSummary() {
  const counts = catProfiles.reduce((acc, cat) => {
    acc.total += 1;
    acc.status[cat.status] = (acc.status[cat.status] || 0) + 1;
    acc.vaccine[getVaccineBucket(cat)] = (acc.vaccine[getVaccineBucket(cat)] || 0) + 1;
    acc.sterilized[getSterilizedBucket(cat)] = (acc.sterilized[getSterilizedBucket(cat)] || 0) + 1;
    return acc;
  }, { total: 0, status: {}, vaccine: {}, sterilized: {} });

  const enrolled = catProfiles.filter(c => c.status === '就读中');
  const enrolledVaccineDone = enrolled.filter(c => getVaccineBucket(c) === '疫苗毕业').length;
  const enrolledSterilized = enrolled.filter(c => getSterilizedBucket(c) === '已绝育').length;
  const enrolledUnsterilized = enrolled.filter(c => getSterilizedBucket(c) === '未绝育').length;

  return [
    { label: '喵校友', value: counts.total, tone: 'dark', filter: 'all' },
    { label: '就读中', value: counts.status['就读中'] || 0, tone: 'green', filter: 'status-就读中' },
    { label: '疫苗毕业', value: enrolledVaccineDone, tone: 'green', filter: 'vaccine-疫苗毕业' },
    { label: '蛋定喵生', value: enrolledSterilized, tone: 'green', filter: 'sterilized-已绝育' },
    { label: '在逃咪', value: enrolledUnsterilized, tone: 'amber', filter: 'sterilized-未绝育' },
    { label: '喵星或失踪', value: counts.status['喵星或失踪'] || 0, tone: 'red', filter: 'status-喵星或失踪' },
    { label: '已毕业', value: counts.status['已毕业'] || 0, tone: 'blue', filter: 'status-已毕业' }
  ];
}

function getFilteredCats() {
  const q = normalize(state.query);
  const filtered = catProfiles.filter(cat => {
    const haystack = normalize([
      cat.name,
      cat.status,
      cat.vaccine,
      cat.sterilized,
      cat.notes,
      cat.area,
      cat.gender
    ].join(' '));

    return (!q || haystack.includes(q))
      && (state.status === '全部' || cat.status === state.status)
      && (state.vaccine === '全部' || getVaccineBucket(cat) === state.vaccine)
      && (state.sterilized === '全部' || getSterilizedBucket(cat) === state.sterilized)
      && (state.area === '全部' || cat.area === state.area);
  });

  return sortDirectoryCats(filtered);
}

function compareDirectoryCats(a, b) {
  const nameCompare = a.name.localeCompare(b.name, 'zh-Hans-CN');
  if (state.directorySort === 'area') {
    const areaCompare = String(a.area || '待补充').localeCompare(String(b.area || '待补充'), 'zh-Hans-CN');
    return areaCompare || nameCompare;
  }

  if (state.directorySort === 'recent') {
    const recentCompare = String(b.photoUpdatedAt || '').localeCompare(String(a.photoUpdatedAt || ''));
    return recentCompare || nameCompare;
  }

  return nameCompare;
}

function sortDirectoryCats(cats) {
  return [...cats].sort(compareDirectoryCats);
}

function cdnUrl(path) {
  if (!path) return path;
  if (path.startsWith('http')) return path;
  const parts = path.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
  return `${BASE_URL}${parts}`;
}

function getCatCover(cat) {
  if (cat.cover) return cat.cover;
  return getMaterialRecords(cat)[0]?.src || null;
}

function getDirectoryCover(cat) {
  const directoryCovers = {
    大头: 'images/大头/datou5.jpg'
  };
  return directoryCovers[cat.name] || getCatCover(cat);
}

function getTimedFeaturedCats(cats, heroCat) {
  const candidates = cats.filter(cat => cat.name !== heroCat?.name);
  if (!candidates.length) return [];

  const batchSize = Math.min(5, candidates.length);
  const slot = Math.floor(Date.now() / (15 * 60 * 1000));
  const start = slot % candidates.length;
  return Array.from({ length: batchSize }, (_, index) => candidates[(start + index) % candidates.length]);
}

function renderDirectorySortPopover() {
  return `
    <div class="directory-sort-popover" id="sortPopover" hidden>
      <div class="directory-sort-heading"><strong>排序档案</strong></div>
      <div class="directory-sort-options">
        ${DIRECTORY_SORT_OPTIONS.map(option => `<button class="directory-sort-option${state.directorySort === option.value ? ' is-selected' : ''}" type="button" data-directory-sort="${option.value}" aria-pressed="${state.directorySort === option.value}">${option.label}</button>`).join('')}
      </div>
    </div>
  `;
}

// ============== Home Tab ==============

function isHomeFiltered() {
  return state.status !== '全部' || state.vaccine !== '全部' || state.sterilized !== '全部' || state.area !== '全部' || state.query !== '';
}

function getActiveHomeFilter() {
  if (state.vaccine !== '全部') return `vaccine-${state.vaccine}`;
  if (state.sterilized !== '全部') return `sterilized-${state.sterilized}`;
  if (state.status !== '全部') return `status-${state.status}`;
  return null;
}

function getDirectoryData() {
  const summary = getSummary();
  const activeFilter = getActiveHomeFilter();
  const filtered = isHomeFiltered();
  const catsWithPhotos = catProfiles.filter(cat => cat.images && cat.images.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
  const directoryCats = filtered ? getFilteredCats() : sortDirectoryCats(catsWithPhotos);
  return {
    summary,
    activeFilter,
    filtered,
    catsWithPhotos,
    directoryCats,
  };
}

function renderHomeStats({ summary, filtered, activeFilter }) {
  const homeStats = [
    summary.find(item => item.filter === 'all'),
    summary.find(item => item.filter === 'status-就读中'),
    summary.find(item => item.filter === 'status-已毕业'),
    summary.find(item => item.filter === 'sterilized-未绝育')
  ].filter(Boolean);
  return `<section class="home-stat-ribbon" aria-label="西电猫猫档案统计">${homeStats.map(item => {
    const active = item.filter === 'all' ? !filtered : item.filter === activeFilter;
    return `<button class="${active ? 'is-active' : ''}" data-summary-filter="${escapeHtml(item.filter)}" type="button"><strong>${item.value}</strong><span>${escapeHtml(item.label)}</span></button>`;
  }).join('')}</section>`;
}

function renderDirectorySection(data, { standalone = false } = {}) {
  const { directoryCats } = data;
  const headingMeta = standalone ? '' : '<small>猫咪目录</small>';
  return `<section class="home-directory${standalone ? ' directory-page-list' : ''}"><header><div><p><img class="directory-heading-icon" src="${cdnUrl('images/cat-archive-icon.png')}" alt="" aria-hidden="true">猫猫档案</p></div>${headingMeta}</header>${renderCatControls(directoryCats.length)}${directoryCats.length ? `<div class="home-directory-grid">${directoryCats.map(cat => `<button class="home-directory-card" data-cat-name="${escapeHtml(cat.name)}" type="button"><img src="${cdnUrl(getDirectoryCover(cat))}" alt="${escapeHtml(cat.name)}" loading="lazy"><span>${escapeHtml(cat.name)}</span></button>`).join('')}</div>` : '<p class="home-directory-empty">没有匹配的猫咪，可以清空筛选后再试。</p>'}</section>`;
}

function renderHomeLandingPage() {
  const data = getDirectoryData();
  const heroCat = catProfiles.find(cat => cat.name === '大头' && getCatCover(cat)) || data.catsWithPhotos[0];
  const coverStripCats = getTimedFeaturedCats(data.catsWithPhotos, heroCat);
  return `<section class="home-yearbook home-landing-page"><div class="home-cover"><div class="home-cover-copy"><h2>猫猫手册</h2><p class="home-cover-title">咪也有自己的生活和故事</p><i></i><p class="home-cover-note home-cover-note-desktop">这里有它们的名字<br>也有它们的故事</p><p class="home-cover-note home-cover-note-mobile">这里有它们的名字<br>也有它们的故事</p></div>${heroCat ? `<div class="home-cover-photos"><button class="home-cover-photo" data-cat-name="${escapeHtml(heroCat.name)}" type="button"><img src="${cdnUrl(getCatCover(heroCat))}" alt="${escapeHtml(heroCat.name)}"></button><div class="home-cover-strip">${coverStripCats.slice(0, 3).map(cat => `<button data-cat-name="${escapeHtml(cat.name)}" type="button"><img src="${cdnUrl(getCatCover(cat))}" alt="${escapeHtml(cat.name)}"></button>`).join('')}</div></div>` : ''}</div>${renderHomeStats(data)}${renderDirectorySection(data, { standalone: true })}</section>`;
}

function renderDirectoryPage() {
  const data = getDirectoryData();
  return `<section class="home-filter-view directory-page-view"><header class="directory-page-heading"><p>西电猫猫档案室</p><h1>猫咪档案</h1><span>按名称、区域和健康记录，查找校园里的每一只猫。</span></header>${renderHomeStats(data)}${renderDirectorySection(data, { standalone: true })}<footer class="home-yearbook-footer">让每一次相遇，都被好好记住 <svg class="home-footer-paw" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6.2" cy="9.3" r="2.1"></circle><circle cx="11.1" cy="6.2" r="2.1"></circle><circle cx="16.1" cy="8.1" r="2.1"></circle><circle cx="18.3" cy="13" r="2.1"></circle><path d="M12.1 11.1c-3.1 0-5.3 2.2-5.3 4.8 0 2 1.4 3.2 3.3 3.2.8 0 1.4-.2 2-.6.6.4 1.3.6 2 .6 1.9 0 3.2-1.2 3.2-3.2 0-2.6-2.1-4.8-5.2-4.8Z"></path></svg></footer></section>`;
}

function renderHomeTab() {
  return renderHomeLandingPage();
}

// ============== Cat Profile Tab ==============

function renderCatSummary() {
  return `
    <section class="summary-grid" aria-label="西电猫猫档案统计">
      ${getSummary().map(item => `
        <div class="summary-card tone-${item.tone}">
          <span class="summary-value">${item.value}</span>
          <span class="summary-label">${item.label}</span>
        </div>
      `).join('')}
    </section>
  `;
}

function renderSelect(label, id, options, value) {
  return `
    <div class="filter-field directory-select">
      <span>${label}</span>
      <button class="directory-select-toggle" type="button" data-select-toggle aria-expanded="false" aria-controls="${id}SelectMenu">
        <span>${escapeHtml(value)}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"></path></svg>
      </button>
      <div class="directory-select-menu" id="${id}SelectMenu" role="listbox" aria-label="${escapeHtml(label)}" hidden>
        ${options.map(option => `<button class="directory-select-option${option === value ? ' is-selected' : ''}" type="button" role="option" aria-selected="${option === value}" data-select-option data-select-filter="${id}" data-select-value="${escapeHtml(option)}">${escapeHtml(option)}</button>`).join('')}
      </div>
    </div>
  `;
}

function renderCatControls(filteredCount) {
  const availableStatuses = STATUS_ORDER.filter(status => status === '全部' || catProfiles.some(cat => cat.status === status));
  const areaOptions = ['全部', ...new Set(catProfiles.map(cat => cat.area).filter(area => !isEmptyValue(area)))].sort((a, b) => a === '全部' ? -1 : a.localeCompare(b, 'zh-Hans-CN'));
  const baseCount = state.status === '全部' ? catProfiles.length : catProfiles.filter(c => c.status === state.status).length;
  const hasFilters = isHomeFiltered();
  return `
    <section class="directory-toolbar" aria-label="搜索和筛选猫咪档案">
      <div class="directory-search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.3"></circle><path d="m16 16 4.3 4.3"></path></svg>
        <input id="searchInput" type="search" value="${escapeHtml(state.query)}" placeholder="搜索猫名、地点" autocomplete="off" aria-label="搜索猫名、地点">
        <button id="searchBtn" type="button" aria-label="搜索">
          <svg viewBox="0 0 24 24" aria-hidden="true" class="paw-icon"><circle cx="6.2" cy="9.3" r="2.1"></circle><circle cx="11.1" cy="6.2" r="2.1"></circle><circle cx="16.1" cy="8.1" r="2.1"></circle><circle cx="18.3" cy="13" r="2.1"></circle><path d="M12.1 11.1c-3.1 0-5.3 2.2-5.3 4.8 0 2 1.4 3.2 3.3 3.2.8 0 1.4-.2 2-.6.6.4 1.3.6 2 .6 1.9 0 3.2-1.2 3.2-3.2 0-2.6-2.1-4.8-5.2-4.8Z"></path></svg>
        </button>
      </div>
      <div class="directory-sort-wrap">
        <button class="directory-sort-toggle${state.directorySort !== 'name' ? ' has-sort' : ''}" id="sortToggle" type="button" aria-label="排序猫咪档案" aria-expanded="false" aria-controls="sortPopover">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h10M5 17h6"></path><path d="M18 13v6m0 0-2-2m2 2 2-2"></path></svg>
        </button>
        ${renderDirectorySortPopover()}
      </div>
      <div class="directory-filter-wrap">
        <button class="directory-filter-toggle${hasFilters ? ' has-filter' : ''}" id="filterToggle" type="button" aria-label="筛选猫咪档案" aria-expanded="false" aria-controls="filterPopover">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7.5 12h9M10.5 18h3"></path></svg>
        </button>
        <div class="directory-filter-popover" id="filterPopover" hidden>
          <div class="directory-filter-heading"><strong>筛选档案</strong><span>当前显示 ${filteredCount} / ${baseCount} 只</span></div>
          <div class="directory-filter-grid">
            ${renderSelect('状态', 'status', availableStatuses, state.status)}
            ${renderSelect('疫苗', 'vaccine', VACCINE_OPTIONS, state.vaccine)}
            ${renderSelect('绝育', 'sterilized', STERILIZED_OPTIONS, state.sterilized)}
            ${renderSelect('地区', 'area', areaOptions, state.area)}
          </div>
          ${hasFilters ? '<button class="directory-filter-reset" id="resetFilters" type="button">清空全部筛选</button>' : ''}
        </div>
      </div>
    </section>
  `;
}

function renderStatusTag(cat) {
  return `<span class="status-pill status-${cat.status}">${escapeHtml(cat.status)}</span>`;
}

function renderMeta(label, value) {
  return `
    <div class="meta-item">
      <span>${label}</span>
      <strong>${escapeHtml(value || '—')}</strong>
    </div>
  `;
}

function renderCatCard(cat) {
  const firstImage = getCatCover(cat);
  return `
    <article class="cat-card" data-cat-name="${escapeHtml(cat.name)}" tabindex="0">
      ${firstImage ? `<img class="cat-card-photo" src="${cdnUrl(firstImage)}" alt="${escapeHtml(cat.name)}" loading="lazy">` : `<div class="cat-card-placeholder">🐱</div>`}
      <h2 class="cat-card-name">${escapeHtml(cat.name)}</h2>
      <div class="cat-card-statuses" aria-label="${escapeHtml(cat.name)}状态">
        ${renderSummaryTag('绝育', getSterilizedSummary(cat), cat.sterilized)}
      </div>
    </article>
  `;
}

function renderSummaryTag(label, summary, original, className = '') {
  const detail = original || '—';
  return `<span class="tag summary-source${className ? ` ${className}` : ''}" tabindex="0" aria-label="${escapeHtml(label)}状态：${escapeHtml(summary)}；完整记录：${escapeHtml(detail)}"><span>${escapeHtml(summary)}</span><span class="summary-detail">${escapeHtml(detail)}</span></span>`;
}

function renderNotesTag(notes) {
  if (isEmptyValue(notes)) return '';
  const detail = String(notes).trim();
  return `<span class="tag notes-tag summary-source" tabindex="0" aria-label="备注：${escapeHtml(detail)}"><span>备注</span><span class="summary-detail">${escapeHtml(detail)}</span></span>`;
}

function renderCatGrid(cats) {
  if (!cats.length) {
    return `
      <section class="empty-state">
        <h2>没有匹配的猫咪</h2>
        <p>可以清空筛选，或检查搜索词是否过窄。</p>
      </section>
    `;
  }

  return `
    <section class="cat-grid" aria-label="猫咪档案列表">
      ${cats.map(renderCatCard).join('')}
    </section>
  `;
}

function renderOptionalSummaryTag(label, value, className = '') {
  if (isEmptyValue(value)) return '';
  return renderSummaryTag(label, value, value, className);
}

function getCatUpdates(cat) {
  return (Array.isArray(cat.updates) ? cat.updates : [])
    .filter(update => update && (update.date || update.title || update.content))
    .sort((a, b) => {
      const parseDate = value => Date.parse(String(value || '').replace(' ', 'T')) || 0;
      return parseDate(b.date) - parseDate(a.date);
    });
}

function formatUpdateDate(value) {
  const text = String(value || '').trim();
  return text.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || text || '日期待补充';
}

function displayDrawerValue(value) {
  return isEmptyValue(value) ? '待补充' : String(value);
}

function drawerSectionIcon(icon) {
  const common = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  const icons = {
    story: `<svg class="drawer-section-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5c2.8-1.3 5.5-.9 8 1.1 2.5-2 5.2-2.4 8-1.1v13c-2.8-1.3-5.5-.9-8 1.1-2.5-2-5.2-2.4-8-1.1Z" ${common}/><path d="M12 6.6v13" ${common}/></svg>`,
    appearance: `<svg class="drawer-section-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5.5" width="16" height="15" rx="2" ${common}/><path d="M8 3.5v4M16 3.5v4M4 10h16M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" ${common}/></svg>`,
    relationships: `<img class="drawer-section-icon drawer-section-icon-relationship-cat" src="${cdnUrl('images/ui/relationship-cat.png')}" alt="" aria-hidden="true">`,
    updates: `<svg class="drawer-section-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h9l3 3v14H6z" ${common}/><path d="M15 3.5v3h3M9 11h6M9 15h6" ${common}/></svg>`,
    personality: `<svg class="drawer-section-icon drawer-section-icon-paw" viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="16.5" rx="5.8" ry="4.2" fill="currentColor"/><circle cx="5.8" cy="10" r="2.1" fill="currentColor"/><circle cx="10" cy="6.3" r="2.1" fill="currentColor"/><circle cx="14.5" cy="6.3" r="2.1" fill="currentColor"/><circle cx="18.2" cy="10" r="2.1" fill="currentColor"/></svg>`
  };
  return icons[icon] || '';
}

function renderDrawerSection(title, content, className = '', meta = '', icon = '') {
  if (!content) return '';
  return `
    <section class="drawer-section${className ? ` ${className}` : ''}">
      <div class="drawer-section-heading">
        <h3>${drawerSectionIcon(icon)}<span>${escapeHtml(title)}</span></h3>
        ${meta ? `<span class="drawer-section-meta">${escapeHtml(meta)}</span>` : ''}
      </div>
      ${content}
    </section>
  `;
}

function renderDrawerGenderBadge(gender) {
  const knownGender = gender === '公' || gender === '母';
  const icon = gender === '公'
    ? '<svg class="drawer-gender-icon" viewBox="0 0 24 24" focusable="false" aria-hidden="true"><circle cx="10" cy="14" r="5.5"></circle><path d="M14 10 21 3m0 0h-5m5 0v5"></path></svg>'
    : gender === '母'
      ? '<svg class="drawer-gender-icon" viewBox="0 0 24 24" focusable="false" aria-hidden="true"><circle cx="12" cy="10" r="5.5"></circle><path d="M12 15.5V22m-3.25-3.25h6.5"></path></svg>'
      : '<svg class="drawer-gender-icon drawer-gender-icon-unknown" viewBox="0 0 24 24" focusable="false" aria-hidden="true"><circle cx="12" cy="12" r="2.4"></circle></svg>';
  return `<span class="drawer-gender-badge gender-${knownGender ? gender : 'unknown'}" aria-label="性别：${escapeHtml(displayDrawerValue(gender))}">${icon}</span>`;
}

function renderDrawerFact(label, value, detail = '', icon = '', tooltip = false) {
  const primary = displayDrawerValue(value);
  const detailText = !isEmptyValue(detail) && String(detail) !== primary ? String(detail) : '';
  const primaryHtml = tooltip && detailText
    ? `<span class="drawer-fact-value summary-source" tabindex="0" aria-label="${escapeHtml(label)}：${escapeHtml(primary)}；详细记录：${escapeHtml(detailText)}"><strong>${escapeHtml(primary)}</strong><span class="summary-detail drawer-summary-detail">${escapeHtml(detailText)}</span></span>`
    : `<strong>${escapeHtml(primary)}</strong>`;
  return `
    <div class="drawer-fact" aria-label="${escapeHtml(label)}：${escapeHtml(primary)}">
      <div class="drawer-fact-heading"><span class="drawer-fact-icon" aria-hidden="true">${icon}</span><span>${escapeHtml(label)}</span></div>
      ${primaryHtml}
    </div>
  `;
}

function getAppearanceSummary(cat) {
  return cat.appearanceDate || cat.firstSeen || cat.firstSeenAt || cat.appearedAt || '待补充';
}

function renderDrawerMobileSummary(cat) {
  const mobileFacts = [
    !isEmptyValue(cat.area) ? `在${cat.area}` : '地点待补充',
    !isEmptyValue(cat.sterilized) ? getSterilizedSummary(cat) : '',
    !isEmptyValue(cat.vaccine) ? getVaccineSummary(cat) : '',
    !isEmptyValue(getAppearanceSummary(cat)) && getAppearanceSummary(cat) !== '待补充' ? getAppearanceSummary(cat) : ''
  ].filter(Boolean);
  return `<div class="drawer-facts-mobile-summary drawer-header-facts" aria-label="简要信息">${mobileFacts.map(value => `<span>${escapeHtml(value)}</span>`).join('<i aria-hidden="true">·</i>')}</div>`;
}

function renderDrawerFacts(cat) {
  const sterilizedIcon = `<img class="drawer-fact-image drawer-fact-image-sterilized" src="${cdnUrl('images/ui/sterilized-fixed.png')}" alt="" aria-hidden="true">`;
  const vaccineIcon = `<img class="drawer-fact-image drawer-fact-image-vaccine" src="${cdnUrl('images/ui/vaccine-syringe.png')}" alt="" aria-hidden="true">`;
  return `
    <section class="drawer-facts-card" aria-label="基础信息">
      <div class="drawer-facts-grid">
        ${renderDrawerFact('所在区域', cat.area, '', drawerSectionIcon('personality'))}
        ${renderDrawerFact('出现时间', getAppearanceSummary(cat), '', drawerSectionIcon('appearance'))}
        ${renderDrawerFact('健康情况', getSterilizedSummary(cat), cat.sterilized, sterilizedIcon, true)}
        ${renderDrawerFact('疫苗情况', getVaccineSummary(cat), cat.vaccine, vaccineIcon, true)}
      </div>
    </section>
  `;
}

function renderDrawerGallery(cat) {
  const images = getMaterialRecords(cat).map((material) => material.src);
  if (!images.length) {
    return `
      <section class="drawer-gallery" aria-label="照片">
        <div class="drawer-photo-placeholder"><span aria-hidden="true">🐱</span><p>暂无照片</p></div>
      </section>
    `;
  }

  const coverSrc = getCatCover(cat) || images[0];
  const galleryImages = [coverSrc, ...images.filter(src => src !== coverSrc)];
  const photoNavigation = galleryImages.length > 1 ? `
        <button class="drawer-photo-nav drawer-photo-nav-prev" type="button" data-photo-prev aria-label="上一张照片"><span aria-hidden="true">‹</span></button>
        <button class="drawer-photo-nav drawer-photo-nav-next" type="button" data-photo-next aria-label="下一张照片"><span aria-hidden="true">›</span></button>
  ` : '';
  return `
    <section class="drawer-gallery" aria-label="照片">
      <div class="drawer-gallery-main-shell">
        <button class="drawer-gallery-main" type="button" data-main-photo aria-label="查看${escapeHtml(cat.name)}大图">
          <img class="drawer-gallery-main-image" src="${cdnUrl(coverSrc)}" data-full="${cdnUrl(coverSrc)}" alt="${escapeHtml(cat.name)}" loading="eager">
        </button>
        ${photoNavigation}
        <div class="drawer-photo-count" data-photo-count aria-live="polite"><strong data-photo-current>1</strong><span>/ ${galleryImages.length}</span></div>
      </div>
    </section>
  `;
}

function findRelatedCat(name) {
  return catProfiles.find(item => item.name === name || (Array.isArray(item.aliases) && item.aliases.includes(name)));
}

const SYMMETRIC_RELATIONS = new Set(['好友', '兄弟姐妹', '兄妹', '同事', '情侣', '宿敌', '夫妻']);
const RELATION_DISPLAY_LABELS = new Map([
  ['兄弟姐妹', '兄妹'],
  ['关系待补充', '待补']
]);

function getRelationDisplayLabel(relation) {
  const normalized = String(relation || '').trim();
  return RELATION_DISPLAY_LABELS.get(normalized) || normalized || '待补';
}

function getChildRelation(cat) {
  if (cat?.gender === '公') return '儿子';
  if (cat?.gender === '母') return '女儿';
  return '子女';
}

function getParentRelation(cat) {
  if (cat?.gender === '公') return '爸爸';
  if (cat?.gender === '母') return '妈妈';
  return '家长';
}

function getInverseRelation(relation, sourceCat) {
  if (SYMMETRIC_RELATIONS.has(relation)) return relation;
  if (relation === '妈妈' || relation === '爸爸') return getChildRelation(sourceCat);
  if (relation === '儿子' || relation === '女儿') return getParentRelation(sourceCat);
  return '';
}

function getCatRelationships(cat) {
  const directRelationships = Array.isArray(cat.relationships)
    ? cat.relationships.filter(item => item?.relatedCatName)
    : [];
  const relationships = [...directRelationships];
  const directTargets = new Set(directRelationships.map(item => findRelatedCat(item.relatedCatName)?.name || item.relatedCatName));

  for (const sourceCat of catProfiles) {
    if (sourceCat.name === cat.name) continue;
    const sourceRelationships = Array.isArray(sourceCat.relationships)
      ? sourceCat.relationships.filter(item => item?.relatedCatName)
      : [];
    for (const item of sourceRelationships) {
      const targetCat = findRelatedCat(item.relatedCatName);
      if (!targetCat || targetCat.name !== cat.name || directTargets.has(sourceCat.name)) continue;
      const inverseRelation = getInverseRelation(item.relation, sourceCat);
      if (!inverseRelation) continue;
      relationships.push({
        ...item,
        relatedCatName: sourceCat.name,
        relation: inverseRelation,
        derived: true
      });
      directTargets.add(sourceCat.name);
    }
  }

  return relationships;
}

function renderRelationshipCard(item, cat) {
  const catName = cat.name;
  const isPlaceholder = item.isPlaceholder === true;
  const relatedName = isPlaceholder ? '待补充' : item.relatedCatName;
  const relatedCat = isPlaceholder ? null : findRelatedCat(relatedName);
  const relatedImage = isPlaceholder ? getCatCover(cat) : (relatedCat ? getCatCover(relatedCat) : null);
  const relation = getRelationDisplayLabel(item.relation);
  const note = [item.note, item.notes, item.remark, item.remarks, item.memo]
    .find(value => !isEmptyValue(value));
  const image = relatedImage
    ? `<img src="${cdnUrl(relatedImage.replace(/([^/]+)$/, 'thumb/$1'))}" alt="${escapeHtml(isPlaceholder ? `${catName}首图` : relatedName)}" loading="lazy">`
    : '<span class="drawer-relation-placeholder" aria-hidden="true">🐱</span>';
  const element = relatedCat ? 'button' : 'div';
  const interaction = relatedCat
    ? `type="button" data-related-cat="${escapeHtml(relatedCat.name)}" aria-label="查看${escapeHtml(relatedCat.name)}详情"`
    : '';
  const cardClass = `drawer-relation-card${isPlaceholder ? ' drawer-relation-card-placeholder' : ''}`;
  return `
    <${element} class="${cardClass}" ${interaction}${isPlaceholder ? ' aria-label="关系待补充" data-relation-placeholder="true"' : ''}>
      ${image}
      <div class="drawer-relation-copy">
        <strong>${escapeHtml(relatedName)}</strong>
        <span class="drawer-relation-type">${escapeHtml(relation)}</span>
        ${note ? `<small class="drawer-relation-note">${escapeHtml(String(note))}</small>` : ''}
      </div>
    </${element}>
  `;
}

function renderDrawerRelationships(cat) {
  const relationships = getCatRelationships(cat);
  const displayRelationships = [
    ...relationships,
    ...Array.from({ length: Math.max(0, 2 - relationships.length) }, () => ({
      relatedCatName: '待补充',
      relation: '未知',
      isPlaceholder: true
    }))
  ];
  const relationCountClass = displayRelationships.length === 1
    ? ' relation-count-1'
    : displayRelationships.length === 2
      ? ' relation-count-2'
      : displayRelationships.length === 3
        ? ' relation-count-3'
        : displayRelationships.length > 3
          ? ' relation-count-more'
          : '';
  const formalHtml = `<div class="drawer-relation-group"><div class="drawer-relation-list${relationCountClass}">${displayRelationships.map(item => renderRelationshipCard(item, cat)).join('')}</div></div>`;
  return `
    <section class="drawer-section drawer-relationships" aria-label="关系">
      ${formalHtml}
    </section>
  `;
}

function renderDrawerUpdates(cat) {
  const updates = getCatUpdates(cat);
  if (!updates.length) return '';
  const visibleUpdates = state.updatesExpanded ? updates : updates.slice(0, 3);
  const updatesHtml = visibleUpdates.map(update => {
    const title = String(update.title || '').trim();
    const content = String(update.content || '').trim();
    const date = formatUpdateDate(update.date);
    return `
      <article class="drawer-update">
        <time datetime="${escapeHtml(date)}">${escapeHtml(date)}</time>
        ${title ? `<h4>${escapeHtml(title)}</h4>` : ''}
        ${content ? `<p>${escapeHtml(content)}</p>` : '<p class="drawer-update-empty">暂无文字记录</p>'}
      </article>
    `;
  }).join('');
  const toggle = updates.length > 3
    ? `<button class="drawer-updates-toggle" type="button" data-updates-toggle data-expanded="${state.updatesExpanded}" aria-expanded="${state.updatesExpanded}">${state.updatesExpanded ? '收起动态' : `展开全部动态（共 ${updates.length} 条）`}</button>`
    : '';
  return renderDrawerSection('猫咪动态', `<div class="drawer-updates-list">${updatesHtml}</div>${toggle}`, 'drawer-updates', `共 ${updates.length} 条`, 'updates');
}

function renderDrawerPersonality(cat) {
  const personality = Array.isArray(cat.personality) ? cat.personality.filter(value => !isEmptyValue(value)) : [];
  if (!personality.length) return '';
  return renderDrawerSection('性格关键词', `<div class="drawer-keyword-list">${personality.map(value => `<span>${escapeHtml(value)}</span>`).join('')}</div>`, 'drawer-personality', '', 'personality');
}

function renderDrawerStory(cat) {
  const isEmptyStory = isEmptyValue(cat.description);
  const story = isEmptyStory
    ? `<div class="drawer-story drawer-story-empty drawer-story-empty-copy" role="status">
        <p>如果你看到这段话，就说明这只咪咪的故事还没有人书写，欢迎投稿。</p>
      </div>`
    : `<div class="drawer-story-popover" data-story-popover>
        <p class="drawer-story" data-story-preview tabindex="-1">${escapeHtml(cat.description)}<span class="drawer-story-tail" data-story-tail></span></p>
        <div class="drawer-story-bubble" data-story-bubble role="tooltip" aria-hidden="true">${escapeHtml(cat.description)}</div>
      </div>`;
  return `
    <section class="drawer-section drawer-description${isEmptyStory ? ' drawer-description-empty' : ''}" aria-label="故事档案">
      ${story}
    </section>
  `;
}

function renderDrawerArchive(cat) {
  const sections = [renderDrawerStory(cat)];
  const relationships = renderDrawerRelationships(cat);
  if (relationships) sections.push(relationships);
  return sections.join('');
}

function getDrawerAnimationOrigin(source) {
  if (!source || typeof source.getBoundingClientRect !== 'function') return null;
  const rect = source.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}

function openDrawer(name, source = null) {
  const cat = catProfiles.find(item => item.name === name);
  if (!cat) return;

  state.selectedName = name;
  state.updatesExpanded = false;
  renderDrawer(cat, { animationOrigin: getDrawerAnimationOrigin(source) });
}

function renderDrawer(cat, { updatesExpanded = state.updatesExpanded, animationOrigin = null } = {}) {
  hideSummaryTooltip();
  hideDrawerScrollIndicator();
  hideDrawerStoryScrollIndicator();
  const shouldAnimate = Boolean(animationOrigin);
  drawer.classList.remove('drawer-opening');
  drawer.classList.remove('drawer-closing');
  drawer.classList.toggle('drawer-opening-pending', shouldAnimate);
  drawer.hidden = false;
  drawerBackdrop.hidden = false;
  syncDrawerViewportHeight();
  state.updatesExpanded = updatesExpanded;

  drawer.innerHTML = `
    <header class="drawer-mobile-header" aria-label="猫咪详情顶部信息">
      <div class="drawer-mobile-header-identity">
        <h2>${escapeHtml(cat.name)}</h2>
        ${renderDrawerGenderBadge(cat.gender)}
        ${renderStatusTag(cat)}
      </div>
      <button class="drawer-mobile-close" type="button" aria-label="关闭猫咪详情">×</button>
    </header>
    <div class="drawer-content">
      <div class="drawer-layout">
        <section class="drawer-column drawer-left" aria-label="照片">
          ${renderDrawerGallery(cat)}
        </section>
        <section class="drawer-column drawer-right" aria-label="故事、关系与基础信息">
          ${renderDrawerFacts(cat)}
          ${renderDrawerArchive(cat)}
        </section>
      </div>
    </div>
  `;

  document.body.classList.add('drawer-open');
  lockMainAreaScroll();

  if (shouldAnimate) {
    const drawerRect = drawer.getBoundingClientRect();
    drawer.style.setProperty('--drawer-origin-x', `${animationOrigin.x - drawerRect.left}px`);
    drawer.style.setProperty('--drawer-origin-y', `${animationOrigin.y - drawerRect.top}px`);
    window.requestAnimationFrame(() => {
      if (drawer.hidden || state.selectedName !== cat.name) return;
      drawer.classList.remove('drawer-opening-pending');
      drawer.classList.add('drawer-opening');
    });
  } else {
    drawer.classList.remove('drawer-opening-pending');
    drawer.style.removeProperty('--drawer-origin-x');
    drawer.style.removeProperty('--drawer-origin-y');
  }

  drawer.setAttribute('tabindex', '-1');
  focusWithoutScrolling(drawer);

  drawer.querySelector('.drawer-mobile-close')?.addEventListener('click', closeDrawer);

  drawer.querySelectorAll('[data-related-cat]').forEach(button => {
    button.addEventListener('click', () => {
      const relatedCat = findRelatedCat(button.dataset.relatedCat);
      if (relatedCat) openDrawer(relatedCat.name, button);
    });
  });

  drawer.querySelectorAll('[data-photo-preview]').forEach(button => {
    button.addEventListener('click', () => {
      const previewImage = button.querySelector('img');
      if (previewImage) openPhotoViewer(previewImage);
    });
  });

  bindDrawerGallery(drawer, cat);

  const updatesToggle = drawer.querySelector('[data-updates-toggle]');
  if (updatesToggle) {
    updatesToggle.addEventListener('click', () => {
      renderDrawer(cat, { updatesExpanded: !state.updatesExpanded });
    });
  }

  bindSummaryTooltips(drawer);
  bindDrawerStoryPopovers(drawer);
  bindDrawerStoryScrollIndicators(drawer);
}

function hideSummaryTooltip() {
  if (!activeSummaryTooltip) return;
  const { source, detail } = activeSummaryTooltip;
  source.classList.remove('is-tooltip-visible');
  source.removeAttribute('aria-describedby');
  detail.removeAttribute('role');
  detail.removeAttribute('id');
  detail.style.left = '';
  detail.style.top = '';
  source.appendChild(detail);
  activeSummaryTooltip = null;
}

function positionSummaryTooltip(source, detail) {
  const gap = 8;
  const margin = 8;
  const sourceRect = source.getBoundingClientRect();
  const detailRect = detail.getBoundingClientRect();
  const left = Math.min(
    Math.max(margin, sourceRect.left + sourceRect.width / 2 - detailRect.width / 2),
    window.innerWidth - detailRect.width - margin
  );
  const aboveTop = sourceRect.top - detailRect.height - gap;
  const top = aboveTop >= margin
    ? aboveTop
    : Math.min(window.innerHeight - detailRect.height - margin, sourceRect.bottom + gap);
  detail.style.left = `${left}px`;
  detail.style.top = `${Math.max(margin, top)}px`;
}

function showSummaryTooltip(source) {
  const detail = source.querySelector('.summary-detail');
  if (!detail) return;
  hideSummaryTooltip();
  detail.id = `summary-detail-${Date.now()}`;
  detail.setAttribute('role', 'tooltip');
  source.setAttribute('aria-describedby', detail.id);
  document.body.appendChild(detail);
  activeSummaryTooltip = { source, detail };
  source.classList.add('is-tooltip-visible');
  positionSummaryTooltip(source, detail);
}

function bindSummaryTooltips(container) {
  container.querySelectorAll('.summary-source').forEach(source => {
    source.addEventListener('pointerenter', () => showSummaryTooltip(source));
  source.addEventListener('pointerleave', () => {
    if (!source.matches(':focus')) hideSummaryTooltip();
  });
  source.addEventListener('focus', () => showSummaryTooltip(source));
  source.addEventListener('blur', () => {
    if (!source.matches(':hover')) hideSummaryTooltip();
  });
  source.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch') {
      source.focus({ preventScroll: true });
      showSummaryTooltip(source);
    }
  });
  source.addEventListener('click', event => event.stopPropagation());
  });
  container.addEventListener('scroll', () => {
    if (activeSummaryTooltip && container.contains(activeSummaryTooltip.source)) positionSummaryTooltip(activeSummaryTooltip.source, activeSummaryTooltip.detail);
  }, { passive: true });
  window.addEventListener('resize', () => {
    if (activeSummaryTooltip && container.contains(activeSummaryTooltip.source)) positionSummaryTooltip(activeSummaryTooltip.source, activeSummaryTooltip.detail);
  }, { passive: true });
}

const STORY_SUPPLEMENT = '更多故事，等待继续记录，欢迎投稿';

function measureDrawerStoryLines(preview, tailText = '') {
  const computed = getComputedStyle(preview);
  const clone = preview.cloneNode(true);
  const cloneTail = clone.querySelector('[data-story-tail]');
  if (cloneTail) cloneTail.remove();
  if (tailText) {
    const tail = document.createElement('span');
    tail.className = 'drawer-story-tail';
    tail.textContent = tailText;
    clone.append(tail);
  }

  Object.assign(clone.style, {
    position: 'absolute',
    top: '0',
    left: '-99999px',
    width: String(preview.clientWidth) + 'px',
    height: 'auto',
    maxHeight: 'none',
    overflow: 'visible',
    display: 'block',
    visibility: 'hidden',
    pointerEvents: 'none',
    webkitLineClamp: 'unset'
  });
  preview.parentElement.appendChild(clone);

  const lineHeight = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.6;
  const verticalPadding = parseFloat(computed.paddingTop) + parseFloat(computed.paddingBottom);
  const contentHeight = Math.max(0, clone.scrollHeight - verticalPadding);
  const lines = Math.max(1, Math.ceil(contentHeight / lineHeight - .01));
  clone.remove();
  return lines;
}

function getDrawerStorySupplement(preview) {
  const lineCount = measureDrawerStoryLines(preview);
  if (lineCount >= 4) return '';
  return STORY_SUPPLEMENT;
}

function syncDrawerStoryPopover(popover) {
  const preview = popover.querySelector('[data-story-preview]');
  const bubble = popover.querySelector('[data-story-bubble]');
  if (!preview || !bubble) return;

  const tail = preview.querySelector('[data-story-tail]');
  const isMobileDrawer = window.matchMedia?.('(max-width: 980px)').matches;
  if (tail) tail.textContent = isMobileDrawer ? '' : getDrawerStorySupplement(preview);

  const isTruncated = preview.scrollHeight > preview.clientHeight + 1;
  popover.classList.toggle('is-truncated', isTruncated);
  bubble.setAttribute('aria-hidden', isTruncated ? 'false' : 'true');

  if (isTruncated) {
    const bubbleId = bubble.id || `drawer-story-${Date.now()}`;
    bubble.id = bubbleId;
    preview.setAttribute('tabindex', '0');
    preview.setAttribute('aria-describedby', bubbleId);
  } else {
    preview.setAttribute('tabindex', '-1');
    preview.removeAttribute('aria-describedby');
  }
}

function bindDrawerStoryPopovers(container) {
  const popovers = [...container.querySelectorAll('[data-story-popover]')];
  if (!popovers.length) return;

  const sync = () => popovers.forEach(syncDrawerStoryPopover);
  sync();
  window.requestAnimationFrame(sync);
  window.addEventListener('resize', sync, { passive: true });
}

function closeDrawer() {
  if (drawer.hidden || drawer.classList.contains('drawer-closing')) return;
  hideSummaryTooltip();
  state.selectedName = null;
  state.updatesExpanded = false;

  const finishClose = () => {
    hideDrawerScrollIndicator();
    hideDrawerStoryScrollIndicator();
    drawer.hidden = true;
    drawerBackdrop.hidden = true;
    drawer.innerHTML = '';
    drawer.classList.remove('drawer-opening', 'drawer-opening-pending', 'drawer-closing');
    drawer.style.removeProperty('--drawer-origin-x');
    drawer.style.removeProperty('--drawer-origin-y');
    document.documentElement.style.removeProperty('--drawer-viewport-height');
    document.body.classList.remove('drawer-open');
    unlockMainAreaScroll();
  };

  drawer.classList.remove('drawer-opening', 'drawer-opening-pending');
  drawer.classList.add('drawer-closing');

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    finishClose();
    return;
  }

  const closeAnimationName = window.matchMedia('(max-width: 719px)').matches
    ? 'drawer-sheet-out'
    : 'drawer-float-out';
  const handleAnimationEnd = event => {
    if (event.animationName !== closeAnimationName) return;
    drawer.removeEventListener('animationend', handleAnimationEnd);
    finishClose();
  };
  drawer.addEventListener('animationend', handleAnimationEnd);
}

function openPhotoViewer(img) {
  const fullSrc = img.dataset.full || img.src;
  const altText = String(img.alt || '').trim();
  const catName = altText.replace(/\s+(?:照片|照片预览)\s*\d+$/, '').trim() || '猫咪照片';
  openMaterialViewer(
    { name: catName },
    0,
    { records: [{ src: fullSrc }], materialLabelOverride: '照片', useThumbs: false }
  );
}

function normalizeMaterial(image) {
  if (typeof image === 'string') {
    return { src: image, isPostcard: false, author: '', photographedAt: '' };
  }
  if (!image || typeof image !== 'object') return null;
  return {
    ...image,
    src: String(image.src || '').trim(),
    isPostcard: image.isPostcard === true,
    author: String(image.author || '').trim(),
    photographedAt: String(image.photographedAt || '').trim()
  };
}

function getMaterialRecords(cat, materialFilter = 'all') {
  return Array.isArray(cat?.images)
    ? cat.images
      .map(normalizeMaterial)
      .filter(material => material?.src
        && !material.src.startsWith('http')
        && (materialFilter === 'postcard'
          ? material.isPostcard
          : materialFilter === 'standard'
            ? !material.isPostcard
            : true))
    : [];
}

function getPhotoExtension(source) {
  const sourceName = decodeURIComponent(String(source || '').split('/').pop()?.split('?')[0] || 'photo.jpg');
  return sourceName.match(/\.[a-z0-9]+$/i)?.[0] || '.jpg';
}

function getMaterialThumbSource(source) {
  if (!source || source.startsWith('http')) return source;
  return source.replace(/([^/]+)$/, 'thumb/$1');
}

function openMaterialViewer(cat, initialIndex = 0, {
  materialFilter = 'all',
  records = null,
  materialLabelOverride = '',
  useThumbs = true
} = {}) {
  const materials = Array.isArray(records)
    ? records.map(normalizeMaterial).filter(material => material?.src)
    : getMaterialRecords(cat, materialFilter);
  const sources = materials.map(material => material.src);
  if (!cat || !sources.length) return;

  let index = Math.min(Math.max(Number(initialIndex) || 0, 0), sources.length - 1);
  const materialLabel = materialLabelOverride || (materialFilter === 'postcard' ? '猫猫明信片' : '猫猫素材');
  const overlay = document.createElement('div');
  overlay.className = 'photo-viewer photo-viewer--materials';
  overlay.tabIndex = -1;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', `${cat.name}${materialLabel}`);
  overlay.innerHTML = `
    <div class="photo-viewer-actions">
      <button class="photo-viewer-close" type="button" aria-label="关闭图片预览">×</button>
    </div>
    <figure class="photo-viewer-stage">
      <figcaption class="photo-viewer-material-meta" data-photo-viewer-meta hidden></figcaption>
      <img data-photo-viewer-image alt="">
    </figure>
    <div class="photo-viewer-toolbar" role="toolbar" aria-label="${escapeHtml(cat.name)}${materialLabel}翻页">
      <button class="photo-viewer-toolbar-button" data-photo-viewer-prev type="button" aria-label="上一张"><span aria-hidden="true">‹</span></button>
      <span class="photo-viewer-counter" aria-live="polite"><strong data-photo-viewer-current></strong><span aria-hidden="true">/</span><span data-photo-viewer-total>${sources.length}</span></span>
      <button class="photo-viewer-toolbar-button" data-photo-viewer-next type="button" aria-label="下一张"><span aria-hidden="true">›</span></button>
      <span class="photo-viewer-toolbar-divider" aria-hidden="true"></span>
      <button class="photo-viewer-toolbar-icon" data-photo-viewer-rotate type="button" aria-label="旋转图片" title="旋转图片">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.2 9.2A7.3 7.3 0 0 1 18 6.5l1.5 1.5"></path><path d="M19.5 4.5v3.8h-3.8"></path><path d="M18.8 14.8A7.3 7.3 0 0 1 6 17.5l-1.5-1.5"></path><path d="M4.5 19.5v-3.8h3.8"></path></svg>
      </button>
      <a class="photo-viewer-toolbar-original" data-photo-original href="" target="_blank" rel="noreferrer noopener" aria-label="查看原图" title="查看原图">查看原图</a>
      <a class="photo-viewer-download photo-viewer-toolbar-download" data-photo-download href="" download aria-label="下载原图" title="下载原图">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5v10"></path><path d="m8 10 4 4 4-4"></path><path d="M5 16.5v3h14v-3"></path></svg>
      </a>
    </div>
  `;

  const image = overlay.querySelector('[data-photo-viewer-image]');
  const meta = overlay.querySelector('[data-photo-viewer-meta]');
  const current = overlay.querySelector('[data-photo-viewer-current]');
  const previous = overlay.querySelector('[data-photo-viewer-prev]');
  const next = overlay.querySelector('[data-photo-viewer-next]');
  const rotate = overlay.querySelector('[data-photo-viewer-rotate]');
  const original = overlay.querySelector('[data-photo-original]');
  const download = overlay.querySelector('[data-photo-download]');
  const close = overlay.querySelector('.photo-viewer-close');
  let rotation = 0;

  const update = nextIndex => {
    index = (nextIndex + sources.length) % sources.length;
    const source = sources[index];
    const material = materials[index];
    const fullSrc = cdnUrl(source);
    image.src = useThumbs ? cdnUrl(getMaterialThumbSource(source)) : fullSrc;
    image.loading = 'eager';
    image.decoding = 'async';
    rotation = 0;
    image.style.transform = 'none';
    image.alt = `${cat.name}${materialLabel} ${index + 1}`;
    const metadata = [
      material.author,
      material.photographedAt ? material.photographedAt.replace(/-/g, '.') : ''
    ].filter(Boolean);
    meta.hidden = metadata.length === 0;
    meta.textContent = metadata.join('·');
    current.textContent = String(index + 1);
    original.href = fullSrc;
    download.href = fullSrc;
    download.download = `${cat.name}-${index + 1}${getPhotoExtension(source)}`;
    previous.disabled = sources.length < 2;
    next.disabled = sources.length < 2;
  };

  const removeViewer = () => overlay.remove();
  update(index);
  previous.addEventListener('click', event => {
    event.stopPropagation();
    update(index - 1);
  });
  next.addEventListener('click', event => {
    event.stopPropagation();
    update(index + 1);
  });
  rotate.addEventListener('click', event => {
    event.stopPropagation();
    rotation = (rotation + 90) % 360;
    image.style.transform = `rotate(${rotation}deg)`;
  });
  download.addEventListener('click', event => event.stopPropagation());
  close.addEventListener('click', event => {
    event.stopPropagation();
    removeViewer();
  });
  overlay.addEventListener('click', event => {
    if (event.target === overlay) removeViewer();
  });
  overlay.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      update(index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      update(index + 1);
    }
  });

  document.body.appendChild(overlay);
  overlay.focus({ preventScroll: true });
}

function openGalleryMaterialCard(name, initialIndex = 0, materialFilter = state.galleryMaterialFilter || 'all') {
  const cat = catProfiles.find(item => item.name === name);
  if (!cat) return;
  openMaterialViewer(cat, initialIndex, { materialFilter });
}

function openInspirationViewer(note) {
  const source = String(note?.cover || '').trim();
  if (!source) return;

  const fullSrc = cdnUrl(source);
  const title = String(note?.title || '猫猫灵感');
  const externalUrl = String(note?.sourceUrl || '').trim();
  const overlay = document.createElement('div');
  overlay.className = 'photo-viewer photo-viewer--materials';
  overlay.tabIndex = -1;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', title);
  overlay.innerHTML = [
    '<div class="photo-viewer-actions">',
    '<button class="photo-viewer-close" type="button" aria-label="关闭图片预览">×</button>',
    '</div>',
    '<figure class="photo-viewer-stage"><img data-photo-viewer-image alt=""></figure>',
    '<div class="photo-viewer-toolbar" role="toolbar" aria-label="灵感图片工具栏">',
    '<button class="photo-viewer-toolbar-button" type="button" aria-label="上一张" disabled><span aria-hidden="true">‹</span></button>',
    '<span class="photo-viewer-counter" aria-live="polite"><strong>1</strong><span aria-hidden="true">/</span><span>1</span></span>',
    '<button class="photo-viewer-toolbar-button" type="button" aria-label="下一张" disabled><span aria-hidden="true">›</span></button>',
    '<span class="photo-viewer-toolbar-divider" aria-hidden="true"></span>',
    '<button class="photo-viewer-toolbar-icon" data-photo-viewer-rotate type="button" aria-label="旋转图片" title="旋转图片">',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.2 9.2A7.3 7.3 0 0 1 18 6.5l1.5 1.5"></path><path d="M19.5 4.5v3.8h-3.8"></path><path d="M18.8 14.8A7.3 7.3 0 0 1 6 17.5l-1.5-1.5"></path><path d="M4.5 19.5v-3.8h3.8"></path></svg>',
    '</button>',
    '<a class="photo-viewer-download photo-viewer-toolbar-download" data-photo-download href="' + escapeHtml(fullSrc) + '" download aria-label="下载原图" title="下载原图">',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5v10"></path><path d="m8 10 4 4 4-4"></path><path d="M5 16.5v3h14v-3"></path></svg>',
    '</a>',
    externalUrl
      ? '<a class="photo-viewer-toolbar-icon photo-viewer-toolbar-external" data-photo-external href="' + escapeHtml(externalUrl) + '" target="_blank" rel="noreferrer noopener" aria-label="打开外部链接" title="打开外部链接"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5"></path><path d="m19 5-8 8"></path><path d="M17 13v4H7V7h4"></path></svg></a>'
      : '',
    import.meta.env.DEV ? '<span class="photo-viewer-toolbar-divider photo-viewer-toolbar-local-divider" aria-hidden="true"></span><button class="photo-viewer-toolbar-icon" data-inspiration-edit type="button" aria-label="编辑灵感笔记" title="编辑灵感笔记"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4.5 16.8-.8 3.5 3.5-.8L18.7 7.9a2.2 2.2 0 0 0-3.1-3.1L4.5 16.8Z"></path><path d="m13.9 6.1 4 4"></path></svg></button><button class="photo-viewer-toolbar-icon photo-viewer-toolbar-danger" data-inspiration-delete type="button" aria-label="删除灵感笔记" title="删除灵感笔记"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14"></path><path d="M9 7V4.5h6V7"></path><path d="m7 7 .7 13h8.6L17 7"></path><path d="M10 11v5M14 11v5"></path></svg></button>' : '',
    '</div>'
  ].join('');

  const image = overlay.querySelector('[data-photo-viewer-image]');
  const rotate = overlay.querySelector('[data-photo-viewer-rotate]');
  const download = overlay.querySelector('[data-photo-download]');
  const external = overlay.querySelector('[data-photo-external]');
  const edit = overlay.querySelector('[data-inspiration-edit]');
  const remove = overlay.querySelector('[data-inspiration-delete]');
  const close = overlay.querySelector('.photo-viewer-close');
  let rotation = 0;

  image.src = fullSrc;
  image.alt = title;
  download.download = title + getPhotoExtension(source);
  rotate.addEventListener('click', event => {
    event.stopPropagation();
    rotation = (rotation + 90) % 360;
    image.style.transform = 'rotate(' + rotation + 'deg)';
  });
  download.addEventListener('click', event => event.stopPropagation());
  external?.addEventListener('click', event => event.stopPropagation());
  edit?.addEventListener('click', event => {
    event.stopPropagation();
    overlay.remove();
    openInspirationEditor(note);
  });
  remove?.addEventListener('click', async event => {
    event.stopPropagation();
    if (remove.disabled) return;
    const confirmed = window.confirm(`确定删除“${title}”吗？\n这会同时删除本地记录和封面图。`);
    if (!confirmed) return;
    remove.disabled = true;
    try {
      await deleteInspirationRecord(note);
      overlay.remove();
    } catch (error) {
      remove.disabled = false;
      window.alert(error instanceof Error ? error.message : '删除失败，请稍后再试');
    }
  });
  close.addEventListener('click', event => {
    event.stopPropagation();
    overlay.remove();
  });
  overlay.addEventListener('click', event => {
    if (event.target === overlay) overlay.remove();
  });
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      overlay.remove();
    }
  });

  document.body.appendChild(overlay);
  overlay.focus({ preventScroll: true });
}

function bindDrawerGallery(container, cat) {
  const main = container.querySelector('[data-main-photo]');
  const image = main?.querySelector('.drawer-gallery-main-image');
  const previous = container.querySelector('[data-photo-prev]');
  const next = container.querySelector('[data-photo-next]');
  if (!main || !image) return;

  const coverSrc = getCatCover(cat);
  const images = [coverSrc, ...getMaterialRecords(cat).map(material => material.src)
    .filter(src => src && src !== coverSrc)];
  if (!images.length) return;

  let index = 0;
  let startX = 0;
  let startY = 0;
  let suppressClick = false;
  const currentCounter = container.querySelector('[data-photo-current]');

  const updatePhoto = nextIndex => {
    index = (nextIndex + images.length) % images.length;
    const source = images[index];
    image.src = cdnUrl(source);
    image.dataset.full = cdnUrl(source);
    image.alt = `${cat.name} 照片 ${index + 1}`;
    if (currentCounter) currentCounter.textContent = String(index + 1);
    main.setAttribute('aria-label', `查看${cat.name}大图，当前第${index + 1}张，共${images.length}张`);
  };

  previous?.addEventListener('click', event => {
    event.stopPropagation();
    updatePhoto(index - 1);
  });

  next?.addEventListener('click', event => {
    event.stopPropagation();
    updatePhoto(index + 1);
  });

  const isMobile = window.matchMedia('(max-width: 719px)').matches;
  const openViewer = () => openMaterialViewer(
    cat,
    index,
    { records: images, materialLabelOverride: '照片', useThumbs: false }
  );
  if (!isMobile) {
    main.addEventListener('click', openViewer);
    return;
  }

  main.addEventListener('touchstart', event => {
    if (event.touches.length !== 1) return;
    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
  }, { passive: true });

  main.addEventListener('touchend', event => {
    if (!startX && !startY) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    startX = 0;
    startY = 0;
    if (Math.abs(deltaX) < 36 || Math.abs(deltaX) < Math.abs(deltaY) * 1.15) return;
    updatePhoto(index + (deltaX < 0 ? 1 : -1));
    suppressClick = true;
    window.setTimeout(() => { suppressClick = false; }, 350);
  }, { passive: true });

  main.addEventListener('click', event => {
    if (suppressClick) {
      event.preventDefault();
      return;
    }
    openViewer();
  });
}

function bindCatCards() {
  const selector = state.activeTab === 'home' ? '[data-cat-name]' : '.cat-card, .gallery-card--inspiration';
  const isMaterialGallery = state.activeTab === 'gallery' && ['souvenir', 'postcard'].includes(state.galleryView);
  const materialFilter = state.galleryView === 'postcard'
    ? 'postcard'
    : state.galleryMaterialFilter || 'all';
  const isInspirationGallery = state.activeTab === 'gallery' && state.galleryView === 'inspiration';
  document.querySelectorAll(selector).forEach(card => {
    const openCard = () => {
      if (isInspirationGallery && card.classList.contains('gallery-card--inspiration')) {
        const note = {
          id: card.dataset.inspirationId || '',
          cover: card.dataset.inspirationCover || card.querySelector('img')?.getAttribute('src') || '',
          sourceUrl: card.dataset.inspirationSourceUrl || '',
          title: card.dataset.inspirationTitle || card.getAttribute('aria-label')?.replace(/^查看/, '') || '猫猫灵感',
          tags: card.dataset.inspirationTags ? card.dataset.inspirationTags.split(',').map(tag => tag.trim()).filter(Boolean) : [],
          note: card.dataset.inspirationNote || '',
          mediaType: card.dataset.inspirationMediaType || 'image'
        };
        if (note.cover) openInspirationViewer(note);
        return;
      }
      if (isMaterialGallery && card.classList.contains('gallery-card--souvenir')) {
        const cat = catProfiles.find(item => item.name === card.dataset.catName);
        if (cat) openMaterialViewer(cat, Number(card.dataset.materialIndex) || 0, { materialFilter });
        return;
      }
      openDrawer(card.dataset.catName, card);
    };
    card.addEventListener('click', openCard);
    if (card.tagName === 'BUTTON') return;
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openCard();
      }
    });
  });
  if (state.activeTab !== 'home') bindSummaryTooltips(app);
}

function applyHomeFilter(filterKey) {
  state.query = '';
  state.status = '全部';
  state.vaccine = '全部';
  state.sterilized = '全部';
  state.area = '全部';
  if (filterKey !== 'all') {
    const [type, value] = filterKey.split('-', 2);
    if (type === 'status') state.status = value;
    else if (type === 'vaccine' || type === 'sterilized') {
      state.status = '就读中';
      state[type] = value;
    }
  }

  renderApp();
}

function bindSummaryCards() {
  document.querySelectorAll('.summary-clickable, [data-summary-filter]').forEach(card => {
    card.addEventListener('click', () => {
      applyHomeFilter(card.dataset.summaryFilter);
    });
    if (card.tagName === 'BUTTON') return;
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        applyHomeFilter(card.dataset.summaryFilter);
      }
    });
  });
}

export {
  DIRECTORY_SORT_OPTIONS,
  renderHomeTab,
  bindCatCards,
  bindSummaryCards,
  closeDrawer,
  openDrawer,
  openGalleryMaterialCard
};
