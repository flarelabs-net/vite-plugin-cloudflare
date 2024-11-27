import { cloudflare } from '@flarelabs-net/vite-plugin-cloudflare';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		cloudflare({
			workers: {
				worker: {
					main: './src/index.ts',
					compatibilityDate: '2024-11-06',
				},
			},
			entryWorker: 'worker',
			persistTo: false,
		}),
	],
});
