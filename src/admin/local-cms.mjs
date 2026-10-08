import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import inspirationCategories from '../data/inspiration-categories.js';

const ROOT = process.env.CMS_CONTENT_ROOT
  ? path.resolve(process.env.CMS_CONTENT_ROOT)
  : path.resolve(process.cwd(), 'src/content/science');
const DEV_SERVER_LOCK = path.resolve(process.cwd(), '.astro', 'cats-dev-server.lock');
const INSPIRATION_DATA_FILE = path.resolve(process.cwd(), 'src/data/inspirations.json');
const INSPIRATION_ASSET_DIRECTORY = path.resolve(process.cwd(), 'public/images/gallery/inspiration');
const XHS_NOTE_SKILL_SCRIPT = process.env.XHS_NOTE_SKILL_SCRIPT
  ? path.resolve(process.env.XHS_NOTE_SKILL_SCRIPT)
  : path.join(os.homedir(), '.claude', 'skills', 'xhs-image-note', 'scripts', 'fetch_xhs_note.py');
const execFileAsync = promisify(execFile);
const FIELDS = ['title', 'description', 'publishedAt', 'category', 'subcategory', 'draft', 'updated', 'slug'];

function localDateValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function readDevServerLock() {
  try {
    return JSON.parse(fsSync.readFileSync(DEV_SERVER_LOCK, 'utf8'));
  } catch {
    return null;
  }
}

function isProcessRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function claimDevServerLock() {
  fsSync.mkdirSync(path.dirname(DEV_SERVER_LOCK), { recursive: true });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = fsSync.openSync(DEV_SERVER_LOCK, 'wx');
      try {
        fsSync.writeFileSync(handle, `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`);
      } finally {
        fsSync.closeSync(handle);
      }
      process.once('exit', () => {
        const owner = readDevServerLock();
        if (owner?.pid === process.pid) fsSync.rmSync(DEV_SERVER_LOCK, { force: true });
      });
      return;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const owner = readDevServerLock();
      if (owner?.pid === process.pid) return;
      if (isProcessRunning(owner?.pid)) {
        throw new Error(`猫猫手册开发服务已在运行（PID ${owner.pid}）。请复用现有服务，不要在同一项目启动第二个 Astro 开发服务。`);
      }
      fsSync.rmSync(DEV_SERVER_LOCK, { force: true });
    }
  }

  throw new Error('无法创建猫猫手册开发服务锁');
}

function usesIsolatedVerificationCache(server) {
  const serverRoot = typeof server.config?.root === 'string' ? path.resolve(server.config.root) : path.resolve(process.cwd());
  return process.env.CMS_ISOLATED_DEV === '1' && serverRoot !== path.resolve(process.cwd());
}

function safePath(value) {
  if (typeof value !== 'string' || !value.endsWith('.md')) return null;
  const normalized = value.replaceAll('\\', '/');
  if (normalized.includes('\0') || path.isAbsolute(normalized)) return null;
  const absolute = path.resolve(ROOT, normalized);
  if (!absolute.startsWith(`${ROOT}${path.sep}`)) return null;
  return absolute;
}

function trashDirectory() {
  return process.platform === 'darwin'
    ? path.join(os.homedir(), '.Trash')
    : path.join(os.homedir(), '.local', 'share', 'Trash', 'files');
}

async function moveToTrash(filePath) {
  if (process.platform === 'darwin') {
    const script = [
      'on run argv',
      '  set targetFile to POSIX file (item 1 of argv) as alias',
      '  tell application "Finder"',
      '    delete targetFile',
      '  end tell',
      'end run',
    ].join('\n');
    await execFileAsync('/usr/bin/osascript', ['-e', script, filePath]);
    return filePath;
  }

  const directory = trashDirectory();
  await fs.mkdir(directory, { recursive: true });
  const originalName = path.basename(filePath);
  const parsed = path.parse(originalName);
  let target = path.join(directory, originalName);
  let suffix = 1;
  while (true) {
    try {
      await fs.access(target);
      target = path.join(directory, `${parsed.name} (${suffix})${parsed.ext}`);
      suffix += 1;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      break;
    }
  }
  try {
    await fs.rename(filePath, target);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    await fs.copyFile(filePath, target);
    try {
      await fs.unlink(filePath);
    } catch (removeError) {
      await fs.rm(target, { force: true }).catch(() => {});
      throw removeError;
    }
  }
  return target;
}

function scalar(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).replace(/\\([\\"])/g, '$1');
  }
  if (trimmed === 'true' || trimmed === 'false') return trimmed === 'true';
  return trimmed;
}

function splitTopLevel(inner) {
  const items = [];
  let depth = 0;
  let quote = null;
  let current = '';
  for (const char of inner) {
    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === '[' || char === '{') {
      depth += 1;
      current += char;
      continue;
    }
    if (char === ']' || char === '}') {
      depth -= 1;
      current += char;
      continue;
    }
    if (char === ',' && depth === 0) {
      items.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) items.push(current);
  return items;
}

function parseInlineValue(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [];
    return splitTopLevel(inner).map((item) => scalar(item)).filter((item) => item !== '');
  }
  return scalar(value);
}

function parseMarkdown(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: source };
  const frontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (field) frontmatter[field[1]] = parseInlineValue(field[2]);
  }
  return { frontmatter, body: match[2] };
}

function yamlValue(value) {
  if (typeof value === 'boolean') return String(value);
  const text = String(value ?? '');
  // 日期保持无引号写法，与现有 frontmatter 风格一致。
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return JSON.stringify(text);
}

function isEmptyValue(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === 'boolean') return value === false;
  return String(value) === '';
}

function currentLocalDate() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function safeInspirationId(value) {
  const normalized = String(value || '').trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized.slice(0, 80) || `inspiration-${Date.now()}`;
}

async function readInspirations() {
  try {
    const source = await fs.readFile(INSPIRATION_DATA_FILE, 'utf8');
    const records = JSON.parse(source);
    return Array.isArray(records) ? records : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function saveInspirations(records) {
  await fs.mkdir(path.dirname(INSPIRATION_DATA_FILE), { recursive: true });
  await fs.writeFile(INSPIRATION_DATA_FILE, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
}

function decodeImageDataUrl(value) {
  const match = String(value || '').match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return null;
  const mime = match[1];
  const buffer = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
  if (!buffer.length || buffer.length > 12 * 1024 * 1024) return null;
  const extension = mime === 'image/jpeg' ? 'jpg' : mime.slice('image/'.length);
  return { buffer, extension };
}

function isXhsSourceUrl(value) {
  try {
    const hostname = new URL(String(value || '')).hostname.toLowerCase();
    return hostname === 'xiaohongshu.com'
      || hostname.endsWith('.xiaohongshu.com')
      || hostname === 'xhslink.com'
      || hostname.endsWith('.xhslink.com');
  } catch {
    return false;
  }
}

async function resolveXhsCover(sourceUrl) {
  try {
    await fs.access(XHS_NOTE_SKILL_SCRIPT);
  } catch {
    throw new Error('本机未找到小红书解析 skill，请保留手动上传或粘贴封面图');
  }

  const outputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'cats-xhs-cover-'));
  try {
    await execFileAsync('python3', [
      XHS_NOTE_SKILL_SCRIPT,
      sourceUrl,
      '--out',
      outputDirectory,
      '--cover-only'
    ], { timeout: 60000, maxBuffer: 2 * 1024 * 1024 });
    const metadata = JSON.parse(await fs.readFile(path.join(outputDirectory, 'meta.json'), 'utf8'));
    const imagePath = Array.isArray(metadata.image_paths) ? metadata.image_paths[0] : null;
    if (!imagePath) throw new Error('页面没有公开可用的封面图');
    const buffer = await fs.readFile(imagePath);
    if (!buffer.length || buffer.length > 12 * 1024 * 1024) throw new Error('封面图超过 12 MB');
    return {
      buffer,
      extension: 'jpg',
      mime: 'image/jpeg',
      title: String(metadata.title || '').trim(),
      mediaType: metadata.media_type === 'video' ? 'video' : 'image',
      coverUrl: String(metadata.cover_url || '').trim(),
    };
  } catch (error) {
    const detail = String(error?.stderr || error?.message || '').trim();
    throw new Error(detail ? `小红书封面提取失败：${detail}` : '小红书封面提取失败');
  } finally {
    await fs.rm(outputDirectory, { recursive: true, force: true }).catch(() => {});
  }
}

function getInspirationAssetPath(cover) {
  const prefix = 'images/gallery/inspiration/';
  const normalized = String(cover || '').replace(/^\/+/, '');
  const fileName = normalized.startsWith(prefix) ? normalized.slice(prefix.length) : '';
  if (!fileName || fileName.includes('/') || !/^[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp|gif)$/i.test(fileName)) return null;
  return path.join(INSPIRATION_ASSET_DIRECTORY, fileName);
}

function serializeMarkdown(frontmatter, body) {
  const lines = ['---'];
  for (const field of FIELDS) {
    const value = frontmatter[field];
    if (isEmptyValue(value)) continue;
    lines.push(`${field}: ${yamlValue(value)}`);
  }
  lines.push('---', '', String(body || '').replace(/^\n+/, ''));
  return `${lines.join('\n')}\n`;
}

function articleFilenameFromTitle(value) {
  const normalized = String(value || '')
    .trim()
    .replaceAll('\0', '')
    .replaceAll('/', '／')
    .replaceAll('\\', '＼')
    .replace(/\.md$/i, '')
    .trim();
  return normalized && normalized !== '.' && normalized !== '..' ? `${normalized}.md` : null;
}

function validate(frontmatter, articlePath) {
  const errors = [];
  if (!String(frontmatter.title || '').trim()) errors.push('title 不能为空');
  if (!String(frontmatter.description || '').trim()) errors.push('description 不能为空');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(frontmatter.publishedAt || ''))) errors.push('publishedAt 必须使用 YYYY-MM-DD');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(frontmatter.updated || ''))) errors.push('updated 必须使用 YYYY-MM-DD');
  if (!String(frontmatter.category || '').trim()) errors.push('category 不能为空');
  if (!String(frontmatter.subcategory || '').trim()) errors.push('subcategory 不能为空');
  if (!String(frontmatter.slug || '').trim()) errors.push('slug 不能为空');
  if (!safePath(articlePath)) errors.push('文章路径不在知识科普内容目录内');
  const normalizedPath = String(articlePath || '').replaceAll('\\', '/');
  const expected = articleFilenameFromTitle(frontmatter.title);
  if (!expected) errors.push('无法从标题生成文件名');
  else if (expected !== normalizedPath) errors.push('文件路径必须与标题对应（<标题>.md）');
  return errors;
}

async function walk(relative = '') {
  const directory = path.join(ROOT, relative);
  let entries = [];
  try { entries = await fs.readdir(directory, { withFileTypes: true }); } catch { return []; }
  const result = [];
  for (const entry of entries) {
    const next = path.join(relative, entry.name);
    if (entry.isDirectory()) result.push(...await walk(next));
    else if (entry.isFile() && entry.name.endsWith('.md')) {
      const articlePath = next.split(path.sep).join('/');
      const source = await fs.readFile(path.join(ROOT, articlePath), 'utf8');
      const { frontmatter } = parseMarkdown(source);
      result.push({ path: articlePath, title: frontmatter.title || entry.name.replace(/\.md$/, ''), ...frontmatter });
    }
  }
  return result;
}

function json(response, status, data) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(data));
}

async function readBody(request) {
  let raw = '';
  for await (const chunk of request) raw += chunk;
  return JSON.parse(raw || '{}');
}

function previewEscapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function previewInline(value) {
  return previewEscapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

// 与 src/scripts/app/knowledge.js 的 markdownToHtml 保持同一套语法
// （h1-h3 / 有序列表 / 无序列表 / 引用 / 行内代码 / 加粗），
// 仅额外注入 data-source-start/end，供 CMS 编辑器与预览双向定位。
function renderPreviewHtml(markdown) {
  const source = String(markdown || '');
  const leading = (source.match(/^\n*/)[0] || '').length;
  const body = source.trim();
  if (!body) return '';
  const lines = body.split('\n');
  const blocks = [];
  let current = null;
  lines.forEach((line, index) => {
    const lineNumber = index + 1 + leading;
    if (!line.trim()) {
      current = null;
      return;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const ordered = line.match(/^\d+\.\s+(.+)$/);
    const unordered = line.match(/^-\s+(.+)$/);
    const quote = line.match(/^>\s+(.+)$/);
    let type = 'p';
    let content = line;
    if (heading) { type = `h${heading[1].length}`; content = heading[2]; }
    else if (ordered) { type = 'ol'; content = ordered[1]; }
    else if (unordered) { type = 'ul'; content = unordered[1]; }
    else if (quote) { type = 'blockquote'; content = quote[1]; }
    if ((type === 'ul' || type === 'ol') && current && current.type === type) {
      current.end = lineNumber;
      current.items.push(content);
      return;
    }
    current = { type, start: lineNumber, end: lineNumber, items: [content] };
    blocks.push(current);
  });
  return blocks.map((block) => {
    const attrs = ` data-source-start="${block.start}" data-source-end="${block.end}"`;
    if (block.type === 'ul' || block.type === 'ol') {
      return `<${block.type}${attrs}>${block.items.map((item) => `<li>${previewInline(item)}</li>`).join('')}</${block.type}>`;
    }
    return `<${block.type}${attrs}>${previewInline(block.items[0])}</${block.type}>`;
  }).join('');
}

export default function localCms() {
  return {
    name: 'cats-local-cms',
    configureServer(server) {
      if (server.config.command === 'serve' && !server.config.server.middlewareMode && !usesIsolatedVerificationCache(server)) claimDevServerLock();

      // CMS writes trigger the dev server's content-change broadcast, which full-reloads the admin page itself.
      // Swallow update signals shortly after a self-write so saving does not refresh the editor.
      let lastSelfWriteAt = 0;
      const SUPPRESS_WINDOW_MS = 2500;
      const hot = server.hot || server.ws;
      if (hot) {
        const originalSend = hot.send.bind(hot);
        hot.send = (...args) => {
          const payload = typeof args[0] === 'string' ? { type: args[0] } : (args[0] || {});
          if ((payload.type === 'full-reload' || payload.type === 'update') && Date.now() - lastSelfWriteAt < SUPPRESS_WINDOW_MS) {
            console.log(`[local-cms] swallowed ${payload.type} broadcast caused by CMS save`);
            return;
          }
          return originalSend(...args);
        };
      }

      // Astro's dev HTML response currently omits the charset parameter. Keep
      // the CMS page explicitly UTF-8 even when Vite later sets its own type.
      // (Dev server runs at base "/", so the admin page lives at /admin.)
      const base = String(server.config.base || '/').replace(/\/?$/, '/');
     const adminPaths = new Set([`${base}admin`, `${base}admin/`]);
      server.middlewares.use(base + 'images/gallery/inspiration', async (request, response, next) => {
        if (request.method !== 'GET' && request.method !== 'HEAD') return next();
        let pathname = '/';
        try {
          pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
        } catch {
          return next();
        }
        const fileName = path.basename(pathname);
        if (!/^[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp|gif)$/i.test(fileName)) return next();
        try {
          const filePath = path.join(INSPIRATION_ASSET_DIRECTORY, fileName);
          const fileStat = await fs.stat(filePath);
          if (!fileStat.isFile()) return next();
          const content = await fs.readFile(filePath);
          const mime = fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')
            ? 'image/jpeg'
            : fileName.endsWith('.png')
              ? 'image/png'
              : fileName.endsWith('.webp')
                ? 'image/webp'
                : 'image/gif';
          response.statusCode = 200;
          response.setHeader('Content-Type', mime);
          response.setHeader('Content-Length', String(content.length));
          response.setHeader('Cache-Control', 'no-cache');
          return request.method === 'HEAD' ? response.end() : response.end(content);
        } catch (error) {
          if (error.code === 'ENOENT') return next();
          return next(error);
        }
      });
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url || '/', 'http://localhost').pathname;
        if (!adminPaths.has(pathname)) return next();

        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        const writeHead = response.writeHead;
        response.writeHead = function (...args) {
          const headersIndex = typeof args[1] === 'string' ? 2 : 1;
          if (args[headersIndex] && typeof args[headersIndex] === 'object') {
            args[headersIndex] = { ...args[headersIndex], 'Content-Type': 'text/html; charset=utf-8' };
          }
          this.setHeader('Content-Type', 'text/html; charset=utf-8');
          return writeHead.apply(this, args);
        };
        next();
      });

      server.middlewares.use('/admin/api', async (request, response) => {
        try {
          const url = new URL(request.url, 'http://localhost');
          if (request.method === 'GET' && url.pathname === '/inspirations') {
            return json(response, 200, { inspirations: await readInspirations() });
          }
          if (request.method === 'POST' && url.pathname === '/inspirations/resolve') {
            const data = await readBody(request);
            const sourceUrl = String(data.sourceUrl || '').trim();
            if (!isXhsSourceUrl(sourceUrl)) {
              return json(response, 400, { error: '目前只能从小红书链接自动提取封面，其他外链请手动上传或粘贴封面图' });
            }
            const resolved = await resolveXhsCover(sourceUrl);
            return json(response, 200, {
              ok: true,
              title: resolved.title,
              mediaType: resolved.mediaType,
              coverUrl: resolved.coverUrl,
              coverDataUrl: `data:${resolved.mime};base64,${resolved.buffer.toString('base64')}`,
            });
          }
          if (request.method === 'POST' && url.pathname === '/inspirations') {
            const data = await readBody(request);
            const title = String(data.title || '').trim();
            const sourceUrl = String(data.sourceUrl || '').trim();
            const createdAt = localDateValue();
            const note = String(data.note || '').trim();
            const category = String(data.category || '').trim();
            const subcategory = String(data.subcategory || '').trim();
            const mediaType = data.mediaType === 'video' ? 'video' : 'image';
            const errors = [];
            if (!title) errors.push('标题不能为空');
            if (!/^https?:\/\//i.test(sourceUrl)) errors.push('链接必须是 http(s) 链接');
            if (!inspirationCategories[category]) errors.push('一级分类无效');
            if (!inspirationCategories[category]?.includes(subcategory)) errors.push('二级分类无效');
            const image = decodeImageDataUrl(data.coverDataUrl);
            if (!image) errors.push('请选择一张不超过 12 MB 的 JPG、PNG、WebP 或 GIF 封面图');
            if (errors.length) return json(response, 400, { errors });

            const id = safeInspirationId(data.id || `inspiration-${Date.now()}`);
            const records = await readInspirations();
            if (records.some((record) => record.id === id)) return json(response, 409, { error: '这条灵感记录已经存在' });
            const fileName = `${id}.${image.extension}`;
            await fs.mkdir(INSPIRATION_ASSET_DIRECTORY, { recursive: true });
            await fs.writeFile(path.join(INSPIRATION_ASSET_DIRECTORY, fileName), image.buffer);
            const record = {
              id,
              cover: `images/gallery/inspiration/${fileName}`,
              sourceUrl,
              title,
              category,
              subcategory,
              note,
              mediaType,
              createdAt,
            };
            await saveInspirations([record, ...records]);
            lastSelfWriteAt = Date.now();
            return json(response, 200, { ok: true, inspiration: record });
          }
          if (request.method === 'PATCH' && url.pathname === '/inspirations') {
            const data = await readBody(request);
            const id = String(url.searchParams.get('id') || data.id || '').trim();
            const records = await readInspirations();
            const recordIndex = records.findIndex((record) => String(record.id || '') === id);
            if (!id) return json(response, 400, { errors: ['缺少灵感记录 id'] });
            if (recordIndex < 0) return json(response, 404, { error: '灵感记录不存在' });

            const current = records[recordIndex];
            const title = String(data.title || '').trim();
            const sourceUrl = String(data.sourceUrl || '').trim();
            const note = String(data.note || '').trim();
            const category = String(data.category || '').trim();
            const subcategory = String(data.subcategory || '').trim();
            const mediaType = data.mediaType === 'video' ? 'video' : data.mediaType === 'image' ? 'image' : (current?.mediaType || 'image');
            const image = data.coverDataUrl ? decodeImageDataUrl(data.coverDataUrl) : null;
            const errors = [];
            if (!title) errors.push('标题不能为空');
            if (!/^https?:\/\//i.test(sourceUrl)) errors.push('链接必须是 http(s) 链接');
            if (!inspirationCategories[category]) errors.push('一级分类无效');
            if (!inspirationCategories[category]?.includes(subcategory)) errors.push('二级分类无效');
            if (data.coverDataUrl && !image) errors.push('封面图必须是不超过 12 MB 的 JPG、PNG、WebP 或 GIF');
            if (errors.length) return json(response, 400, { errors });

            const { tags: _legacyTags, ...currentWithoutLegacyTags } = current;
            const nextRecord = {
              ...currentWithoutLegacyTags,
              title,
              category,
              subcategory,
              sourceUrl,
              note,
              mediaType,
            };
            let nextAssetPath = null;
            const previousAssetPath = getInspirationAssetPath(current.cover);
            if (image) {
              const fileName = `${safeInspirationId(current.id)}-${Date.now()}.${image.extension}`;
              nextAssetPath = path.join(INSPIRATION_ASSET_DIRECTORY, fileName);
              nextRecord.cover = `images/gallery/inspiration/${fileName}`;
              await fs.mkdir(INSPIRATION_ASSET_DIRECTORY, { recursive: true });
              await fs.writeFile(nextAssetPath, image.buffer);
            }

            const nextRecords = [...records];
            nextRecords[recordIndex] = nextRecord;
            try {
              await saveInspirations(nextRecords);
            } catch (error) {
              if (nextAssetPath) await fs.rm(nextAssetPath, { force: true }).catch(() => {});
              throw error;
            }

            if (nextAssetPath && previousAssetPath && previousAssetPath !== nextAssetPath) {
              await fs.rm(previousAssetPath, { force: true }).catch(() => {});
            }
            lastSelfWriteAt = Date.now();
            return json(response, 200, { ok: true, inspiration: nextRecord });
          }
          if (request.method === 'DELETE' && url.pathname === '/inspirations') {
            const id = String(url.searchParams.get('id') || '').trim();
            if (!id) return json(response, 400, { errors: ['缺少灵感记录 id'] });
            const records = await readInspirations();
            const record = records.find((item) => String(item.id || '') === id);
            if (!record) return json(response, 404, { error: '灵感记录不存在' });

            await saveInspirations(records.filter((item) => String(item.id || '') !== id));
            const assetPath = getInspirationAssetPath(record.cover);
            if (assetPath) await fs.rm(assetPath, { force: true }).catch(() => {});
            lastSelfWriteAt = Date.now();
            return json(response, 200, { ok: true, id });
          }
          if (request.method === 'GET' && url.pathname === '/articles') {
            const articles = await walk();
            return json(response, 200, { articles: articles.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN')) });
          }
          if (request.method === 'POST' && url.pathname === '/preview') {
            const data = await readBody(request);
            return json(response, 200, { html: renderPreviewHtml(data.body) });
          }
          const articlePath = url.searchParams.get('path');
          if (request.method === 'GET' && url.pathname === '/article' && safePath(articlePath)) {
            const source = await fs.readFile(safePath(articlePath), 'utf8');
            return json(response, 200, { path: articlePath, ...parseMarkdown(source) });
          }
          if (request.method === 'DELETE' && url.pathname === '/article' && safePath(articlePath)) {
            const absolutePath = safePath(articlePath);
            try {
              await fs.access(absolutePath);
            } catch (error) {
              if (error.code === 'ENOENT') return json(response, 404, { error: '文章不存在' });
              throw error;
            }
            await moveToTrash(absolutePath);
            lastSelfWriteAt = Date.now();
            return json(response, 200, { ok: true, path: articlePath });
          }
          if (request.method === 'POST' && url.pathname === '/article') {
            const data = await readBody(request);
            const target = safePath(data.path);
            const previous = data.previousPath ? safePath(data.previousPath) : null;
            if (data.previousPath && !previous) return json(response, 400, { error: '原文章路径不在知识科普内容目录内' });
            const frontmatter = { ...(data.frontmatter || {}), updated: currentLocalDate() };
            const errors = validate(frontmatter, data.path);
            if (errors.length) return json(response, 400, { errors });
            if (previous && previous !== target) {
              try {
                await fs.access(previous);
              } catch (error) {
                if (error.code === 'ENOENT') return json(response, 404, { error: '原文章不存在' });
                throw error;
              }
              try {
                await fs.access(target);
                return json(response, 409, { error: '目标路径已存在，请先更换文件路径' });
              } catch (error) {
                if (error.code !== 'ENOENT') throw error;
              }
              await fs.mkdir(path.dirname(target), { recursive: true });
              await fs.rename(previous, target);
            } else {
              await fs.mkdir(path.dirname(target), { recursive: true });
            }
            await fs.writeFile(target, serializeMarkdown(frontmatter, data.body || ''), 'utf8');
            lastSelfWriteAt = Date.now();
            return json(response, 200, { ok: true, path: data.path, frontmatter });
          }
          return json(response, 404, { error: 'Not found' });
        } catch (error) {
          return json(response, 400, { error: error.message });
        }
      });
    },
  };
}
