import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'react/index': 'src/react/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: false,
  clean: true,
  // Strip whitespace from the 3 MB geometry chunk but keep identifiers readable.
  minifyWhitespace: true,
  minifySyntax: true,
  treeshake: true,
  target: 'es2020',
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  // Both entries share the core + data; keep it in one chunk so the
  // 2 MB geometry is never duplicated.
  splitting: true,
});
