function initApp() {
  const navTabs = document.getElementById('navTabs');
  const sectionContainer = document.getElementById('sectionContainer');

  const params = new URLSearchParams(window.location.search);
  const initialId = params.get('tab') || catKnowledge[0].id;

  function renderNav() {
    navTabs.innerHTML = catKnowledge.map(cat => `
      <button class="nav-tab${cat.id === initialId ? ' active' : ''}" data-id="${cat.id}">
        <span class="icon">${cat.icon}</span>${cat.title}
      </button>
    `).join('');
  }

  function renderSections() {
    sectionContainer.innerHTML = catKnowledge.map(cat => `
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

  renderNav();
  renderSections();
}

document.addEventListener('DOMContentLoaded', initApp);
