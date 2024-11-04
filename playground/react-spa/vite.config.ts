import { cloudflare } from '@flarelabs-net/vite-plugin-cloudflare';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		react(),
		// cloudflare({
		// 	workers: {
		// 		worker: {
		// 			main: './src/index.ts',
		// 			wranglerConfig: './src/wrangler.toml',
		// 		},
		// 	},
		// 	entryWorker: 'worker',
		// 	persistTo: false,
		// }),
	],
});
