import fs from 'node:fs/promises';
import path from 'node:path';
import { defineConfig } from 'astro/config';
import localCms from './src/admin/local-cms.mjs';

export default defineConfig({
  site: 'https://thebear617.github.io',
  base: '/cat-knowledge',
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
