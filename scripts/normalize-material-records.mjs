#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const CATS_JS = path.join(ROOT, 'js', 'cats.js');

function normalizeMaterial(image) {
  if (typeof image === 'string') {
    return { src: image, isPostcard: false, author: '', photographedAt: '' };
  }
  return {
    ...image,
    src: String(image?.src || '').trim(),
    isPostcard: image?.isPostcard === true,
    author: String(image?.author || '').trim(),
    photographedAt: String(image?.photographedAt || '').trim(),
  };
}

function stringifyProfiles(profiles) {
  const json = JSON.stringify(profiles, null, 2);
  return json.replace(
    /^(\s*)\{\n\s*"src": (.*),\n\s*"isPostcard": (true|false),\n\s*"author": (.*),\n\s*"photographedAt": (.*)\n\1\}(,?)$/gm,
    '$1{ "src": $2, "isPostcard": $3, "author": $4, "photographedAt": $5 }$6',
  );
}

const { catProfiles } = await import(`${new URL('../js/cats.js', import.meta.url).href}?t=${Date.now()}`);
for (const cat of catProfiles) {
  cat.images = Array.isArray(cat.images) ? cat.images.map(normalizeMaterial) : [];
}

await fs.writeFile(
  CATS_JS,
  `// 猫只档案主数据：由 data/meowzart-cats-candidate.json 迁移生成。\nexport const catProfiles = ${stringifyProfiles(catProfiles)};\n`,
  'utf8',
);

const materialCount = catProfiles.reduce((sum, cat) => sum + cat.images.length, 0);
console.log(`✓ 已规范化 ${catProfiles.length} 个猫咪档案中的 ${materialCount} 条素材记录，默认 isPostcard=false。`);
