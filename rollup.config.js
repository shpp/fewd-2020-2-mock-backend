// plugin-node-resolve and plugin-commonjs are required for a rollup bundled project
// to resolve dependencies from node_modules. See the documentation for these plugins
// for more details.
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

// additional plugins
import nodePolyfills from 'rollup-plugin-node-polyfills';
import sizes from 'rollup-plugin-sizes';
import cleanup from 'rollup-plugin-cleanup';
import json from '@rollup/plugin-json';

// disabled, but keeping eye on:
// import { terser } from 'rollup-plugin-terser';
// import esbuild from 'rollup-plugin-esbuild';
// import dynamicImportVars from '@rollup/plugin-dynamic-import-vars';

// for exporting of "rollup-plugin-sizes" result to file
import { writeFileSync, mkdirSync, existsSync } from 'fs';

const resultFile = 'dist/index.mjs';

export default {
  input: 'src/index.ts',
  output: {
    exports: 'named',
    format: 'es',
    file: resultFile,
    preserveModules: false,
    sourcemap: true,
  },
  plugins: [
    cleanup(),
    sizes({
      details: false,
      report: function defaultReport(details) {
        const args = Object.assign({}, details);
        const distDir = resultFile.split('/')[0];
        existsSync(distDir) || mkdirSync(distDir);
        writeFileSync(resultFile + '.buildstats.json', JSON.stringify(args, undefined, 2));
      },
    }),

    typescript({ compilerOptions: { target: 'es2021' } }),
    commonjs({ transformMixedEsModules: true }),
    nodeResolve({ browser: true, exportConditions: ['default', 'module', 'import'] }),
    json(),
    nodePolyfills(),

    // unlucky:
    // esbuild({ experimentalBundling: true, minify: false, target: 'es2019' }),
    // terser(),
    // dynamicImportVars({ warnOnError: true }),
  ],
};
