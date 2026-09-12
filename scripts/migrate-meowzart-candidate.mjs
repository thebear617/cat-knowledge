#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const INPUT = path.join(ROOT, 'data/meowzart-cats-candidate.json');
const OUTPUT = path.join(ROOT, 'js/cats.js');

async function main() {
  const report = JSON.parse(await fs.readFile(INPUT, 'utf8'));
  const cats = [
    ...(report.candidates ?? []).map((candidate) => candidate.cat),
    ...(report.retainedWebsiteOnly ?? []),
  ];

  const names = cats.map((cat) => cat.name);
  const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index);
  if (duplicateNames.length) {
    throw new Error(`正式名称重复：${[...new Set(duplicateNames)].join('、')}`);
  }

  const sourceIds = cats.map((cat) => cat.sourceId).filter((sourceId) => sourceId !== null && sourceId !== undefined);
  const duplicateSourceIds = sourceIds.filter((sourceId, index) => sourceIds.indexOf(sourceId) !== index);
  if (duplicateSourceIds.length) {
    throw new Error(`sourceId 重复：${[...new Set(duplicateSourceIds)].join('、')}`);
  }

  const requiredFields = ['name', 'status', 'vaccine', 'sterilized', 'notes', 'area', 'gender', 'images'];
  const missingFields = cats.flatMap((cat) => requiredFields.filter((field) => !Object.hasOwn(cat, field)).map((field) => `${cat.name}.${field}`));
  if (missingFields.length) throw new Error(`缺少正式字段：${missingFields.join('、')}`);

  const content = `// 猫只档案主数据：由 data/meowzart-cats-candidate.json 迁移生成。\nexport const catProfiles = ${JSON.stringify(cats, null, 2)};\n`;
  await fs.writeFile(OUTPUT, content, 'utf8');

  console.log(JSON.stringify({
    output: path.relative(ROOT, OUTPUT),
    count: cats.length,
    apiCount: (report.candidates ?? []).length,
    retainedWebsiteOnlyCount: (report.retainedWebsiteOnly ?? []).length,
    duplicateNameCount: 0,
    duplicateSourceIdCount: 0,
  }, null, 2));
}

main().catch((error) => {
  console.error(`候选数据迁移失败：${error.message}`);
  process.exitCode = 1;
});
