import { catProfiles } from '../../js/cats.js';
import { supplies } from '../../js/supplies.js';
import { timelineEvents } from '../../js/timeline.js';
import { roles } from '../../js/roles.js';

const BASE_URL = `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}`;
const STATUS_ORDER = ['全部', '就读中', '已毕业', '喵星或失踪'];
const VACCINE_OPTIONS = ['全部', '零针', '一针', '两针', '疫苗毕业'];
const STERILIZED_OPTIONS = ['全部', '已绝育', '未绝育'];
const FRIENDLINESS_OPTIONS = ['全部', '亲人', '怕人', '非常怕人'];

const TABS = [
  { id: 'home', title: '首页', icon: '🏠' },
  { id: 'timeline', title: '猫猫编年史', icon: '📜' },
  { id: 'supplies', title: '物资管理', icon: '📦' },
  { id: 'roles', title: '猫协分工', icon: '👥' },
  { id: 'knowledge', title: '知识科普', icon: '📖' }
];

const state = {
  query: '',
  status: '全部',
  vaccine: '全部',
  sterilized: '全部',
  friendliness: '全部',
  selectedName: null,
  drawerTab: 'profile',
  activeTab: 'home',
  knowledgeQuery: '',
  knowledgeCategory: '',
  knowledgeSubcategory: '',
  knowledgeView: 'group',
  knowledgeFilterOpen: false,
  knowledgeArticle: null
};

const knowledgePosts = window.__catKnowledgePosts || [];
let knowledgeTocScrollContainer = null;
let knowledgeTocScrollHandler = null;

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

function getSterilizedBucket(cat) {
  return isEmptyValue(cat.sterilized) || String(cat.sterilized).includes('未') ? '未绝育' : '已绝育';
}

function getFriendlinessBucket(cat) {
  return String(cat.friendliness || '');
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
      && (state.friendliness === '全部' || getFriendlinessBucket(cat) === state.friendliness);
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

// ============== Tab Navigation ==============

function renderSidebar() {
  const nav = document.getElementById('sidebarNav');
  if (!nav) return;
  nav.innerHTML = TABS.map(tab => {
    const active = tab.id === state.activeTab ? ' active' : '';
    return `<button class="sidebar-item${active}" data-tab="${tab.id}" aria-current="${tab.id === state.activeTab ? 'page' : 'false'}">
      <span class="sidebar-icon">${tab.icon}</span>
      <span>${escapeHtml(tab.title)}</span>
    </button>`;
  }).join('');
}

// ============== Home Tab ==============

function isHomeFiltered() {
  return state.status !== '全部' || state.vaccine !== '全部' || state.sterilized !== '全部' || state.friendliness !== '全部' || state.query !== '';
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

  let content = `
    <div class="home-hero">
      <h2>西电南校区猫猫</h2>
      <p>追踪每只西电南校区在校喵校友的疫苗、绝育与生活点滴 · 图源：猫咪交流群</p>
    </div>
    <section class="summary-grid" aria-label="猫协档案统计">
      ${summary.map(item => {
        const active = item.filter === 'all' ? !filtered : item.filter === activeFilter;
        return `
        <div class="summary-card tone-${item.tone} summary-clickable${active ? ' summary-active' : ''}" data-summary-filter="${escapeHtml(item.filter)}" tabindex="0">
          <span class="summary-value">${item.value}</span>
          <span class="summary-label">${item.label}</span>
        </div>`;
      }).join('')}
    </section>`;

  if (filtered) {
    const cats = getFilteredCats();
    content += renderCatControls(cats.length) + renderCatGrid(cats);
  } else {
    const catsWithPhotos = catProfiles.filter(cat => cat.images && cat.images.length > 0).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
    content += `
    <div class="home-photo-wall" aria-label="猫咪照片墙">
      ${catsWithPhotos.map(cat => {
        const img = getCatCover(cat);
        return `<div class="home-photo-card" data-cat-name="${escapeHtml(cat.name)}" tabindex="0">
          <img src="${cdnUrl(img)}" alt="${escapeHtml(cat.name)}" loading="lazy">
          <span class="home-photo-label">${escapeHtml(cat.name)}</span>
        </div>`;
      }).join('')}
    </div>`;
  }

  return content;
}

// ============== Cat Profile Tab ==============

function renderCatSummary() {
  return `
    <section class="summary-grid" aria-label="猫协档案统计">
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
    <label class="filter-field" for="${id}">
      <span>${label}</span>
      <select id="${id}" data-filter="${id}">
        ${options.map(option => `
          <option value="${escapeHtml(option)}"${option === value ? ' selected' : ''}>${escapeHtml(option)}</option>
        `).join('')}
      </select>
    </label>
  `;
}

function renderCatControls(filteredCount) {
  const availableStatuses = STATUS_ORDER.filter(status => status === '全部' || catProfiles.some(cat => cat.status === status));
  const baseCount = state.status === '全部' ? catProfiles.length : catProfiles.filter(c => c.status === state.status).length;
  return `
    <section class="controls" aria-label="筛选和搜索">
      <div class="search-row">
        <div class="search-box">
          <span>搜索</span>
          <div class="search-input-row">
            <input id="searchInput" type="search" value="${escapeHtml(state.query)}" placeholder="猫名" autocomplete="off">
            <button class="search-btn" id="searchBtn" title="搜索（回车也可）">搜索</button>
          </div>
        </div>
      </div>
      <div class="filter-grid">
        ${renderSelect('状态', 'status', availableStatuses, state.status)}
        ${renderSelect('疫苗', 'vaccine', VACCINE_OPTIONS, state.vaccine)}
        ${renderSelect('绝育', 'sterilized', STERILIZED_OPTIONS, state.sterilized)}
        ${renderSelect('亲人/抓捕', 'friendliness', FRIENDLINESS_OPTIONS, state.friendliness)}
      </div>
      <div class="result-bar">
        <span>当前显示 <strong>${filteredCount}</strong> / ${baseCount} 只</span>
        <button class="text-button" id="resetFilters" type="button">清空筛选</button>
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
    </article>
  `;
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

function renderDetailRow(label, value) {
  return `
    <div class="detail-row">
      <dt>${label}</dt>
      <dd>${escapeHtml(value || '—')}</dd>
    </div>
  `;
}

function openDrawer(name) {
  const cat = catProfiles.find(item => item.name === name);
  if (!cat) return;

  state.selectedName = name;
  state.drawerTab = 'profile';
  renderDrawer(cat);
}

function renderDrawer(cat) {
  drawer.hidden = false;
  drawerBackdrop.hidden = false;

  const tab = state.drawerTab;
  let contentHtml = '';

  if (tab === 'profile') {
    contentHtml = `
      ${cat.image ? `<img class="drawer-image" src="${cdnUrl(cat.image)}" alt="${escapeHtml(cat.name)}">` : ''}
      <div class="drawer-tags">
        ${renderStatusTag(cat)}
        <span class="tag vaccine-${getVaccineBucket(cat)}">${escapeHtml(getVaccineBucket(cat))}</span>
        <span class="tag">${escapeHtml(getSterilizedBucket(cat))}</span>
        <span class="tag">${escapeHtml(getFriendlinessBucket(cat))}</span>
      </div>
      <dl class="detail-list">
        ${renderDetailRow('抓捕/亲人状态', cat.friendliness)}
        ${renderDetailRow('疫苗状态', cat.vaccine)}
        ${renderDetailRow('绝育状态', cat.sterilized)}
        ${renderDetailRow('区域', cat.area)}
        ${renderDetailRow('性别', cat.gender)}
        ${renderDetailRow('备注', cat.notes)}
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
}

function closeDrawer() {
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
      normalize(item.name).includes(q) || normalize(item.notes || '').includes(q)
    );
    return matched.length > 0 ? { ...category, items: matched } : null;
  }).filter(Boolean);
}

function renderSuppliesTab() {
  const data = getFilteredSupplies();
  let html = buildSearchBar('supplies', '物资名称、备注...');

  if (!data.length) {
    html += '<section class="empty-state"><h2>没有匹配的物资</h2><p>可以清除搜索试试。</p></section>';
  } else {
    const catGradients = [
      { gradient: 'linear-gradient(135deg, #D3C5B5, #C9B99A)', text: '#2f2924' },  // 容器
      { gradient: 'linear-gradient(135deg, #C9B99A, #A89F91)', text: '#fff' },      // 猫粮
      { gradient: 'linear-gradient(135deg, #A89F91, #8B7D6B)', text: '#fff' },      // 猫砂
      { gradient: 'linear-gradient(135deg, #D3C5B5, #8B7D6B)', text: '#fff' }      // 其他物资
    ];
    const catEmoji = { '猫粮': '🍖', '抓捕工具': '🔧', '航空箱 / 猫包': '🧳', '药品': '💊', '猫窝': '🛏️', '其它': '📦' };
    html += '<div class="supplies-list">';
    let gi = 0;
    for (const cat of data) {
      if (!cat.items.length) continue;
      const g = catGradients[gi % catGradients.length];
      gi++;
      const emoji = catEmoji[cat.category] || '📦';
      html += `<details class="supply-category" open>
        <summary class="supply-cat-header" style="background:${g.gradient};color:${g.text}">
          <h3>${emoji} ${escapeHtml(cat.category)}<span>${cat.items.length} 件</span><span class="supply-arrow">▾</span></h3>
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

  return html;
}

// ============== Timeline Tab ==============

function getFilteredTimeline() {
  const q = normalize(state.query);
  if (!q) return timelineEvents;
  return timelineEvents.filter(event =>
    normalize(event.cat).includes(q) ||
    normalize(event.type).includes(q) ||
    normalize(event.notes || '').includes(q) ||
    normalize(event.location || '').includes(q)
  );
}

function renderTimelineTab() {
  const events = getFilteredTimeline();
  let html = buildSearchBar('timeline', '搜索猫名、事件类型...');

  if (!events.length) {
    html += '<section class="empty-state"><h2>没有匹配的事件</h2><p>可以清除搜索试试。</p></section>';
  } else {
    const months = {};
    for (const event of events) {
      const key = event.date.slice(0, 7);
      if (!months[key]) months[key] = [];
      months[key].push(event);
    }

    const monthGradients = [
      { gradient: 'linear-gradient(135deg, #e0c3fc, #8ec5fc)', text: '#2f2924' },
      { gradient: 'linear-gradient(135deg, #fdcbf1, #e6dee9)', text: '#2f2924' },
      { gradient: 'linear-gradient(135deg, #ffecd2, #fcb69f)', text: '#2f2924' },
      { gradient: 'linear-gradient(135deg, #fad0c4, #ffd1ff)', text: '#2f2924' },
      { gradient: 'linear-gradient(135deg, #f6d365, #fda085)', text: '#2f2924' },
      { gradient: 'linear-gradient(135deg, #e6b980, #eacda3)', text: '#2f2924' },
      { gradient: 'linear-gradient(135deg, #fa709a, #fee140)', text: '#2f2924' },
      { gradient: 'linear-gradient(135deg, #c79081, #dfa579)', text: '#f7c974' },
      { gradient: 'linear-gradient(135deg, #f83600, #f9d423)', text: '#f7c974' },
      { gradient: 'linear-gradient(135deg, #feada6, #f5efef)', text: '#2f2924' },
      { gradient: 'linear-gradient(135deg, #868f96, #596164)', text: '#f7c974' },
      { gradient: 'linear-gradient(135deg, #cfd9df, #e2ebf0)', text: '#2f2924' }
    ];
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

    html += '<div class="timeline-list">';
    for (const [key, items] of Object.entries(months).sort()) {
      const [year, month] = key.split('-');
      const m = parseInt(month, 10);
      const label = `${year}年${monthNames[m - 1]}`;
      const g = monthGradients[m - 1];

      html += `<details class="timeline-month" open>
        <summary class="timeline-month-label" style="background:${g.gradient};color:${g.text}">${label}<span>${items.length} 条记录</span><span class="timeline-month-arrow">▾</span></summary>
        <div class="timeline-events">`;
      for (const event of items.sort((a, b) => a.date.localeCompare(b.date))) {
        const day = event.date.slice(5);
        html += `<div class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-entry">
            <div class="timeline-entry-header">
              <span class="timeline-entry-cat">${escapeHtml(event.cat)}</span>
              <span class="timeline-badge timeline-badge-${event.type}">${escapeHtml(event.type)}</span>
              <span class="timeline-entry-date">${day}</span>
            </div>`;
        if (event.location || event.notes) {
          html += `<div class="timeline-entry-desc">
            ${event.location ? `📍 ${escapeHtml(event.location)}` : ''}${event.location && event.notes ? ' · ' : ''}${event.notes ? escapeHtml(event.notes) : ''}
          </div>`;
        }
        html += '</div></div>';
      }
      html += '</div></details>';
    }
    html += '</div>';
  }

  return html;
}

// ============== Roles Tab ==============

function renderRolesTab() {
  const data = roles;
  let html = '';

  if (!data.length) {
    html += '<section class="empty-state"><h2>没有匹配的分工</h2></section>';
  } else {
    const roleGradients = [
      { gradient: 'linear-gradient(135deg, #FEF3C7, #FDE68A)' },   // 义卖组 琥珀
      { gradient: 'linear-gradient(135deg, #FCE7F3, #F9A8D4)' },   // 疫苗绝育组 粉玫
      { gradient: 'linear-gradient(135deg, #D1FAE5, #A7F3D0)' },    // 赞助组 薄荷
      { gradient: 'linear-gradient(135deg, #DBEAFE, #BFDBFE)' }     // 宣传财务组 晴蓝
    ];

    html += '<div class="roles-list">';
    for (let i = 0; i < data.length; i++) {
      const role = data[i];
      const g = roleGradients[i % roleGradients.length];
      html += `<div class="role-card">
        <div class="role-header" style="background:${g.gradient}">
          <h3>${escapeHtml(role.name)}</h3>
          <p class="role-desc">${escapeHtml(role.description)}</p>
        </div>
        <div class="role-phases">`;
      for (const phase of role.phases) {
        html += `<div class="role-phase">
          <span class="role-phase-label">${escapeHtml(phase.label)}</span>
          <span class="role-phase-detail">${escapeHtml(phase.detail)}</span>
        </div>`;
      }
      html += '</div></div>';
    }
    html += '</div>';
  }

  return html;
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
  const cards = state.knowledgeView === 'group' ? `<div class="knowledge-group-grid">${groups.map(group => `<section class="knowledge-group"><div class="knowledge-group-heading"><div class="knowledge-group-title"><span class="knowledge-group-icon">${knowledgeCategoryIcon(group.category)}</span><h2>${escapeHtml(group.category)}</h2><span>${group.posts.length} 篇</span></div><button class="knowledge-group-view-all" data-knowledge-focus-category="${escapeHtml(group.category)}" type="button">查看全部 →</button></div><div class="knowledge-cards">${group.posts.map(renderKnowledgeCard).join('')}</div></section>`).join('')}</div>` : state.knowledgeView === 'list' ? `<div class="knowledge-list">${posts.map(renderKnowledgeListRow).join('')}</div>` : `<div class="knowledge-cards">${posts.map(renderKnowledgeCard).join('')}</div>`;
  const hasFilter = state.knowledgeCategory || state.knowledgeSubcategory;
  return `<section class="knowledge-shell"><header class="knowledge-heading"><p>CAT KNOWLEDGE</p><h1>知识科普</h1><span>照护、救助与校园共处的行动知识。</span></header><div class="knowledge-toolbar"><label class="knowledge-search"><span>⌕</span><input id="knowledgeSearch" type="search" value="${escapeHtml(state.knowledgeQuery)}" placeholder="搜索文章、标签或关键词"></label><div class="knowledge-actions"><div class="knowledge-views" aria-label="视图切换">${['group', 'grid', 'list'].map(id => `<button data-knowledge-view="${id}" class="${state.knowledgeView === id ? 'is-active' : ''}" type="button" title="${knowledgeViewLabel(id)}" aria-label="${knowledgeViewLabel(id)}">${knowledgeViewIcon(id)}</button>`).join('')}</div><button id="knowledgeFilterToggle" class="knowledge-filter-btn${hasFilter ? ' has-filter' : ''}" type="button">筛选${hasFilter ? ' · 已选' : ''}</button>${state.knowledgeFilterOpen ? `<div class="knowledge-filter-popover"><div><strong>筛选文章</strong><button id="knowledgeFilterClear" type="button">清除</button></div><section><span>一级分类</span><p>${categories.map(item => `<button data-knowledge-category="${escapeHtml(item)}" class="${item === state.knowledgeCategory ? 'is-selected' : ''}" type="button">${escapeHtml(item)}</button>`).join('')}</p></section><section><span>二级主题</span><p>${subcategories.map(item => `<button data-knowledge-subcategory="${escapeHtml(item)}" class="${item === state.knowledgeSubcategory ? 'is-selected' : ''}" type="button">${escapeHtml(item)}</button>`).join('')}</p></section></div>` : ''}</div></div><div class="knowledge-results view-${state.knowledgeView}">${cards || '<p class="knowledge-empty">没有找到匹配的文章。</p>'}</div></section>`;
}

function knowledgeCategoryIcon(category) {
  return ({ '救助与 TNR': '🐾', '健康与安全': '🩺', '猫协运营': '🗂️' })[category] || '📚';
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

// ============== Main Render ==============

function renderApp() {
  let content = '';

  if (state.activeTab === 'home') {
    content = renderHomeTab();
  } else if (state.activeTab === 'supplies') {
    content = renderSuppliesTab();
  } else if (state.activeTab === 'timeline') {
    content = renderTimelineTab();
  } else if (state.activeTab === 'roles') {
    content = renderRolesTab();
  } else if (state.activeTab === 'knowledge') {
    content = renderScienceTab();
  }

  app.classList.toggle('knowledge-app-shell', state.activeTab === 'knowledge');
  app.innerHTML = `
    <div class="tab-panel">
      ${content}
    </div>
  `;

  renderSidebar();
  bindControls();
  bindKnowledgeControls();
  bindKnowledgeToc();
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
  const clearSearch = document.getElementById('clearSearch');
  if (clearSearch) {
    clearSearch.addEventListener('click', () => {
      state.query = '';
      renderApp();
    });
  }

  if (state.activeTab === 'home') {
    if (isHomeFiltered()) {
      document.querySelectorAll('[data-filter]').forEach(control => {
        control.addEventListener('change', event => {
          state[event.target.dataset.filter] = event.target.value;
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
          renderApp();
        });
      }
    }

    bindCatCards();
    bindSummaryCards();
  }
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
  document.getElementById('knowledgeFilterClear')?.addEventListener('click', () => {
    state.knowledgeCategory = '';
    state.knowledgeSubcategory = '';
    state.knowledgeFilterOpen = false;
    renderApp();
  });
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
    state.knowledgeView = 'grid';
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
  const selector = (state.activeTab === 'home' && !isHomeFiltered()) ? '.home-photo-card' : '.cat-card';
  document.querySelectorAll(selector).forEach(card => {
    card.addEventListener('click', () => openDrawer(card.dataset.catName));
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openDrawer(card.dataset.catName);
      }
    });
  });
}

function applyHomeFilter(filterKey) {
  state.query = '';
  state.status = '全部';
  state.vaccine = '全部';
  state.sterilized = '全部';
  state.friendliness = '全部';

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
  document.querySelectorAll('.summary-clickable').forEach(card => {
    card.addEventListener('click', () => {
      applyHomeFilter(card.dataset.summaryFilter);
    });
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
