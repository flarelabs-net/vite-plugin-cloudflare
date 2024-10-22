import * as vite from 'vite';
import { INIT_PATH, invariant, UNKNOWN_HOST } from './shared';
import type { NormalizedPluginConfig, WorkerOptions } from './plugin-config';
import type { Fetcher } from '@cloudflare/workers-types/experimental';
import type {
	MessageEvent,
	Miniflare,
	ReplaceWorkersTypes,
	WebSocket,
} from 'miniflare';

interface WebSocketContainer {
	webSocket?: WebSocket;
}

const webSocketUndefinedError = 'The WebSocket is undefined';

function createHotChannel(
	webSocketContainer: WebSocketContainer,
): vite.HotChannel {
	const listenersMap = new Map<string, Set<Function>>();

	function onMessage(event: MessageEvent) {
		const payload = JSON.parse(event.data.toString()) as vite.CustomPayload;
		const listeners = listenersMap.get(payload.event) ?? new Set();

		for (const listener of listeners) {
			listener(payload.data);
		}
	}

	return {
		send(...args: [string, unknown] | [vite.HotPayload]) {
			let payload: vite.HotPayload;

			if (typeof args[0] === 'string') {
				payload = {
					type: 'custom',
					event: args[0],
					data: args[1],
				};
			} else {
				payload = args[0];
			}

			const webSocket = webSocketContainer.webSocket;
			invariant(webSocket, webSocketUndefinedError);

			webSocket.send(JSON.stringify(payload));
		},
		on(event: string, listener: Function) {
			const listeners = listenersMap.get(event) ?? new Set();

			listeners.add(listener);
			listenersMap.set(event, listeners);
		},
		off(event, listener) {
			listenersMap.get(event)?.delete(listener);
		},
		listen() {
			const webSocket = webSocketContainer.webSocket;
			invariant(webSocket, webSocketUndefinedError);

			webSocket.addEventListener('message', onMessage);
		},
		close() {
			const webSocket = webSocketContainer.webSocket;
			invariant(webSocket, webSocketUndefinedError);

			webSocket.removeEventListener('message', onMessage);
		},
	};
}

export class CloudflareDevEnvironment extends vite.DevEnvironment {
	#webSocketContainer: { webSocket?: WebSocket };
	#worker?: ReplaceWorkersTypes<Fetcher>;

	constructor(name: string, config: vite.ResolvedConfig) {
		// It would be good if we could avoid passing this object around and mutating it
		const webSocketContainer = {};
		super(name, config, { hot: createHotChannel(webSocketContainer) });
		this.#webSocketContainer = webSocketContainer;
	}

	async initRunner(worker: ReplaceWorkersTypes<Fetcher>) {
		this.#worker = worker;

		const response = await this.#worker.fetch(
			new URL(INIT_PATH, UNKNOWN_HOST),
			{
				headers: {
					upgrade: 'websocket',
				},
			},
		);

		invariant(response.ok, 'Failed to initialize module runner');

		const webSocket = response.webSocket;
		invariant(webSocket, 'Failed to establish WebSocket');

		webSocket.accept();

		this.#webSocketContainer.webSocket = webSocket;
	}

	async dispatchFetch(request: Request) {
		invariant(this.#worker, 'Runner not initialized');

		return this.#worker.fetch(request.url, {
			method: request.method,
			headers: [['accept-encoding', 'identity'], ...request.headers],
			body: request.body,
			duplex: 'half',
		}) as any;
	}
}

export function createCloudflareEnvironment(
	options: WorkerOptions,
): vite.EnvironmentOptions {
	return vite.mergeConfig(
		{
			resolve: {
				// Note: in order for ssr pre-bundling to take effect we need to ask vite to treat all
				//       dependencies as not external
				noExternal: true,
			},
			dev: {
				createEnvironment(name, config) {
					return new CloudflareDevEnvironment(name, config);
				},
				optimizeDeps: {
					// Note: ssr pre-bundling is opt-in, and we need to enabled it by setting
					//       noDiscovery to false
					noDiscovery: false,
					exclude: [...getWorkerdBuiltIns()],
				},
			},
			build: {
				createEnvironment(name, config) {
					return new vite.BuildEnvironment(name, config);
				},
				ssr: true,
				rollupOptions: {
					// Note: vite starts dev pre-bundling crawling from either optimizeDeps.entries or rollupOptions.input
					//       so the input value here serves both as the build input as well as the starting point for
					//       dev pre-bundling crawling (were we not to set this input field we'd have to appropriately set
					//       optimizeDeps.entries in the dev config)
					input: options.main,
					external: [
						'cloudflare:email',
						'cloudflare:sockets',
						'cloudflare:workers',
					],
				},
			},
			webCompatible: true,
		} satisfies vite.EnvironmentOptions,
		options.overrides ?? {},
	);
}

export function initRunners(
	normalizedPluginConfig: NormalizedPluginConfig,
	miniflare: Miniflare,
	viteDevServer: vite.ViteDevServer,
): Promise<void[]> {
	return Promise.all(
		normalizedPluginConfig.workers.map(async ({ name }) => {
			const worker = await miniflare.getWorker(name);

			return (
				viteDevServer.environments[name] as CloudflareDevEnvironment
			).initRunner(worker);
		}),
	);
}

function getWorkerdBuiltIns() {
	// source: https://github.com/sindresorhus/builtin-modules/blob/main/builtin-modules.json
	const nodePlainBuiltIns = [
		'assert',
		'assert/strict',
		'async_hooks',
		'buffer',
		'child_process',
		'cluster',
		'console',
		'constants',
		'crypto',
		'dgram',
		'diagnostics_channel',
		'dns',
		'dns/promises',
		'domain',
		'events',
		'fs',
		'fs/promises',
		'http',
		'http2',
		'https',
		'inspector',
		'inspector/promises',
		'module',
		'net',
		'os',
		'path',
		'path/posix',
		'path/win32',
		'perf_hooks',
		'process',
		'punycode',
		'querystring',
		'readline',
		'readline/promises',
		'repl',
		'stream',
		'stream/consumers',
		'stream/promises',
		'stream/web',
		'string_decoder',
		'timers',
		'timers/promises',
		'tls',
		'trace_events',
		'tty',
		'url',
		'util',
		'util/types',
		'v8',
		'vm',
		'wasi',
		'worker_threads',
		'zlib',
	];
	const nodeBuiltIns = [
		...nodePlainBuiltIns,
		...nodePlainBuiltIns.map((mod) => `node:${mod}`),
	];

	const cloudflareBuiltIns = ['cloudflare:workers', 'cloudflare:sockets'];

	// Note: we always include the node built-ins even if the worker is not under nodejs_compat, this makes it so
	//       that vite does not error on pre-bundling. If the worker is not under nodejs_compat then an error should
	//       occur later on in any case
	return [...nodeBuiltIns, ...cloudflareBuiltIns];
}
