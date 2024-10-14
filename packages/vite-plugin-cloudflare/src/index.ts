import * as vite from 'vite';
import { createMiddleware } from '@hattip/adapter-node';
import { Miniflare } from 'miniflare';
import {
	createCloudflareEnvironment,
	initRunners,
} from './cloudflare-environment';
import { getMiniflareOptions } from './miniflare-options';
import type { CloudflareDevEnvironment } from './cloudflare-environment';
import type { CloudflareEnvironmentOptions, PluginConfig } from './types';

export function cloudflare<
	T extends Record<string, CloudflareEnvironmentOptions>,
>(pluginConfig: PluginConfig<T>): vite.Plugin {
	let viteConfig: vite.ResolvedConfig;

	return {
		name: 'vite-plugin-cloudflare',
		config() {
			return {
				environments: Object.fromEntries(
					Object.entries(pluginConfig.workers).map(([name, options]) => {
						return [name, createCloudflareEnvironment(options)];
					}),
				),
			};
		},
		configResolved(resolvedConfig) {
			viteConfig = resolvedConfig;
		},
		async configureServer(viteDevServer) {
			const miniflare = new Miniflare(
				getMiniflareOptions(pluginConfig, viteConfig, viteDevServer),
			);

			const workerNames = Object.keys(pluginConfig.workers);

			await initRunners(workerNames, miniflare, viteDevServer);

			const middleware =
				pluginConfig.entryWorker &&
				createMiddleware(
					(context) => {
						return (
							viteDevServer.environments[
								pluginConfig.entryWorker as string
							] as CloudflareDevEnvironment
						).dispatchFetch(context.request);
					},
					{ alwaysCallNext: false },
				);

			return () => {
				viteDevServer.middlewares.use((req, res, next) => {
					req.url = req.originalUrl;

					if (!middleware) {
						next();
						return;
					}

					middleware(req, res, next);
				});
			};
		},
	};
}
