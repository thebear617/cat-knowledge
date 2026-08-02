import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://thebear617.github.io',
  base: '/cat-knowledge',
  vite: { server: { strictPort: true } },
  output: 'static'
});
