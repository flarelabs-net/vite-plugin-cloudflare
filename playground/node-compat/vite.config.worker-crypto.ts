import { cloudflare } from '@flarelabs-net/vite-plugin-cloudflare';
import { defineConfig } from 'vite';

export default defineConfig({
	build: {
		outDir: 'dist/worker-crypto',
	},
	plugins: [
		cloudflare({
			workers: {
				worker: {
					main: './worker-crypto/index.ts',
					compatibilityDate: '2024-11-06',
					compatibilityFlags: ['nodejs_compat'],
					wranglerConfig: './worker-crypto/wrangler.toml',
				},
			},
			entryWorker: 'worker',
			persistTo: false,
		}),
	],
});
