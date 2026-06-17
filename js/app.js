function initApp() {
  const navTabs = document.getElementById('navTabs');
  const sectionContainer = document.getElementById('sectionContainer');
  const archiveTab = {
    id: 'cat-archive',
    title: '猫协档案',
    icon: '📋'
  };
  const tabs = [...catKnowledge, archiveTab];

  const params = new URLSearchParams(window.location.search);
  const initialId = tabs.some(tab => tab.id === params.get('tab')) ? params.get('tab') : tabs[0].id;
  let activeStatus = '全部';

  function renderNav() {
    navTabs.innerHTML = tabs.map(tab => `
      <button class="nav-tab${tab.id === initialId ? ' active' : ''}" data-id="${tab.id}">
        <span class="icon">${tab.icon}</span>${tab.title}
      </button>
    `).join('');
  }

  function getStatusCounts() {
    return catProfiles.reduce((counts, cat) => {
      counts[cat.status] = (counts[cat.status] || 0) + 1;
      counts['全部'] += 1;
      return counts;
    }, { '全部': 0 });
  }

  function getStatusOptions() {
    const statusOrder = ['全部', '在校', '预计领养', '已领养', '已离世', '失踪'];
    const counts = getStatusCounts();
    return statusOrder.filter(status => counts[status]);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function renderStatCards() {
    const counts = getStatusCounts();
    const stats = [
      ['全部', counts['全部'] || 0],
      ['在校', counts['在校'] || 0],
      ['预计领养', counts['预计领养'] || 0],
      ['已领养', counts['已领养'] || 0],
      ['已离世', counts['已离世'] || 0]
    ];

    return `
      <div class="archive-stats">
        ${stats.map(([label, value]) => `
          <div class="stat-card">
            <span class="stat-value">${value}</span>
            <span class="stat-label">${label}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderStatusFilters() {
    return `
      <div class="filter-row" aria-label="猫咪状态筛选">
        ${getStatusOptions().map(status => `
          <button class="filter-chip${status === activeStatus ? ' active' : ''}" data-status="${status}">
            ${status}
          </button>
        `).join('')}
      </div>
    `;
  }

  function renderCatCard(cat) {
    const fields = [
      ['疫苗', cat.vaccine],
      ['下一针', cat.nextWindow],
      ['绝育', cat.sterilized],
      ['亲人/抓捕', cat.friendliness],
      ['领养人', cat.adopter],
      ['去向', cat.destination]
    ];

    return `
      <article class="cat-card">
        <div class="cat-card-top">
          <div>
            <h3>${escapeHtml(cat.name)}</h3>
            <p>${escapeHtml(cat.source)}</p>
          </div>
          <span class="status-pill status-${cat.status}">${escapeHtml(cat.status)}</span>
        </div>
        <dl class="cat-fields">
          ${fields.map(([label, value]) => `
            <div>
              <dt>${label}</dt>
              <dd>${escapeHtml(value || '—')}</dd>
            </div>
          `).join('')}
        </dl>
        <p class="cat-note">${escapeHtml(cat.notes || '—')}</p>
      </article>
    `;
  }

  function renderCatArchiveContent() {
    const filteredCats = activeStatus === '全部'
      ? catProfiles
      : catProfiles.filter(cat => cat.status === activeStatus);

    const archiveSection = document.getElementById('section-cat-archive');
    archiveSection.innerHTML = `
      <div class="section-header">
        <h2>📋 猫协档案</h2>
        <p class="lead">展示当前猫协猫只状态、疫苗进度、绝育信息和领养去向。数据来自 Obsidian 猫协档案，当前为手写结构化版本。</p>
      </div>
      ${renderStatCards()}
      ${renderStatusFilters()}
      <div class="cat-grid">
        ${filteredCats.map(renderCatCard).join('')}
      </div>
    `;
  }

  function renderSections() {
    const knowledgeSections = catKnowledge.map(cat => `
      <div class="section-content${cat.id === initialId ? ' active' : ''}" id="section-${cat.id}">
        <div class="section-header">
          <h2>${cat.icon} ${cat.title}</h2>
          <p class="lead">${cat.intro}</p>
        </div>
        <div class="card-grid">
          ${cat.items.map(item => `
            <div class="card">
              <h3>${item.name}</h3>
              <div class="subtitle">${item.subtitle}</div>
              <p class="desc">${item.desc}</p>
              <div class="tags">
                ${item.tags.map(t => `<span class="tag">${t}</span>`).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');

    sectionContainer.innerHTML = `
      ${knowledgeSections}
      <div class="section-content${archiveTab.id === initialId ? ' active' : ''}" id="section-${archiveTab.id}"></div>
    `;

    renderCatArchiveContent();
  }

  function switchTab(id) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.id === id));
    document.querySelectorAll('.section-content').forEach(s => s.classList.toggle('active', s.id === `section-${id}`));
    const url = new URL(window.location);
    url.searchParams.set('tab', id);
    window.history.replaceState({}, '', url);
  }

  navTabs.addEventListener('click', e => {
    const btn = e.target.closest('.nav-tab');
    if (btn) switchTab(btn.dataset.id);
  });

  sectionContainer.addEventListener('click', e => {
    const btn = e.target.closest('.filter-chip');
    if (!btn) return;
    activeStatus = btn.dataset.status;
    renderCatArchiveContent();
  });

  renderNav();
  renderSections();
}

document.addEventListener('DOMContentLoaded', initApp);
