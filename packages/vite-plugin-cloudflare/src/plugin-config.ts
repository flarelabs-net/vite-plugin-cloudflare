import * as path from 'node:path';
import * as vite from 'vite';
import { readConfig, unstable_getMiniflareWorkerOptions } from 'wrangler';
import type { AssetConfig } from './assets';
import type { Config, SourcelessWorkerOptions } from 'wrangler';

export interface WorkerOptions {
	main: string;
	wranglerConfig?: string;
	// TODO: tighten up types so assets can only be bound to entry worker
	assetsBinding?: string;
	overrides?: vite.EnvironmentOptions;
}

export interface PluginConfig<
	TWorkers extends Record<string, WorkerOptions> = Record<
		string,
		WorkerOptions
	>,
	TEntryWorker extends string = Extract<keyof TWorkers, string>,
> {
	workers?: TWorkers;
	entryWorker?: TEntryWorker;
	assets?: AssetConfig;
	persistTo?: string | false;
}

export interface NormalizedPluginConfig {
	workers: Record<
		string,
		{
			entryPath: string;
			wranglerConfigPath: string;
			wranglerConfig: Config;
			assetsBinding?: string;
			workerOptions: SourcelessWorkerOptions & { name: string };
		}
	>;
	entryWorkerName?: string;
	assets: AssetConfig;
	persistPath: string | false;
	wranglerConfigPaths: Set<string>;
}

const DEFAULT_PERSIST_PATH = '.wrangler/state/v3';

export function normalizePluginConfig(
	pluginConfig: PluginConfig,
	viteConfig: vite.ResolvedConfig,
	mode?: string,
): NormalizedPluginConfig {
	const wranglerConfigPaths = new Set<string>();
	const workers = Object.fromEntries(
		Object.entries(pluginConfig.workers ?? {}).map(([name, options]) => {
			const wranglerConfigPath = path.resolve(
				viteConfig.root,
				options.wranglerConfig ?? './wrangler.toml',
			);

			if (wranglerConfigPaths.has(wranglerConfigPath)) {
				throw new Error(
					`Duplicate Wrangler config path found: ${wranglerConfigPath}`,
				);
			}

			const wranglerConfig = readConfig(wranglerConfigPath, {
				env: mode,
			});

			wranglerConfigPaths.add(wranglerConfigPath);

			// We'll need to change this to `${name}-${mode}` when the `mode` is present but this is non-trivial because service bindings etc. will need updating
			wranglerConfig.name;

			const miniflareWorkerOptions =
				unstable_getMiniflareWorkerOptions(wranglerConfig);

			const { ratelimits, ...workerOptions } =
				miniflareWorkerOptions.workerOptions;

			return [
				name,
				{
					assetsBinding: options.assetsBinding,
					entryPath: options.main,
					wranglerConfigPath,
					wranglerConfig,
					// `unstable_getMiniflareWorkerOptions` always sets the `name` to undefined so we have to add it again here
					workerOptions: { ...workerOptions, name },
				},
			];
		}),
	);

	const assets = pluginConfig.assets ?? {};

	const persistPath =
		pluginConfig.persistTo === false
			? false
			: path.resolve(
					viteConfig.root,
					pluginConfig.persistTo ?? DEFAULT_PERSIST_PATH,
				);

	return {
		workers,
		entryWorkerName: pluginConfig.entryWorker,
		assets,
		persistPath,
		wranglerConfigPaths,
	};
}
