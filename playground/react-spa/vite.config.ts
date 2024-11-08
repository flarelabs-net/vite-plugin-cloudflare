import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { cloudflare } from '@flarelabs-net/vite-plugin-cloudflare';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		react(),
		cloudflare({
			workers: {},
			assets: {
				notFoundHandling: 'single-page-application',
			},
			persistTo: false,
		}),
	],
});
