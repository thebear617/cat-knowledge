import { priceSnapshot } from '../../data/price-snapshot.js';
import { chronicleMotif } from './operations.js';
import { state } from './state.js';
import { escapeHtml, normalize } from './shared.js';

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

let procurementFilterOutsideClickBound = false;
let procurementFilterEscapeBound = false;
let procurementSortOutsideClickBound = false;
let procurementSortEscapeBound = false;

function isMobileDirectoryLayout() {
  return window.matchMedia('(max-width: 719px)').matches;
}

function getCompactPaginationItems(totalPages, page) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const items = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) items.push('ellipsis-start');
  for (let pageNumber = start; pageNumber <= end; pageNumber += 1) items.push(pageNumber);
  if (end < totalPages - 1) items.push('ellipsis-end');
  items.push(totalPages);
  return items;
}

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
  const pageItems = isMobileDirectoryLayout() ? getCompactPaginationItems(totalPages, page) : Array.from({ length: totalPages }, (_, index) => index + 1);
  const pageButtons = pageItems.map(item => {
    if (typeof item !== 'number') return '<span class="procurement-pagination-ellipsis" aria-hidden="true">…</span>';
    return `<button type="button" class="procurement-pagination-page${item === page ? ' is-current' : ''}" data-procurement-page="${item}" aria-label="第 ${item} 页"${item === page ? ' aria-current="page"' : ''}>${item}</button>`;
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

function renderProcurementTab({ embedded = false } = {}) {
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
    <section class="procurement-shell${embedded ? ' procurement-shell--finance-embedded' : ''}">
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

function isProcurementViewActive() {
  return state.activeTab === 'procurement' || (state.activeTab === 'finance' && state.financeView === 'price');
}

function bindProcurementControls(renderApp) {
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
      if (!state.procurementFilterOpen || !isProcurementViewActive()) return;
      const target = event.target;
      if (target instanceof Element && target.closest('.procurement-filter-wrap')) return;
      state.procurementFilterOpen = false;
      renderApp();
    });
    procurementFilterOutsideClickBound = true;
  }

  if (!procurementFilterEscapeBound) {
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !state.procurementFilterOpen || !isProcurementViewActive()) return;
      state.procurementFilterOpen = false;
      renderApp();
    });
    procurementFilterEscapeBound = true;
  }

  if (!procurementSortOutsideClickBound) {
    document.addEventListener('click', event => {
      if (!state.procurementSortOpen || !isProcurementViewActive()) return;
      const target = event.target;
      if (target instanceof Element && target.closest('.procurement-sort-wrap')) return;
      state.procurementSortOpen = false;
      renderApp();
    });
    procurementSortOutsideClickBound = true;
  }

  if (!procurementSortEscapeBound) {
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !state.procurementSortOpen || !isProcurementViewActive()) return;
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

export { renderProcurementTab, bindProcurementControls };
