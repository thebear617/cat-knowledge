import { catProfiles } from '../../../js/cats.js';
import { state } from './state.js';
import { escapeHtml, normalize } from './shared.js';

const BASE_URL = `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}`;
const SOURCE_NAME = 'XDU 猫猫群';
const SOURCE_AVATAR = 'images/cat-archive-icon.png';
const CARD_VARIANTS = ['portrait-34', 'landscape-43', 'portrait-45'];
const SOUVENIR_VARIANTS = ['square-11', 'landscape-43', 'portrait-34', 'portrait-23'];
const GALLERY_VIEWS = [
  { id: 'souvenir', label: '猫猫素材' },
  { id: 'archive', label: '猫猫档案' }
];
const GALLERY_VIEW_IDS = GALLERY_VIEWS.map(view => view.id);

function cdnUrl(path) {
  if (!path) return path;
  if (path.startsWith('http')) return path;
  const parts = path.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
  return `${BASE_URL}${parts}`;
}

function getLocalImages(cat) {
  return Array.isArray(cat.images)
    ? cat.images.filter(image => image && !image.startsWith('http'))
    : [];
}

function getGalleryTitle(cat) {
  const firstLine = String(cat.description || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(Boolean)
    ?.replace(/\s+/g, ' ');
  if (firstLine && firstLine.length <= 34) return firstLine;
  return `${cat.name}的校园日常`;
}

function getGalleryCardTitle(cat) {
  const title = getGalleryTitle(cat);
  return title.startsWith(cat.name) ? title : `${cat.name} · ${title}`;
}

function getUpdateTitle(update, cat) {
  const title = String(update?.title || '').trim().replace(/\s+/g, ' ');
  if (title) return title;
  const firstLine = String(update?.content || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(Boolean)
    ?.replace(/\s+/g, ' ');
  return firstLine ? `${cat.name}：${firstLine}` : `${cat.name}的近况记录`;
}

function formatUpdateDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : '近期记录';
}

function getStableHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getStableVariant(value, variants = CARD_VARIANTS) {
  return variants[getStableHash(value) % variants.length];
}

function getActiveGalleryView() {
  return GALLERY_VIEWS.find(view => view.id === state.galleryView) || GALLERY_VIEWS[0];
}

function getSearchHaystack(cat) {
  const updates = Array.isArray(cat.updates) ? cat.updates : [];
  return normalize([
    cat.name,
    cat.area,
    cat.status,
    cat.description,
    ...(Array.isArray(cat.personality) ? cat.personality : []),
    ...updates.flatMap(update => [update?.title, update?.content])
  ].filter(Boolean).join(' '));
}

function getGalleryItems(view) {
  const query = normalize(state.query);
  const cats = catProfiles
    .filter(cat => getLocalImages(cat).length > 0)
    .filter(cat => !query || getSearchHaystack(cat).includes(query));

  if (view.id === 'souvenir') {
    const shuffledItems = cats
      .flatMap(cat => getLocalImages(cat).map((image, imageIndex, images) => ({
        cat,
        image,
        imageIndex,
        imageCount: images.length,
        order: getStableHash(`souvenir:${cat.name}:${image}`),
        variant: getStableVariant(`${cat.name}:${image}`, SOUVENIR_VARIANTS)
      })))
      .sort((a, b) => a.order - b.order || a.cat.name.localeCompare(b.cat.name, 'zh-Hans-CN') || a.imageIndex - b.imageIndex);
    const items = [];

    // Stable-shuffle the full wall, then skip the previous cat whenever
    // possible so repeated photos do not form neighboring pairs.
    let previousCatName = '';
    while (shuffledItems.length) {
      const nextIndex = shuffledItems.findIndex(item => item.cat.name !== previousCatName);
      const [item] = shuffledItems.splice(nextIndex === -1 ? 0 : nextIndex, 1);
      items.push(item);
      previousCatName = item.cat.name;
    }
    return items;
  }

  if (view.id === 'diary') {
    return cats
      .flatMap(cat => (Array.isArray(cat.updates) ? cat.updates : []).map(update => ({
        cat,
        update,
        image: getLocalImages(cat)[0],
        variant: getStableVariant(`${cat.name}:${update?.sourceId || update?.date || update?.title}`)
      })))
      .sort((a, b) => String(b.update?.date || '').localeCompare(String(a.update?.date || '')));
  }

  return cats
    .sort((a, b) => String(b.photoUpdatedAt || '').localeCompare(String(a.photoUpdatedAt || '')) || a.name.localeCompare(b.name, 'zh-Hans-CN'))
    .map(cat => ({
      cat,
      image: getLocalImages(cat)[0],
      variant: getStableVariant(`${cat.name}:${getLocalImages(cat)[0]}`)
    }));
}

function renderGalleryCard(item, view) {
  const { cat, image, imageIndex = 0, variant } = item;
  if (view.id === 'souvenir') {
    return `
      <button class="cat-card gallery-card gallery-card--${variant} gallery-card--souvenir" type="button" data-cat-name="${escapeHtml(cat.name)}" data-material-index="${imageIndex}" aria-label="查看${escapeHtml(cat.name)}的猫猫素材照片">
        <span class="gallery-card-media">
          <img src="${escapeHtml(cdnUrl(image))}" alt="${escapeHtml(cat.name)}" loading="lazy">
        </span>
      </button>
    `;
  }

  const location = cat.area && cat.area !== '待补充' ? cat.area : '校园记录';
  const status = cat.status && cat.status !== '待补充' ? cat.status : '';
  const latestUpdate = view.id === 'diary' ? item.update : null;
  const title = view.id === 'diary'
    ? getUpdateTitle(latestUpdate, cat)
    : view.id === 'souvenir'
      ? `${cat.name} · 猫猫素材`
      : getGalleryCardTitle(cat);
  const meta = view.id === 'diary'
    ? [cat.name, formatUpdateDate(latestUpdate?.date)].join(' · ')
    : view.id === 'souvenir'
      ? [location, `照片 ${item.imageIndex + 1}/${item.imageCount}`].join(' · ')
      : [location, status].filter(Boolean).join(' · ');
  const note = view.id === 'diary'
    ? String(latestUpdate?.content || '').split(/\r?\n/).map(line => line.trim()).find(Boolean)?.replace(/\s+/g, ' ')
    : '';
  return `
    <button class="cat-card gallery-card gallery-card--${variant} gallery-card--${view.id}" type="button" data-cat-name="${escapeHtml(cat.name)}">
      <span class="gallery-card-media">
        <img src="${escapeHtml(cdnUrl(image))}" alt="${escapeHtml(cat.name)}" loading="lazy">
      </span>
      <span class="gallery-card-body">
        <strong class="gallery-card-title">${escapeHtml(title)}</strong>
        <span class="gallery-card-meta">${escapeHtml(meta)}</span>
        ${note ? `<span class="gallery-card-note">${escapeHtml(note)}</span>` : ''}
        <span class="gallery-card-author">
          <img src="${escapeHtml(cdnUrl(SOURCE_AVATAR))}" alt="">
          <span>${escapeHtml(SOURCE_NAME)}</span>
        </span>
      </span>
    </button>
  `;
}

function renderGalleryTab() {
  const view = getActiveGalleryView();
  const items = getGalleryItems(view);
  const totalCats = catProfiles.filter(cat => getLocalImages(cat).length > 0).length;
  const summary = state.query
    ? `找到 ${items.length} 条记录`
    : view.id === 'diary'
      ? `收录 ${items.length} 条日记`
      : view.id === 'souvenir'
        ? `收集 ${items.length} 张照片`
        : `收录 ${totalCats} 个档案`;
  const emptyText = view.id === 'diary' ? '这些猫猫还没有可展示的日记' : '没有找到匹配的猫猫';
  return `
    <section class="gallery-page" data-gallery-view="${escapeHtml(view.id)}">
      <header class="gallery-header">
        <div class="gallery-search-frame">
          <label class="gallery-search">
            <svg class="gallery-search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.7" cy="10.7" r="6.4"></circle><path d="m15.6 15.6 4.1 4.1"></path></svg>
            <input id="searchInput" type="search" value="${escapeHtml(state.query)}" placeholder="搜索猫名、地点或故事" autocomplete="off" aria-label="搜索猫名、地点或故事">
            <button id="searchBtn" type="button" aria-label="搜索"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.7" cy="10.7" r="6.4"></circle><path d="m15.6 15.6 4.1 4.1"></path></svg></button>
          </label>
          <div class="gallery-search-footer">
            <button class="gallery-header-action" type="button" aria-label="添加图集">＋</button>
            <span class="gallery-header-divider" aria-hidden="true"></span>
            <span class="gallery-ai-chip"><span aria-hidden="true">◌</span> 猫猫档案 <em>AI</em></span>
            <span class="gallery-search-count">${escapeHtml(summary)}</span>
          </div>
        </div>
        <nav class="gallery-topic-nav" aria-label="小猫书视图">
          ${GALLERY_VIEWS.map(topic => `<button type="button" class="${topic.id === view.id ? 'is-active' : ''}" data-gallery-view="${escapeHtml(topic.id)}" aria-pressed="${topic.id === view.id ? 'true' : 'false'}">${escapeHtml(topic.label)}</button>`).join('')}
        </nav>
      </header>
      ${items.length
        ? `<div class="gallery-masonry${view.id === 'souvenir' ? ' gallery-masonry--souvenir' : ''}" aria-label="${escapeHtml(view.label)}瀑布流">${items.map(item => renderGalleryCard(item, view)).join('')}</div>`
        : `<div class="gallery-empty"><strong>${escapeHtml(emptyText)}</strong><span>换个名字、区域或关键词试试。</span></div>`}
    </section>
  `;
}

export { GALLERY_VIEW_IDS, renderGalleryTab };
