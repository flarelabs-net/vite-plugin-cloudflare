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
					overrides: {
						// Note: this sets esbuild's platform to node, allowing it to accept
						//       imports such as module, node:module, buffer, node:buffer, etc...
						webCompatible: false,
					},
				},
			},
			entryWorker: 'worker',
		}),
	],
});
