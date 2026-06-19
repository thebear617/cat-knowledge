const STATUS_ORDER = ['全部', '在校', '预计领养', '已领养', '已离世', '失踪'];
const VACCINE_OPTIONS = ['全部', '待首针', '需补针', '超窗口', '三针完成'];
const STERILIZED_OPTIONS = ['全部', '已绝育', '未确认'];
const FRIENDLINESS_OPTIONS = ['全部', '不怕人', '有点怕人', '行踪不定', '状态待补充'];

const TABS = [
  { id: 'cats', title: '猫只档案' },
  { id: 'supplies', title: '物资管理' },
  { id: 'sop', title: '标准 SOP' },
  { id: 'timeline', title: '猫猫编年史' }
];

const state = {
  query: '',
  status: '全部',
  vaccine: '全部',
  sterilized: '全部',
  friendliness: '全部',
  sort: 'priority',
  selectedName: null,
  drawerTab: 'profile',
  activeTab: 'cats'
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
  const text = `${cat.vaccine} ${cat.nextWindow}`;
  if (text.includes('超窗口')) return '超窗口';
  if (text.includes('待首针') || text.includes('未接种')) return '待首针';
  if (text.includes('二针未接种') || text.includes('三针未接种') || text.includes('待认领')) return '需补针';
  if (text.includes('三针已完成') || /三针\s*(20\d{2}|约\s*20\d{2})/.test(text)) return '三针完成';
  return '需补针';
}

function getSterilizedBucket(cat) {
  return isEmptyValue(cat.sterilized) || String(cat.sterilized).includes('未') ? '未确认' : '已绝育';
}

function getFriendlinessBucket(cat) {
  const text = String(cat.friendliness || '');
  if (text.includes('不怕人')) return '不怕人';
  if (text.includes('有点怕人') || text.includes('怕人')) return '有点怕人';
  if (text.includes('行踪不定')) return '行踪不定';
  return '状态待补充';
}

function getPriorityScore(cat) {
  let score = 0;
  if (cat.status === '在校') score += 50;
  if (cat.status === '预计领养') score += 35;
  if (getVaccineBucket(cat) === '超窗口') score += 40;
  if (getVaccineBucket(cat) === '待首针') score += 28;
  if (getVaccineBucket(cat) === '需补针') score += 18;
  if (getSterilizedBucket(cat) === '未确认') score += 8;
  if (getFriendlinessBucket(cat) === '不怕人') score += 6;
  return score;
}

function getSummary() {
  const counts = catProfiles.reduce((acc, cat) => {
    acc.total += 1;
    acc.status[cat.status] = (acc.status[cat.status] || 0) + 1;
    acc.vaccine[getVaccineBucket(cat)] = (acc.vaccine[getVaccineBucket(cat)] || 0) + 1;
    acc.sterilized[getSterilizedBucket(cat)] = (acc.sterilized[getSterilizedBucket(cat)] || 0) + 1;
    return acc;
  }, { total: 0, status: {}, vaccine: {}, sterilized: {} });

  return [
    { label: '全部猫咪', value: counts.total, tone: 'dark' },
    { label: '在校管理', value: counts.status['在校'] || 0, tone: 'green' },
    { label: '预计领养', value: counts.status['预计领养'] || 0, tone: 'amber' },
    { label: '已领养', value: counts.status['已领养'] || 0, tone: 'blue' },
    { label: '待首针', value: counts.vaccine['待首针'] || 0, tone: 'red' },
    { label: '超窗口', value: counts.vaccine['超窗口'] || 0, tone: 'red' },
    { label: '已绝育', value: counts.sterilized['已绝育'] || 0, tone: 'green' }
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
      cat.nextWindow,
      cat.sterilized,
      cat.adopter,
      cat.destination,
      cat.notes,
      cat.source
    ].join(' '));

    return (!q || haystack.includes(q))
      && (state.status === '全部' || cat.status === state.status)
      && (state.vaccine === '全部' || getVaccineBucket(cat) === state.vaccine)
      && (state.sterilized === '全部' || getSterilizedBucket(cat) === state.sterilized)
      && (state.friendliness === '全部' || getFriendlinessBucket(cat) === state.friendliness);
  });

  return filtered.sort((a, b) => {
    if (state.sort === 'name') return a.name.localeCompare(b.name, 'zh-Hans-CN');
    if (state.sort === 'status') {
      const statusDiff = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
      return statusDiff || a.name.localeCompare(b.name, 'zh-Hans-CN');
    }
    return getPriorityScore(b) - getPriorityScore(a) || a.name.localeCompare(b.name, 'zh-Hans-CN');
  });
}

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/thebear617/cat-knowledge@main';
const IMG_VER = Date.now();

function cdnUrl(path) {
  if (!path) return path;
  return path.startsWith('http') ? path : CDN_BASE + '/' + path;
}

// ============== Tab Navigation ==============

function buildTabBar() {
  return `
    <nav class="tab-bar" role="tablist">
      ${TABS.map(tab => {
        const active = tab.id === state.activeTab ? ' active' : '';
        return `<button class="tab-button${active}" role="tab" data-tab="${tab.id}" aria-selected="${tab.id === state.activeTab}">
          ${escapeHtml(tab.title)}
        </button>`;
      }).join('')}
    </nav>
  `;
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
  return `
    <section class="controls" aria-label="筛选和搜索">
      <div class="search-row">
        <div class="search-box">
          <span>搜索</span>
          <div class="search-input-row">
            <input id="searchInput" type="search" value="${escapeHtml(state.query)}" placeholder="猫名、疫苗、领养人、备注..." autocomplete="off">
            <button class="search-btn" id="searchBtn" title="搜索（回车也可）">搜索</button>
          </div>
        </div>
        <label class="filter-field sort-field" for="sort">
          <span>排序</span>
          <select id="sort" data-filter="sort">
            <option value="priority"${state.sort === 'priority' ? ' selected' : ''}>跟进优先</option>
            <option value="status"${state.sort === 'status' ? ' selected' : ''}>状态分组</option>
            <option value="name"${state.sort === 'name' ? ' selected' : ''}>猫名排序</option>
          </select>
        </label>
      </div>
      <div class="filter-grid">
        ${renderSelect('状态', 'status', availableStatuses, state.status)}
        ${renderSelect('疫苗', 'vaccine', VACCINE_OPTIONS, state.vaccine)}
        ${renderSelect('绝育', 'sterilized', STERILIZED_OPTIONS, state.sterilized)}
        ${renderSelect('亲人/抓捕', 'friendliness', FRIENDLINESS_OPTIONS, state.friendliness)}
      </div>
      <div class="result-bar">
        <span>当前显示 <strong>${filteredCount}</strong> / ${catProfiles.length} 只</span>
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
  const vaccineBucket = getVaccineBucket(cat);
  const sterilizedBucket = getSterilizedBucket(cat);
  return `
    <article class="cat-card" data-cat-name="${escapeHtml(cat.name)}" tabindex="0">
      ${cat.image ? `<img class="cat-thumb" src="${cdnUrl(cat.image)}?v=${IMG_VER}" alt="${escapeHtml(cat.name)}" loading="lazy" onerror="this.parentElement.classList.add('img-missing')">` : ''}
      <div class="cat-card-header">
        <div>
          <h2>${escapeHtml(cat.name)}</h2>
          <p>${escapeHtml(cat.source)}</p>
        </div>
        ${renderStatusTag(cat)}
      </div>
      <div class="cat-tags">
        <span class="tag vaccine-${vaccineBucket}">${escapeHtml(vaccineBucket)}</span>
        <span class="tag">${escapeHtml(sterilizedBucket)}</span>
        <span class="tag">${escapeHtml(getFriendlinessBucket(cat))}</span>
      </div>
      <div class="card-meta">
        ${renderMeta('疫苗', cat.vaccine)}
        ${renderMeta('下一针', cat.nextWindow)}
        ${renderMeta('绝育', cat.sterilized)}
        ${renderMeta('去向', cat.destination)}
      </div>
      <p class="card-note">${escapeHtml(cat.notes || '—')}</p>
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
      ${cat.image ? `<img class="drawer-image" src="${cdnUrl(cat.image)}?v=${IMG_VER}" alt="${escapeHtml(cat.name)}">` : ''}
      <div class="drawer-tags">
        ${renderStatusTag(cat)}
        <span class="tag vaccine-${getVaccineBucket(cat)}">${escapeHtml(getVaccineBucket(cat))}</span>
        <span class="tag">${escapeHtml(getSterilizedBucket(cat))}</span>
        <span class="tag">${escapeHtml(getFriendlinessBucket(cat))}</span>
      </div>
      <dl class="detail-list">
        ${renderDetailRow('抓捕/亲人状态', cat.friendliness)}
        ${renderDetailRow('疫苗状态', cat.vaccine)}
        ${renderDetailRow('下一针窗口', cat.nextWindow)}
        ${renderDetailRow('绝育状态', cat.sterilized)}
        ${renderDetailRow('领养人', cat.adopter)}
        ${renderDetailRow('去向', cat.destination)}
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
              <img src="${cdnUrl(src.replace(/([^/]+)$/, 'thumb/$1'))}?v=${IMG_VER}" data-full="${cdnUrl(src)}?v=${IMG_VER}" alt="${escapeHtml(cat.name)}" loading="lazy" onclick="openPhotoViewer(this)">
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
      if (!cat.items.length) {
        html += '<p class="supply-empty">暂无记录</p>';
      } else {
        html += '<div class="supply-table">';
        html += '<div class="supply-row supply-row-header"><span>名称</span><span>规格</span><span>价格</span><span>日期</span><span>备注</span></div>';
        for (const item of cat.items) {
          html += `<div class="supply-row">
            <span><strong>${escapeHtml(item.name)}</strong></span>
            <span>${escapeHtml(item.spec || '—')}</span>
            <span>${escapeHtml(item.price || '—')}</span>
            <span>${escapeHtml(item.date || '—')}</span>
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
    html += '<div class="timeline-list">';
    for (const event of events) {
      html += `<div class="timeline-item">
        <div class="timeline-date">${escapeHtml(event.date)}</div>
        <div class="timeline-dot"></div>
        <div class="timeline-card">
          <div class="timeline-header">
            <strong>${escapeHtml(event.cat)}</strong>
            <span class="timeline-type">${escapeHtml(event.type)}</span>
          </div>
          ${event.location ? `<p class="timeline-location">📍 ${escapeHtml(event.location)}</p>` : ''}
          <p class="timeline-note">${escapeHtml(event.notes)}</p>
        </div>
      </div>`;
    }
    html += '</div>';
  }

  return html;
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

function renderCatsTab() {
  const cats = getFilteredCats();
  return `
    ${renderCatSummary()}
    ${renderCatControls(cats.length)}
    ${renderCatGrid(cats)}
  `;
}

function renderApp() {
  let content = '';

  if (state.activeTab === 'cats') {
    content = renderCatsTab();
  } else if (state.activeTab === 'supplies') {
    content = renderSuppliesTab();
  } else if (state.activeTab === 'sop') {
    content = renderSopTab();
  } else if (state.activeTab === 'timeline') {
    content = renderTimelineTab();
  }

  app.innerHTML = `
    ${buildTabBar()}
    <div class="tab-panel">
      ${content}
    </div>
  `;

  bindControls();
}

// ============== Event Binding ==============

function bindControls() {
  // Tab switching
  app.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => {
      const newTab = btn.dataset.tab;
      if (newTab !== state.activeTab) {
        state.activeTab = newTab;
        state.query = '';
        state.status = '全部';
        state.vaccine = '全部';
        state.sterilized = '全部';
        state.friendliness = '全部';
        state.sort = 'priority';
        renderApp();
      }
    });
  });

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

  // Cats tab specific
  if (state.activeTab === 'cats') {
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
        state.sort = 'priority';
        renderApp();
      });
    }

    bindCatCards();
  }
}

function bindCatCards() {
  document.querySelectorAll('.cat-card').forEach(card => {
    card.addEventListener('click', () => openDrawer(card.dataset.catName));
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openDrawer(card.dataset.catName);
      }
    });
  });
}

// ============== Global Events ==============

drawerBackdrop.addEventListener('click', closeDrawer);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !drawer.hidden) closeDrawer();
});

document.addEventListener('DOMContentLoaded', renderApp);
