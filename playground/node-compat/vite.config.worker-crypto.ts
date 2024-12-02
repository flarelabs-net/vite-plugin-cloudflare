import { cloudflare } from '@flarelabs-net/vite-plugin-cloudflare';
import { defineConfig } from 'vite';

export default defineConfig({
	build: {
		outDir: 'dist/worker-crypto',
	},
	plugins: [cloudflare({ wranglerConfig: './worker-crypto/wrangler.toml' })],
});
