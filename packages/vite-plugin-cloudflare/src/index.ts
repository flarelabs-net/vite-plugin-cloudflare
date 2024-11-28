import * as fs from 'node:fs';
import path from 'node:path';
import { createMiddleware } from '@hattip/adapter-node';
import { Miniflare } from 'miniflare';
import * as vite from 'vite';
import { getRouterWorker } from './assets';
import {
	createCloudflareEnvironmentOptions,
	initRunners,
} from './cloudflare-environment';
import {
	getDevMiniflareOptions,
	getPreviewMiniflareOptions,
} from './miniflare-options';
import {
	getNodeCompatAliases,
	injectGlobalCode,
	resolveNodeAliases,
} from './node-js-compat';
import { normalizePluginConfig } from './plugin-config';
import { invariant } from './shared';
import { toMiniflareRequest } from './utils';
import type {
	NormalizedPluginConfig,
	PluginConfig,
	WorkerOptions,
} from './plugin-config';
import type { RawConfig } from 'wrangler';

// This is temporary
let hasClientEnvironment = false;

export function cloudflare<T extends Record<string, WorkerOptions>>(
	pluginConfig: PluginConfig<T>,
): vite.Plugin {
	let mode: string | undefined;
	let viteConfig: vite.ResolvedConfig;
	let normalizedPluginConfig: NormalizedPluginConfig;

	return {
		name: 'vite-plugin-cloudflare',
		config(userConfig) {
			// We use the mode from the user config rather than the resolved config for now so that the mode has to be set explicitly
			// Passing an `env` value to `readConfig` will lead to unexpected behaviour if the given environment does not exist in the user's config
			mode = userConfig.mode;

			return {
				resolve: {
					alias: getNodeCompatAliases(),
				},
				appType: 'custom',
				builder: {
					async buildApp(builder) {
						const client = builder.environments.client;
						const defaultHtmlPath = path.resolve(
							builder.config.root,
							'index.html',
						);

						if (
							client &&
							(client.config.build.rollupOptions.input ||
								fs.existsSync(defaultHtmlPath))
						) {
							hasClientEnvironment = true;
							await builder.build(client);
						}

						const workerEnvironments = Object.keys(
							pluginConfig.workers ?? {},
						).map((name) => {
							const environment = builder.environments[name];
							invariant(environment, `${name} environment not found`);

							return environment;
						});

						await Promise.all(
							workerEnvironments.map((environment) =>
								builder.build(environment),
							),
						);
					},
				},
				// Ensure there is an environment for each worker
				environments: Object.fromEntries(
					Object.entries(pluginConfig.workers ?? {}).map(
						([name, workerOptions]) => [
							name,
							createCloudflareEnvironmentOptions(workerOptions, userConfig),
						],
					),
				),
			};
		},
		configEnvironment(name, options) {
			options.build = {
				...options.build,
				// Puts all environment builds in subdirectories of the same build directory
				outDir: path.join(options.build?.outDir ?? 'dist', name),
			};
		},
		configResolved(resolvedConfig) {
			viteConfig = resolvedConfig;
			normalizedPluginConfig = normalizePluginConfig(
				pluginConfig,
				resolvedConfig,
				mode,
			);
		},
		generateBundle() {
			let config: RawConfig;

			if (
				this.environment.name === 'client' &&
				!Object.keys(normalizedPluginConfig.workers).length
			) {
				config = {
					assets: {
						...normalizedPluginConfig.assets,
						directory: '.',
					},
				};
			} else {
				const worker = normalizedPluginConfig.workers[this.environment.name];

				if (!worker) {
					return;
				}

				config = worker.wranglerConfig;

				const isEntryWorker =
					this.environment.name === normalizedPluginConfig.entryWorkerName;

				if (isEntryWorker && hasClientEnvironment) {
					config.assets = {
						...normalizedPluginConfig.assets,
						directory: path.join('..', 'client'),
						binding:
							normalizedPluginConfig.workers[this.environment.name]
								?.assetsBinding,
					};
				}
			}

			this.emitFile({
				type: 'asset',
				fileName: 'wrangler.json',
				source: JSON.stringify(config),
			});
		},
		async resolveId(source) {
			const worker = normalizedPluginConfig.workers[this.environment.name];
			if (worker) {
				const aliased = resolveNodeAliases(source, worker.workerOptions);
				if (aliased) {
					if (aliased.external) {
						return aliased.id;
					} else {
						return await this.resolve(aliased.id);
					}
				}
			}
		},
		async transform(code, id) {
			const worker = normalizedPluginConfig.workers[this.environment.name];
			if (worker) {
				const rId = await this.resolve(worker.entryPath);
				if (id === rId?.id) {
					return injectGlobalCode(id, code, worker.workerOptions);
				}
			}
		},
		async configureServer(viteDevServer) {
			let error: unknown;

			const miniflare = new Miniflare(
				getDevMiniflareOptions(
					normalizedPluginConfig,
					viteConfig,
					viteDevServer,
				),
			);

			await initRunners(normalizedPluginConfig, miniflare, viteDevServer);

			viteDevServer.watcher.on('all', async (_, path) => {
				if (!normalizedPluginConfig.wranglerConfigPaths.has(path)) {
					return;
				}

				try {
					await miniflare.setOptions(
						getDevMiniflareOptions(
							normalizedPluginConfig,
							viteConfig,
							viteDevServer,
						),
					);

					await initRunners(normalizedPluginConfig, miniflare, viteDevServer);

					error = undefined;
					viteDevServer.environments.client.hot.send({ type: 'full-reload' });
				} catch (err) {
					error = err;
					viteDevServer.environments.client.hot.send({ type: 'full-reload' });
				}
			});

			const middleware = createMiddleware(async ({ request }) => {
				const routerWorker = await getRouterWorker(miniflare);

				return routerWorker.fetch(toMiniflareRequest(request), {
					redirect: 'manual',
				}) as any;
			});

			return () => {
				viteDevServer.middlewares.use((req, res, next) => {
					if (error) {
						throw error;
					}

					if (!middleware) {
						next();
						return;
					}

					middleware(req, res, next);
				});
			};
		},
		configurePreviewServer(vitePreviewServer) {
			const miniflare = new Miniflare(
				getPreviewMiniflareOptions(normalizedPluginConfig, viteConfig),
			);

			const middleware = createMiddleware(
				({ request }) => {
					return miniflare.dispatchFetch(toMiniflareRequest(request), {
						redirect: 'manual',
					}) as any;
				},
				{ alwaysCallNext: false },
			);

			return () => {
				vitePreviewServer.middlewares.use((req, res, next) => {
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
