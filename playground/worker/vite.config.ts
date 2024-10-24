import { fileURLToPath } from 'node:url';
import { cloudflare } from '@flarelabs-net/vite-plugin-cloudflare';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		cloudflare({
			workers: {
				worker: {
					main: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
					wranglerConfig: './src/wrangler.toml',
				},
			},
			entryWorker: 'worker',
		}),
	],
});
