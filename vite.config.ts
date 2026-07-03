import { defineConfig } from 'vite';

// Dev: `vite` serves index.html (the demo harness).
// Build: `vite build` produces the tree-shakeable library (ESM), one file per entry.
export default defineConfig(({ command }) => {
  if (command === 'serve') {
    return {};
  }
  return {
    build: {
      lib: {
        entry: {
          index: 'src/index.ts',
          'single/select-lab': 'src/single/select-lab.ts',
          'multi/select-lab-multi': 'src/multi/select-lab-multi.ts',
          'core/base-select': 'src/core/base-select.ts',
        },
        formats: ['es'],
      },
      rollupOptions: {
        // consumers install lit / floating-ui themselves (keeps the lib lean)
        external: [/^lit/, /^@floating-ui/],
      },
    },
  };
});
