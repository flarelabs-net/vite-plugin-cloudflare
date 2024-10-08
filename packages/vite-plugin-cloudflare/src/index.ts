import * as vite from 'vite';
import { createMiddleware } from '@hattip/adapter-node';
import { Miniflare, Response as MiniflareResponse } from 'miniflare';
import { unstable_getMiniflareWorkerOptions } from 'wrangler';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { createCloudflareEnvironment } from './cloudflare-environment';
import type { FetchFunctionOptions } from 'vite/module-runner';
import type { WorkerOptions } from 'miniflare';
import type {
	CloudflareEnvironmentOptions,
	CloudflareDevEnvironment,
} from './cloudflare-environment';
import { getModuleFallbackHandler } from './module-fallback';
import type { ResolveIdFunction } from './module-fallback';

const wrapperPath = '__VITE_WRAPPER_PATH__';
const runnerPath = fileURLToPath(new URL('./runner/index.js', import.meta.url));
const workerdCustomImportPath = '/__workerd-custom-import.cjs';

export function cloudflare<
	T extends Record<string, CloudflareEnvironmentOptions>,
>(pluginConfig: { workers: T; entryWorker?: keyof T }): vite.Plugin {
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
			const workers = Object.entries(pluginConfig.workers).map(
				([name, options]) => {
					const miniflareOptions = unstable_getMiniflareWorkerOptions(
						path.resolve(
							viteConfig.root,
							options.wranglerConfig ?? './wrangler.toml',
						),
					);

					const { ratelimits, ...workerOptions } =
						miniflareOptions.workerOptions;

					return {
						...workerOptions,
						name,
						modulesRoot: '/',
						unsafeEvalBinding: '__VITE_UNSAFE_EVAL__',
						bindings: {
							...workerOptions.bindings,
							__VITE_ROOT__: viteConfig.root,
							__VITE_ENTRY_PATH__: options.main,
						},
					} satisfies Partial<WorkerOptions>;
				},
			);

			const workerEntrypointNames = Object.fromEntries(
				workers.map((workerOptions) => [workerOptions.name, new Set<string>()]),
			);

			for (const worker of workers) {
				if (worker.serviceBindings === undefined) {
					continue;
				}

				for (const value of Object.values(worker.serviceBindings)) {
					if (
						typeof value === 'object' &&
						'name' in value &&
						typeof value.name === 'string' &&
						value.entrypoint !== undefined &&
						value.entrypoint !== 'default'
					) {
						workerEntrypointNames[value.name]?.add(value.entrypoint);
					}
				}
			}

			const esmResolveId = vite.createIdResolver(viteConfig, {});

			// for `require` calls we want a resolver that prioritized node/cjs modules
			const cjsResolveId = vite.createIdResolver(viteConfig, {
				conditions: ['node'],
				mainFields: ['main'],
				webCompatible: false,
				isRequire: true,
				extensions: ['.cjs', '.cts', '.js', '.ts', '.jsx', '.tsx', '.json'],
			});

			const resolveId: ResolveIdFunction = (
				id,
				importer,
				{ resolveMethod } = {
					resolveMethod: 'import',
				},
			) => {
				const resolveIdFn =
					resolveMethod === 'import' ? esmResolveId : cjsResolveId;

				// TODO: we only have a single module resolution strategy shared across all workers
				//       (generated using the first worker's dev environment)
				//       we should investigate and ideally have potential different resolutions per worker
				//       see: https://github.com/flarelabs-net/vite-plugin-cloudflare/issues/19
				const firstWorkerName = Object.keys(pluginConfig.workers)[0]!;

				const devEnv = viteDevServer.environments[
					firstWorkerName
				] as CloudflareDevEnvironment;

				return resolveIdFn(devEnv, id, importer);
			};

			const miniflare = new Miniflare({
				workers: workers.map((workerOptions) => {
					const wrappers = [
						`import { createWorkerEntrypointWrapper } from '${runnerPath}';`,
						`export default createWorkerEntrypointWrapper('default');`,
					];

					for (const entrypointName of [
						...(workerEntrypointNames[workerOptions.name] ?? []),
					].sort()) {
						wrappers.push(
							`export const ${entrypointName} = createWorkerEntrypointWrapper('${entrypointName}');`,
						);
					}

					return {
						...workerOptions,
						unsafeUseModuleFallbackService: true,
						modules: [
							{
								type: 'ESModule',
								path: wrapperPath,
								contents: wrappers.join('\n'),
							},
							{
								type: 'ESModule',
								path: runnerPath,
							},
							{
								// we declare the workerd-custom-import as a CommonJS module, thanks to this
								// require is made available in the module and we are able to handle cjs imports
								type: 'CommonJS',
								path: workerdCustomImportPath,
								contents: 'module.exports = path => import(path)',
							},
						],
						serviceBindings: {
							...workerOptions.serviceBindings,
							__VITE_FETCH_MODULE__: async (request) => {
								const [moduleId, imported, options] =
									(await request.json()) as [
										string,
										string,
										FetchFunctionOptions,
									];

								const devEnvironment = viteDevServer.environments[
									workerOptions.name
								] as CloudflareDevEnvironment;

								try {
									const result = await devEnvironment.fetchModule(
										moduleId,
										imported,
										options,
									);

									return new MiniflareResponse(JSON.stringify(result));
								} catch (error) {
									if (moduleId.startsWith('cloudflare:')) {
										const result = {
											externalize: moduleId,
											type: 'module',
										} satisfies vite.FetchResult;

										return new MiniflareResponse(JSON.stringify(result));
									}
									throw new Error(
										`Unexpected Error, failed to get module: ${moduleId}`,
									);
								}
							},
						},
					};
				}),
				unsafeModuleFallbackService: getModuleFallbackHandler(resolveId),
			});

			await Promise.all(
				workers.map(async (workerOptions) => {
					const worker = await miniflare.getWorker(workerOptions.name);

					return (
						viteDevServer.environments[
							workerOptions.name
						] as CloudflareDevEnvironment
					).initRunner(worker);
				}),
			);

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
