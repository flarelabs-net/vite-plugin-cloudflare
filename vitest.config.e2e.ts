import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {
			'~utils': resolve(__dirname, './playground/__test-utils__'),
		},
	},
	test: {
		include: ['./playground/**/__tests__/**/*.spec.[tj]s'],
		setupFiles: ['./playground/vitestSetup.ts'],
		globalSetup: ['./playground/vitestGlobalSetup.ts'],
		reporters: 'dot',
		onConsoleLog: () => false,
	},
	publicDir: false,
});
