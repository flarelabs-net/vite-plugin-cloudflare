import * as path from 'node:path';
import { createMiddleware } from '@hattip/adapter-node';
import MagicString from 'magic-string';
import { Miniflare } from 'miniflare';
import * as vite from 'vite';
import { unstable_getMiniflareWorkerOptions } from 'wrangler';
import {
	createCloudflareEnvironmentOptions,
	initRunners,
} from './cloudflare-environment';
import { getMiniflareOptions } from './miniflare-options';
import {
	getGlobalInjectionCode,
	getNodeCompatAliases,
	isNodeCompat,
	resolveNodeAliases,
} from './node-js-compat';
import { normalizePluginConfig } from './plugin-config';
import { invariant } from './shared';
import type { CloudflareDevEnvironment } from './cloudflare-environment';
import type { PluginConfig, WorkerOptions } from './plugin-config';

export function cloudflare<T extends Record<string, WorkerOptions>>(
	pluginConfig: PluginConfig<T>,
): vite.Plugin {
	let viteConfig: vite.ResolvedConfig;

	/**
	 * A set of worker/environment names that require Node.js compatibility.
	 */
	let requiresNodeCompat: Set<string>;

	return {
		name: 'vite-plugin-cloudflare',
		config() {
			return {
				resolve: {
					alias: { ...getNodeCompatAliases() },
					// We want to use `workerd` package exports if available (e.g. for postgres).
					conditions: ['workerd'],
				},
				appType: 'custom',
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
				// Ensure there is an environment for each worker
				environments: Object.fromEntries(
					Object.entries(pluginConfig.workers).map(([name, workerOptions]) => [
						name,
						createCloudflareEnvironmentOptions(name, workerOptions),
					]),
				),
			};
		},
		configResolved(resolvedConfig) {
			viteConfig = resolvedConfig;
			requiresNodeCompat = getNodeCompatEnvironments(
				pluginConfig,
				path.resolve(
					path.dirname(viteConfig.configFile ?? './dummy'),
					viteConfig.root,
				),
			);
		},
		resolveId(source) {
			return resolveNodeAliases(
				source,
				requiresNodeCompat.has(this.environment.name),
			);
		},
		transform(code, id) {
			// If the current environment needs Node.js compatibility,
			// then inject the necessary global polyfills into the entry point.
			if (requiresNodeCompat.has(this.environment.name)) {
				// TODO: find a better way to identify if this is an entry-point
				const firstModule = this.getModuleIds().next().value;
				if (id === firstModule) {
					const modified = new MagicString(code);
					modified.prepend(getGlobalInjectionCode());
					return {
						code: modified.toString(),
						map: modified.generateMap({ hires: 'boundary', source: id }),
					};
				}
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
					viteDevServer.environments.client.hot.send({ type: 'full-reload' });
				} catch (err) {
					error = err;
					viteDevServer.environments.client.hot.send({ type: 'full-reload' });
				}
			});

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

/**
 * Returns a set of environment names that need Node.js compatibility.
 */
function getNodeCompatEnvironments(config: PluginConfig, root: string) {
	const needsNodeJsCompat = new Set<string>();

	Object.entries(config.workers).forEach(([name, rawWorkerOptions]) => {
		const wranglerConfigPath = path.resolve(
			root,
			rawWorkerOptions.wranglerConfig ?? './wrangler.toml',
		);
		const { workerOptions } =
			unstable_getMiniflareWorkerOptions(wranglerConfigPath);
		if (isNodeCompat(workerOptions)) {
			needsNodeJsCompat.add(name);
		}
	});

	return needsNodeJsCompat;
}
