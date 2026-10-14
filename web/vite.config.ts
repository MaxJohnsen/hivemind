import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const root = import.meta.dirname;

// The approval card runs inside Claude and ChatGPT as a single HTML file, so its build
// inlines the script, the styles and every asset into card.html.
function singleFile(): Plugin {
  return {
    name: 'homing-single-file',
    enforce: 'post',
    generateBundle(_, bundle) {
      const html = Object.values(bundle).find((file) => file.fileName.endsWith('.html'));
      if (!html || html.type !== 'asset') return;
      let source = String(html.source);
      for (const file of Object.values(bundle)) {
        if (file.type === 'chunk') {
          const tag = new RegExp(`<script[^>]*src="[^"]*${file.fileName}"[^>]*></script>`);
          source = source.replace(tag, () => `<script type="module">${file.code}</script>`);
          delete bundle[file.fileName];
        } else if (file.fileName.endsWith('.css')) {
          const tag = new RegExp(`<link[^>]*href="[^"]*${file.fileName}"[^>]*>`);
          source = source.replace(tag, () => `<style>${file.source}</style>`);
          delete bundle[file.fileName];
        }
      }
      html.source = source;
    },
  };
}

export default defineConfig(({ mode }) => {
  const card = mode === 'card';
  return {
    root,
    plugins: [react(), tailwindcss(), ...(card ? [singleFile()] : [])],
    resolve: { alias: { '@': resolve(root, 'src') } },
    build: card
      ? {
          outDir: resolve(root, 'dist/card'),
          emptyOutDir: true,
          assetsInlineLimit: Number.MAX_SAFE_INTEGER,
          cssCodeSplit: false,
          rollupOptions: { input: resolve(root, 'card.html'), output: { codeSplitting: false } },
        }
      : {
          outDir: resolve(root, 'dist/app'),
          emptyOutDir: true,
          rollupOptions: { input: resolve(root, 'index.html') },
        },
  };
});
