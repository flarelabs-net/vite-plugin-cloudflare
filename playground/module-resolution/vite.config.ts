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
			// let's externalize this unconfigured alias just to make the build command pass
			external: ['@alias/unconfigured'],
		},
	},
	plugins: [
		cloudflare({
			workers: {
				worker: {
					main: './src/index.ts',
					wranglerConfig: './src/wrangler.toml',
				},
			},
			entryWorker: 'worker',
			persistTo: false,
		}),
	],
});
