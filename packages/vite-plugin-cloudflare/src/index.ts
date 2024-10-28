import path from 'node:path';
import { createMiddleware } from '@hattip/adapter-node';
import MagicString from 'magic-string';
import { Miniflare } from 'miniflare';
import * as unenv from 'unenv';
import * as vite from 'vite';
import { unstable_getMiniflareWorkerOptions } from 'wrangler';
import {
	createCloudflareEnvironmentOptions,
	initRunners,
} from './cloudflare-environment';
import { getGlobalModuleContents, isNodeCompat } from './hybrid-nodejs-compat';
import { getMiniflareOptions } from './miniflare-options';
import { normalizePluginConfig } from './plugin-config';
import { invariant } from './shared';
import type { CloudflareDevEnvironment } from './cloudflare-environment';
import type { PluginConfig, WorkerOptions } from './plugin-config';

export type MiniflareOptions = ReturnType<
	typeof unstable_getMiniflareWorkerOptions
> & { main: string; overrides: vite.EnvironmentOptions };

export function cloudflare<T extends Record<string, WorkerOptions>>(
	pluginConfig: PluginConfig<T>,
): vite.Plugin {
	let viteConfig: vite.ResolvedConfig;
	const miniflareOptions = new Map<string, MiniflareOptions>();

	return {
		name: 'vite-plugin-cloudflare',
		enforce: 'pre', // we need our transform to run ahead of the built-in esbuild transform
		config(viteConfig) {
			// Compute and cache all the Miniflare options
			miniflareOptions.clear();
			Object.entries(pluginConfig.workers).forEach(
				([name, rawWorkerOptions]) => {
					const wranglerConfigPath = path.resolve(
						viteConfig.root ?? '.',
						rawWorkerOptions.wranglerConfig ?? './wrangler.toml',
					);
					miniflareOptions.set(name, {
						...unstable_getMiniflareWorkerOptions(wranglerConfigPath),
						main: rawWorkerOptions.main,
						overrides: rawWorkerOptions.overrides ?? {},
					});
				},
			);

			// Ensure there is an environment for each worker
			const environments: Record<string, vite.EnvironmentOptions> = {};
			miniflareOptions.forEach(
				({ workerOptions, main, overrides }, name) =>
					(environments[name] = vite.mergeConfig(
						createCloudflareEnvironmentOptions(name, main, workerOptions),
						overrides,
					)),
			);

			return {
				appType: 'custom',
				environments,
				builder: {
					async buildApp(builder) {
						const environments = Object.keys(pluginConfig.workers).map(
							(name) => {
								const environment = builder.environments[name];
								invariant(environment, `${name} environment not found`);

								return environment;
							},
						);

						await Promise.all(
							environments.map((environment) => builder.build(environment)),
						);
					},
				},
			};
		},
		configResolved(resolvedConfig) {
			viteConfig = resolvedConfig;
		},
		transform(code, id, options) {
			const { workerOptions } =
				miniflareOptions.get(this.environment.name) ?? {};
			if (!workerOptions) {
				console.log('transform: no worker', id);
				return;
			}

			if (id !== Array.from(this.getModuleIds())[0]) {
				console.log('transform: not entry-point', id);
				// TODO: check whether there is a better way to only do this on entry-points
				return;
			}

			if (isNodeCompat(workerOptions)) {
				// Inject the node globals into the entry-point file
				const { inject } = unenv.env(unenv.nodeless, unenv.cloudflare);
				const statements = Object.entries(inject).map(getGlobalModuleContents);
				const modified = new MagicString(code);
				modified.prepend(statements.join('\n'));
				console.log('tranform: injected', id, statements);
				return {
					code: modified.toString(),
					map: modified.generateMap({ hires: 'boundary', source: id }),
				};
			}
		},
		async configureServer(viteDevServer) {
			const { normalizedPluginConfig, wranglerConfigPaths } =
				normalizePluginConfig(pluginConfig, viteConfig);

			let error: unknown;

			const miniflare = new Miniflare(
				getMiniflareOptions(normalizedPluginConfig, viteConfig, viteDevServer),
			);

			await initRunners(normalizedPluginConfig, miniflare, viteDevServer);

			viteDevServer.watcher.on('all', async (_, path) => {
				if (!wranglerConfigPaths.has(path)) {
					return;
				}

				try {
					await miniflare.setOptions(
						getMiniflareOptions(
							normalizedPluginConfig,
							viteConfig,
							viteDevServer,
						),
					);

					await initRunners(normalizedPluginConfig, miniflare, viteDevServer);

					error = undefined;
				} catch (err) {
					error = err;
				}
				viteDevServer.environments.client.hot.send({ type: 'full-reload' });
			});

			const entryWorker = pluginConfig.entryWorker;
			const middleware =
				entryWorker &&
				createMiddleware(
					(context) => {
						return (
							viteDevServer.environments[
								entryWorker
							] as CloudflareDevEnvironment
						).dispatchFetch(context.request);
					},
					{ alwaysCallNext: false },
				);

			return () => {
				viteDevServer.middlewares.use((req, res, next) => {
					if (error) {
						throw error;
					}

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
