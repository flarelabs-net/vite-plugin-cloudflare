import { cloudflare } from '@flarelabs-net/vite-plugin-cloudflare';
import { defineConfig } from 'vite';

export default defineConfig({
	dev: {
		optimizeDeps: {
			// Note: we want vite to pre-bundle this workspace dependency
			include: ['@cloudflare-dev-module-resolution/builtins/cjs'],
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
		}),
	],
});
