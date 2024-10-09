import { defineConfig } from 'tsup';

export default defineConfig([
	{
		entry: ['src/index.ts'],
		format: 'esm',
		platform: 'node',
		dts: true,
		outDir: 'dist',
		tsconfig: 'tsconfig.plugin.json',
	},
	{
		entry: ['src/runner/index.ts'],
		format: 'esm',
		platform: 'neutral',
		outDir: 'dist/runner',
		external: ['cloudflare:workers'],
		noExternal: ['vite/module-runner'],
		tsconfig: 'tsconfig.runner.json',
	},
	{
		entry: ['src/runner/workerd-custom-import.cts'],
		outDir: 'dist/runner',
		format: ['cjs'],
		platform: 'node',
		noExternal: [/.*/],
		tsconfig: 'tsconfig.workerd-custom-import.json',
	},
]);
