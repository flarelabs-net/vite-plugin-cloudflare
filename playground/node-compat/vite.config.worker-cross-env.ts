import { cloudflare } from '@flarelabs-net/vite-plugin-cloudflare';
import { defineConfig } from 'vite';

export default defineConfig({
	build: {
		outDir: 'dist/worker-cross-env',
	},
	plugins: [
		cloudflare({
			workers: {
				worker: {
					main: './worker-cross-env/index.ts',
					compatibilityDate: '2024-11-06',
					compatibilityFlags: ['nodejs_compat'],
					wranglerConfig: './worker-cross-env/wrangler.toml',
				},
			},
			entryWorker: 'worker',
			persistTo: false,
		}),
	],
});
