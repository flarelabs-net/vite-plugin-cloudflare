import { cloudflare } from '@flarelabs-net/vite-plugin-cloudflare';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		cloudflare({
			workers: {
				worker: {
					main: './worker-cross-env/index.ts',
					wranglerConfig: './worker-cross-env/wrangler.toml',
				},
			},
			entryWorker: 'worker',
			persistTo: false,
		}),
	],
});
