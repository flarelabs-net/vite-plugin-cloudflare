import { ModuleRunner } from 'vite/module-runner';
import { UNKNOWN_HOST } from '../shared';
import type { WrapperEnv } from './env';
import type { FetchResult } from 'vite/module-runner';

let moduleRunner: ModuleRunner;

export async function createModuleRunner(
	env: WrapperEnv,
	webSocket: WebSocket,
) {
	if (moduleRunner) {
		throw new Error('Runner already initialized');
	}

	moduleRunner = new ModuleRunner(
		{
			root: env.__VITE_ROOT__,
			sourcemapInterceptor: 'prepareStackTrace',
			transport: {
				async fetchModule(...args) {
					console.log(`fetchModule: ${args[0]}\nfrom: ${args[1]}`);
					const response = await env.__VITE_FETCH_MODULE__.fetch(
						new Request(UNKNOWN_HOST, {
							method: 'POST',
							body: JSON.stringify(args),
						}),
					);

					if (!response.ok) {
						throw new Error(await response.text());
					}

					const result = await response.json();

					return result as FetchResult;
				},
			},
			hmr: {
				connection: {
					isReady: () => true,
					onUpdate(callback) {
						webSocket.addEventListener('message', (event) => {
							callback(JSON.parse(event.data.toString()));
						});
					},
					send(payload) {
						webSocket.send(JSON.stringify(payload));
					},
				},
			},
		},
		{
			async runInlinedModule(context, transformed, module) {
				const codeDefinition = `'use strict';async (${Object.keys(context).join(
					',',
				)})=>{{`;
				const code = `${codeDefinition}${transformed}\n}}`;
				console.log('runInlineModule', module.id);
				try {
					const fn = env.__VITE_UNSAFE_EVAL__.eval(code, module.id);
					await fn(...Object.values(context));
					Object.freeze(context.__vite_ssr_exports__);
				} catch (e) {
					console.error('error running', module.id);
					console.error('stack' in (e as any) ? (e as any).stack : e);
					throw e;
				}
			},
			async runExternalModule(filepath) {
				filepath = filepath.replace(/^file:\/\//, '');
				console.log('runExternalModule', filepath);
				return import(filepath);
			},
		},
	);
}

export async function getWorkerEntryExport(path: string, entrypoint: string) {
	const module = await moduleRunner.import(path);
	const entrypointValue =
		typeof module === 'object' &&
		module !== null &&
		entrypoint in module &&
		module[entrypoint];

	if (!entrypointValue) {
		throw new Error(`${path} does not export a ${entrypoint} entrypoint.`);
	}

	return entrypointValue;
}
