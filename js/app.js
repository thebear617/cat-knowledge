const STATUS_ORDER = ['全部', '就读中', '已毕业', '喵星或失踪'];
const VACCINE_OPTIONS = ['全部', '零针', '一针', '两针', '疫苗毕业'];
const STERILIZED_OPTIONS = ['全部', '已绝育', '未绝育'];
const FRIENDLINESS_OPTIONS = ['全部', '亲人', '怕人', '非常怕人'];

const TABS = [
  { id: 'home', title: '首页', icon: '🏠' },
  { id: 'supplies', title: '物资管理', icon: '📦' },
  { id: 'sop', title: '标准 SOP', icon: '📋' },
  { id: 'timeline', title: '猫猫编年史', icon: '📜' },
  { id: 'roles', title: '猫协分工', icon: '👥' },
  { id: 'science', title: '猫猫科普', icon: '📖' }
];

const state = {
  query: '',
  status: '全部',
  vaccine: '全部',
  sterilized: '全部',
  friendliness: '全部',
  selectedName: null,
  drawerTab: 'profile',
  activeTab: 'home'
};

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
      cat.source
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
  const parts = path.split('/').map(encodeURIComponent).join('/');
  return parts;
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
      <h2>西电猫猫</h2>
      <p>追踪每只西电在校喵校友的疫苗、绝育与生活点滴</p>
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
        const img = cat.images[0];
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
  const firstImage = cat.images && cat.images.length ? cat.images[0] : null;
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
        <p>${escapeHtml(cat.source)}</p>
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
    html += '<div class="supplies-list">';
    for (const cat of data) {
      html += `<div class="supply-category">
        <h3>${escapeHtml(cat.category)}</h3>`;
      if (cat.note) {
        html += `<p class="supply-cat-note">${escapeHtml(cat.note)}</p>`;
      }
      if (!cat.items.length) {
        html += '<p class="supply-empty">暂无记录</p>';
      } else {
        html += '<div class="supply-table">';
        html += '<div class="supply-row supply-row-header"><span>名称</span><span>位置</span><span>规格</span><span>状态</span><span>备注</span></div>';
        for (const item of cat.items) {
          html += `<div class="supply-row">
            <span><strong>${escapeHtml(item.name)}</strong></span>
            <span>${escapeHtml(item.location || '—')}</span>
            <span>${escapeHtml(item.spec || '—')}</span>
            <span>${escapeHtml(item.status || '—')}</span>
            <span>${escapeHtml(item.notes || '—')}</span>
          </div>`;
        }
        html += '</div>';
      }
      html += '</div>';
    }
    html += '</div>';
  }

  return html;
}

// ============== SOP Tab ==============

function getFilteredSops() {
  const q = normalize(state.query);
  if (!q) return sops;
  return sops.map(sop => {
    const matched = sop.sections.map(section => {
      const matchedItems = section.items.filter(item =>
        normalize(item).includes(q)
      );
      return matchedItems.length > 0 ? { ...section, items: matchedItems } : null;
    }).filter(Boolean);
    return matched.length > 0 ? { ...sop, sections: matched } : null;
  }).filter(Boolean);
}

function renderSopTab() {
  const data = getFilteredSops();
  let html = buildSearchBar('sop', '搜索 SOP 内容...');

  if (!data.length) {
    html += '<section class="empty-state"><h2>没有匹配的 SOP</h2><p>可以清除搜索试试。</p></section>';
  } else {
    html += '<div class="sop-list">';
    for (const sop of data) {
      html += `<details class="sop-card" open>
        <summary class="sop-title">${escapeHtml(sop.title)}</summary>
        <div class="sop-body">`;
      for (const section of sop.sections) {
        html += `<div class="sop-section">
          <h4>${escapeHtml(section.title)}</h4>
          <ul>`;
        for (const item of section.items) {
          html += `<li>${escapeHtml(item)}</li>`;
        }
        html += '</ul></div>';
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

function getFilteredRoles() {
  const q = normalize(state.query);
  if (!q) return roles;
  return roles.map(role => {
    const matched = role.phases.filter(phase =>
      normalize(phase.label).includes(q) || normalize(phase.detail).includes(q)
    );
    return matched.length > 0 ? { ...role, phases: matched } : null;
  }).filter(Boolean);
}

function renderRolesTab() {
  const data = getFilteredRoles();
  let html = buildSearchBar('roles', '搜索组名、职责...');

  if (!data.length) {
    html += '<section class="empty-state"><h2>没有匹配的分工</h2><p>可以清除搜索试试。</p></section>';
  } else {
    const roleGradients = [
      { gradient: 'linear-gradient(135deg, #e8b84b, #e87850)', text: '#fff' },     // 义卖组 深暖金
      { gradient: 'linear-gradient(135deg, #30cfd0, #330867)', text: '#fff' },     // 疫苗绝育组 青紫
      { gradient: 'linear-gradient(135deg, #16a085, #f4d03f)', text: '#fff' },     // 赞助组 青绿金
      { gradient: 'linear-gradient(135deg, #fa709a, #fee140)', text: '#2f2924' }   // 宣传财务组 粉金
    ];

    html += '<div class="roles-list">';
    for (let i = 0; i < data.length; i++) {
      const role = data[i];
      const g = roleGradients[i % roleGradients.length];
      html += `<div class="role-card">
        <div class="role-header" style="background:${g.gradient};color:${g.text}">
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
  return `
    <section class="controls" aria-label="搜索">
      <div class="search-row">
        <div class="search-box">
          <span>搜索</span>
          <div class="search-input-row">
            <input id="searchInput" type="search" value="" placeholder="搜索科普文章..." autocomplete="off">
            <button class="search-btn" id="searchBtn" title="搜索（回车也可）">搜索</button>
          </div>
        </div>
      </div>
    </section>
    <section class="empty-state">
      <h2>🐱 猫猫科普</h2>
      <p>科普内容即将上线，建设中。</p>
    </section>
  `;
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
  } else if (state.activeTab === 'sop') {
    content = renderSopTab();
  } else if (state.activeTab === 'timeline') {
    content = renderTimelineTab();
  } else if (state.activeTab === 'roles') {
    content = renderRolesTab();
  } else if (state.activeTab === 'science') {
    content = renderScienceTab();
  }

  app.innerHTML = `
    <div class="tab-panel">
      ${content}
    </div>
  `;

  renderSidebar();
  bindControls();
}

// ============== Event Binding ==============

function bindControls() {
  const sidebarNav = document.getElementById('sidebarNav');
  if (sidebarNav) {
    sidebarNav.querySelectorAll('.sidebar-item').forEach(btn => {
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
