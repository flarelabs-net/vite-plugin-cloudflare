import assert from 'node:assert';
import { cloudflare } from '@flarelabs-net/vite-plugin-cloudflare';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		cloudflare({
			workers: {
				worker: {
					main: './src/index.ts',
					compatibilityDate: '2024-11-06',
					wranglerConfig: './src/wrangler.toml',
				},
			},
			entryWorker: 'worker',
			persistTo: false,
		}),
		{
			name: 'test-plugin',
			configureServer(viteDevServer) {
				const worker = viteDevServer.environments.worker;
				assert(worker, `'worker' environment not found`);

				return () => {
					viteDevServer.middlewares.use(async (req, res, next) => {
						worker.hot.send('server-event', 'server-event-data');
						worker.hot.on('client-event', (payload) => {
							worker.hot.send('client-event-received', payload);
						});
						next();
					});
				};
			},
		},
	],
});
