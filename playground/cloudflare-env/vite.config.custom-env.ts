import { cloudflare } from '@flarelabs-net/vite-plugin-cloudflare';
import { defineConfig } from 'vite';

export default defineConfig(() => {
	process.env = { ...process.env, CLOUDFLARE_ENV: 'custom-env' };

	return {
		plugins: [cloudflare({ persistState: false })],
	};
});
