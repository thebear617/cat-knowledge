import { catProfiles } from '../../js/cats.js';
import { supplies } from '../../js/supplies.js';
import { timelineEvents } from '../../js/timeline.js';
import { roles } from '../../js/roles.js';
import { priceSnapshot } from '../data/price-snapshot.js';

const BASE_URL = `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}`;
const STATUS_ORDER = ['全部', '就读中', '已毕业', '喵星或失踪'];
const VACCINE_OPTIONS = ['全部', '零针', '一针', '两针', '疫苗毕业'];
const STERILIZED_OPTIONS = ['全部', '已绝育', '未绝育'];
const FRIENDLINESS_OPTIONS = ['全部', '亲人', '怕人', '非常怕人'];
const OPERATIONS_VIEWS = [
  { id: 'inventory', label: '物资库存', icon: '📦' },
  { id: 'collaboration', label: '行动协作', icon: '🤝' },
  { id: 'workflows', label: '工作流程', icon: '↗' }
];
const TIMELINE_TYPES = ['全部', '救助', '疫苗', '绝育', '送养'];

const TABS = [
  { id: 'home', title: '首页', icon: '🏠' },
  { id: 'timeline', title: '猫猫编年史', icon: '📜' },
  { id: 'supplies', title: '物资与协作', icon: '📦' },
  { id: 'procurement', title: '价格参考', icon: '🛒' },
  { id: 'knowledge', title: '猫猫知识', icon: '📖' }
];

const state = {
  query: '',
  status: '全部',
  vaccine: '全部',
  sterilized: '全部',
  friendliness: '全部',
  area: '全部',
  selectedName: null,
  drawerTab: 'profile',
  activeTab: 'home',
  operationsView: 'inventory',
  inventoryCategory: '全部',
  timelineType: '全部',
  knowledgeQuery: '',
  knowledgeCategory: '',
  knowledgeSubcategory: '',
  knowledgeView: 'group',
  knowledgeFilterOpen: false,
  knowledgeArticle: null,
  procurementQuery: '',
  procurementCategory: '主粮',
  procurementSubcategory: '',
  procurementMaxPerJin: '',
  procurementPage: 1,
  procurementSort: 'brand',
  procurementSortOpen: false,
  procurementFilterOpen: false
};

const knowledgePosts = window.__catKnowledgePosts || [];
let knowledgeTocScrollContainer = null;
let knowledgeTocScrollHandler = null;
let homeFeaturedRefreshTimer = null;
let procurementFilterOutsideClickBound = false;
let procurementFilterEscapeBound = false;
let procurementSortOutsideClickBound = false;
let procurementSortEscapeBound = false;
let activeSummaryTooltip = null;

const app = document.getElementById('app');
const drawer = document.getElementById('catDrawer');
const drawerBackdrop = document.getElementById('drawerBackdrop');

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// ============== Procurement 工具函数 ==============
const PROCUREMENT_CATEGORIES = [
  { category: '主粮', subcategories: ['幼猫粮', '成猫粮', '全期粮', '老年猫粮'] },
  { category: '猫砂 / 清洁护理', subcategories: ['猫砂', '清洁护理'] },
  { category: '罐头 / 湿粮', subcategories: ['主食罐', '零食罐'] },
  { category: '零食', subcategories: ['冻干', '猫条', '肉泥'] },
  { category: '驱虫 / 药品', subcategories: ['外驱', '内驱'] },
  { category: '航空箱 / 猫包', subcategories: ['航空箱', '猫包'] },
  { category: '猫窝 / 保暖', subcategories: [] },
];

const PROCUREMENT_INDEX_GROUPS = [
  { title: '日常喂养', categories: ['主粮', '罐头 / 湿粮', '零食'] },
  { title: '健康护理', categories: ['驱虫 / 药品', '猫砂 / 清洁护理'] },
  { title: '救助与安置', categories: ['航空箱 / 猫包', '猫窝 / 保暖'] },
];
const PROCUREMENT_PAGE_SIZE = 9;
const PROCUREMENT_MOBILE_PAGE_SIZE = 5;
const PROCUREMENT_SORT_OPTIONS = [
  { value: 'brand', label: '按品牌排序' },
  { value: 'price-asc', label: '按单价升序' },
  { value: 'price-desc', label: '按单价降序' },
];

function parseSpecToGrams(spec) {
  const m = String(spec ?? '').trim().match(/([\d.]+)\s*(kg|g|斤|克|公斤)/i);
  if (!m) return null;
  const value = parseFloat(m[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = m[2].toLowerCase();
  if (unit === 'kg' || unit === '公斤') return value * 1000;
  if (unit === 'g' || unit === '克') return value;
  if (unit === '斤') return value * 500;
  return null;
}

function computePerJin(item) {
  const grams = parseSpecToGrams(item.spec);
  if (grams == null) return null;
  const price = Number(item.price);
  if (!Number.isFinite(price)) return null;
  return price / (grams / 500);
}

function formatPerJin(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(1)} 元/斤`;
}

function formatItemPrice(item) {
  if (item.priceUnit) {
    const price = Number(item.price);
    return Number.isFinite(price) ? `¥${price.toFixed(2)} / ${item.priceUnit}` : '—';
  }
  return formatPerJin(computePerJin(item));
}

function getProcurementFiltered() {
  let items = priceSnapshot.items.slice();
  const q = (state.procurementQuery || '').trim().toLowerCase();
  if (q) {
    items = items.filter(item =>
      String(item.brand || '').toLowerCase().includes(q) ||
      String(item.series || '').toLowerCase().includes(q) ||
      String(item.product || '').toLowerCase().includes(q) ||
      String(item.sourceTitle || '').toLowerCase().includes(q)
    );
  }
  if (state.procurementCategory !== '全部') {
    items = items.filter(item => item.category === state.procurementCategory);
  }
  if (state.procurementSubcategory !== '') {
    items = items.filter(item => item.subcategory === state.procurementSubcategory);
  }
  const max = Number(state.procurementMaxPerJin);
  if (state.procurementMaxPerJin !== '' && Number.isFinite(max)) {
    items = items.filter(item => {
      const perJin = computePerJin(item);
      return perJin != null && perJin <= max;
    });
  }
  return sortProcurementItems(items);
}

function sortProcurementItems(items) {
  const sortValue = state.procurementSort || 'brand';
  return items.sort((a, b) => {
    if (sortValue === 'brand') {
      const brandOrder = normalize(a.brand).localeCompare(normalize(b.brand), 'zh-CN');
      if (brandOrder) return brandOrder;
      const seriesOrder = normalize(a.series).localeCompare(normalize(b.series), 'zh-CN');
      if (seriesOrder) return seriesOrder;
      return normalize(a.product).localeCompare(normalize(b.product), 'zh-CN');
    }
    const pa = a.priceUnit ? Number(a.price) : computePerJin(a);
    const pb = b.priceUnit ? Number(b.price) : computePerJin(b);
    if (pa == null && pb == null) return 0;
    if (pa == null) return 1;
    if (pb == null) return -1;
    return sortValue === 'price-desc' ? pb - pa : pa - pb;
  });
}

function getProcurementPageSize() {
  return window.innerWidth <= 719 ? PROCUREMENT_MOBILE_PAGE_SIZE : PROCUREMENT_PAGE_SIZE;
}

function getProcurementPage(items) {
  const pageSize = getProcurementPageSize();
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const requestedPage = Number(state.procurementPage) || 1;
  const page = Math.min(Math.max(requestedPage, 1), totalPages);
  const start = (page - 1) * pageSize;
  if (state.procurementPage !== page) state.procurementPage = page;
  return {
    items: items.slice(start, start + pageSize),
    page,
    totalPages,
    pageSize,
    start,
    end: Math.min(start + pageSize, items.length),
  };
}

function groupProcurementByCategory(items) {
  return PROCUREMENT_CATEGORIES
    .map(({ category, subcategories }) => {
      const catItems = items.filter(item => item.category === category);
      if (!catItems.length) return null;
      const subgroups = [];
      if (subcategories.length) {
        subcategories.forEach(sub => {
          const subItems = catItems.filter(item => (item.subcategory || '') === sub);
          if (subItems.length) subgroups.push({ subcategory: sub, items: subItems });
        });
      }
      const rest = catItems.filter(item => !subcategories.includes(item.subcategory || ''));
      if (rest.length) subgroups.push({ subcategory: null, items: rest });
      if (!subgroups.length) subgroups.push({ subcategory: null, items: catItems });
      return { category, subgroups };
    })
    .filter(Boolean);
}

function normalize(value) {
  return String(value ?? '').toLowerCase();
}

function isEmptyValue(value) {
  return !value || ['—', '-', '未知', '待补充', '❌ 未知', '❌未知'].includes(String(value).trim());
}

function getVaccineBucket(cat) {
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
    零针: '零针',
    一针: '已完成一针',
    两针: '已完成二针',
    疫苗毕业: '已完成三针',
  }[getVaccineBucket(cat)];
}

function getSterilizedBucket(cat) {
  return isEmptyValue(cat.sterilized) || String(cat.sterilized).includes('未') ? '未绝育' : '已绝育';
}

function getFriendlinessBucket(cat) {
  return String(cat.friendliness || '待观察');
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
      cat.friendliness,
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
      && (state.friendliness === '全部' || getFriendlinessBucket(cat) === state.friendliness)
      && (state.area === '全部' || cat.area === state.area);
  });

  return filtered.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
}

function cdnUrl(path) {
  if (!path) return path;
  if (path.startsWith('http')) return path;
  const parts = path.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
  return `${BASE_URL}${parts}`;
}

function getCatCover(cat) {
  if (cat.cover) return cat.cover;
  return cat.images && cat.images.length ? cat.images[0] : null;
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

// ============== Tab Navigation ==============

function renderSidebar() {
  const nav = document.getElementById('sidebarNav');
  if (!nav) return;
  nav.innerHTML = TABS.map(tab => {
    const active = tab.id === state.activeTab ? ' active' : '';
    return `<button class="sidebar-item${active}" data-tab="${tab.id}" aria-current="${tab.id === state.activeTab ? 'page' : 'false'}">
      <span class="sidebar-icon">${sidebarNavIcon(tab.id)}</span>
      <span>${escapeHtml(tab.title)}</span>
    </button>`;
  }).join('');
}

function sidebarNavIcon(tabId) {
  const common = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  const icons = {
    home: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3.5 10 8.5-7 8.5 7v10H14v-6H10v6H3.5Z" ${common}/></svg>`,
    timeline: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3.5h14v17H5zM8 8h8M8 12h8M8 16h5" ${common}/><path d="m7 3.5 1 2m8-2-1 2" ${common}/></svg>`,
    supplies: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 8 8-4 8 4v10l-8 4-8-4Z" ${common}/><path d="m4 8 8 4 8-4M12 12v10" ${common}/></svg>`,
    procurement: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10l1 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7Z" ${common}/><path d="M6 7h12M10 11h4" ${common}/></svg>`,
    knowledge: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5c3.2-1.5 5.9-1 8 1.1 2.1-2.1 4.8-2.6 8-1.1v13c-3.2-1.5-5.9-1-8 1.1-2.1-2.1-4.8-2.6-8-1.1Z" ${common}/><path d="M12 6.6v13" ${common}/></svg>`
  };
  return icons[tabId] || icons.home;
}

// ============== Home Tab ==============

function isHomeFiltered() {
  return state.status !== '全部' || state.vaccine !== '全部' || state.sterilized !== '全部' || state.friendliness !== '全部' || state.area !== '全部' || state.query !== '';
}

function getActiveHomeFilter() {
  if (state.vaccine !== '全部') return `vaccine-${state.vaccine}`;
  if (state.sterilized !== '全部') return `sterilized-${state.sterilized}`;
  if (state.status !== '全部') return `status-${state.status}`;
  return null;
}

function renderHomeTab() {
  const summary = getSummary();
  const activeFilter = getActiveHomeFilter();
  const filtered = isHomeFiltered();

  const catsWithPhotos = catProfiles.filter(cat => cat.images && cat.images.length > 0).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
  const heroCat = catProfiles.find(cat => cat.name === '大头' && getCatCover(cat)) || catsWithPhotos[0];
  const featuredCats = getTimedFeaturedCats(catsWithPhotos, heroCat);
  const directoryCats = filtered ? getFilteredCats() : catsWithPhotos;
  const homeStats = [summary.find(item => item.filter === 'all'), summary.find(item => item.filter === 'status-就读中'), summary.find(item => item.filter === 'status-已毕业'), summary.find(item => item.filter === 'sterilized-未绝育')].filter(Boolean);

  return `<section class="home-yearbook"><div class="home-cover"><div class="home-cover-copy"><p class="home-edition">⌁ 持续档案</p><h2>猫猫手册</h2><p class="home-cover-title">它们路过校园，也路过我们的生活</p><span>/ 从开始记录的那天起 /</span><i></i><p class="home-cover-note">从镜头和档案中，<br>认识校园里的每一只猫。</p></div>${heroCat ? `<div class="home-cover-photos"><button class="home-cover-photo" data-cat-name="${escapeHtml(heroCat.name)}" type="button"><img src="${cdnUrl(getCatCover(heroCat))}" alt="${escapeHtml(heroCat.name)}"><strong>${escapeHtml(heroCat.name)}</strong></button><div class="home-cover-strip">${featuredCats.slice(0, 3).map(cat => `<button data-cat-name="${escapeHtml(cat.name)}" type="button"><img src="${cdnUrl(getCatCover(cat))}" alt="${escapeHtml(cat.name)}"></button>`).join('')}</div><span>ONGOING ARCHIVE</span></div>` : ''}</div><section class="home-stat-ribbon" aria-label="西电猫猫档案统计">${homeStats.map(item => { const active = item.filter === 'all' ? !filtered : item.filter === activeFilter; return `<button class="${active ? 'is-active' : ''}" data-summary-filter="${escapeHtml(item.filter)}" type="button"><strong>${item.value}</strong><span>${escapeHtml(item.label)}</span></button>`; }).join('')}</section><section class="home-featured"><header><div><p>▣ 精选目录</p><span>点击照片，进入它们的档案</span></div><small>每 15 分钟更新</small></header><div class="home-feature-grid">${featuredCats.map((cat, index) => `<button class="home-feature-card card-${index + 1}" data-cat-name="${escapeHtml(cat.name)}" type="button"><img src="${cdnUrl(getCatCover(cat))}" alt="${escapeHtml(cat.name)}" loading="lazy"><div><h3>${escapeHtml(cat.name)}</h3><p>${escapeHtml(cat.status)} · ${escapeHtml(getSterilizedBucket(cat))}</p><span>📍 ${escapeHtml(cat.area || '地点待补充')}</span></div></button>`).join('')}</div></section><section class="home-directory"><header><div><p>◆ 全部猫咪档案</p><span>已收录 ${catsWithPhotos.length} 只猫咪的照片与档案</span></div><small>CAT DIRECTORY</small></header>${renderCatControls(directoryCats.length)}${directoryCats.length ? `<div class="home-directory-grid">${directoryCats.map(cat => `<button class="home-directory-card" data-cat-name="${escapeHtml(cat.name)}" type="button"><img src="${cdnUrl(getDirectoryCover(cat))}" alt="${escapeHtml(cat.name)}" loading="lazy"><span>${escapeHtml(cat.name)}</span></button>`).join('')}</div>` : '<p class="home-directory-empty">没有匹配的猫咪，可以清空筛选后再试。</p>'}</section><footer class="home-yearbook-footer">谢谢关心它们的你　♡</footer></section>`;
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
        <input id="searchInput" type="search" value="${escapeHtml(state.query)}" placeholder="搜索猫名、地点或备注" autocomplete="off" aria-label="搜索猫名、地点或备注">
        <button id="searchBtn" type="button" aria-label="搜索">
          <svg viewBox="0 0 24 24" aria-hidden="true" class="paw-icon"><circle cx="6.2" cy="9.3" r="2.1"></circle><circle cx="11.1" cy="6.2" r="2.1"></circle><circle cx="16.1" cy="8.1" r="2.1"></circle><circle cx="18.3" cy="13" r="2.1"></circle><path d="M12.1 11.1c-3.1 0-5.3 2.2-5.3 4.8 0 2 1.4 3.2 3.3 3.2.8 0 1.4-.2 2-.6.6.4 1.3.6 2 .6 1.9 0 3.2-1.2 3.2-3.2 0-2.6-2.1-4.8-5.2-4.8Z"></path></svg>
        </button>
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
        ${renderSummaryTag('抓捕/亲人', getFriendlinessBucket(cat), cat.friendliness)}
        ${renderSummaryTag('绝育', getSterilizedSummary(cat), cat.sterilized)}
      </div>
    </article>
  `;
}

function renderSummaryTag(label, summary, original) {
  const detail = original || '—';
  return `<span class="tag summary-source" tabindex="0" aria-label="${escapeHtml(label)}状态：${escapeHtml(summary)}；完整记录：${escapeHtml(detail)}"><span>${escapeHtml(summary)}</span><span class="summary-detail">${escapeHtml(detail)}</span></span>`;
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

function renderDetailRow(label, value, className = '') {
  const displayValue = value || '—';
  const isNotes = className === 'detail-row-notes';
  return `
    <div class="detail-row${className ? ` ${className}` : ''}">
      <dt>${label}</dt>
      <dd${isNotes ? ` class="detail-value-notes" tabindex="0" title="${escapeHtml(displayValue)}" aria-label="备注：${escapeHtml(displayValue)}"` : ''}>${escapeHtml(displayValue)}</dd>
    </div>
  `;
}

function renderOptionalSummaryTag(label, value) {
  if (isEmptyValue(value)) return '';
  return renderSummaryTag(label, value, value);
}

function openDrawer(name) {
  const cat = catProfiles.find(item => item.name === name);
  if (!cat) return;

  state.selectedName = name;
  state.drawerTab = 'profile';
  renderDrawer(cat);
}

function renderDrawer(cat) {
  hideSummaryTooltip();
  drawer.hidden = false;
  drawerBackdrop.hidden = false;

  const tab = state.drawerTab;
  let contentHtml = '';

  if (tab === 'profile') {
    contentHtml = `
      ${cat.image ? `<img class="drawer-image" src="${cdnUrl(cat.image)}" alt="${escapeHtml(cat.name)}">` : ''}
      <div class="drawer-tags">
        ${renderStatusTag(cat)}
        <span class="tag vaccine-${getVaccineBucket(cat)} summary-source" tabindex="0" aria-label="疫苗状态：${escapeHtml(getVaccineSummary(cat))}；具体记录：${escapeHtml(cat.vaccine || '—')}">
          <span>${escapeHtml(getVaccineSummary(cat))}</span>
          <span class="summary-detail">${escapeHtml(cat.vaccine || '—')}</span>
        </span>
        ${renderSummaryTag('绝育', getSterilizedSummary(cat), cat.sterilized)}
        ${renderSummaryTag('抓捕/亲人', getFriendlinessBucket(cat), cat.friendliness)}
        ${renderOptionalSummaryTag('区域', cat.area)}
        ${renderOptionalSummaryTag('性别', cat.gender)}
      </div>
      <dl class="detail-list">
        ${renderDetailRow('备注', cat.notes, 'detail-row-notes')}
      </dl>
    `;
  } else if (tab === 'photos') {
    const imgs = cat.images || [];
    if (imgs.length === 0) {
      contentHtml = `
        <div class="photo-empty">
          <p>暂无照片</p>
          <p class="photo-empty-hint">将照片放入 <code>images/${escapeHtml(cat.name)}/</code> 文件夹，并在 cats.js 中添加路径即可</p>
        </div>
      `;
    } else {
      contentHtml = `
        <div class="photo-grid">
          ${imgs.map(src => `
            <div class="photo-item">
              <img src="${cdnUrl(src.replace(/([^/]+)$/, 'thumb/$1'))}" data-full="${cdnUrl(src)}" alt="${escapeHtml(cat.name)}" loading="lazy" onclick="openPhotoViewer(this)">
            </div>
          `).join('')}
        </div>
      `;
    }
  }

  drawer.innerHTML = `
    <div class="drawer-header">
      <div>
        <h2>${escapeHtml(cat.name)}</h2>
      </div>
      <button class="icon-button" id="closeDrawer" type="button" aria-label="关闭详情">×</button>
    </div>
    <div class="drawer-tabs">
      <button class="drawer-tab${tab === 'profile' ? ' active' : ''}" data-tab="profile">档案</button>
      <button class="drawer-tab${tab === 'photos' ? ' active' : ''}" data-tab="photos">照片${(cat.images || []).length ? ` (${cat.images.length})` : ''}</button>
    </div>
    <div class="drawer-content">
      ${contentHtml}
    </div>
  `;

  document.body.classList.add('drawer-open');
  document.getElementById('closeDrawer').focus();
  document.getElementById('closeDrawer').addEventListener('click', closeDrawer);

  drawer.querySelectorAll('.drawer-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      state.drawerTab = btn.dataset.tab;
      renderDrawer(cat);
    });
  });

  bindSummaryTooltips(drawer);
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

function closeDrawer() {
  hideSummaryTooltip();
  state.selectedName = null;
  drawer.hidden = true;
  drawerBackdrop.hidden = true;
  drawer.innerHTML = '';
  document.body.classList.remove('drawer-open');
}

function openPhotoViewer(img) {
  const fullSrc = img.dataset.full || img.src;
  const overlay = document.createElement('div');
  overlay.className = 'photo-viewer';
  overlay.innerHTML = `<img src="${fullSrc}" alt="${img.alt}">`;
  overlay.addEventListener('click', () => overlay.remove());
  document.addEventListener('keydown', function handler(e) {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', handler);
    }
  });
  document.body.appendChild(overlay);
}

window.openPhotoViewer = openPhotoViewer;

// ============== Supplies Tab ==============

function getFilteredSupplies() {
  const q = normalize(state.query);
  if (!q) return supplies;
  return supplies.map(category => {
    const matched = category.items.filter(item =>
      normalize(item.name).includes(q)
      || normalize(item.spec || '').includes(q)
      || normalize(item.location || '').includes(q)
      || normalize(item.notes || '').includes(q)
    );
    return matched.length > 0 ? { ...category, items: matched } : null;
  }).filter(Boolean);
}

function renderSuppliesTab() {
  const view = OPERATIONS_VIEWS.find(item => item.id === state.operationsView) || OPERATIONS_VIEWS[0];
  return `<section class="operations-shell"><header class="operations-heading"><div><p>校园救助行动手册</p><h1>物资与协作 <span aria-hidden="true">◌</span></h1><strong>${state.operationsView === 'inventory' ? '物资库存档案' : escapeHtml(view.label)}</strong></div><div class="operations-stamp" aria-label="西电猫猫档案室"><span>西电猫猫档案室</span><b>每一份物资，都有去处</b><i>XDU CATS</i></div></header><nav class="operations-tabs" aria-label="运营台内容切换">${OPERATIONS_VIEWS.map(item => `<button data-operations-view="${item.id}" class="${state.operationsView === item.id ? 'is-active' : ''}" type="button"><span>${item.icon}</span>${item.label}</button>`).join('')}</nav>${state.operationsView === 'inventory' ? renderInventoryView() : state.operationsView === 'collaboration' ? renderCollaborationView() : renderWorkflowView()}</section>`;
}

function renderInventoryView() {
  const allData = getFilteredSupplies();
  const data = state.inventoryCategory === '全部' ? allData : allData.filter(category => category.category === state.inventoryCategory);
  const categoryIcons = { '猫粮': '🍖', '抓捕工具': '🔧', '航空箱 / 猫包': '🧳', '药品': '💊', '猫窝': '🛏️', '其它': '📦' };
  const totalItems = data.reduce((count, category) => count + category.items.length, 0);
  const totalRecordedItems = supplies.reduce((count, category) => count + category.items.length, 0);
  const allItems = supplies.flatMap(category => category.items);
  const recordedLocations = [...new Set(allItems.flatMap(item => (item.location || '').split(/\s*\/\s*/).filter(Boolean)))];
  const itemsWithNotes = allItems.filter(item => item.notes).length;
  let html = '<section class="operations-layout inventory-archive-layout"><div class="inventory-view">';
  html += `<section class="inventory-archive-toolbar" aria-label="库存搜索和分类筛选"><div class="inventory-archive-search"><span>⌕</span><input id="searchInput" type="search" value="${escapeHtml(state.query)}" placeholder="搜索物资名称 / 规格 / 地点 / 备注" autocomplete="off"><button id="searchBtn" type="button" aria-label="搜索"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6.2" cy="9.3" r="2.1"></circle><circle cx="11.1" cy="6.2" r="2.1"></circle><circle cx="16.1" cy="8.1" r="2.1"></circle><circle cx="18.3" cy="13" r="2.1"></circle><path d="M12.1 11.1c-3.1 0-5.3 2.2-5.3 4.8 0 2 1.4 3.2 3.3 3.2.8 0 1.4-.2 2-.6.6.4 1.3.6 2 .6 1.9 0 3.2-1.2 3.2-3.2 0-2.6-2.1-4.8-5.2-4.8Z"></path></svg></button></div><div class="inventory-category-filters" aria-label="物资分类筛选"><button data-inventory-category="全部" class="${state.inventoryCategory === '全部' ? 'is-active' : ''}" type="button">全部</button>${supplies.map(category => `<button data-inventory-category="${escapeHtml(category.category)}" class="${state.inventoryCategory === category.category ? 'is-active' : ''}" type="button">${escapeHtml(category.category)}</button>`).join('')}</div></section>`;
  html += `<section class="inventory-archive-stats" aria-label="库存概览"><article><span>▣</span><div><small>库存分类</small><strong>${data.length}</strong><em>类</em></div><p>当前视图</p></article><article><span>☷</span><div><small>收录条目</small><strong>${totalItems}</strong><em>项</em></div><p>可检索物资</p></article><article><span>⌑</span><div><small>已标注地点</small><strong>${recordedLocations.length}</strong><em>处</em></div><p>存放位置</p></article><article><span>✎</span><div><small>档案备注</small><strong>${itemsWithNotes}</strong><em>条</em></div><p>待留意信息</p></article></section>`;
  html += `<section class="inventory-panel"><div class="inventory-panel-toolbar"><div class="inventory-summary"><strong>物资清单</strong><span>按类别归档 · ${data.length} 类 ${totalItems} 项记录</span></div><div class="inventory-expand-controls"><button data-inventory-expand="all" type="button">全部展开</button><span></span><button data-inventory-expand="none" type="button">全部折叠</button></div></div>`;

  if (!data.length) {
    html += '<section class="empty-state"><h2>没有匹配的物资</h2><p>可以清除搜索试试。</p></section>';
  } else {
    html += '<div class="supplies-list">';
    for (const cat of data) {
      if (!cat.items.length) continue;
      const emoji = categoryIcons[cat.category] || '📦';
      html += `<details class="supply-category" data-supply-category="${escapeHtml(cat.category)}">
        <summary class="supply-cat-header">
          <h3><span class="supply-category-icon">${emoji}</span>${escapeHtml(cat.category)}<small>共 ${cat.items.length} 项</small><span class="supply-arrow">⌄</span></h3>
        </summary>
        <div class="supply-cards">
        <div class="supply-row supply-row-head">
          <span>名称</span><span>规格</span><span>地点</span><span>备注</span>
        </div>`;
      for (const item of cat.items) {
        html += `<div class="supply-row">
          <span class="supply-cell supply-cell-name">${escapeHtml(item.name)}</span>
          <span class="supply-cell supply-cell-spec">${escapeHtml(item.spec || '—')}</span>
          <span class="supply-cell supply-cell-loc">${item.location ? `📍 ${escapeHtml(item.location)}` : '—'}</span>
          <span class="supply-cell supply-cell-notes">${escapeHtml(item.notes || '—')}</span>
        </div>`;
      }
      html += '</div></details>';
    }
    html += '</div>';
  }

  html += '</div>';
  html += `<aside class="inventory-aside" aria-label="库存档案索引"><section class="inventory-note-card inventory-category-card"><p>CATALOGUE</p><h2>分类速览</h2><div>${supplies.map(category => `<button data-inventory-category="${escapeHtml(category.category)}" class="${state.inventoryCategory === category.category ? 'is-active' : ''}" type="button"><span>${categoryIcons[category.category] || '📦'}</span><strong>${escapeHtml(category.category)}</strong><small>${category.items.length} 项</small></button>`).join('')}</div></section><section class="inventory-note-card inventory-location-card"><p>LOCATION INDEX</p><h2>存放索引</h2><ul>${recordedLocations.map(location => `<li><span>●</span>${escapeHtml(location)}</li>`).join('')}</ul></section><section class="inventory-note-card inventory-tip-card"><p>ARCHIVE NOTE</p><h2>归档说明</h2><p>所有数量、地点和备注均以现有物资档案为准；展开分类即可查看完整记录。</p><small>全库共 ${totalRecordedItems} 项物资记录</small></section></aside></section>`;
  return html;
}

// ============== Timeline Tab ==============

function getFilteredTimeline() {
  const q = normalize(state.query);
  return timelineEvents.filter(event =>
    (!q || normalize(event.cat).includes(q) ||
      normalize(event.type).includes(q) ||
      normalize(event.notes || '').includes(q) ||
      normalize(event.location || '').includes(q)) &&
    (state.timelineType === '全部' || event.type === state.timelineType)
  );
}

function buildChronicleSearch() {
  return `<div class="chronicle-search"><span>⌕</span><input id="searchInput" type="search" value="${escapeHtml(state.query)}" placeholder="搜索猫名、地点或备注" autocomplete="off"><button id="searchBtn" type="button">搜索</button>${state.query ? '<button id="clearSearch" class="chronicle-search-clear" type="button" aria-label="清除搜索">×</button>' : ''}</div>`;
}

function chronicleMotif(kind) {
  const common = 'fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"';
  const motifs = {
    envelope: `<svg viewBox="0 0 72 48" aria-hidden="true"><rect x="8" y="9" width="54" height="30" rx="1.5" ${common}/><path d="m9 11 27 19 26-19M9 38l18-16m36 16L45 22" ${common}/><circle cx="55" cy="9" r="8" ${common}/><path d="M52 9h6M55 6v6" ${common}/></svg>`,
    stamp: `<svg viewBox="0 0 64 52" aria-hidden="true"><path d="M11 8h42v36H11z" ${common}/><path d="m15 8 3 4 4-4 4 4 4-4 4 4 4-4 4 4 4-4 3 4M15 44l3-4 4 4 4-4 4 4 4-4 4 4 4-4 4 4 3-4" ${common}/><path d="M24 30c0-6 3-10 8-10s8 4 8 10c-2 3-5 5-8 5s-6-2-8-5Z" ${common}/><path d="m27 21-3-4 5 1m8 0 5-1-3 4M29 28h.1m6-.1h.1M29 32c2 1 4 1 6 0" ${common}/></svg>`,
    flower: `<svg viewBox="0 0 52 60" aria-hidden="true"><path d="M27 32c-5-1-8-5-7-9 2-4 6-4 9-1-1-5 2-8 6-7 4 2 4 6 1 9 5-1 8 2 7 6-1 4-5 5-9 3 1 5-2 8-6 7-4-2-4-6-1-8-4 2-8 1-9-3Z" ${common}/><circle cx="28" cy="28" r="3" ${common}/><path d="M28 36c0 8-2 13-6 17m6-10c4 1 7 3 9 6M22 53l-5 2m5-2-2-5" ${common}/></svg>`,
    paw: `<svg viewBox="0 0 42 34" aria-hidden="true"><ellipse cx="21" cy="23" rx="10" ry="7" fill="currentColor"/><circle cx="10" cy="13" r="4" fill="currentColor"/><circle cx="18" cy="8" r="4" fill="currentColor"/><circle cx="27" cy="8" r="4" fill="currentColor"/><circle cx="34" cy="14" r="4" fill="currentColor"/></svg>`
  };
  return motifs[kind] || '';
}

function renderTimelineTab() {
  const events = getFilteredTimeline();
  const chroniclePhoto = cdnUrl(getCatCover(catProfiles[0]));
  const months = {};
  for (const event of events) {
    const key = event.date.slice(0, 7);
    if (!months[key]) months[key] = [];
    months[key].push(event);
  }
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const typeDescriptions = { '救助': '发现受伤或需要帮助的猫咪', '疫苗': '进行疫苗接种记录', '绝育': '完成绝育手术记录', '送养': '成功进入送养流程' };
  const visibleMonths = Object.keys(months).sort();
  const mobileSummary = state.query ? `“${escapeHtml(state.query)}” · 找到 ${events.length} 条记录` : `共 ${events.length} 条记录`;
  const mobileMonthNav = visibleMonths.map((key, index) => {
    const [year, month] = key.split('-');
    return `<button data-timeline-month="${key}" type="button" aria-label="跳转到 ${year} 年 ${month} 月"><span>${index === 0 ? year : ''}</span><strong>${month}</strong></button>`;
  }).join('');
  let html = `<section class="chronicle-shell"><div class="chronicle-layout"><main class="chronicle-rail"><header class="chronicle-heading"><div><div class="chronicle-title-line"><h1>猫猫编年史</h1><span class="chronicle-postmark">🐾</span></div><span>记录校园猫咪的点滴故事，每一次相遇都值得被珍藏。</span></div>${buildChronicleSearch()}</header><div class="chronicle-type-filters" aria-label="事件类型筛选">${TIMELINE_TYPES.map(type => `<button data-timeline-type="${type}" class="${state.timelineType === type ? 'is-active' : ''}" type="button">${type === '全部' ? '全部' : `<i class="timeline-filter-dot timeline-type-${type}"></i>${type}`}</button>`).join('')}</div><div class="chronicle-archive-body">`;
  html += `<nav class="chronicle-mobile-month-nav" aria-label="月份导航">${mobileMonthNav}</nav><div class="chronicle-mobile-summary">${mobileSummary}${state.query ? '<button id="clearSearchMobile" type="button">清除</button>' : ''}</div>`;

  if (!events.length) {
    html += '<section class="empty-state"><h2>没有匹配的事件</h2><p>可以清除搜索或切换事件类型。</p></section>';
  } else {
    html += '<div class="timeline-list">';
    html += `<div class="chronicle-floating-motifs" aria-hidden="true"><i class="chronicle-float-flower">${chronicleMotif('flower')}</i><i class="chronicle-float-stamp">${chronicleMotif('stamp')}</i><i class="chronicle-float-envelope">${chronicleMotif('envelope')}</i></div>`;
    for (const [key, items] of Object.entries(months).sort()) {
      const [year, month] = key.split('-');
      const m = Number(month);
      const isFirst = key === visibleMonths[0];
      html += `<section class="timeline-month" id="timeline-${key}"><header class="timeline-month-label"><span>${year}</span><h2>${String(m).padStart(2, '0')}</h2><small>${items.length} 条记录</small></header><div class="timeline-events">${isFirst ? '<div class="timeline-table-head"><span>日期</span><span>猫名</span><span>事件类型</span><span>地点</span><span>备注</span></div>' : ''}`;
      for (const event of items.sort((a, b) => a.date.localeCompare(b.date))) {
        const location = isEmptyValue(event.location) ? '' : `<span class="timeline-entry-location">⌖ ${escapeHtml(event.location)}</span>`;
        const notes = isEmptyValue(event.notes) ? '' : `<span class="timeline-entry-desc">${escapeHtml(event.notes)}</span>`;
        html += `<article class="timeline-item timeline-type-${event.type}"><time datetime="${event.date}">${event.date.slice(5).replace('-', '.')}</time><span class="timeline-entry-cat">${escapeHtml(event.cat)}</span><span class="timeline-badge timeline-badge-${event.type}">${escapeHtml(event.type)}</span>${location}${notes}</article>`;
      }
      html += '</div></section>';
    }
    html += `</div><footer class="chronicle-quote"><span>“</span><p>它们或许只是我们校园里的过客，但对于它们，我们是全部。</p><i>${chronicleMotif('paw')}</i><b></b></footer>`;
  }

  html += `</div></main><aside class="chronicle-aside" aria-label="编年史索引"><section class="chronicle-nav-card"><p>时间索引</p><div>${visibleMonths.map(key => { const [year, month] = key.split('-'); return `<button data-timeline-month="${key}" type="button"><span>${year} / ${month}</span><i></i></button>`; }).join('')}</div></section><section class="chronicle-legend-card"><p>事件类型图例</p><div>${TIMELINE_TYPES.slice(1).map(type => `<div><i class="timeline-filter-dot timeline-type-${type}"></i><span><strong>${type}</strong><small>${typeDescriptions[type]}</small></span></div>`).join('')}</div></section><section class="chronicle-total-card"><p>记录总数</p><strong>${timelineEvents.length}<small>条记录</small></strong><span>持续更新</span></section>${chroniclePhoto ? `<figure class="chronicle-photo-card"><img src="${chroniclePhoto}" alt="${escapeHtml(catProfiles[0].name)}"><figcaption>愿每一次记录，都成为更好的明天。</figcaption></figure>` : ''}</aside></div></section>`;
  return html;
}

// ============== Operations: Collaboration & Workflows ==============

function roleKnowledgeLinks(roleName) {
  const links = {
    '义卖组': ['校园救助行动的核心原则'],
    '疫苗绝育组': ['疫苗接种前后怎么准备', '绝育行动怎么安排'],
    '赞助组': ['校园救助行动的核心原则'],
    '宣传财务组': ['救助费用如何按规则处理', '校园救助行动的核心原则']
  };
  return (links[roleName] || []).map(title => knowledgePosts.find(post => post.title === title)).filter(Boolean);
}

function renderCollaborationView() {
  const roleIcons = { '义卖组': '🛍️', '疫苗绝育组': '🩺', '赞助组': '🤝', '宣传财务组': '📣' };
  return `<section class="operations-archive-view collaboration-view"><header class="operations-section-heading archive-section-heading"><div><p>COLLABORATION FILES</p><h2>行动协作</h2><span>按小组归档职责、协作阶段与相关行动知识，不预设虚假的任务状态。</span></div><strong>${roles.length} 个协作小组</strong></header><div class="operations-archive-layout"><main class="collaboration-list">${roles.map((role, index) => { const links = roleKnowledgeLinks(role.name); return `<article class="collaboration-role"><span class="archive-item-number">0${index + 1}</span><div class="collaboration-role-top"><span class="collaboration-role-icon">${roleIcons[role.name] || '👥'}</span><div><h3>${escapeHtml(role.name)}</h3><p>${escapeHtml(role.description)}</p></div></div><dl class="collaboration-phases">${role.phases.map(phase => `<div><dt>${escapeHtml(phase.label)}</dt><dd>${escapeHtml(phase.detail)}</dd></div>`).join('')}</dl>${links.length ? `<div class="role-knowledge-links"><span>查阅条目</span>${links.map(post => `<button data-operations-knowledge-slug="${escapeHtml(post.slug)}" type="button">${escapeHtml(post.title)} →</button>`).join('')}</div>` : ''}</article>`; }).join('')}</main><aside class="operations-archive-aside"><section class="operations-note-card"><p>GROUP INDEX</p><h3>协作目录</h3><ol>${roles.map((role, index) => `<li><span>0${index + 1}</span>${escapeHtml(role.name)}</li>`).join('')}</ol></section><section class="operations-note-card operations-note-card-tilted"><p>COLLABORATION NOTE</p><h3>协作说明</h3><span>每个小组独立记录职责与阶段；具体操作以关联的猫猫知识文章为准。</span></section></aside></div></section>`;
}

function renderWorkflowView() {
  const workflows = [
    { icon: '🐾', title: '新猫出现后的评估', text: '从发现、隔离到两周观察，再判断送养或放归路径。', steps: ['发现情况', '隔离观察', '记录评估', '确定路径'], article: '新猫出现后的去留评估' },
    { icon: '💉', title: '疫苗接种准备', text: '在接种前后确认健康情况、时间窗口和观察要点。', steps: ['健康评估', '确认窗口', '接种记录', '后续观察'], article: '疫苗接种前后怎么准备' },
    { icon: '✂️', title: '绝育行动安排', text: '围绕抓捕、接送、术后恢复和放归的行动安排。', steps: ['确认对象', '抓捕接送', '术后照护', '恢复放归'], article: '绝育行动怎么安排' },
    { icon: '🧾', title: '救助费用处理', text: '将费用确认、救助执行与后续记录放进同一条规则。', steps: ['确认需求', '执行救助', '保留记录', '规则处理'], article: '救助费用如何按规则处理' }
  ];
  return `<section class="operations-archive-view workflow-view"><header class="operations-section-heading archive-section-heading"><div><p>FIELD MANUAL</p><h2>工作流程</h2><span>把已有的救助行动知识整理成可快速查阅的步骤卷宗。</span></div><strong>${workflows.length} 条行动流程</strong></header><div class="operations-archive-layout"><main class="workflow-list">${workflows.map((workflow, index) => { const post = knowledgePosts.find(item => item.title === workflow.article); return `<article class="workflow-card"><header class="workflow-card-head"><span>${workflow.icon}</span><div><small>流程 0${index + 1}</small><h3>${workflow.title}</h3><p>${workflow.text}</p></div></header><ol>${workflow.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>${post ? `<footer><button data-operations-knowledge-slug="${escapeHtml(post.slug)}" type="button">查阅完整科普文章 →</button></footer>` : ''}</article>`; }).join('')}</main><aside class="operations-archive-aside"><section class="operations-note-card"><p>PROCESS INDEX</p><h3>行动索引</h3><ol>${workflows.map((workflow, index) => `<li><span>0${index + 1}</span>${escapeHtml(workflow.title)}</li>`).join('')}</ol></section><section class="operations-note-card operations-note-card-tilted"><p>FIELD NOTE</p><h3>使用提示</h3><span>流程卡用于快速确认步骤；遇到具体情形时，请继续查阅对应的完整科普文章。</span></section></aside></div></section>`;
}

// ============== Science Tab ==============

function renderScienceTab() {
  if (state.knowledgeArticle) {
    const post = knowledgePosts.find(item => item.slug === state.knowledgeArticle);
    if (post) {
      const headings = getArticleHeadings(post.body);
      return `<section class="knowledge-shell knowledge-article-layout${headings.length ? ' has-toc' : ''}"><button class="knowledge-back" id="knowledgeBack" type="button">← 返回文章列表</button><div class="knowledge-article-detail-layout">${renderKnowledgeToc(headings)}<article class="knowledge-article"><header class="knowledge-article-header"><h1>${escapeHtml(post.title)}</h1><div class="knowledge-article-meta-row"><p class="knowledge-article-meta">发布于 ${new Date(post.publishedAt).toLocaleDateString('zh-CN')}</p><div class="knowledge-tags">${(post.tags || []).map(tag => `<span>#${escapeHtml(tag)}</span>`).join('')}</div></div></header><div class="knowledge-body">${markdownToHtml(post.body, headings)}</div></article></div></section>`;
    }
  }
  const categories = [...new Set(knowledgePosts.map(post => post.category))];
  const subcategories = [...new Set(knowledgePosts.map(post => post.subcategory))];
  const posts = knowledgePosts.filter(knowledgePostMatches);
  const groups = categories.map(category => ({ category, posts: posts.filter(post => post.category === category) })).filter(group => group.posts.length);
  const mobileKnowledge = typeof window !== 'undefined' && window.matchMedia('(max-width: 719px)').matches;
  const view = mobileKnowledge && state.knowledgeView === 'grid' ? 'group' : state.knowledgeView;
  const cards = view === 'group' ? `<div class="knowledge-archive-groups">${groups.map((group, index) => renderKnowledgeArchiveGroup(group, index)).join('')}</div>` : view === 'list' ? `<div class="knowledge-list">${posts.map(renderKnowledgeListRow).join('')}</div>` : `<div class="knowledge-cards">${posts.map(renderKnowledgeCard).join('')}</div>`;
  const hasFilter = state.knowledgeCategory || state.knowledgeSubcategory;
  const tagCounts = Object.entries(knowledgePosts.flatMap(post => post.tags || []).reduce((counts, tag) => ({ ...counts, [tag]: (counts[tag] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hans-CN'));
  const filterSummary = [state.knowledgeCategory || '全部分类', state.knowledgeSubcategory || '全部主题', state.knowledgeQuery || '未输入关键词'];
  const viewButtons = ['group', 'grid', 'list'].filter(id => !mobileKnowledge || id !== 'grid').map(id => `<button data-knowledge-view="${id}" class="${view === id ? 'is-active' : ''}" type="button" title="${knowledgeViewLabel(id)}" aria-label="${knowledgeViewLabel(id)}">${knowledgeViewIcon(id)}<span>${knowledgeViewLabel(id)}</span></button>`).join('');
  const filterTags = tagCounts.map(([tag, count]) => `<button data-knowledge-tag="${escapeHtml(tag)}" type="button">${escapeHtml(tag)} <small>${count}</small></button>`).join('');
  const filterPanel = state.knowledgeFilterOpen ? `<div class="knowledge-filter-popover"><div><strong>筛选文章</strong><button data-knowledge-clear type="button">清空条件</button></div><section><span>一级分类</span><p>${categories.map(item => `<button data-knowledge-category="${escapeHtml(item)}" class="${item === state.knowledgeCategory ? 'is-selected' : ''}" type="button">${escapeHtml(item)}</button>`).join('')}</p></section><section><span>二级主题</span><p>${subcategories.map(item => `<button data-knowledge-subcategory="${escapeHtml(item)}" class="${item === state.knowledgeSubcategory ? 'is-selected' : ''}" type="button">${escapeHtml(item)}</button>`).join('')}</p></section><section><span>常用标签</span><p class="knowledge-filter-tags">${filterTags}</p></section></div>` : '';
  return `<section class="knowledge-shell"><header class="knowledge-heading"><div><h1>猫猫知识</h1><span>校园流浪猫救助与运营知识手册</span></div><div class="knowledge-heading-stamp"><b>知识在流转</b><span>善意在延续</span></div></header><div class="knowledge-toolbar"><label class="knowledge-search"><span>⌕</span><input id="knowledgeSearch" type="search" value="${escapeHtml(state.knowledgeQuery)}" placeholder="搜索文章 / 标签 / 关键词"></label><div class="knowledge-actions"><div class="knowledge-views" aria-label="视图切换">${viewButtons}</div><button id="knowledgeFilterToggle" class="knowledge-filter-btn${hasFilter ? ' has-filter' : ''}" type="button">筛选${hasFilter ? ' · 已选' : ''}</button>${filterPanel}</div></div><p class="knowledge-result-count">共 <strong>${posts.length}</strong> 篇条目</p><div class="knowledge-archive-layout"><main class="knowledge-results view-${view}">${cards || '<p class="knowledge-empty">没有找到匹配的文章。</p>'}</main><aside class="knowledge-archive-aside"><section class="knowledge-aside-card knowledge-filter-summary"><p>⌕ 当前检索条件</p><ul><li>一级分类：${escapeHtml(filterSummary[0])}</li><li>二级主题：${escapeHtml(filterSummary[1])}</li><li>关键词：${escapeHtml(filterSummary[2])}</li></ul>${hasFilter || state.knowledgeQuery ? '<button data-knowledge-clear type="button">清空条件</button>' : ''}</section><section class="knowledge-aside-card"><p>◇ 常用标签</p><div class="knowledge-tag-cloud">${filterTags}</div></section><section class="knowledge-aside-card"><p>▣ 分类索引</p><ol>${categories.map((category, index) => `<li><span>0${index + 1}</span>${escapeHtml(category)}<small>${knowledgePosts.filter(post => post.category === category).length} 篇</small></li>`).join('')}</ol></section><section class="knowledge-aside-card knowledge-tip-card"><p>检索小贴士</p><span>支持通过关键词、标签、主题组合检索；输入“疫苗管理”即可找到包含“疫苗”与“管理”的相关文章。</span></section></aside></div></section>`;
}

function knowledgeCategoryIcon(category) {
  return ({ '救助与 TNR': '🐾', '健康与安全': '🩺', '救助运营': '🗂️' })[category] || '📚';
}

function knowledgeViewLabel(view) {
  return ({ group: '分组视图', grid: '宫格视图', list: '列表视图' })[view];
}

function knowledgeViewIcon(view) {
  const icons = {
    group: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    grid: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="5" height="5" rx=".7"/><rect x="10" y="3" width="5" height="5" rx=".7"/><rect x="17" y="3" width="4" height="5" rx=".7"/><rect x="3" y="10" width="5" height="5" rx=".7"/><rect x="10" y="10" width="5" height="5" rx=".7"/><rect x="17" y="10" width="4" height="5" rx=".7"/><rect x="3" y="17" width="5" height="4" rx=".7"/><rect x="10" y="17" width="5" height="4" rx=".7"/><rect x="17" y="17" width="4" height="4" rx=".7"/></svg>',
    list: '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r=".75"/><circle cx="3.5" cy="12" r=".75"/><circle cx="3.5" cy="18" r=".75"/></svg>'
  };
  return icons[view];
}

function knowledgePostMatches(post) {
  const query = state.knowledgeQuery.trim().toLowerCase();
  const haystack = [post.title, post.description, post.category, post.subcategory, ...(post.tags || [])].join(' ').toLowerCase();
  return (!query || haystack.includes(query)) && (!state.knowledgeCategory || post.category === state.knowledgeCategory) && (!state.knowledgeSubcategory || post.subcategory === state.knowledgeSubcategory);
}

function renderKnowledgeCard(post) {
  return `<button class="knowledge-card" data-knowledge-slug="${escapeHtml(post.slug)}" type="button"><p class="knowledge-card-meta">${escapeHtml(post.subcategory)} · ${new Date(post.publishedAt).toLocaleDateString('zh-CN')}</p><h2>${escapeHtml(post.title)}</h2><p>${escapeHtml(post.description)}</p><div>${(post.tags || []).map(tag => `<span>#${escapeHtml(tag)}</span>`).join('')}</div></button>`;
}

function renderKnowledgeListRow(post) {
  return `<button class="knowledge-list-row" data-knowledge-slug="${escapeHtml(post.slug)}" type="button"><div><p class="knowledge-card-meta">${escapeHtml(post.category)} / ${escapeHtml(post.subcategory)}</p><h2>${escapeHtml(post.title)}</h2><p>${escapeHtml(post.description)}</p></div><span>${new Date(post.publishedAt).toLocaleDateString('zh-CN')} →</span></button>`;
}

function renderKnowledgeArchiveGroup(group, index) {
  return `<section class="knowledge-archive-group"><header><div><span>${knowledgeCategoryIcon(group.category)} 0${index + 1}</span><h2>${escapeHtml(group.category)}</h2></div><small>共 ${group.posts.length} 篇</small></header><div class="knowledge-archive-table-head"><span>文章标题</span><span>日期</span><span>二级主题</span><span>标签</span></div>${group.posts.map(post => `<button class="knowledge-archive-row" data-knowledge-slug="${escapeHtml(post.slug)}" type="button"><div><h3>${escapeHtml(post.title)}</h3><p>${escapeHtml(post.description)}</p></div><time>${new Date(post.publishedAt).toLocaleDateString('zh-CN')}</time><span>${escapeHtml(post.subcategory)}</span><i>${(post.tags || []).map(tag => `<em>${escapeHtml(tag)}</em>`).join('')}</i></button>`).join('')}</section>`;
}

function getArticleHeadings(markdown) {
  let index = 0;
  return markdown.trim().split('\n').flatMap(line => {
    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (!match) return [];
    index += 1;
    return [{ id: `knowledge-section-${index}`, level: match[1].length, text: match[2] }];
  });
}

function renderKnowledgeToc(headings) {
  if (!headings.length) return '';
  return `<aside class="knowledge-toc-column" aria-label="文章目录"><details class="knowledge-toc" open><summary>本文目录</summary><nav>${headings.map((heading, index) => `<a class="knowledge-toc-link toc-level-${heading.level}${index === 0 ? ' active' : ''}" href="#${heading.id}" data-heading-id="${heading.id}">${escapeHtml(heading.text)}</a>`).join('')}</nav></details></aside>`;
}

function markdownToHtml(markdown, headings = []) {
  const lines = markdown.trim().split('\n'); let html = ''; let list = null;
  let headingIndex = 0;
  const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
  const inline = value => escapeHtml(value).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  for (const line of lines) {
    if (!line.trim()) { closeList(); continue; }
    const heading = line.match(/^(#{1,3})\s+(.+)$/); const ordered = line.match(/^\d+\.\s+(.+)$/); const unordered = line.match(/^-\s+(.+)$/); const quote = line.match(/^>\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      const item = level >= 2 ? headings[headingIndex++] : null;
      html += `<h${level}${item ? ` id="${item.id}"` : ''}>${inline(heading[2])}</h${level}>`;
    }
    else if (ordered) { if (list !== 'ol') { closeList(); list = 'ol'; html += '<ol>'; } html += `<li>${inline(ordered[1])}</li>`; }
    else if (unordered) { if (list !== 'ul') { closeList(); list = 'ul'; html += '<ul>'; } html += `<li>${inline(unordered[1])}</li>`; }
    else if (quote) { closeList(); html += `<blockquote>${inline(quote[1])}</blockquote>`; }
    else { closeList(); html += `<p>${inline(line)}</p>`; }
  }
  closeList(); return html;
}

// ============== Shared Search Bar ==============

function buildSearchBar(tabId, placeholder) {
  return `
    <section class="controls" aria-label="搜索">
      <div class="search-row">
        <div class="search-box">
          <span>搜索</span>
          <div class="search-input-row">
            <input id="searchInput" type="search" value="${escapeHtml(state.query)}" placeholder="${placeholder}" autocomplete="off">
            <button class="search-btn" id="searchBtn" title="搜索（回车也可）">搜索</button>
          </div>
        </div>
      </div>
      ${state.query ? `
      <div class="result-bar">
        <span></span>
        <button class="text-button" id="clearSearch" type="button">✕ 清除搜索</button>
      </div>` : ''}
    </section>
  `;
}

// ============== Procurement Tab ==============

function renderProcurementSection({ category, subgroups }, summaryItems = null, toolbar = '') {
  const allItems = subgroups.flatMap(g => g.items);
  const sectionMeta = procurementSectionTagline(category);
  const rows = sortProcurementItems(allItems.slice()).map(item => renderProcurementRow(item)).join('');
  return `
    <section class="price-section" data-price-category="${escapeHtml(category)}">
      <div class="price-section-header">
        <h2 class="price-section-title">${escapeHtml(category)}
          <small>${sectionMeta}</small>
        </h2>
        ${toolbar}
      </div>
      <div class="price-table-wrap">
        <table class="price-table">
          <thead>
            <tr>
              <th class="price-cell price-cell--brand" scope="col">品牌</th>
              <th class="price-cell price-cell--series" scope="col">系列</th>
              <th class="price-cell price-cell--product" scope="col">商品</th>
              <th class="price-cell price-cell--spec" scope="col">规格</th>
              <th class="price-cell price-cell--perjin" scope="col">单价</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function procurementSectionTagline(category) {
  const taglines = {
    '主粮': '猫猫的幸福，先从一顿靠谱的饭开始。',
    '猫砂': '把日常照料好，猫猫就能自在地过日子。',
    '罐头 / 湿粮': '偶尔开个罐，快乐就有了形状。',
  };
  return taglines[category] || '把猫猫的日常，照料得妥妥当当。';
}

function renderProcurementRow(item) {
  const link = item.url
    ? `<a class="price-buy" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" title="前往京东">↗</a>`
    : '';
  return `
    <tr class="price-row">
      <td class="price-cell price-cell--brand">${escapeHtml(item.brand)}</td>
      <td class="price-cell price-cell--series">${escapeHtml(item.series || '待补充')}</td>
      <td class="price-cell price-cell--product"><span class="price-product-content">${escapeHtml(item.product)}${link}</span></td>
      <td class="price-cell price-cell--spec"><span class="price-spec-pill">${escapeHtml(item.spec)}</span></td>
      <td class="price-cell price-cell--perjin"><span class="price-perjin">${formatItemPrice(item)}</span></td>
    </tr>
  `;
}

function renderProcurementPagination({ page, totalPages, pageSize }, totalItems) {
  if (totalItems <= pageSize) return '';
  const pageButtons = Array.from({ length: totalPages }, (_, index) => {
    const pageNumber = index + 1;
    return `<button type="button" class="procurement-pagination-page${pageNumber === page ? ' is-current' : ''}" data-procurement-page="${pageNumber}" aria-label="第 ${pageNumber} 页"${pageNumber === page ? ' aria-current="page"' : ''}>${pageNumber}</button>`;
  }).join('');
  return `
    <nav class="procurement-pagination" aria-label="采购记录翻页">
      <div class="procurement-pagination-controls">
        <button type="button" class="procurement-pagination-direction" data-procurement-page="${page - 1}" aria-label="上一页" title="上一页"${page === 1 ? ' disabled' : ''}><svg class="procurement-pagination-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg></button>
        ${pageButtons}
        <button type="button" class="procurement-pagination-direction" data-procurement-page="${page + 1}" aria-label="下一页" title="下一页"${page === totalPages ? ' disabled' : ''}><svg class="procurement-pagination-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></button>
      </div>
    </nav>
  `;
}

function procurementFolderSvg() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h6l2 2h9v10.5h-17Z"/><path d="M3.5 6.5v-1h6l2 2"/></svg>`;
}

function procurementBoxSvg() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 7 8-4 8 4v11l-8 4-8-4Z"/><path d="m4 7 8 4 8-4M12 11v11"/></svg>`;
}

function procurementCategoryCounts() {
  return priceSnapshot.items.reduce((counts, item) => {
    counts[item.category] = (counts[item.category] || 0) + 1;
    return counts;
  }, {});
}

function renderProcurementFilterPopover() {
  const categoryCounts = procurementCategoryCounts();
  const categoryOptions = PROCUREMENT_CATEGORIES
    .filter(({ category }) => categoryCounts[category])
    .map(({ category }) => `<button class="procurement-filter-chip${state.procurementCategory === category ? ' is-active' : ''}" type="button" data-procurement-filter-kind="category" data-procurement-filter-value="${escapeHtml(category)}"><span>${escapeHtml(category)}</span><strong>${categoryCounts[category]}</strong></button>`)
    .join('');
  const subcategoryCounts = priceSnapshot.items
    .filter(item => state.procurementCategory === '全部' || item.category === state.procurementCategory)
    .reduce((counts, item) => {
      if (item.subcategory) counts[item.subcategory] = (counts[item.subcategory] || 0) + 1;
      return counts;
    }, {});
  const subcategoryOptions = Object.entries(subcategoryCounts)
    .map(([subcategory, count]) => `<button class="procurement-filter-chip${state.procurementSubcategory === subcategory ? ' is-active' : ''}" type="button" data-procurement-filter-kind="subcategory" data-procurement-filter-value="${escapeHtml(subcategory)}"><span>${escapeHtml(subcategory)}</span><strong>${count}</strong></button>`)
    .join('');
  const priceOptions = [
    { value: '', label: '不限' },
    { value: '10', label: '≤ 10 元/斤' },
    { value: '20', label: '≤ 20 元/斤' },
    { value: '30', label: '≤ 30 元/斤' },
    { value: '50', label: '≤ 50 元/斤' },
  ].map(option => `<button class="procurement-filter-chip${state.procurementMaxPerJin === option.value ? ' is-active' : ''}" type="button" data-procurement-filter-kind="price" data-procurement-filter-value="${option.value}">${option.label}</button>`).join('');
  return `
    <div class="procurement-filter-wrap">
      <button class="procurement-filter-toggle" id="procurementFilterToggle" type="button" aria-label="筛选物资" title="筛选物资" aria-haspopup="dialog" aria-expanded="${state.procurementFilterOpen}" aria-controls="procurementFilterPopover">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7.5 12h9M10.5 18h3"/></svg>
      </button>
      <div class="procurement-filter-popover" id="procurementFilterPopover" role="dialog" aria-label="采购筛选"${state.procurementFilterOpen ? '' : ' hidden'}>
        <div class="procurement-filter-popover-head">
          <div><strong>筛选物资</strong><span>按类别和单价缩小范围</span></div>
          <button type="button" class="procurement-filter-close" data-procurement-filter-close aria-label="关闭筛选">✕</button>
        </div>
        <div class="procurement-filter-popover-body">
          <section class="procurement-filter-group procurement-filter-category-group">
            <span class="procurement-filter-label">物资类别</span>
            <div class="procurement-filter-options">
              <button class="procurement-filter-chip${state.procurementCategory === '全部' ? ' is-active' : ''}" type="button" data-procurement-filter-kind="category" data-procurement-filter-value="全部"><span>全部</span><strong>${priceSnapshot.items.length}</strong></button>
              ${categoryOptions}
            </div>
          </section>
          <section class="procurement-filter-group procurement-filter-subcategory-group">
            <span class="procurement-filter-label">细分类型${state.procurementCategory !== '全部' ? ` · ${escapeHtml(state.procurementCategory)}` : ''}</span>
            <div class="procurement-filter-options">
              <button class="procurement-filter-chip${state.procurementSubcategory === '' ? ' is-active' : ''}" type="button" data-procurement-filter-kind="subcategory" data-procurement-filter-value=""><span>全部</span></button>
              ${subcategoryOptions || '<span class="procurement-filter-empty">当前类别暂无细分类型</span>'}
            </div>
          </section>
          <section class="procurement-filter-group procurement-filter-price-group">
            <span class="procurement-filter-label">每斤单价</span>
            <div class="procurement-filter-options">${priceOptions}</div>
          </section>
        </div>
        <div class="procurement-filter-popover-foot">
          <button type="button" class="procurement-filter-clear" data-procurement-filter-clear>清除筛选</button>
          <button type="button" class="procurement-filter-done" data-procurement-filter-close>完成</button>
        </div>
      </div>
    </div>
  `;
}

function renderProcurementSortPopover() {
  const current = PROCUREMENT_SORT_OPTIONS.find(option => option.value === state.procurementSort) || PROCUREMENT_SORT_OPTIONS[0];
  const options = PROCUREMENT_SORT_OPTIONS.map(option => `
    <button class="procurement-sort-option${option.value === state.procurementSort ? ' is-active' : ''}" type="button" data-procurement-sort-value="${option.value}"${option.value === state.procurementSort ? ' aria-current="true"' : ''}>
      <span>${escapeHtml(option.label)}</span>${option.value === state.procurementSort ? '<span aria-hidden="true">✓</span>' : ''}
    </button>`).join('');
  return `
    <div class="procurement-sort-wrap">
      <button class="procurement-sort-toggle" id="procurementSortToggle" type="button" aria-label="排序：${escapeHtml(current.label)}" title="排序：${escapeHtml(current.label)}" aria-haspopup="dialog" aria-expanded="${state.procurementSortOpen}" aria-controls="procurementSortPopover">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5v14M7 5 4.5 7.5M7 5 9.5 7.5M17 19V5m0 14 2.5-2.5M17 19l-2.5-2.5"/></svg>
      </button>
      <div class="procurement-sort-popover" id="procurementSortPopover" role="dialog" aria-label="选择排序方式"${state.procurementSortOpen ? '' : ' hidden'}>
        <strong>排序方式</strong>
        <div class="procurement-sort-options">${options}</div>
      </div>
    </div>
  `;
}

function renderProcurementIndex() {
  const counts = procurementCategoryCounts();
  const categoryGroups = PROCUREMENT_INDEX_GROUPS.map(group => {
    const categories = group.categories.filter(category => counts[category]);
    if (!categories.length) return '';
    return `
      <section class="procurement-index-group">
        <h3><span class="procurement-index-icon">${procurementFolderSvg()}</span>${escapeHtml(group.title)}</h3>
        <div class="procurement-index-list">
          ${categories.map(category => `
            <button class="procurement-index-item${state.procurementCategory === category ? ' is-active' : ''}" type="button" data-procurement-index-category="${escapeHtml(category)}">
              <span>${escapeHtml(category)}</span><strong>${counts[category]}</strong>
            </button>`).join('')}
        </div>
      </section>`;
  }).join('');
  const foodItems = priceSnapshot.items.filter(item => item.category === '主粮');
  const subcategoryCounts = foodItems.reduce((counts, item) => {
    const subcategory = item.subcategory || '未分类';
    counts[subcategory] = (counts[subcategory] || 0) + 1;
    return counts;
  }, {});
  return `
    <aside class="procurement-index" aria-label="物资索引">
      <header class="procurement-index-header">
        <div class="procurement-index-title"><span>✣</span><h2>物资索引</h2><span>✣</span></div>
        <p>按物资类型浏览采购价格</p>
        <button class="procurement-index-all${state.procurementCategory === '全部' ? ' is-active' : ''}" type="button" data-procurement-index-category="全部">全部商品 <strong>${priceSnapshot.items.length}</strong></button>
      </header>
      ${categoryGroups}
      ${Object.keys(subcategoryCounts).length ? `
        <section class="procurement-index-group procurement-index-subgroups">
          <h3><span class="procurement-index-icon">✣</span>主粮分类</h3>
          <div class="procurement-index-chips">${Object.entries(subcategoryCounts).map(([subcategory, count]) => `<span>${escapeHtml(subcategory)} <strong>${count}</strong></span>`).join('')}</div>
        </section>` : ''}
      <section class="procurement-index-note">
        <h3><span class="procurement-index-icon">▣</span>猫猫采购小抄</h3>
        <div class="procurement-index-focus">
          <ul><li><span class="procurement-note-paw">${chronicleMotif('paw')}</span>猫猫不懂什么叫远方</li><li><span class="procurement-note-paw">${chronicleMotif('paw')}</span>它只认得晒太阳的位置</li><li><span class="procurement-note-paw">${chronicleMotif('paw')}</span>和回家的脚步声</li></ul>
        </div>
      </section>
    </aside>
  `;
}

function renderProcurementTab() {
  const filtered = getProcurementFiltered();
  const pageData = getProcurementPage(filtered);
  const grouped = groupProcurementByCategory(pageData.items);
  const totalCount = priceSnapshot.items.length;
  const categoryCount = new Set(priceSnapshot.items.map(item => item.category)).size;
  const toolbar = `
    <div class="procurement-toolbar">
      <div class="procurement-search">
        <svg class="procurement-search-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm7.5 14-3-3"/></svg>
        <input id="procurementSearchInput" type="search" placeholder="搜索品牌 / 系列 / 商品" value="${escapeHtml(state.procurementQuery)}" aria-label="搜索品牌、系列或商品">
      </div>
      ${renderProcurementFilterPopover()}
      ${renderProcurementSortPopover()}
    </div>
  `;
  const body = grouped.length
    ? grouped.map((section, index) => renderProcurementSection(section, null, index === 0 ? toolbar : '')).join('')
    : `<div class="procurement-skeleton"><p>没有匹配的物资，稍后再来看看</p><p class="procurement-skeleton-hint">试试清空搜索或放宽价格上限</p></div>`;
  const pagination = renderProcurementPagination(pageData, filtered.length);
  return `
    <section class="procurement-shell">
      <div class="procurement-layout">
        <main class="procurement-main">
          <section class="procurement-main-card">
            <header class="procurement-header">
              <div class="procurement-heading-line">
                <h2 class="procurement-title">价格参考</h2>
                <p class="procurement-subtitle">记录常用猫咪物资价格，供个人参考决策</p>
              </div>
              <span class="procurement-meta-stamp">▣ 最后更新于 ${escapeHtml(priceSnapshot.meta.fetchedAt)}</span>
            </header>
            <div class="procurement-stats">
              <span class="procurement-stat"><span class="procurement-stat-icon">${procurementBoxSvg()}</span><span><strong>已收录 ${totalCount}</strong><small>件商品</small></span></span>
              <span class="procurement-stat"><span class="procurement-stat-icon">${procurementFolderSvg()}</span><span><strong>覆盖 ${categoryCount}</strong><small>个分类</small></span></span>
            </div>
            <div class="procurement-dossier">
              <div class="procurement-dossier-inner">
                <div class="procurement-view-body">${body}</div>
                ${pagination}
              </div>
            </div>
          </section>
        </main>
        ${renderProcurementIndex()}
      </div>
    </section>
  `;
}

// ============== Main Render ==============

function renderApp() {
  if (homeFeaturedRefreshTimer) {
    window.clearTimeout(homeFeaturedRefreshTimer);
    homeFeaturedRefreshTimer = null;
  }
  let content = '';

  if (state.activeTab === 'home') {
    content = renderHomeTab();
  } else if (state.activeTab === 'supplies') {
    content = renderSuppliesTab();
  } else if (state.activeTab === 'timeline') {
    content = renderTimelineTab();
  } else if (state.activeTab === 'procurement') {
    content = renderProcurementTab();
  } else if (state.activeTab === 'knowledge') {
    content = renderScienceTab();
  }

  app.classList.toggle('knowledge-app-shell', state.activeTab === 'knowledge');
  app.classList.toggle('operations-app-shell', state.activeTab === 'supplies');
  app.classList.toggle('chronicle-app-shell', state.activeTab === 'timeline');
  app.classList.toggle('procurement-app-shell', state.activeTab === 'procurement');
  app.classList.toggle('home-app-shell', state.activeTab === 'home');
  app.innerHTML = `
    <div class="tab-panel">
      ${content}
    </div>
  `;

  renderSidebar();
  bindControls();
  bindProcurementControls();
  bindOperationsControls();
  bindKnowledgeControls();
  bindKnowledgeToc();

  if (state.activeTab === 'home') {
    const fifteenMinutes = 15 * 60 * 1000;
    const delay = fifteenMinutes - (Date.now() % fifteenMinutes) + 50;
    homeFeaturedRefreshTimer = window.setTimeout(renderApp, delay);
  }
}

// ============== Event Binding ==============

function bindControls() {
  const sidebarNav = document.getElementById('sidebarNav');
  if (sidebarNav) {
    sidebarNav.querySelectorAll('.sidebar-item[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const newTab = btn.dataset.tab;
        if (newTab === state.activeTab) return;
        state.activeTab = newTab;
        state.query = '';
        state.status = '全部';
        state.vaccine = '全部';
        state.sterilized = '全部';
        state.friendliness = '全部';
        state.area = '全部';
        state.timelineType = '全部';
        state.procurementQuery = '';
        state.procurementSubcategory = '';
        state.procurementMaxPerJin = '';
        state.procurementPage = 1;
        state.procurementSort = 'brand';
        state.procurementSortOpen = false;
        state.procurementFilterOpen = false;
        renderApp();
      });
    });
  }

  // Search
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');

  if (searchInput) {
    function doSearch() {
      const val = searchInput.value.trim();
      if (val !== state.query) {
        state.query = val;
        renderApp();
      }
    }

    searchInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        doSearch();
      }
    });

    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        doSearch();
      });
    }
  }

  // Clear search
  const clearSearchButtons = document.querySelectorAll('#clearSearch, #clearSearchMobile');
  clearSearchButtons.forEach(clearSearch => {
    clearSearch.addEventListener('click', () => {
      state.query = '';
      renderApp();
    });
  });

  if (state.activeTab === 'home') {
    const filterToggle = document.getElementById('filterToggle');
    const filterPopover = document.getElementById('filterPopover');
    if (filterToggle && filterPopover) {
      filterToggle.addEventListener('click', () => {
        const isOpen = !filterPopover.hidden;
        filterPopover.hidden = isOpen;
        filterToggle.setAttribute('aria-expanded', String(!isOpen));
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
        renderApp();
      });
    });

    const resetBtn = document.getElementById('resetFilters');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        state.query = '';
        state.status = '全部';
        state.vaccine = '全部';
        state.sterilized = '全部';
        state.friendliness = '全部';
        state.area = '全部';
        renderApp();
      });
    }

    bindCatCards();
    bindSummaryCards();
  }

  if (state.activeTab === 'timeline') {
    document.querySelectorAll('[data-timeline-type]').forEach(button => button.addEventListener('click', () => {
      state.timelineType = button.dataset.timelineType;
      renderApp();
    }));
    document.querySelectorAll('[data-timeline-month]').forEach(button => button.addEventListener('click', () => {
      document.getElementById(`timeline-${button.dataset.timelineMonth}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }
}

function bindProcurementControls() {
  const searchInput = document.getElementById('procurementSearchInput');
  if (searchInput) {
    let debounceTimer = null;
    const doSearch = () => {
      const val = searchInput.value.trim();
      if (val !== state.procurementQuery) {
        state.procurementQuery = val;
        state.procurementPage = 1;
        renderApp();
      }
    };
    searchInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        window.clearTimeout(debounceTimer);
        doSearch();
      }
    });
    searchInput.addEventListener('input', () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(doSearch, 200);
    });
  }

  const filterToggle = document.getElementById('procurementFilterToggle');
  if (filterToggle) {
    filterToggle.addEventListener('click', () => {
      state.procurementSortOpen = false;
      state.procurementFilterOpen = !state.procurementFilterOpen;
      renderApp();
    });
  }

  const sortToggle = document.getElementById('procurementSortToggle');
  if (sortToggle) {
    sortToggle.addEventListener('click', () => {
      state.procurementFilterOpen = false;
      state.procurementSortOpen = !state.procurementSortOpen;
      renderApp();
    });
  }

  document.querySelectorAll('[data-procurement-sort-value]').forEach(button => {
    button.addEventListener('click', () => {
      const value = button.dataset.procurementSortValue;
      if (!PROCUREMENT_SORT_OPTIONS.some(option => option.value === value)) return;
      state.procurementSort = value;
      state.procurementPage = 1;
      state.procurementSortOpen = false;
      renderApp();
    });
  });

  document.querySelectorAll('[data-procurement-filter-kind]').forEach(button => {
    button.addEventListener('click', () => {
      const kind = button.dataset.procurementFilterKind;
      const value = button.dataset.procurementFilterValue || '';
      if (kind === 'category') {
        state.procurementCategory = value || '全部';
        const availableSubcategories = new Set(priceSnapshot.items
          .filter(item => state.procurementCategory === '全部' || item.category === state.procurementCategory)
          .map(item => item.subcategory)
          .filter(Boolean));
        if (state.procurementSubcategory && !availableSubcategories.has(state.procurementSubcategory)) {
          state.procurementSubcategory = '';
        }
      } else if (kind === 'subcategory') {
        state.procurementSubcategory = value;
      } else if (kind === 'price') {
        state.procurementMaxPerJin = value;
      }
      state.procurementPage = 1;
      state.procurementFilterOpen = true;
      renderApp();
    });
  });

  document.querySelectorAll('[data-procurement-filter-close]').forEach(button => {
    button.addEventListener('click', () => {
      state.procurementFilterOpen = false;
      renderApp();
    });
  });

  document.querySelector('[data-procurement-filter-clear]')?.addEventListener('click', () => {
    state.procurementCategory = '全部';
    state.procurementSubcategory = '';
    state.procurementMaxPerJin = '';
    state.procurementPage = 1;
    state.procurementFilterOpen = true;
    renderApp();
  });

  if (!procurementFilterOutsideClickBound) {
    document.addEventListener('click', event => {
      if (!state.procurementFilterOpen || state.activeTab !== 'procurement') return;
      const target = event.target;
      if (target instanceof Element && target.closest('.procurement-filter-wrap')) return;
      state.procurementFilterOpen = false;
      renderApp();
    });
    procurementFilterOutsideClickBound = true;
  }

  if (!procurementFilterEscapeBound) {
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !state.procurementFilterOpen || state.activeTab !== 'procurement') return;
      state.procurementFilterOpen = false;
      renderApp();
    });
    procurementFilterEscapeBound = true;
  }

  if (!procurementSortOutsideClickBound) {
    document.addEventListener('click', event => {
      if (!state.procurementSortOpen || state.activeTab !== 'procurement') return;
      const target = event.target;
      if (target instanceof Element && target.closest('.procurement-sort-wrap')) return;
      state.procurementSortOpen = false;
      renderApp();
    });
    procurementSortOutsideClickBound = true;
  }

  if (!procurementSortEscapeBound) {
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !state.procurementSortOpen || state.activeTab !== 'procurement') return;
      state.procurementSortOpen = false;
      renderApp();
    });
    procurementSortEscapeBound = true;
  }

  document.querySelectorAll('[data-procurement-index-category]').forEach(button => {
    button.addEventListener('click', () => {
      const category = button.dataset.procurementIndexCategory;
      state.procurementCategory = category;
      state.procurementSubcategory = '';
      state.procurementPage = 1;
      state.procurementFilterOpen = false;
      renderApp();
    });
  });

  document.querySelectorAll('[data-procurement-page]').forEach(button => {
    button.addEventListener('click', () => {
      const page = Number(button.dataset.procurementPage);
      if (!Number.isInteger(page) || page < 1 || page === state.procurementPage) return;
      state.procurementPage = page;
      renderApp();
    });
  });

}

function bindOperationsControls() {
  document.querySelectorAll('[data-operations-view]').forEach(button => button.addEventListener('click', () => {
    state.operationsView = button.dataset.operationsView;
    state.query = '';
    renderApp();
  }));

  document.querySelectorAll('[data-inventory-category]').forEach(button => button.addEventListener('click', () => {
    state.inventoryCategory = button.dataset.inventoryCategory;
    renderApp();
  }));

  document.querySelectorAll('[data-inventory-expand]').forEach(button => button.addEventListener('click', () => {
    const shouldExpand = button.dataset.inventoryExpand === 'all';
    document.querySelectorAll('.supply-category').forEach(category => { category.open = shouldExpand; });
  }));

  document.querySelectorAll('[data-operations-knowledge-slug]').forEach(button => button.addEventListener('click', () => {
    state.activeTab = 'knowledge';
    state.knowledgeArticle = button.dataset.operationsKnowledgeSlug;
    renderApp();
  }));
}

function bindKnowledgeControls() {
  const search = document.getElementById('knowledgeSearch');
  if (search) search.addEventListener('input', () => {
    const cursor = search.selectionStart;
    state.knowledgeQuery = search.value;
    renderApp();
    const nextSearch = document.getElementById('knowledgeSearch');
    if (nextSearch) {
      nextSearch.focus();
      nextSearch.setSelectionRange(cursor, cursor);
    }
  });
  document.querySelectorAll('[data-knowledge-view]').forEach(button => button.addEventListener('click', () => { state.knowledgeView = button.dataset.knowledgeView; renderApp(); }));
  document.getElementById('knowledgeFilterToggle')?.addEventListener('click', () => { state.knowledgeFilterOpen = !state.knowledgeFilterOpen; renderApp(); });
  document.querySelectorAll('[data-knowledge-clear]').forEach(button => button.addEventListener('click', () => {
    state.knowledgeQuery = '';
    state.knowledgeCategory = '';
    state.knowledgeSubcategory = '';
    state.knowledgeFilterOpen = false;
    renderApp();
  }));
  document.querySelectorAll('[data-knowledge-category]').forEach(button => button.addEventListener('click', () => {
    const value = button.dataset.knowledgeCategory;
    state.knowledgeCategory = state.knowledgeCategory === value ? '' : value;
    renderApp();
  }));
  document.querySelectorAll('[data-knowledge-subcategory]').forEach(button => button.addEventListener('click', () => {
    const value = button.dataset.knowledgeSubcategory;
    state.knowledgeSubcategory = state.knowledgeSubcategory === value ? '' : value;
    renderApp();
  }));
  document.querySelectorAll('[data-knowledge-focus-category]').forEach(button => button.addEventListener('click', () => {
    state.knowledgeCategory = button.dataset.knowledgeFocusCategory;
    state.knowledgeSubcategory = '';
    state.knowledgeView = window.matchMedia('(max-width: 719px)').matches ? 'group' : 'grid';
    renderApp();
  }));
  document.querySelectorAll('[data-knowledge-tag]').forEach(button => button.addEventListener('click', () => {
    state.knowledgeQuery = button.dataset.knowledgeTag;
    renderApp();
  }));
  document.querySelectorAll('[data-knowledge-slug]').forEach(card => card.addEventListener('click', () => { state.knowledgeArticle = card.dataset.knowledgeSlug; renderApp(); }));
  document.getElementById('knowledgeBack')?.addEventListener('click', () => { state.knowledgeArticle = null; renderApp(); });
}

function bindKnowledgeToc() {
  if (knowledgeTocScrollContainer && knowledgeTocScrollHandler) {
    knowledgeTocScrollContainer.removeEventListener('scroll', knowledgeTocScrollHandler);
  }
  knowledgeTocScrollContainer = null;
  knowledgeTocScrollHandler = null;

  const links = [...document.querySelectorAll('.knowledge-toc-link')];
  const headings = [...document.querySelectorAll('.knowledge-body h2[id], .knowledge-body h3[id]')];
  const scrollContainer = document.querySelector('.main-area');
  if (!links.length || !headings.length || !scrollContainer) return;

  const updateActiveHeading = () => {
    let activeId = headings[0].id;
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top <= 120) activeId = heading.id;
      else break;
    }
    links.forEach(link => {
      const active = link.dataset.headingId === activeId;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  };

  knowledgeTocScrollContainer = scrollContainer;
  knowledgeTocScrollHandler = () => requestAnimationFrame(updateActiveHeading);
  scrollContainer.addEventListener('scroll', knowledgeTocScrollHandler, { passive: true });
  updateActiveHeading();
}

function bindCatCards() {
  const selector = state.activeTab === 'home' ? '[data-cat-name]' : '.cat-card';
  document.querySelectorAll(selector).forEach(card => {
    card.addEventListener('click', () => openDrawer(card.dataset.catName));
    if (card.tagName === 'BUTTON') return;
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openDrawer(card.dataset.catName);
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
  state.friendliness = '全部';
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

// ============== Sidebar Toggle ==============

function closeSidebar() {
  document.body.classList.remove('sidebar-open');
  document.body.style.overflow = '';
}
function openSidebar() {
  document.body.classList.add('sidebar-open');
  document.body.style.overflow = 'hidden';
}

(function initSidebarToggle() {
  const toggle = document.getElementById('sidebarToggle');
  const backdrop = document.getElementById('sidebarBackdrop');
  const close = document.getElementById('sidebarClose');

  if (toggle) toggle.addEventListener('click', openSidebar);
  if (backdrop) backdrop.addEventListener('click', closeSidebar);
  if (close) close.addEventListener('click', closeSidebar);

  // Close sidebar on nav item click (mobile)
  const nav = document.getElementById('sidebarNav');
  if (nav) {
    nav.addEventListener('click', e => {
      if (e.target.closest('.sidebar-item') && window.innerWidth < 720) {
        closeSidebar();
      }
    });
  }
})();

// ============== Global Events ==============

drawerBackdrop.addEventListener('click', closeDrawer);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (!drawer.hidden) closeDrawer();
    closeSidebar();
  }
});

document.addEventListener('DOMContentLoaded', renderApp);
