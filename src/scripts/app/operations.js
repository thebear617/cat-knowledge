import { catProfiles } from '../../../js/cats.js';
import { roles } from '../../../js/roles.js';
import { supplies } from '../../../js/supplies.js';
import { timelineEvents } from '../../../js/timeline.js';
import { renderFinanceLedgerView } from './finance.js';
import { openDrawer } from './directory.js';
import { knowledgePosts } from './data.js';
import { pageHref } from './routes.js';
import { state } from './state.js';
import { escapeHtml, isEmptyValue, normalize } from './shared.js';

const BASE_URL = `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}`;
const CHRONICLE_PHOTO = `${BASE_URL}images/chronicle-photo.png`;
const OPERATIONS_VIEWS = [
  { id: 'inventory', label: '物资库存', icon: '📦' }
];
const TIMELINE_TYPES = ['全部', '救助', '疫苗', '绝育', '送养'];
const LUNAR_DAY_NAMES = {
  1: '初一', 2: '初二', 3: '初三', 4: '初四', 5: '初五', 6: '初六', 7: '初七', 8: '初八', 9: '初九', 10: '初十',
  11: '十一', 12: '十二', 13: '十三', 14: '十四', 15: '十五', 16: '十六', 17: '十七', 18: '十八', 19: '十九', 20: '二十',
  21: '廿一', 22: '廿二', 23: '廿三', 24: '廿四', 25: '廿五', 26: '廿六', 27: '廿七', 28: '廿八', 29: '廿九', 30: '三十'
};
const lunarDateFormatter = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { month: 'long', day: 'numeric' });

function cdnUrl(path) {
  if (!path) return path;
  if (path.startsWith('http')) return path;
  const parts = path.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
  return `${BASE_URL}${parts}`;
}

function renderCatProfileLinks(value, className = '') {
  return String(value || '').split('、').map(name => name.trim()).filter(Boolean).map(name => {
    const known = catProfiles.some(cat => cat.name === name);
    return known
      ? `<button class="${className}" type="button" data-cat-profile="${escapeHtml(name)}">${escapeHtml(name)}</button>`
      : escapeHtml(name);
  }).join('、');
}

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

function renderSuppliesTab({ embedded = false } = {}) {
  if (embedded) return `<section class="operations-shell operations-shell--embedded">${renderInventoryView()}</section>`;
  return `<section class="operations-shell"><header class="operations-heading"><div><p>校园救助行动手册</p><h1>救助行动 <span aria-hidden="true">◌</span></h1><strong>物资库存档案</strong></div><div class="operations-stamp" aria-label="西电猫猫档案室"><span>西电猫猫档案室</span><b>每一份物资，都有去处</b><i>西电猫猫</i></div></header><nav class="operations-tabs" aria-label="救助行动视图切换">${OPERATIONS_VIEWS.map(item => `<button data-operations-view="${item.id}" class="${state.operationsView === item.id ? 'is-active' : ''}" type="button"><span>${item.icon}</span>${item.label}</button>`).join('')}</nav>${renderInventoryView()}</section>`;
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
  html += `<aside class="inventory-aside" aria-label="库存档案索引"><section class="inventory-note-card inventory-category-card"><p>分类索引</p><h2>分类速览</h2><div>${supplies.map(category => `<button data-inventory-category="${escapeHtml(category.category)}" class="${state.inventoryCategory === category.category ? 'is-active' : ''}" type="button"><span>${categoryIcons[category.category] || '📦'}</span><strong>${escapeHtml(category.category)}</strong><small>${category.items.length} 项</small></button>`).join('')}</div></section><section class="inventory-note-card inventory-location-card"><p>存放索引</p><h2>存放索引</h2><ul>${recordedLocations.map(location => `<li><span>●</span>${escapeHtml(location)}</li>`).join('')}</ul></section><section class="inventory-note-card inventory-tip-card"><p>归档说明</p><h2>归档说明</h2><p>所有数量、地点和备注均以现有物资档案为准；展开分类即可查看完整记录。</p><small>全库共 ${totalRecordedItems} 项物资记录</small></section></aside></section>`;
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
  const filterOptions = TIMELINE_TYPES.map(type => `<button class="chronicle-filter-option${state.timelineType === type ? ' is-selected' : ''}" type="button" role="menuitemradio" aria-checked="${state.timelineType === type}" data-timeline-type="${type}"><i class="timeline-filter-dot timeline-type-${type}"></i><span>${type}</span>${state.timelineType === type ? '<b aria-hidden="true">✓</b>' : ''}</button>`).join('');
  return `<div class="chronicle-search-controls"><div class="chronicle-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.3"></circle><path d="m16 16 4.3 4.3"></path></svg><input id="searchInput" type="search" value="${escapeHtml(state.query)}" placeholder="搜索猫名、地点" autocomplete="off" aria-label="搜索猫名、地点">${state.query ? '<button id="clearSearch" class="chronicle-search-clear" type="button" aria-label="清除搜索">×</button>' : ''}<button id="searchBtn" type="button" aria-label="搜索"><svg viewBox="0 0 24 24" aria-hidden="true" class="paw-icon"><circle cx="6.2" cy="9.3" r="2.1"></circle><circle cx="11.1" cy="6.2" r="2.1"></circle><circle cx="16.1" cy="8.1" r="2.1"></circle><circle cx="18.3" cy="13" r="2.1"></circle><path d="M12.1 11.1c-3.1 0-5.3 2.2-5.3 4.8 0 2 1.4 3.2 3.3 3.2.8 0 1.4-.2 2 .6.6.4 1.3.6 2 .6 1.9 0 3.2-1.2 3.2-3.2 0-2.6-2.1-4.8-5.2-4.8Z"></path></svg></button></div><div class="chronicle-filter-wrap"><button class="chronicle-filter-toggle${state.timelineType !== '全部' ? ' has-filter' : ''}" id="timelineFilterToggle" type="button" aria-label="筛选事件类型" title="筛选事件类型" aria-haspopup="menu" aria-expanded="false" aria-controls="timelineFilterMenu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"></path></svg></button><div class="chronicle-filter-menu" id="timelineFilterMenu" role="menu" aria-label="筛选事件类型" hidden><strong>筛选记录</strong><div class="chronicle-filter-options">${filterOptions}</div></div></div></div>`;
}

function renderTimelinePagination(page, totalPages) {
  if (totalPages <= 1) return '';
  const pageButtons = Array.from({ length: totalPages }, (_, index) => {
    const pageNumber = index + 1;
    return `<button type="button" class="timeline-pagination-page${pageNumber === page ? ' is-current' : ''}" data-timeline-page="${pageNumber}" aria-label="第 ${pageNumber} 页"${pageNumber === page ? ' aria-current="page"' : ''}>${pageNumber}</button>`;
  }).join('');
  return `<nav class="timeline-pagination" aria-label="猫猫日记翻页"><div class="timeline-pagination-controls"><button type="button" class="timeline-pagination-direction" data-timeline-page="${page - 1}" aria-label="上一页" title="上一页"${page === 1 ? ' disabled' : ''}>‹</button>${pageButtons}<button type="button" class="timeline-pagination-direction" data-timeline-page="${page + 1}" aria-label="下一页" title="下一页"${page === totalPages ? ' disabled' : ''}>›</button></div></nav>`;
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

function timelineMonthKey(date) {
  return date.slice(0, 7);
}

function timelineMonthLabel(monthKey) {
  const [year, month] = monthKey.split('-');
  return `${year}年${Number(month)}月`;
}

function timelineDateLabel(date) {
  const value = new Date(`${date}T00:00:00`);
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${value.getMonth() + 1}月${value.getDate()}日 周${weekdays[value.getDay()]}`;
}

function timelineLunarText(year, month, day) {
  const value = new Date(year, month - 1, day, 12);
  const parts = lunarDateFormatter.formatToParts(value);
  const monthName = parts.find(part => part.type === 'month')?.value || '';
  const lunarDay = Number(parts.find(part => part.type === 'day')?.value || 0);
  const lunarText = lunarDay === 1 ? monthName : (LUNAR_DAY_NAMES[lunarDay] || String(lunarDay));
  return `<span class="chronicle-calendar-lunar${lunarDay === 1 ? ' is-start' : ''}">${escapeHtml(lunarText)}</span>`;
}

function timelineCalendarCells(monthKey, events, selectedDate) {
  const [year, month] = monthKey.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const previousMonthDays = new Date(year, month - 1, 0).getDate();
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const eventsByDate = new Map();
  events.forEach(event => {
    const dayEvents = eventsByDate.get(event.date) || [];
    dayEvents.push(event);
    eventsByDate.set(event.date, dayEvents);
  });
  const cells = [];
  for (let index = 0; index < firstDay; index += 1) {
    const day = previousMonthDays - firstDay + index + 1;
    const previousMonth = month === 1 ? 12 : month - 1;
    const previousYear = month === 1 ? year - 1 : year;
    cells.push(`<div class="chronicle-calendar-cell is-other-month" aria-hidden="true"><span class="chronicle-calendar-date">${day}日</span>${timelineLunarText(previousYear, previousMonth, day)}</div>`);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${monthKey}-${String(day).padStart(2, '0')}`;
    const dayEvents = eventsByDate.get(date) || [];
    const classes = ['chronicle-calendar-cell'];
    if (date === selectedDate) classes.push('is-selected');
    if (date === todayKey) classes.push('is-today');
    if (dayEvents.length) classes.push('has-events');
    const markers = dayEvents.slice(0, 3).map(event => `<i class="chronicle-calendar-dot chronicle-calendar-dot-type-${event.type}" title="${escapeHtml(event.type)}"></i>`).join('');
    cells.push(`<button class="${classes.join(' ')}" type="button" data-timeline-date="${date}" aria-label="${timelineDateLabel(date)}${dayEvents.length ? `，${dayEvents.length} 条记录` : ''}" aria-pressed="${date === selectedDate}"><span class="chronicle-calendar-date">${day}日</span>${timelineLunarText(year, month, day)}${markers ? `<span class="chronicle-calendar-dots" aria-hidden="true">${markers}</span>` : ''}</button>`);
  }
  const totalCells = 42;
  const trailingDays = totalCells - cells.length;
  for (let day = 1; day <= trailingDays; day += 1) {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    cells.push(`<div class="chronicle-calendar-cell is-other-month" aria-hidden="true"><span class="chronicle-calendar-date">${day}日</span>${timelineLunarText(nextYear, nextMonth, day)}</div>`);
  }
  return cells.join('');
}

function renderTimelineDetail(date, events) {
  const dateEvents = date ? events.filter(event => event.date === date) : [];
  if (!date) {
    return '<aside class="chronicle-detail-card" aria-label="猫猫日记详情"><div class="chronicle-detail-empty"><span>▦</span><h2>选择一个日期</h2><p>点击左侧日历中的日期，查看当天的记录。</p></div></aside>';
  }
  if (!dateEvents.length) {
    return `<aside class="chronicle-detail-card" aria-label="猫猫日记详情"><header class="chronicle-detail-header"><span>记录详情</span><h2>${timelineDateLabel(date)}</h2></header><div class="chronicle-detail-empty is-quiet"><span>—</span><h2>这一天没有记录</h2><p>可以选择日历中带有圆点的日期。</p></div></aside>`;
  }
  const eventCards = dateEvents.map(event => {
    const cats = renderCatProfileLinks(event.cat, 'timeline-cat-link');
    return `<article class="chronicle-detail-event"><header><span class="timeline-badge timeline-badge-${event.type}">${escapeHtml(event.type)}</span><strong>${cats}</strong></header><dl>${event.location ? `<div><dt>地点</dt><dd>${escapeHtml(event.location)}</dd></div>` : ''}${event.notes ? `<div><dt>记录</dt><dd>${escapeHtml(event.notes)}</dd></div>` : ''}</dl></article>`;
  }).join('');
  return `<aside class="chronicle-detail-card" aria-label="猫猫日记详情"><header class="chronicle-detail-header"><span>记录详情</span><h2>${timelineDateLabel(date)}</h2></header><div class="chronicle-detail-events">${eventCards}</div></aside>`;
}

function renderTimelineListView() {
  const filteredEvents = getFilteredTimeline();
  const orderedEvents = [...filteredEvents].sort((a, b) => a.date.localeCompare(b.date));
  const totalPages = Math.max(1, Math.ceil(orderedEvents.length / 14));
  const currentPage = Math.min(Math.max(Number(state.timelinePage) || 1, 1), totalPages);
  state.timelinePage = currentPage;
  const events = orderedEvents.slice((currentPage - 1) * 14, currentPage * 14);
  const pageSummary = totalPages > 1 ? ` · 第 ${currentPage}/${totalPages} 页` : '';
  const mobileSummary = state.query ? `“${escapeHtml(state.query)}” · 找到 ${filteredEvents.length} 条记录${pageSummary}` : `共 ${filteredEvents.length} 条记录${pageSummary}`;
  let html = '<div class="misc-timeline-list-body"><div class="chronicle-mobile-summary">' + `${mobileSummary}${state.query ? '<button id="clearSearchMobile" type="button">清除</button>' : ''}</div>`;
  if (!events.length) {
    html += '<section class="empty-state"><h2>没有匹配的事件</h2><p>可以清除搜索或切换事件类型。</p></section>';
  } else {
    html += '<div class="timeline-list"><div class="timeline-table-head"><span>日期</span><span>猫名</span><span>事件类型</span><span>地点</span><span>备注</span></div>';
    for (const event of events) {
      const locationValue = isEmptyValue(event.location) ? '' : String(event.location);
      const notesValue = isEmptyValue(event.notes) ? '' : String(event.notes);
      const location = locationValue ? `<span class="timeline-entry-location" title="${escapeHtml(locationValue)}">⌖ ${escapeHtml(locationValue)}</span>` : '';
      const notes = notesValue ? `<span class="timeline-entry-desc" title="${escapeHtml(notesValue)}">${escapeHtml(notesValue)}</span>` : '';
      html += `<article class="timeline-item timeline-type-${event.type}"><time datetime="${event.date}">${event.date.slice(5).replace('-', '.')}</time><span class="timeline-entry-cat">${renderCatProfileLinks(event.cat, 'timeline-cat-link')}</span><span class="timeline-badge timeline-badge-${event.type}">${escapeHtml(event.type)}</span>${location}${notes}</article>`;
    }
    html += `</div>${renderTimelinePagination(currentPage, totalPages)}`;
  }
  return `${html}</div>`;
}

function renderChronicleDashboard(events) {
  const monthKeys = [...new Set(timelineEvents.map(event => timelineMonthKey(event.date)))].sort();
  const counts = monthKeys.map(monthKey => events.filter(event => timelineMonthKey(event.date) === monthKey).length);
  const width = 440;
  const height = 120;
  const padding = { top: 10, right: 14, bottom: 24, left: 25 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const max = Math.max(...counts, 1);
  const points = counts.map((count, index) => ({
    x: padding.left + (index * plotWidth) / Math.max(counts.length - 1, 1),
    y: padding.top + (1 - count / max) * plotHeight
  }));
  const linePath = points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  const gridLines = [0, .5, 1].map(ratio => {
    const y = padding.top + (1 - ratio) * plotHeight;
    return `<line class="chronicle-dashboard-grid-line" x1="${padding.left}" x2="${width - padding.right}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"/><text class="chronicle-dashboard-y-label" x="${padding.left - 8}" y="${(y + 3).toFixed(1)}">${Math.round(max * ratio)}</text>`;
  }).join('');
  const labels = monthKeys.map((monthKey, index) => {
    const [, month] = monthKey.split('-');
    return `<text class="chronicle-dashboard-x-label" x="${points[index].x.toFixed(1)}" y="${height - 8}">${Number(month)}月</text>`;
  }).join('');
  const nodes = points.map((point, index) => `<circle class="chronicle-dashboard-node" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="3.2"><title>${timelineMonthLabel(monthKeys[index])} · ${counts[index]} 条记录</title></circle>`).join('');
  const chart = events.length
    ? `<svg class="chronicle-dashboard-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="猫猫日记月度记录趋势">${gridLines}<path class="chronicle-dashboard-line" d="${linePath}"/>${nodes}${labels}</svg>`
    : '<div class="chronicle-dashboard-empty">暂无匹配记录</div>';
  return `<article class="chronicle-dashboard-card" aria-label="猫猫日记数据看板"><header class="chronicle-dashboard-head"><h3><span class="chronicle-dashboard-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 19V5m0 14h16M8 16v-4m4 4V8m4 8v-7"/></svg></span>记录趋势</h3><button class="chronicle-dashboard-link" type="button" data-timeline-view="finance">财务公示 <span aria-hidden="true">›</span></button></header><div class="chronicle-dashboard-chart-wrap">${chart}</div></article>`;
}

function renderTimelineCalendarView() {
  const filteredEvents = getFilteredTimeline();
  const orderedEvents = [...filteredEvents].sort((a, b) => a.date.localeCompare(b.date));
  const monthKeys = [...new Set(orderedEvents.map(event => timelineMonthKey(event.date)))].sort();
  const now = new Date();
  const fallbackMonth = monthKeys[monthKeys.length - 1] || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthKey = monthKeys.includes(state.timelineMonth) ? state.timelineMonth : fallbackMonth;
  state.timelineMonth = monthKey;
  const monthEvents = orderedEvents.filter(event => timelineMonthKey(event.date) === monthKey);
  const selectedDate = state.timelineSelectedDate && state.timelineSelectedDate.startsWith(`${monthKey}-`)
    ? state.timelineSelectedDate
    : (monthEvents[monthEvents.length - 1]?.date || null);
  state.timelineSelectedDate = selectedDate;
  const monthIndex = monthKeys.indexOf(monthKey);
  const previousMonth = monthKeys[monthIndex - 1] || '';
  const nextMonth = monthKeys[monthIndex + 1] || '';
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const calendar = timelineCalendarCells(monthKey, monthEvents, selectedDate);
  const chroniclePhoto = CHRONICLE_PHOTO;
  const calendarLegend = TIMELINE_TYPES.slice(1).map(type => `<span><i class="chronicle-calendar-dot chronicle-calendar-dot-type-${type}"></i>${type}</span>`).join('');
  const chronicleQuote = `<footer class="chronicle-quote"><span>“</span><p>它们或许只是我们校园里的过客，但对于它们，我们是全部。</p><i>${chronicleMotif('paw')}</i><b></b></footer>`;
  const calendarSection = `<section class="chronicle-calendar-section" aria-label="猫猫日记日历"><div class="chronicle-calendar-workspace"><section class="chronicle-calendar-card" aria-label="猫猫日记日历"><header class="chronicle-calendar-toolbar"><h2>${timelineMonthLabel(monthKey)}</h2><div class="chronicle-calendar-toolbar-tools"><div class="chronicle-calendar-legend" aria-label="日历图例">${calendarLegend}</div><div class="chronicle-calendar-nav"><button type="button" data-timeline-calendar-nav="${previousMonth}" aria-label="上一个月"${previousMonth ? '' : ' disabled'}>‹</button><button type="button" data-timeline-calendar-nav="${nextMonth}" aria-label="下一个月"${nextMonth ? '' : ' disabled'}>›</button></div></div></header><div class="chronicle-calendar-weekdays">${weekdays.map(day => `<span>${day}</span>`).join('')}</div><div class="chronicle-calendar-grid">${calendar}</div></section>${renderTimelineDetail(selectedDate, orderedEvents)}<div class="chronicle-total-row"><section class="chronicle-total-card"><p>记录总数</p><strong>${timelineEvents.length}<small>条记录</small></strong></section>${renderChronicleDashboard(orderedEvents)}</div><figure class="chronicle-photo-card"><img src="${chroniclePhoto}" alt="校园猫咪"><figcaption>人，咪真的很想你</figcaption></figure></div>${chronicleQuote}</section>`;
  const chronicleHeader = `<header class="chronicle-heading chronicle-calendar-heading"><div><div class="chronicle-title-line"><h1>猫猫日记</h1><span class="chronicle-postmark">🐾</span></div><span>记录校园猫咪的点滴故事，每一次相遇都值得被珍藏</span></div>${buildChronicleSearch()}</header>`;
  return `<section class="chronicle-shell">${chronicleHeader}${calendarSection}</section>`;
}

function renderTimelineTab() {
  if (state.timelineView === 'finance') {
    return `<section class="chronicle-shell chronicle-finance-shell"><header class="chronicle-heading chronicle-calendar-heading"><div><div class="chronicle-title-line"><h1>猫猫日记</h1><span class="chronicle-postmark">🐾</span></div><span>记录每一笔帮助猫咪的收支，也记录它们如何回到生活里</span></div><button class="chronicle-finance-back-button" type="button" data-timeline-view="diary"><span aria-hidden="true">‹</span> 返回猫猫日记</button></header><div class="chronicle-finance-view finance-shell">${renderFinanceLedgerView()}</div></section>`;
  }
  return renderTimelineCalendarView();
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
  return `<section class="operations-archive-view collaboration-view"><header class="operations-section-heading archive-section-heading"><div><p>协作档案</p><h2>行动协作</h2><span>按小组归档职责、协作阶段与相关行动知识，不预设虚假的任务状态。</span></div><strong>${roles.length} 个协作小组</strong></header><div class="operations-archive-layout"><main class="collaboration-list">${roles.map((role, index) => { const links = roleKnowledgeLinks(role.name); return `<article class="collaboration-role"><span class="archive-item-number">0${index + 1}</span><div class="collaboration-role-top"><span class="collaboration-role-icon">${roleIcons[role.name] || '👥'}</span><div><h3>${escapeHtml(role.name)}</h3><p>${escapeHtml(role.description)}</p></div></div><dl class="collaboration-phases">${role.phases.map(phase => `<div><dt>${escapeHtml(phase.label)}</dt><dd>${escapeHtml(phase.detail)}</dd></div>`).join('')}</dl>${links.length ? `<div class="role-knowledge-links"><span>查阅条目</span>${links.map(post => `<button data-operations-knowledge-slug="${escapeHtml(post.slug)}" type="button">${escapeHtml(post.title)} →</button>`).join('')}</div>` : ''}</article>`; }).join('')}</main><aside class="operations-archive-aside"><section class="operations-note-card"><p>小组索引</p><h3>协作目录</h3><ol>${roles.map((role, index) => `<li><span>0${index + 1}</span>${escapeHtml(role.name)}</li>`).join('')}</ol></section><section class="operations-note-card operations-note-card-tilted"><p>协作说明</p><h3>协作说明</h3><span>每个小组独立记录职责与阶段；具体操作以关联的猫猫知识文章为准。</span></section></aside></div></section>`;
}

// ============== Science Tab ==============

function bindOperationsControls(renderApp) {
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
    const slug = button.dataset.operationsKnowledgeSlug;
    window.location.href = `${pageHref('knowledge')}?article=${encodeURIComponent(slug)}`;
  }));

  document.querySelectorAll('[data-timeline-view]').forEach(button => button.addEventListener('click', () => {
    state.timelineView = button.dataset.timelineView === 'finance' ? 'finance' : 'diary';
    renderApp();
  }));

  const timelineFilterToggle = document.getElementById('timelineFilterToggle');
  const timelineFilterMenu = document.getElementById('timelineFilterMenu');
  if (timelineFilterToggle && timelineFilterMenu) {
    timelineFilterToggle.addEventListener('click', () => {
      const shouldOpen = timelineFilterMenu.hidden;
      timelineFilterMenu.hidden = !shouldOpen;
      timelineFilterToggle.setAttribute('aria-expanded', String(shouldOpen));
    });
    timelineFilterMenu.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      timelineFilterMenu.hidden = true;
      timelineFilterToggle.setAttribute('aria-expanded', 'false');
      timelineFilterToggle.focus();
    });
  }

  document.querySelectorAll('[data-timeline-calendar-nav]').forEach(button => button.addEventListener('click', () => {
    if (button.disabled || !button.dataset.timelineCalendarNav) return;
    state.timelineMonth = button.dataset.timelineCalendarNav;
    state.timelineSelectedDate = null;
    renderApp();
  }));

  document.querySelectorAll('[data-timeline-type]').forEach(button => button.addEventListener('click', () => {
    state.timelineType = button.dataset.timelineType;
    state.timelinePage = 1;
    renderApp();
  }));

  document.querySelectorAll('[data-timeline-page]').forEach(button => button.addEventListener('click', () => {
    if (button.disabled) return;
    const page = Number(button.dataset.timelinePage);
    if (!Number.isInteger(page) || page < 1 || page === state.timelinePage) return;
    state.timelinePage = page;
    renderApp();
  }));

  document.querySelectorAll('[data-timeline-date]').forEach(button => button.addEventListener('click', () => {
    state.timelineSelectedDate = button.dataset.timelineDate;
    renderApp();
  }));

  document.querySelectorAll('.timeline-cat-link').forEach(button => button.addEventListener('click', () => {
    openDrawer(button.dataset.catProfile);
  }));
}

export { renderSuppliesTab, renderTimelineTab, renderTimelineListView, renderCollaborationView, buildChronicleSearch, chronicleMotif, bindOperationsControls };
