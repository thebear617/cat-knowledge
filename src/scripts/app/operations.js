import { catProfiles } from '../../../js/cats.js';
import { roles } from '../../../js/roles.js';
import { supplies } from '../../../js/supplies.js';
import { timelineEvents } from '../../../js/timeline.js';
import { knowledgePosts } from './data.js';
import { pageHref } from './routes.js';
import { state } from './state.js';
import { escapeHtml, isEmptyValue, normalize } from './shared.js';

const BASE_URL = `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}`;
const OPERATIONS_VIEWS = [
  { id: 'inventory', label: '物资库存', icon: '📦' },
  { id: 'collaboration', label: '行动协作', icon: '🤝' },
  { id: 'workflows', label: '工作流程', icon: '↗' }
];
const TIMELINE_TYPES = ['全部', '救助', '疫苗', '绝育', '送养'];

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

function catImageUrl(path) {
  return cdnUrl(path);
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
  const chroniclePhoto = catImageUrl(getCatCover(catProfiles[0]));
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
}

export { renderSuppliesTab, renderTimelineTab, chronicleMotif, bindOperationsControls };
