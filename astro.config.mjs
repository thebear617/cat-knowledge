import fs from 'node:fs/promises';
import path from 'node:path';
import { defineConfig } from 'astro/config';
import localCms from './src/admin/local-cms.mjs';

// GitHub Pages 部署时使用 SITE_BASE=/cat-knowledge/（在 deploy workflow 的 build step 注入）；
// 本地开发保持默认根路径，后台可直接访问 /admin/。
export default defineConfig({
  site: 'https://thebear617.github.io',
  base: process.env.SITE_BASE || '/',
  vite: { server: { strictPort: true }, plugins: [localCms()] },
  output: 'static',
  integrations: [{
    name: 'remove-local-cms-from-static-output',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        await fs.rm(path.join(dir.pathname, 'admin'), { recursive: true, force: true });
      },
    },
  }],
});
