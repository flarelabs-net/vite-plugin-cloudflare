import { env, nodeless, cloudflare } from 'unenv';
import { defineConfig } from 'tsup';
import { createRequire } from 'module';

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
		entry: getUnenvModules(),
		outDir: 'dist/unenv/runtime',
		platform: 'node',
		format: 'esm',
		splitting: false,
		outExtension: () => ({ js: '.mjs' }),
		noExternal: ['unenv'],
	},
]);

function getUnenvModules() {
	// We precompile the unenv modules into flat files so they can be
	// easily loaded into workerd
	const { alias, inject } = env(nodeless, cloudflare);
	const require = createRequire(import.meta.url);
	const unenvModules = Array.from(
		new Set([
			...Object.values(alias),
			...Object.values(inject).map((i) => (typeof i === 'string' ? i : i[1]!)),
		]),
	)
		.filter((entry) => entry.startsWith('unenv'))
		.map((entry) => require.resolve(entry).replace(/\.cjs$/, '.mjs'));
	return unenvModules;
}
