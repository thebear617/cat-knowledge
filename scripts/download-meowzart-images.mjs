#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const CANDIDATE_INPUT = path.join(ROOT, 'data/meowzart-cats-candidate.json');
const MANIFEST_OUTPUT = path.join(ROOT, 'data/meowzart-local-image-manifest.json');
const PUBLIC_IMAGE_ROOT = path.join(ROOT, 'public');

function safeDirectoryName(name, sourceId) {
  return (name || `未命名-${sourceId}`).replace(/[\\/:*?"<>|]/g, '_');
}

function extensionFrom(url, contentType) {
  const fromUrl = url.match(/\.([a-z0-9]+)(?:[?#].*)?$/i)?.[1]?.toLowerCase();
  if (fromUrl && ['avif', 'gif', 'jpeg', 'jpg', 'png', 'webp'].includes(fromUrl)) {
    return fromUrl === 'jpeg' ? 'jpg' : fromUrl;
  }
  const fromType = contentType?.split(';')[0]?.split('/')[1]?.toLowerCase();
  if (fromType === 'jpeg') return 'jpg';
  if (['avif', 'gif', 'jpg', 'png', 'webp'].includes(fromType)) return fromType;
  return 'jpg';
}

async function readManifest() {
  try {
    return JSON.parse(await fs.readFile(MANIFEST_OUTPUT, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

async function main() {
  const candidateReport = JSON.parse(await fs.readFile(CANDIDATE_INPUT, 'utf8'));
  const manifest = await readManifest();
  const failures = [];
  let downloadedCount = 0;
  let skippedCount = 0;
  let migratedCount = 0;

  for (const candidate of candidateReport.candidates ?? []) {
    const cat = candidate.cat;
    if (cat.images?.length) {
      for (const relativePath of cat.images) {
        const publicPath = path.join(PUBLIC_IMAGE_ROOT, relativePath);
        const legacyPath = path.join(ROOT, relativePath);
        try {
          await fs.access(publicPath);
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
          try {
            await fs.access(legacyPath);
            await fs.mkdir(path.dirname(publicPath), { recursive: true });
            await fs.copyFile(legacyPath, publicPath);
            migratedCount += 1;
          } catch (legacyError) {
            if (legacyError.code !== 'ENOENT') throw legacyError;
          }
        }
      }
      skippedCount += 1;
      continue;
    }

    const sourceImages = [...new Set((cat.sourceImages ?? []).filter((url) => /^https?:\/\//i.test(url)))].slice(0, 2);
    const targetDirectoryName = safeDirectoryName(cat.name, candidate.sourceId);
    const targetDirectory = path.join(PUBLIC_IMAGE_ROOT, 'images', targetDirectoryName);
    await fs.mkdir(targetDirectory, { recursive: true });
    const localPaths = [];

    for (let index = 0; index < sourceImages.length; index += 1) {
      const url = sourceImages[index];
      const basePath = path.join(targetDirectory, `api-${candidate.sourceId}-${index + 1}`);
      let extension = 'jpg';
      try {
        const response = await fetch(url, {
          headers: { 'user-agent': 'cats-site-readonly-image-import/1.0' },
          signal: AbortSignal.timeout(30000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const contentType = response.headers.get('content-type') ?? '';
        extension = extensionFrom(url, contentType);
        const targetPath = `${basePath}.${extension}`;
        await fs.writeFile(targetPath, Buffer.from(await response.arrayBuffer()));
        localPaths.push(path.posix.join('images', targetDirectoryName, path.basename(targetPath)));
        downloadedCount += 1;
      } catch (error) {
        failures.push({ sourceId: candidate.sourceId, name: cat.name, url, error: error.message });
      }
    }

    manifest[String(candidate.sourceId)] = localPaths;
  }

  await fs.writeFile(MANIFEST_OUTPUT, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    candidateWithoutLocalImages: (candidateReport.candidates ?? []).filter((candidate) => !candidate.cat.images?.length).length,
    downloadedCount,
    migratedFromLegacyRootCount: migratedCount,
    skippedExistingLocalImageCount: skippedCount,
    manifestCount: Object.keys(manifest).length,
    failureCount: failures.length,
    failures,
  }, null, 2));
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`图片下载失败：${error.message}`);
  process.exitCode = 1;
});
