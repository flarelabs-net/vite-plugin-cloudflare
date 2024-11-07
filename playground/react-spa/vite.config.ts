import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { cloudflare } from '@flarelabs-net/vite-plugin-cloudflare';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		react(),
		{
			name: 'test-plugin',
			configureServer(viteDevServer) {
				const root = viteDevServer.config.root;

				return () => {
					viteDevServer.middlewares.use(async (req, res, next) => {
						console.log(req.url, req.originalUrl);
						// Clean url?
						const url = req.url;

						if (
							url?.endsWith('.html') &&
							req.headers['sec-fetch-dest'] !== 'script'
						) {
							const filePath = path.join(root, decodeURIComponent(url));

							if (fs.existsSync(filePath)) {
								// Add headers?
								try {
									let html = await fsp.readFile(filePath, 'utf-8');
									html = await viteDevServer.transformIndexHtml(url, html);

									res.end(html);
								} catch (error) {
									next();
								}
							}
						}
					});
				};
			},
		},
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
