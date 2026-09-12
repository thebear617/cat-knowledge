#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_BASE_URL = 'https://api.meowzart.com';
const DEFAULT_OUTPUT = 'data/meowzart-api-export.json';
const DEFAULT_LIST_SIZE = 20;
const DEFAULT_CONTENT_SIZE = 20;
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_DELAY_MS = 150;
const DEFAULT_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 20_000;

function printHelp() {
  console.log(`只读导出小小喵扎特 API 数据。

用法：
  MEOWZART_TOKEN=... node scripts/export-meowzart.mjs
  node scripts/export-meowzart.mjs --token-file /path/to/西电猫猫爬虫.txt

选项：
  --token-file PATH       从已有 curl 文本中临时读取 Bearer token，不会写入输出
  --output PATH           输出 JSON，默认 ${DEFAULT_OUTPUT}
  --society-id ID         默认 649
  --list-size N           列表分页大小，默认 ${DEFAULT_LIST_SIZE}
  --content-size N        动态分页大小，默认 ${DEFAULT_CONTENT_SIZE}
  --concurrency N         详情/动态并发数，默认 ${DEFAULT_CONCURRENCY}
  --delay-ms N            请求间隔毫秒数，默认 ${DEFAULT_DELAY_MS}
  --skip-contents         只导出列表和详情，不请求动态
  --help                  显示帮助
`);
}

function parseArgs(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    output: DEFAULT_OUTPUT,
    societyId: '649',
    listSize: DEFAULT_LIST_SIZE,
    contentSize: DEFAULT_CONTENT_SIZE,
    concurrency: DEFAULT_CONCURRENCY,
    delayMs: DEFAULT_DELAY_MS,
    retries: DEFAULT_RETRIES,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    skipContents: false,
    tokenFile: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    if (arg === '--skip-contents') {
      options.skipContents = true;
      continue;
    }
    const match = arg.match(/^--([^=]+)(?:=(.*))?$/);
    if (!match) throw new Error(`无法识别参数：${arg}`);
    const key = match[1];
    const inlineValue = match[2];
    const value = inlineValue ?? argv[++index];
    if (value == null || value.startsWith('--')) {
      throw new Error(`参数 ${arg} 需要值`);
    }

    const keyMap = {
      'token-file': 'tokenFile',
      output: 'output',
      'society-id': 'societyId',
      'list-size': 'listSize',
      'content-size': 'contentSize',
      concurrency: 'concurrency',
      'delay-ms': 'delayMs',
      retries: 'retries',
      'timeout-ms': 'timeoutMs',
      'base-url': 'baseUrl',
    };
    const optionKey = keyMap[key];
    if (!optionKey) throw new Error(`无法识别参数：--${key}`);
    options[optionKey] = value;
  }

  for (const key of ['listSize', 'contentSize', 'concurrency', 'delayMs', 'retries', 'timeoutMs']) {
    options[key] = Number(options[key]);
    if (!Number.isInteger(options[key]) || options[key] < 0) {
      throw new Error(`参数 ${key} 必须是非负整数`);
    }
  }
  if (options.listSize === 0 || options.contentSize === 0 || options.concurrency === 0) {
    throw new Error('list-size、content-size、concurrency 必须大于 0');
  }

  return options;
}

async function readToken(options) {
  if (process.env.MEOWZART_TOKEN?.trim()) {
    return { token: process.env.MEOWZART_TOKEN.trim(), source: 'environment' };
  }
  if (!options.tokenFile) {
    throw new Error('未找到令牌。请设置 MEOWZART_TOKEN，或使用 --token-file 指向现有 curl 文本。');
  }
  const text = await fs.readFile(path.resolve(options.tokenFile), 'utf8');
  const match = text.match(/authorization:\s*Bearer\s+([^\s'"`]+)/i);
  if (!match) throw new Error(`文件中没有找到 authorization Bearer token：${options.tokenFile}`);
  return { token: match[1], source: 'token-file' };
}

function sleep(ms) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function buildHeaders(token) {
  return {
    accept: '*/*',
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    referer: 'https://servicewechat.com/wxa25510fbff03d79d/934/page-frame.html',
    'user-agent': 'Mozilla/5.0 MiniProgramEnv/Node.js',
    xweb_xhr: '1',
  };
}

function parseBody(text) {
  try {
    return { json: JSON.parse(text), rawText: null };
  } catch {
    return { json: null, rawText: text };
  }
}

async function requestJson(url, token, options, requestNumber) {
  let lastError = null;
  for (let attempt = 1; attempt <= options.retries + 1; attempt += 1) {
    await sleep(attempt === 1 ? options.delayMs : Math.min(options.delayMs * attempt, 2_000));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: buildHeaders(token),
        signal: controller.signal,
      });
      const text = await response.text();
      const parsed = parseBody(text);
      const record = {
        requestNumber,
        url,
        status: response.status,
        ok: response.ok,
        contentType: response.headers.get('content-type'),
        body: parsed.json,
      };
      if (parsed.rawText !== null) record.rawText = parsed.rawText;
      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
        return record;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error.name === 'AbortError' ? new Error(`请求超时（${options.timeoutMs}ms）`) : error;
    } finally {
      clearTimeout(timer);
    }
    if (attempt <= options.retries) {
      console.warn(`请求重试 ${attempt}/${options.retries}：${url}`);
    }
  }

  return {
    requestNumber,
    url,
    status: null,
    ok: false,
    contentType: null,
    body: null,
    error: lastError?.message ?? '未知请求错误',
  };
}

function isObject(value) {
  return value !== null && typeof value === 'object';
}

function looksLikePet(value) {
  if (!isObject(value) || Array.isArray(value)) return false;
  const keys = Object.keys(value).map((key) => key.toLowerCase());
  return keys.some((key) => ['id', 'petid', 'pet_id', 'catid', 'cat_id'].includes(key))
    && keys.some((key) => ['name', 'petname', 'pet_name', 'catname', 'cat_name', 'nickname', 'title'].includes(key));
}

function findCandidateArrays(value, depth = 0, key = '') {
  if (depth > 6 || !isObject(value)) return [];
  const candidates = [];
  if (Array.isArray(value)) {
    if (value.length && value.every((item) => isObject(item))) {
      const petScore = value.filter(looksLikePet).length;
      if (petScore > 0) candidates.push({ value, score: petScore * 100 + value.length, key });
    }
    for (const item of value) candidates.push(...findCandidateArrays(item, depth + 1, key));
    return candidates;
  }
  for (const [childKey, child] of Object.entries(value)) {
    if (Array.isArray(child)) {
      const objectCount = child.filter((item) => isObject(item)).length;
      const petScore = child.filter(looksLikePet).length;
      if (objectCount > 0) {
        const preferred = /list|items|records|pets|cats|rows|data/i.test(childKey) ? 30 : 0;
        candidates.push({ value: child, score: petScore * 100 + objectCount + preferred, key: childKey });
      }
    }
    candidates.push(...findCandidateArrays(child, depth + 1, childKey));
  }
  return candidates;
}

function extractListItems(body) {
  if (!body) return [];
  const candidates = findCandidateArrays(body);
  candidates.sort((a, b) => b.score - a.score || b.value.length - a.value.length);
  return candidates[0]?.value ?? [];
}

function pickFirst(value, keys) {
  if (!isObject(value)) return null;
  for (const key of keys) {
    if (value[key] !== undefined && value[key] !== null && value[key] !== '') return value[key];
  }
  const lowerKeys = new Map(Object.keys(value).map((key) => [key.toLowerCase(), key]));
  for (const key of keys) {
    const actualKey = lowerKeys.get(key.toLowerCase());
    if (actualKey && value[actualKey] !== undefined && value[actualKey] !== null && value[actualKey] !== '') {
      return value[actualKey];
    }
  }
  return null;
}

function extractPetId(item) {
  const id = pickFirst(item, ['id', 'petId', 'pet_id', 'catId', 'cat_id', 'entityId']);
  return id == null ? null : String(id);
}

function extractPetName(item) {
  const name = pickFirst(item, ['name', 'petName', 'pet_name', 'catName', 'cat_name', 'nickname', 'title']);
  return name == null ? null : String(name);
}

function extractContentItems(body) {
  if (!body) return [];
  const candidates = findCandidateArrays(body);
  candidates.sort((a, b) => b.value.length - a.value.length);
  return candidates[0]?.value ?? [];
}

function collectImageUrls(value, key = '', output = new Set()) {
  if (typeof value === 'string') {
    const isUrl = /^https?:\/\//i.test(value);
    const imageKey = /image|img|cover|avatar|photo|picture|pic|thumb/i.test(key);
    const imageExtension = /\.(?:avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i.test(value);
    if (isUrl && (imageKey || imageExtension)) output.add(value);
    return output;
  }
  if (Array.isArray(value)) {
    for (const child of value) collectImageUrls(child, key, output);
    return output;
  }
  if (isObject(value)) {
    for (const [childKey, child] of Object.entries(value)) collectImageUrls(child, childKey, output);
  }
  return output;
}

function makeUrl(baseUrl, pathname, params) {
  const url = new URL(pathname, `${baseUrl.replace(/\/$/, '')}/`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  return url.toString();
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function runWorker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
  return results;
}

async function fetchPaginatedContents(petId, token, options, requestCounter) {
  const pages = [];
  for (let start = 0; ; start += options.contentSize) {
    const url = makeUrl(options.baseUrl, '/api/v1/content/contents', {
      types: 'cat-line,article',
      tags: `:pet:${petId}`,
      start,
      size: options.contentSize,
      showLevel: 9,
      ord: 'record',
    });
    const response = await requestJson(url, token, options, requestCounter());
    pages.push(response);
    const items = extractContentItems(response.body);
    if (!response.ok || items.length < options.contentSize) break;
    if (pages.length > 100) {
      pages.push({ ok: false, error: '动态分页超过100页，已停止以避免异常循环。' });
      break;
    }
  }
  return pages;
}

function countSuccessful(records) {
  return records.filter((record) => record?.ok).length;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const tokenInfo = await readToken(options);
  const outputPath = path.resolve(options.output);
  const errors = [];
  let requestNumber = 0;
  const nextRequestNumber = () => {
    requestNumber += 1;
    return requestNumber;
  };

  console.log(`开始读取 societyId=${options.societyId} 的猫咪列表…`);
  const aggregationUrl = makeUrl(options.baseUrl, '/v1/aggregation/scene/society', {
    societyId: options.societyId,
    category: 'cat',
  });
  const aggregation = await requestJson(aggregationUrl, tokenInfo.token, options, nextRequestNumber());

  const listPages = [];
  const rawListItems = [];
  const seenPageSignatures = new Set();
  for (let start = 0; ; start += options.listSize) {
    const url = makeUrl(options.baseUrl, '/api/v1/pet/society/list', {
      societyId: options.societyId,
      color: '',
      start,
      size: options.listSize,
      status: '',
      category: '',
    });
    const response = await requestJson(url, tokenInfo.token, options, nextRequestNumber());
    const items = extractListItems(response.body);
    listPages.push({ ...response, extractedItemCount: items.length });
    rawListItems.push(...items);
    console.log(`列表 start=${start}: ${items.length} 条`);

    const signature = JSON.stringify(items.map((item) => extractPetId(item) ?? extractPetName(item)));
    if (seenPageSignatures.has(signature) && items.length > 0) {
      errors.push(`列表分页 start=${start} 返回了重复页面，已停止。`);
      break;
    }
    seenPageSignatures.add(signature);
    if (!response.ok || items.length < options.listSize) break;
    if (listPages.length > 100) {
      errors.push('列表分页超过100页，已停止以避免异常循环。');
      break;
    }
  }

  const petsById = new Map();
  for (const item of rawListItems) {
    const id = extractPetId(item);
    if (!id) {
      errors.push(`列表中有一条记录无法识别猫咪 ID：${extractPetName(item) ?? '未知猫名'}`);
      continue;
    }
    if (!petsById.has(id)) petsById.set(id, { id, listItem: item });
  }
  const petsToFetch = [...petsById.values()];
  console.log(`列表共发现 ${rawListItems.length} 条记录，去重后 ${petsToFetch.length} 个猫咪 ID。`);

  const pets = await mapWithConcurrency(petsToFetch, options.concurrency, async (pet) => {
    const detailUrl = makeUrl(options.baseUrl, `/api/v1/pet/${encodeURIComponent(pet.id)}`, {});
    const detail = await requestJson(detailUrl, tokenInfo.token, options, nextRequestNumber());
    const result = {
      id: pet.id,
      listItem: pet.listItem,
      nameFromList: extractPetName(pet.listItem),
      detail,
      imageUrls: [...collectImageUrls(pet.listItem), ...collectImageUrls(detail.body)],
    };
    if (!detail.ok) errors.push(`猫咪 ${pet.id} 详情请求失败：${detail.error ?? `HTTP ${detail.status}`}`);

    if (!options.skipContents) {
      result.contents = { pages: await fetchPaginatedContents(pet.id, tokenInfo.token, options, nextRequestNumber) };
      const contentRecords = result.contents.pages;
      for (const content of contentRecords) {
        for (const imageUrl of collectImageUrls(content.body)) result.imageUrls.push(imageUrl);
      }
      result.imageUrls = [...new Set(result.imageUrls)];
      if (contentRecords.some((record) => !record.ok)) {
        errors.push(`猫咪 ${pet.id} 的动态请求部分失败。`);
      }
    }
    console.log(`已完成 ${pet.id}${result.nameFromList ? `（${result.nameFromList}）` : ''}`);
    return result;
  });

  const contentPages = pets.flatMap((pet) => pet.contents?.pages ?? []);
  const detailRecords = pets.map((pet) => pet.detail);
  const exportData = {
    schema: 'meowzart-api-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    source: {
      baseUrl: options.baseUrl,
      societyId: options.societyId,
      category: 'cat',
      tokenSource: tokenInfo.source,
      tokenStored: false,
      listStartMode: 'offset-assumed-and-recorded',
      listPageSize: options.listSize,
      contentPageSize: options.contentSize,
      note: '这是 API 原始响应快照；imageUrls 只是从原始响应提取的便捷索引，图片未下载。',
    },
    summary: {
      listRawItemCount: rawListItems.length,
      uniquePetCount: pets.length,
      detailSuccessCount: countSuccessful(detailRecords),
      contentPageCount: options.skipContents ? 0 : contentPages.length,
      contentSuccessCount: options.skipContents ? 0 : countSuccessful(contentPages),
      imageUrlCount: new Set(pets.flatMap((pet) => pet.imageUrls)).size,
      requestCount: requestNumber,
      errorCount: errors.length,
    },
    aggregation,
    list: {
      pages: listPages,
      items: rawListItems,
    },
    pets,
    errors,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(exportData, null, 2)}\n`, 'utf8');
  console.log(`导出完成：${outputPath}`);
  console.log(JSON.stringify(exportData.summary, null, 2));
}

main().catch((error) => {
  console.error(`导出失败：${error.message}`);
  process.exitCode = 1;
});
