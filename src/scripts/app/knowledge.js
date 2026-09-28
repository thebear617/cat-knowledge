import { knowledgePosts } from './data.js';
import { state } from './state.js';
import { escapeHtml } from './shared.js';

let knowledgeTocScrollContainer = null;
let knowledgeTocScrollHandler = null;

function renderScienceTab() {
  if (state.knowledgeArticle) {
    const post = knowledgePosts.find(item => item.slug === state.knowledgeArticle);
    if (post) {
      const headings = getArticleHeadings(post.body);
      return `<section class="knowledge-shell knowledge-article-layout${headings.length ? ' has-toc' : ''}"><button class="knowledge-back" id="knowledgeBack" type="button">← 返回文章列表</button><div class="knowledge-article-detail-layout">${renderKnowledgeToc(headings)}<article class="knowledge-article"><header class="knowledge-article-header"><h1>${escapeHtml(post.title)}</h1><div class="knowledge-article-meta-row"><p class="knowledge-article-meta">发布于 ${new Date(post.publishedAt).toLocaleDateString('zh-CN')}</p></div></header><div class="knowledge-body">${markdownToHtml(post.body, headings)}</div></article></div></section>`;
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
  const filterSummary = [state.knowledgeCategory || '全部分类', state.knowledgeSubcategory || '全部主题', state.knowledgeQuery || '未输入关键词'];
  const viewButtons = ['group', 'grid', 'list'].filter(id => !mobileKnowledge || id !== 'grid').map(id => `<button data-knowledge-view="${id}" class="${view === id ? 'is-active' : ''}" type="button" title="${knowledgeViewLabel(id)}" aria-label="${knowledgeViewLabel(id)}">${knowledgeViewIcon(id)}<span>${knowledgeViewLabel(id)}</span></button>`).join('');
  const filterPanel = state.knowledgeFilterOpen ? `<div class="knowledge-filter-popover"><div><strong>筛选文章</strong><button data-knowledge-clear type="button">清空条件</button></div><section><span>一级分类</span><p>${categories.map(item => `<button data-knowledge-category="${escapeHtml(item)}" class="${item === state.knowledgeCategory ? 'is-selected' : ''}" type="button">${escapeHtml(item)}</button>`).join('')}</p></section><section><span>二级主题</span><p>${subcategories.map(item => `<button data-knowledge-subcategory="${escapeHtml(item)}" class="${item === state.knowledgeSubcategory ? 'is-selected' : ''}" type="button">${escapeHtml(item)}</button>`).join('')}</p></section></div>` : '';
  return `<section class="knowledge-shell"><header class="knowledge-heading"><div><h1>猫猫知识</h1><span>校园流浪猫救助与运营知识手册</span></div><div class="knowledge-heading-stamp"><b>知识在流转</b><span>善意在延续</span></div></header><div class="knowledge-toolbar"><label class="knowledge-search"><span>⌕</span><input id="knowledgeSearch" type="search" value="${escapeHtml(state.knowledgeQuery)}" placeholder="搜索文章 / 关键词"></label><div class="knowledge-actions"><div class="knowledge-views" aria-label="视图切换">${viewButtons}</div><button id="knowledgeFilterToggle" class="knowledge-filter-btn${hasFilter ? ' has-filter' : ''}" type="button">筛选${hasFilter ? ' · 已选' : ''}</button>${filterPanel}</div></div><p class="knowledge-result-count">共 <strong>${posts.length}</strong> 篇条目</p><div class="knowledge-archive-layout"><main class="knowledge-results view-${view}">${cards || '<p class="knowledge-empty">没有找到匹配的文章。</p>'}</main><aside class="knowledge-archive-aside"><section class="knowledge-aside-card knowledge-filter-summary"><p>⌕ 当前检索条件</p><ul><li>一级分类：${escapeHtml(filterSummary[0])}</li><li>二级主题：${escapeHtml(filterSummary[1])}</li><li>关键词：${escapeHtml(filterSummary[2])}</li></ul>${hasFilter || state.knowledgeQuery ? '<button data-knowledge-clear type="button">清空条件</button>' : ''}</section><section class="knowledge-aside-card"><p>▣ 分类索引</p><ol>${categories.map((category, index) => `<li><span>0${index + 1}</span>${escapeHtml(category)}<small>${knowledgePosts.filter(post => post.category === category).length} 篇</small></li>`).join('')}</ol></section><section class="knowledge-aside-card knowledge-tip-card"><p>检索小贴士</p><span>支持通过关键词、主题组合检索；输入“疫苗”即可找到疫苗接种相关的文章。</span></section></aside></div></section>`;
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
  const haystack = [post.title, post.description, post.category, post.subcategory].join(' ').toLowerCase();
  return (!query || haystack.includes(query)) && (!state.knowledgeCategory || post.category === state.knowledgeCategory) && (!state.knowledgeSubcategory || post.subcategory === state.knowledgeSubcategory);
}

function renderKnowledgeCard(post) {
  return `<button class="knowledge-card" data-knowledge-slug="${escapeHtml(post.slug)}" type="button"><p class="knowledge-card-meta">${escapeHtml(post.subcategory)} · ${new Date(post.publishedAt).toLocaleDateString('zh-CN')}</p><h2>${escapeHtml(post.title)}</h2><p>${escapeHtml(post.description)}</p></button>`;
}

function renderKnowledgeListRow(post) {
  return `<button class="knowledge-list-row" data-knowledge-slug="${escapeHtml(post.slug)}" type="button"><div><p class="knowledge-card-meta">${escapeHtml(post.category)} / ${escapeHtml(post.subcategory)}</p><h2>${escapeHtml(post.title)}</h2><p>${escapeHtml(post.description)}</p></div><span>${new Date(post.publishedAt).toLocaleDateString('zh-CN')} →</span></button>`;
}

function renderKnowledgeArchiveGroup(group, index) {
  return `<section class="knowledge-archive-group"><header><div><span>${knowledgeCategoryIcon(group.category)} 0${index + 1}</span><h2>${escapeHtml(group.category)}</h2></div><small>共 ${group.posts.length} 篇</small></header><div class="knowledge-archive-table-head"><span>文章标题</span><span>日期</span><span>二级主题</span></div>${group.posts.map(post => `<button class="knowledge-archive-row" data-knowledge-slug="${escapeHtml(post.slug)}" type="button"><div><h3>${escapeHtml(post.title)}</h3><p>${escapeHtml(post.description)}</p></div><time>${new Date(post.publishedAt).toLocaleDateString('zh-CN')}</time><span>${escapeHtml(post.subcategory)}</span></button>`).join('')}</section>`;
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

function bindKnowledgeControls(renderApp) {
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

export { renderScienceTab, bindKnowledgeControls, bindKnowledgeToc };
