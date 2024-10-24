import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const timeout = process.env.PWDEBUG ? Infinity : process.env.CI ? 50000 : 30000;

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
		testTimeout: timeout,
		hookTimeout: timeout,
		reporters: 'dot',
		deps: {
			// Prevent Vitest from running the workspace packages in Vite's SSR runtime
			moduleDirectories: ['node_modules', 'packages'],
		},
		onConsoleLog(log) {
			if (
				log.match(
					/experimental|jit engine|emitted file|tailwind|The CJS build of Vite/i,
				)
			)
				return false;
		},
	},
	esbuild: {
		target: 'node18',
	},
	publicDir: false,
});
