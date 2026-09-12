#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const MANIFEST_INPUT = path.join(ROOT, 'data/meowzart-local-image-manifest.json');
const PUBLIC_ROOT = path.join(ROOT, 'public');

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function resizeImage(sourcePath, targetPath) {
  return new Promise((resolve, reject) => {
    const process = spawn('sips', ['-Z', '400', sourcePath, '--out', targetPath], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    process.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    process.on('error', reject);
    process.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `sips exited with code ${code}`));
    });
  });
}

async function main() {
  const manifest = JSON.parse(await fs.readFile(MANIFEST_INPUT, 'utf8'));
  const imagePaths = [...new Set(Object.values(manifest).flat())];
  let generatedCount = 0;
  let skippedCount = 0;
  let missingSourceCount = 0;
  const failures = [];

  for (const relativePath of imagePaths) {
    const sourcePath = path.join(PUBLIC_ROOT, relativePath);
    if (!(await exists(sourcePath))) {
      missingSourceCount += 1;
      continue;
    }

    const targetPath = path.join(path.dirname(sourcePath), 'thumb', path.basename(sourcePath));
    if (await exists(targetPath)) {
      skippedCount += 1;
      continue;
    }

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    try {
      await resizeImage(sourcePath, targetPath);
      generatedCount += 1;
    } catch (error) {
      failures.push({ relativePath, error: error.message });
    }
  }

  console.log(JSON.stringify({
    sourceImageCount: imagePaths.length,
    generatedCount,
    skippedCount,
    missingSourceCount,
    failureCount: failures.length,
    failures,
  }, null, 2));

  if (missingSourceCount || failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`缩略图生成失败：${error.message}`);
  process.exitCode = 1;
});
