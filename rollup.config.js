
import alias from '@rollup/plugin-alias';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';
import { readFileSync } from 'fs';
import path from 'path';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: pkg.main,
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: pkg.exports['.'].import,
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: [
      alias({ entries: [{ find: '@', replacement: path.resolve(__dirname, 'src') }] }),
      resolve(),
      commonjs(),
      typescript(),
    ],
    external: Object.keys(pkg.dependencies),
  },
  {
    input: 'src/index.ts',
    output: [{ file: pkg.exports['.'].types, format: 'es' }],
    plugins: [dts(), alias({ entries: [{ find: '@', replacement: path.resolve(__dirname, 'src') }] })],
  },
];
