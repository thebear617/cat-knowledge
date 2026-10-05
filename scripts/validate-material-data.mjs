#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const { catProfiles } = await import(`${new URL('../js/cats.js', import.meta.url).href}?t=${Date.now()}`);
const errors = [];
let materialCount = 0;
let postcardCount = 0;

function validDate(value) {
  if (value === '待补充') return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

for (const cat of catProfiles) {
  if (!Array.isArray(cat.images)) {
    errors.push(`${cat.name}.images 不是数组`);
    continue;
  }
  cat.images.forEach((material, index) => {
    materialCount += 1;
    const prefix = `${cat.name}.images[${index}]`;
    if (!material || typeof material !== 'object' || Array.isArray(material)) {
      errors.push(`${prefix} 必须是素材记录对象`);
      return;
    }
    if (!String(material.src || '').trim()) errors.push(`${prefix}.src 不能为空`);
    if (typeof material.isPostcard !== 'boolean') errors.push(`${prefix}.isPostcard 必须是布尔值`);
    const localPath = String(material.src || '').replace(/^\/+/, '');
    if (localPath.startsWith('http')) {
      errors.push(`${prefix}.src 必须是本地图片路径`);
      return;
    }

    const sourcePath = path.join(ROOT, 'public', localPath);
    const imageDirectory = path.dirname(localPath);
    const imageName = path.basename(localPath);
    if (!fs.existsSync(sourcePath)) errors.push(`${prefix}.src 对应的图片不存在：${localPath}`);
    for (const variant of ['preview', 'thumb']) {
      const variantPath = path.join(ROOT, 'public', imageDirectory, variant, imageName);
      if (!fs.existsSync(variantPath)) errors.push(`${prefix}.src 对应的${variant}图片不存在：${path.join(imageDirectory, variant, imageName)}`);
    }

    if (!material.isPostcard) return;
    postcardCount += 1;
    if (!String(material.author || '').trim()) errors.push(`${prefix}.author 是明信片素材必填项`);
    if (!validDate(String(material.photographedAt || '').trim())) {
      errors.push(`${prefix}.photographedAt 必须使用有效的 YYYY-MM-DD 日期或“待补充”`);
    }
  });
}

if (errors.length) {
  console.error(errors.map(error => `✗ ${error}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`✓ 素材校验通过：${catProfiles.length} 个档案，${materialCount} 张素材，${postcardCount} 张明信片。`);
}
