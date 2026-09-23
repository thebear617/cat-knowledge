#!/usr/bin/env node
/**
 * 把照片相对路径追加进 js/cats.js 中对应猫的 `images` 数组，并同步该猫的 `photoUpdatedAt`。
 *
 * 用法：
 *   node scripts/append-cat-photo.mjs <猫名> <相对路径> [<相对路径>...] [--date YYYY-MM-DD]
 * 示例：
 *   node scripts/append-cat-photo.mjs 漂亮橘 images/漂亮橘/漂亮橘19.jpg
 *
 * 说明：
 * - 只改 `js/cats.js`，不碰图片；图片由 add-photo.sh 用 sips 生成。
 * - 按 `"name": "<猫名>"` 精确锚定条目，不会误命中别猫 relationships 里的同名引用。
 * - `photoUpdatedAt` 已存在则改日期；不存在则在条目末尾补一个（驱动「最近更新」排序）。
 * - 改完会自检：数组项数 vs 磁盘文件数，不一致会告警。
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATS_JS = path.join(ROOT, 'js', 'cats.js');

const argv = process.argv.slice(2);
const dateFlag = argv.indexOf('--date');
const dateArg = dateFlag >= 0 ? argv[dateFlag + 1] : null;
const dateValueIdx = dateFlag >= 0 ? dateFlag + 1 : -1;
const positional = argv.filter((arg, i) => !arg.startsWith('--') && i !== dateValueIdx);

const [catName, ...relPaths] = positional;

if (!catName || relPaths.length === 0) {
  console.error('用法: node scripts/append-cat-photo.mjs <猫名> <相对路径> [<相对路径>...] [--date YYYY-MM-DD]');
  process.exit(1);
}

const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const date = dateArg || today;

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let source = readFileSync(CATS_JS, 'utf8');

// 1. 定位该猫的顶层条目（字段缩进 4 空格，条目以 2 空格的 "}," 收尾）
const nameMatch = new RegExp(`^ {4}"name":\\s*"${escapeRegExp(catName)}",?[ \\t]*$`, 'm').exec(source);
if (!nameMatch) {
  console.error(`✗ js/cats.js 里找不到猫「${catName}」的条目。`);
  console.error('  新猫需要先手工建档（照抄同区域其它猫的字段结构），再重新运行。');
  process.exit(1);
}

const blockStart = nameMatch.index;
const tail = source.slice(blockStart);
const endMatch = /^ {2}\},?[ \t]*$/m.exec(tail);
if (!endMatch) {
  console.error(`✗ 定位到「${catName}」但找不到条目结尾，已放弃改动（文件未修改）。`);
  process.exit(1);
}
const blockEnd = blockStart + endMatch.index;

const before = source.slice(0, blockStart);
const after = source.slice(blockEnd);
const lines = source.slice(blockStart, blockEnd).replace(/\n$/, '').split('\n');

// 2. 改 images 数组
const multiIdx = lines.findIndex((line) => /^\s*"images":\s*\[\s*$/.test(line));
const singleIdx = lines.findIndex((line) => /^\s*"images":\s*\[.*\][ \t]*,?[ \t]*$/.test(line));

if (multiIdx >= 0) {
  const closeIdx = lines.findIndex((line, i) => i > multiIdx && /^\s*\],[ \t]*$/.test(line));
  if (closeIdx < 0) {
    console.error(`✗ 「${catName}」的 images 数组没有找到收尾的 "],"（文件未修改）。`);
    process.exit(1);
  }
  const keyIndent = lines[multiIdx].match(/^\s*/)[0];
  const itemIndent = `${keyIndent}  `;
  const items = lines
    .slice(multiIdx + 1, closeIdx)
    .map((line) => line.trim().replace(/,$/, ''))
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  for (const relPath of relPaths) {
    if (!items.includes(relPath)) items.push(relPath);
  }

  const rebuilt = items.map((item, i) => `${itemIndent}${JSON.stringify(item)}${i === items.length - 1 ? '' : ','}`);
  lines.splice(multiIdx + 1, closeIdx - multiIdx - 1, ...rebuilt);
} else if (singleIdx >= 0) {
  const line = lines[singleIdx];
  const keyIndent = line.match(/^\s*/)[0];
  const trailingComma = /,[ \t]*$/.test(line) ? ',' : '';
  const inner = line.match(/\[(.*)\]/)[1].trim();
  const items = inner ? JSON.parse(`[${inner}]`) : [];

  for (const relPath of relPaths) {
    if (!items.includes(relPath)) items.push(relPath);
  }

  lines.splice(
    singleIdx,
    1,
    `${keyIndent}"images": [`,
    ...items.map((item, i) => `${keyIndent}  ${JSON.stringify(item)}${i === items.length - 1 ? '' : ','}`),
    `${keyIndent}]${trailingComma}`,
  );
} else {
  console.error(`✗ 「${catName}」的条目里找不到 images 字段（文件未修改）。`);
  process.exit(1);
}

// 3. 同步 photoUpdatedAt
const updatedIdx = lines.findIndex((line) => /^\s*"photoUpdatedAt":/.test(line));
if (updatedIdx >= 0) {
  const indent = lines[updatedIdx].match(/^\s*/)[0];
  const comma = /,[ \t]*$/.test(lines[updatedIdx]) ? ',' : '';
  lines[updatedIdx] = `${indent}"photoUpdatedAt": "${date}"${comma}`;
} else {
  let last = lines.length - 1;
  while (last > 0 && lines[last].trim() === '') last -= 1;
  const indent = lines[last].match(/^\s*/)[0];
  if (!/,[ \t]*$/.test(lines[last])) lines[last] = `${lines[last].replace(/\s+$/, '')},`;
  lines.splice(last + 1, 0, `${indent}"photoUpdatedAt": "${date}"`);
}

writeFileSync(CATS_JS, `${before}${lines.join('\n')}\n${after}`);

// 4. 自检：数组项数 vs 磁盘文件数
const { catProfiles } = await import(`${pathToFileURL(CATS_JS).href}?t=${Date.now()}`);
const cat = catProfiles.find((item) => item.name === catName);
const imageDir = path.join(ROOT, 'public', 'images', catName);
const count = (dir) => {
  try {
    return readdirSync(dir).filter((file) => file.toLowerCase().endsWith('.jpg')).length;
  } catch {
    return 0;
  }
};

console.log(`✓ 已写入 js/cats.js：${catName}.images ${cat.images.length} 项，photoUpdatedAt = ${date}`);
for (const relPath of relPaths) console.log(`  + ${relPath}`);

const files = count(imageDir);
const thumbs = count(path.join(imageDir, 'thumb'));
if (files !== cat.images.length || thumbs !== cat.images.length) {
  console.warn(`⚠️  数量不一致：数组 ${cat.images.length} 项 / 原图 ${files} 个 / 缩略图 ${thumbs} 个，请人工核对。`);
} else {
  console.log(`✓ 数量一致：数组 ${cat.images.length} 项 = 原图 ${files} 个 = 缩略图 ${thumbs} 个`);
}
