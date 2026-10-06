import { catProfiles } from '../../../js/cats.js';
import inspirationNotes from '../../data/inspirations.json';
import { state } from './state.js';
import { escapeHtml, normalize } from './shared.js';

const BASE_URL = `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}`;
const SOURCE_NAME = 'XDU 猫猫';
const SOURCE_AVATAR = 'images/cat-archive-icon.png';
const CARD_VARIANTS = ['portrait-34', 'landscape-43', 'portrait-45'];
const SOUVENIR_VARIANTS = ['square-11', 'landscape-43', 'portrait-34', 'portrait-23'];
const GALLERY_VIEWS = [
  { id: 'souvenir', label: '猫猫素材' },
  { id: 'archive', label: '猫猫档案' },
  { id: 'inspiration', label: '猫猫灵感' }
];
const GALLERY_VIEW_IDS = GALLERY_VIEWS.map(view => view.id);
const MATERIAL_FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'postcard', label: '明信片' },
  { id: 'standard', label: '未分类' }
];
const MATERIAL_FILTER_IDS = MATERIAL_FILTERS.map(filter => filter.id);
const MATERIAL_VIEW_IDS = new Set(['souvenir']);
let galleryInspirationPasteCleanup = null;
let galleryRenderApp = null;
let inspirationRecords = Array.isArray(inspirationNotes) ? [...inspirationNotes] : [];
let inspirationSyncPromise = null;
let inspirationComposerOpen = null;

function setGalleryRenderApp(callback) {
  galleryRenderApp = callback;
}

function cdnUrl(path) {
  if (!path) return path;
  if (path.startsWith('http')) return path;
  const parts = path.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
  return `${BASE_URL}${parts}`;
}

function thumbnailPath(path) {
  if (!path || path.startsWith('http')) return path;
  return path.replace(/([^/]+)$/, 'thumb/$1');
}

function normalizeMaterial(image) {
  if (typeof image === 'string') {
    return {
      src: image,
      isPostcard: false,
      author: '',
      photographedAt: ''
    };
  }
  if (!image || typeof image !== 'object') return null;
  return {
    ...image,
    src: String(image.src || '').trim(),
    isPostcard: image.isPostcard === true,
    author: String(image.author || '').trim(),
    photographedAt: String(image.photographedAt || '').trim()
  };
}

function getLocalMaterialRecords(cat) {
  return Array.isArray(cat?.images)
    ? cat.images
      .map(normalizeMaterial)
      .filter(image => image?.src && !image.src.startsWith('http'))
    : [];
}

function getLocalImages(cat) {
  return getLocalMaterialRecords(cat).map(image => image.src);
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

function getActiveMaterialFilter() {
  return MATERIAL_FILTER_IDS.includes(state.galleryMaterialFilter)
    ? state.galleryMaterialFilter
    : 'all';
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

function getInspirationSearchHaystack(note) {
  return normalize([
    note.title,
    note.note,
    ...(Array.isArray(note.tags) ? note.tags : [])
  ].filter(Boolean).join(' '));
}

function getGalleryItems(view) {
  const query = normalize(state.query);
  if (view.id === 'inspiration') {
    return inspirationRecords
      .filter(note => !query || getInspirationSearchHaystack(note).includes(query))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .map(note => ({
        note,
        image: note.cover,
        variant: getStableVariant(note.id || note.title, SOUVENIR_VARIANTS)
      }));
  }

  const cats = catProfiles
    .filter(cat => getLocalImages(cat).length > 0)
    .filter(cat => !query || getSearchHaystack(cat).includes(query));

  if (MATERIAL_VIEW_IDS.has(view.id)) {
    const materialFilter = getActiveMaterialFilter();
    const shuffledItems = cats
      .flatMap(cat => {
        const materials = getLocalMaterialRecords(cat)
          .filter(material => materialFilter === 'all'
            || (materialFilter === 'postcard' ? material.isPostcard : !material.isPostcard));
        return materials.map((material, imageIndex, images) => ({
          cat,
          material,
          image: material.src,
          imageIndex,
          imageCount: images.length,
          order: getStableHash(`${view.id}:${cat.name}:${material.src}`),
          variant: getStableVariant(`${cat.name}:${material.src}`, SOUVENIR_VARIANTS)
        }));
      })
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

function getMaterialFilterCounts() {
  const query = normalize(state.query);
  const materials = catProfiles
    .filter(cat => !query || getSearchHaystack(cat).includes(query))
    .flatMap(cat => getLocalMaterialRecords(cat));
  return {
    all: materials.length,
    postcard: materials.filter(material => material.isPostcard).length,
    standard: materials.filter(material => !material.isPostcard).length
  };
}

async function syncInspirationRecords() {
  if (!import.meta.env.DEV) return;
  if (inspirationSyncPromise) return inspirationSyncPromise;
  inspirationSyncPromise = fetch('/admin/api/inspirations', { headers: { Accept: 'application/json' } })
    .then(response => {
      if (!response.ok) throw new Error(`灵感列表读取失败（${response.status}）`);
      return response.json();
    })
    .then(payload => {
      const nextRecords = Array.isArray(payload.inspirations) ? payload.inspirations : [];
      if (JSON.stringify(nextRecords) === JSON.stringify(inspirationRecords)) return;
      inspirationRecords = nextRecords;
      if (state.galleryView === 'inspiration') galleryRenderApp?.();
    })
    .catch(() => {
      // The bundled JSON remains a usable first paint when the local API is unavailable.
    })
    .finally(() => {
      inspirationSyncPromise = null;
    });
  return inspirationSyncPromise;
}

function renderGalleryCard(item, view) {
  if (view.id === 'inspiration') {
    const note = item.note || {};
    const title = String(note.title || '查看灵感笔记');
    const tags = Array.isArray(note.tags) ? note.tags.filter(Boolean).join(' · ') : '';
    const meta = [tags, note.createdAt].filter(Boolean).join(' · ');
    const isVideo = note.mediaType === 'video';
    const mediaClass = isVideo ? ' gallery-card--inspiration-video' : '';
    return `
      <button class="gallery-card gallery-card--${item.variant}${mediaClass} gallery-card--inspiration" type="button" data-inspiration-id="${escapeHtml(note.id || '')}" data-inspiration-cover="${escapeHtml(note.cover || '')}" data-inspiration-source-url="${escapeHtml(note.sourceUrl || '')}" data-inspiration-title="${escapeHtml(title)}" data-inspiration-tags="${escapeHtml(Array.isArray(note.tags) ? note.tags.join(', ') : '')}" data-inspiration-note="${escapeHtml(note.note || '')}" data-inspiration-media-type="${escapeHtml(note.mediaType || 'image')}" aria-label="查看${escapeHtml(title)}">
        <span class="gallery-card-media">
          <img src="${escapeHtml(cdnUrl(item.image))}" alt="${escapeHtml(title)}" loading="lazy">
          ${isVideo ? '<span class="gallery-card-media-badge" aria-label="视频笔记"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 9 6-9 6V6Z"></path></svg></span>' : ''}
        </span>
        <span class="gallery-card-body">
          <strong class="gallery-card-title">${escapeHtml(title)}</strong>
          ${meta ? `<span class="gallery-card-meta">${escapeHtml(meta)}</span>` : ''}
          ${note.note ? `<span class="gallery-card-note">${escapeHtml(note.note)}</span>` : ''}
        </span>
      </button>
    `;
  }

  const { cat, image, imageIndex = 0, variant } = item;
  if (MATERIAL_VIEW_IDS.has(view.id)) {
    const materialLabel = getActiveMaterialFilter() === 'postcard' ? '猫猫明信片' : '猫猫素材';
    return `
      <button class="cat-card gallery-card gallery-card--${variant} gallery-card--souvenir" type="button" data-cat-name="${escapeHtml(cat.name)}" data-material-index="${imageIndex}" aria-label="查看${escapeHtml(cat.name)}的${materialLabel}照片">
        <span class="gallery-card-media">
          <img src="${escapeHtml(cdnUrl(thumbnailPath(image)))}" alt="${escapeHtml(cat.name)}" loading="lazy" decoding="async">
        </span>
      </button>
    `;
  }

  const location = cat.area && cat.area !== '待补充' ? cat.area : '';
  const status = cat.status && cat.status !== '待补充' ? cat.status : '';
  const latestUpdate = view.id === 'diary' ? item.update : null;
  const title = view.id === 'diary'
    ? getUpdateTitle(latestUpdate, cat)
    : MATERIAL_VIEW_IDS.has(view.id)
      ? `${cat.name} · 猫猫素材`
      : view.id === 'archive'
        ? cat.name
        : getGalleryCardTitle(cat);
  const meta = view.id === 'diary'
    ? [cat.name, formatUpdateDate(latestUpdate?.date)].join(' · ')
    : MATERIAL_VIEW_IDS.has(view.id)
      ? [location || '校园记录', `照片 ${item.imageIndex + 1}/${item.imageCount}`].join(' · ')
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
        ${meta ? `<span class="gallery-card-meta">${escapeHtml(meta)}</span>` : ''}
        ${note ? `<span class="gallery-card-note">${escapeHtml(note)}</span>` : ''}
        <span class="gallery-card-author">
          <img src="${escapeHtml(cdnUrl(SOURCE_AVATAR))}" alt="">
          <span>${escapeHtml(SOURCE_NAME)}</span>
        </span>
      </span>
    </button>
  `;
}

function renderInspirationComposer() {
  if (!import.meta.env.DEV) return '';
  return `
    <div class="gallery-inspiration-modal" id="gallery-inspiration-modal" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-label="灵感笔记">
      <div class="gallery-inspiration-modal-backdrop" data-gallery-inspiration-close></div>
      <section class="gallery-inspiration-modal-card">
        <form class="gallery-inspiration-form" id="gallery-inspiration-form" autocomplete="off">
          <div class="gallery-inspiration-cover-field">
            <span>封面图 <small id="gallery-inspiration-cover-requirement">必填</small></span>
            <div class="gallery-inspiration-paste-target" id="gallery-inspiration-paste-target" tabindex="0" role="button" aria-label="粘贴封面图">
              <span id="gallery-inspiration-cover-prompt">选择文件 / Command+V</span>
              <input class="gallery-inspiration-file-input" id="gallery-inspiration-cover" type="file" accept="image/jpeg,image/png,image/webp,image/gif" aria-label="选择封面图" required>
            </div>
          </div>
          <label><span>标题 <small>必填</small></span><input id="gallery-inspiration-title" required placeholder="请输入标题"></label>
          <label><span>标签 <small>必填</small></span><input id="gallery-inspiration-tags" autocomplete="off" required placeholder="多个标签用逗号分隔"></label>
          <label class="gallery-inspiration-full"><span>链接 <small>必填</small></span><input id="gallery-inspiration-source-url" autocomplete="off" type="url" required placeholder="https://..."><button class="gallery-inspiration-fetch-cover" id="gallery-inspiration-fetch-cover" type="button" disabled>从链接提取封面</button></label>
          <label class="gallery-inspiration-full"><span>备注</span><textarea id="gallery-inspiration-note" placeholder="可留空"></textarea></label>
          <footer class="gallery-inspiration-form-footer">
            <span class="gallery-inspiration-form-status" id="gallery-inspiration-status" aria-live="polite"></span>
            <div>
              <button class="gallery-inspiration-form-cancel" id="gallery-inspiration-cancel" type="button">取消</button>
              <button class="gallery-inspiration-form-save" id="gallery-inspiration-submit" type="submit">写入本地</button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  `;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result || '')));
    reader.addEventListener('error', () => reject(new Error('封面图读取失败')));
    reader.readAsDataURL(file);
  });
}

async function dataUrlToFile(dataUrl, fileName = 'xhs-cover.jpg') {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], fileName, { type: blob.type || 'image/jpeg', lastModified: Date.now() });
}

function isXhsSourceUrl(value) {
  return /^https?:\/\/(?:www\.)?(?:xiaohongshu\.com|xhslink\.com)(?:\/|$)/i.test(String(value || '').trim());
}

function getClipboardImageFile(event) {
  const clipboard = event.clipboardData;
  const file = Array.from(clipboard?.files || []).find(item => item.type.startsWith('image/'));
  if (file) return file;
  const item = Array.from(clipboard?.items || []).find(clipboardItem => clipboardItem.kind === 'file' && clipboardItem.type.startsWith('image/'));
  return item?.getAsFile() || null;
}

async function readClipboardImage() {
  if (!navigator.clipboard?.read) return null;
  try {
    const clipboardItems = await navigator.clipboard.read();
    for (const clipboardItem of clipboardItems) {
      const imageType = clipboardItem.types.find(type => type.startsWith('image/'));
      if (!imageType) continue;
      const blob = await clipboardItem.getType(imageType);
      const extension = imageType.split('/')[1].replace('jpeg', 'jpg');
      return new File([blob], `pasted-cover.${extension}`, { type: imageType, lastModified: Date.now() });
    }
  } catch {
    // Clipboard permission may be unavailable; the paste event path remains usable.
  }
  return null;
}

function bindGalleryControls() {
  document.querySelectorAll('button[data-gallery-material-filter]').forEach(button => {
    button.addEventListener('click', () => {
      const filter = button.dataset.galleryMaterialFilter;
      if (!MATERIAL_FILTER_IDS.includes(filter) || filter === getActiveMaterialFilter()) return;
      state.galleryView = 'souvenir';
      state.galleryMaterialFilter = filter;
      const url = new URL(window.location.href);
      url.searchParams.set('view', 'souvenir');
      if (filter === 'all') url.searchParams.delete('filter');
      else url.searchParams.set('filter', filter);
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      galleryRenderApp?.();
    });
  });

  const modal = document.getElementById('gallery-inspiration-modal');
  const openButton = document.getElementById('open-gallery-inspiration');
  if (!modal || !openButton) {
    galleryInspirationPasteCleanup?.();
    galleryInspirationPasteCleanup = null;
    inspirationComposerOpen = null;
    return;
  }
  if (modal.dataset.bound === 'true') return;
  modal.dataset.bound = 'true';

  const form = document.getElementById('gallery-inspiration-form');
  const cancelButton = document.getElementById('gallery-inspiration-cancel');
  const status = document.getElementById('gallery-inspiration-status');
  const coverInput = document.getElementById('gallery-inspiration-cover');
  const pasteTarget = document.getElementById('gallery-inspiration-paste-target');
  const coverRequirement = document.getElementById('gallery-inspiration-cover-requirement');
  const coverPrompt = document.getElementById('gallery-inspiration-cover-prompt');
  const sourceInput = document.getElementById('gallery-inspiration-source-url');
  const fetchCoverButton = document.getElementById('gallery-inspiration-fetch-cover');
  let pastedCoverFile = null;
  let composerMode = 'create';
  let editingId = '';
  let resolvedMediaType = 'image';
  const closeModal = () => {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    openButton.focus();
  };
  const openModal = (note = null) => {
    const editing = Boolean(note?.id);
    composerMode = editing ? 'edit' : 'create';
    editingId = editing ? String(note.id) : '';
    resolvedMediaType = editing ? String(note.mediaType || 'image') : 'image';
    form.reset();
    pastedCoverFile = null;
    coverInput.required = !editing;
    coverRequirement.textContent = editing ? '可选' : '必填';
    coverPrompt.textContent = editing ? '更换封面图 / Command+V' : '选择文件 / Command+V';
    document.getElementById('gallery-inspiration-title').value = editing ? String(note.title || '') : '';
    document.getElementById('gallery-inspiration-tags').value = Array.isArray(note.tags) ? note.tags.join(', ') : String(note.tags || '');
    document.getElementById('gallery-inspiration-source-url').value = editing ? String(note.sourceUrl || '') : '';
    document.getElementById('gallery-inspiration-note').value = editing ? String(note.note || '') : '';
    fetchCoverButton.disabled = !sourceInput.value.trim();
    document.getElementById('gallery-inspiration-submit').textContent = editing ? '保存修改' : '写入本地';
    status.textContent = editing ? '不更换封面图时，将保留当前封面' : '';
    status.dataset.kind = editing ? 'neutral' : '';
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    pasteTarget?.focus();
  };

  inspirationComposerOpen = openModal;

  openButton.addEventListener('click', openModal);
  cancelButton?.addEventListener('click', closeModal);
  modal.addEventListener('click', event => {
    if (event.target === modal || (event.target instanceof HTMLElement && event.target.hasAttribute('data-gallery-inspiration-close'))) closeModal();
  });
  modal.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !modal.hidden) closeModal();
  });
  const setCoverFile = file => {
    if (!file || !file.type.startsWith('image/')) return;
    pastedCoverFile = file;
    try {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      coverInput.files = transfer.files;
    } catch {
      // Some embedded browsers expose clipboard files but not DataTransfer.
    }
    status.textContent = '封面图已就绪';
    status.dataset.kind = 'success';
  };
  const fetchCoverFromSource = async () => {
    const sourceUrl = sourceInput.value.trim();
    if (!sourceUrl) {
      status.textContent = '请先填写链接';
      status.dataset.kind = 'error';
      sourceInput.focus();
      return null;
    }
    fetchCoverButton.disabled = true;
    status.textContent = '正在从链接提取封面…';
    status.dataset.kind = 'saving';
    try {
      const response = await fetch('/admin/api/inspirations/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceUrl })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || '封面提取失败');
      const file = await dataUrlToFile(result.coverDataUrl, result.mediaType === 'video' ? 'xhs-video-cover.jpg' : 'xhs-cover.jpg');
      setCoverFile(file);
      resolvedMediaType = result.mediaType === 'video' ? 'video' : 'image';
      const titleInput = document.getElementById('gallery-inspiration-title');
      if (!titleInput.value.trim() && result.title) titleInput.value = result.title;
      status.textContent = result.mediaType === 'video' ? '视频封面已提取' : '封面图已提取';
      status.dataset.kind = 'success';
      return file;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : '封面提取失败，请手动上传或粘贴';
      status.dataset.kind = 'error';
      return null;
    } finally {
      fetchCoverButton.disabled = !sourceInput.value.trim();
    }
  };
  const handlePaste = async event => {
    if (modal.hidden) return;
    const directFile = getClipboardImageFile(event);
    const hasImageItem = Array.from(event.clipboardData?.items || []).some(item => item.type.startsWith('image/'));
    const isPasteTarget = event.target === pasteTarget || pasteTarget?.contains(event.target);
    if (!directFile && !hasImageItem && !isPasteTarget) return;
    event.preventDefault();
    const file = directFile || await readClipboardImage();
    if (file) {
      setCoverFile(file);
    } else {
      status.textContent = '没有读取到图片，请使用“复制图片”或直接选择文件';
      status.dataset.kind = 'error';
    }
  };
  galleryInspirationPasteCleanup?.();
  document.addEventListener('paste', handlePaste, true);
  galleryInspirationPasteCleanup = () => document.removeEventListener('paste', handlePaste, true);
  pasteTarget?.addEventListener('click', event => {
    if (event.target !== coverInput) coverInput?.click();
    pasteTarget.focus();
  });
  pasteTarget?.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    coverInput?.click();
  });
  sourceInput?.addEventListener('input', () => {
    fetchCoverButton.disabled = !sourceInput.value.trim();
  });
  fetchCoverButton?.addEventListener('click', () => {
    void fetchCoverFromSource();
  });
  void syncInspirationRecords();
  coverInput?.addEventListener('change', () => {
    const file = coverInput.files?.[0];
    if (file) setCoverFile(file);
  });
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const sourceUrl = document.getElementById('gallery-inspiration-source-url').value.trim();
    let cover = coverInput?.files?.[0] || pastedCoverFile;
    if (composerMode === 'create' && !cover && isXhsSourceUrl(sourceUrl)) {
      cover = await fetchCoverFromSource();
    }
    if (composerMode === 'create' && !cover) {
      status.textContent = '请先选择或粘贴一张封面图';
      status.dataset.kind = 'error';
      pasteTarget?.focus();
      return;
    }
    const hadRequired = coverInput.required;
    if (pastedCoverFile && !coverInput.files?.length) coverInput.required = false;
    const isValid = form.reportValidity();
    coverInput.required = hadRequired;
    if (!isValid) return;
    const submitButton = document.getElementById('gallery-inspiration-submit');
    submitButton.disabled = true;
    status.textContent = composerMode === 'edit' ? '正在保存修改…' : '正在写入本地…';
    status.dataset.kind = 'saving';
    try {
      const payload = {
        title: document.getElementById('gallery-inspiration-title').value.trim(),
        tags: document.getElementById('gallery-inspiration-tags').value.trim(),
        sourceUrl,
        note: document.getElementById('gallery-inspiration-note').value.trim(),
        mediaType: resolvedMediaType,
      };
      if (cover) payload.coverDataUrl = await readFileAsDataUrl(cover);
      const response = await fetch(`/admin/api/inspirations${composerMode === 'edit' ? `?id=${encodeURIComponent(editingId)}` : ''}`, {
        method: composerMode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = Array.isArray(result.errors) ? result.errors.join('；') : result.error;
        throw new Error(message || '写入失败');
      }
      status.textContent = composerMode === 'edit' ? '已保存修改，正在更新列表…' : '已写入本地，正在更新列表…';
      status.dataset.kind = 'success';
      if (result.inspiration) {
        inspirationRecords = composerMode === 'edit'
          ? inspirationRecords.map(record => record.id === result.inspiration.id ? result.inspiration : record)
          : [result.inspiration, ...inspirationRecords.filter(record => record.id !== result.inspiration.id)];
        window.setTimeout(() => {
          closeModal();
          galleryRenderApp?.() || window.location.reload();
        }, 280);
      } else {
        window.setTimeout(() => {
          closeModal();
          window.location.reload();
        }, 280);
      }
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : '写入失败，请稍后再试';
      status.dataset.kind = 'error';
      submitButton.disabled = false;
    }
  });
}

function openInspirationEditor(note) {
  if (!inspirationComposerOpen) return false;
  inspirationComposerOpen(note);
  return true;
}

async function deleteInspirationRecord(note) {
  const id = String(note?.id || '').trim();
  if (!id) throw new Error('缺少灵感记录 id');
  const response = await fetch(`/admin/api/inspirations?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(result.errors) ? result.errors.join('；') : result.error;
    throw new Error(message || '删除失败');
  }
  inspirationRecords = inspirationRecords.filter(record => record.id !== id);
  galleryRenderApp?.();
  return result;
}

function renderGalleryTab() {
  const view = getActiveGalleryView();
  const items = getGalleryItems(view);
  const totalCats = catProfiles.filter(cat => getLocalImages(cat).length > 0).length;
  const materialFilter = view.id === 'souvenir' ? getActiveMaterialFilter() : 'all';
  const materialFilterCounts = view.id === 'souvenir' ? getMaterialFilterCounts() : null;
  const summary = state.query
    ? `找到 ${items.length} 条记录`
    : view.id === 'diary'
      ? `收录 ${items.length} 条日记`
      : view.id === 'souvenir'
        ? materialFilter === 'postcard'
          ? `收集 ${items.length} 张明信片`
          : materialFilter === 'standard'
          ? `收集 ${items.length} 张未分类素材`
            : `收集 ${items.length} 张照片`
        : view.id === 'inspiration'
          ? `收集 ${items.length} 条灵感`
          : `收录 ${totalCats} 个档案`;
  const emptyText = view.id === 'diary'
    ? '这些猫猫还没有可展示的日记'
    : view.id === 'souvenir' && materialFilter === 'postcard'
      ? '还没有标记为明信片的素材'
    : view.id === 'souvenir' && materialFilter === 'standard'
      ? '还没有未分类素材'
      : view.id === 'inspiration'
      ? '还没有收录灵感笔记'
      : '没有找到匹配的猫猫';
  const localInspirationAction = import.meta.env.DEV && view.id === 'inspiration'
    ? `<button class="gallery-inspiration-add gallery-inspiration-add--nav" id="open-gallery-inspiration" type="button"><span aria-hidden="true">＋</span> 新增笔记</button>`
    : '';
  const masonryClass = MATERIAL_VIEW_IDS.has(view.id)
    ? 'gallery-masonry gallery-masonry--souvenir'
    : view.id === 'inspiration'
      ? 'gallery-masonry gallery-masonry--inspiration'
      : 'gallery-masonry';
  const materialFilterNav = view.id === 'souvenir'
    ? `<div class="gallery-material-filter" role="group" aria-label="素材筛选">
        ${MATERIAL_FILTERS.map(filter => `<button type="button" data-gallery-material-filter="${filter.id}" class="${filter.id === materialFilter ? 'is-active' : ''}" aria-pressed="${filter.id === materialFilter ? 'true' : 'false'}"><span>${filter.label}</span><small>${materialFilterCounts[filter.id]}</small></button>`).join('')}
      </div>`
    : '';
  return `
    <section class="gallery-page" data-gallery-view="${escapeHtml(view.id)}">
      <header class="gallery-header">
        <div class="gallery-mobile-topbar">
          <div class="gallery-search-frame">
            <label class="gallery-search">
              <svg class="gallery-search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.7" cy="10.7" r="6.4"></circle><path d="m15.6 15.6 4.1 4.1"></path></svg>
              <input id="searchInput" type="search" value="${escapeHtml(state.query)}" placeholder="搜索猫名、地点或故事" autocomplete="off" aria-label="搜索猫名、地点或故事">
              <button id="searchBtn" type="button" aria-label="搜索"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.7" cy="10.7" r="6.4"></circle><path d="m15.6 15.6 4.1 4.1"></path></svg></button>
            </label>
            <div class="gallery-search-footer">
              <span class="gallery-header-divider" aria-hidden="true"></span>
              <span class="gallery-ai-chip"><span aria-hidden="true">◌</span> 猫猫档案 <em>AI</em></span>
              <span class="gallery-search-count">${escapeHtml(summary)}</span>
            </div>
          </div>
          <nav class="gallery-topic-nav" aria-label="小猫书视图">
            ${GALLERY_VIEWS.map(topic => `<button type="button" class="${topic.id === view.id ? 'is-active' : ''}" data-gallery-view="${escapeHtml(topic.id)}" aria-pressed="${topic.id === view.id ? 'true' : 'false'}">${escapeHtml(topic.label)}</button>`).join('')}
            ${localInspirationAction}
          </nav>
          <button class="gallery-mobile-search-toggle" id="galleryMobileSearchToggle" type="button" aria-label="打开搜索" aria-expanded="false">
            <svg class="gallery-mobile-search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.7" cy="10.7" r="6.4"></circle><path d="m15.6 15.6 4.1 4.1"></path></svg>
            <span class="gallery-mobile-search-label">取消</span>
          </button>
        </div>
        ${materialFilterNav}
      </header>
      ${items.length
        ? `<div class="${masonryClass}" aria-label="${escapeHtml(view.label)}瀑布流">${items.map(item => renderGalleryCard(item, view)).join('')}</div>`
        : `<div class="gallery-empty"><strong>${escapeHtml(emptyText)}</strong><span>换个名字、区域或关键词试试。</span></div>`}
      ${renderInspirationComposer()}
    </section>
  `;
}

export {
  GALLERY_VIEW_IDS,
  MATERIAL_FILTER_IDS,
  renderGalleryTab,
  bindGalleryControls,
  setGalleryRenderApp,
  openInspirationEditor,
  deleteInspirationRecord
};
