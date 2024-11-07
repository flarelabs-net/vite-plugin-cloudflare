import { resolve } from 'node:path';
import { cloudflare } from '@flarelabs-net/vite-plugin-cloudflare';
import { defineConfig } from 'vite';

export default defineConfig({
	resolve: {
		alias: {
			'@alias/test': resolve(__dirname, './src/aliasing.ts'),
		},
	},
	build: {
		rollupOptions: {
			// let's externalize this unregistered alias just to make the build command pass
			external: ['@alias/test-not-registered'],
		},
	},
	plugins: [
		cloudflare({
			workers: {
				worker: {
					main: './src/index.ts',
					wranglerConfig: './src/wrangler.toml',
					overrides: {
						dev: {
							optimizeDeps: {
								exclude: [
									'@cloudflare-dev-module-resolution/requires',
									'react',
								],
							},
						},
						resolve: {
							external: ['@cloudflare-dev-module-resolution/requires/ext'],
						},
					},
				},
			},
			entryWorker: 'worker',
			persistTo: false,
		}),
	],
});
