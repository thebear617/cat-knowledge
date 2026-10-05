#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { catProfiles } from '../js/cats.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const PUBLIC_ROOT = path.join(ROOT, 'public');
const PREVIEW_MAX_SIZE = 1200;
const FORCE_REBUILD = process.env.FORCE_PREVIEWS === '1';

function exists(filePath) {
  return fs.access(filePath).then(() => true).catch(error => {
    if (error.code === 'ENOENT') return false;
    throw error;
  });
}

function resizeImage(sourcePath, targetPath) {
  return new Promise((resolve, reject) => {
    const process = spawn('ffmpeg', [
      '-hide_banner',
      '-loglevel', 'error',
      '-y',
      '-i', sourcePath,
      '-vf', `scale=${PREVIEW_MAX_SIZE}:${PREVIEW_MAX_SIZE}:force_original_aspect_ratio=decrease`,
      '-q:v', '2',
      '-frames:v', '1',
      targetPath,
    ], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    process.stderr.on('data', chunk => {
      stderr += chunk;
    });
    process.on('error', reject);
    process.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `sips exited with code ${code}`));
    });
  });
}

const imagePaths = [...new Set(
  catProfiles.flatMap(cat => (Array.isArray(cat.images) ? cat.images : []))
    .map(image => typeof image === 'string' ? image : image?.src)
    .filter(source => source && !source.startsWith('http'))
)];

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

  const targetPath = path.join(path.dirname(sourcePath), 'preview', path.basename(sourcePath));
  if (!FORCE_REBUILD && await exists(targetPath)) {
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
