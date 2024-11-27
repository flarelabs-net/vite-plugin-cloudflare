import * as path from 'node:path';
import * as vite from 'vite';
import { unstable_getMiniflareWorkerOptions } from 'wrangler';
import type { AssetConfig } from './assets';
import type { SourcelessWorkerOptions } from 'wrangler';

export interface WorkerOptions {
	main: string;
	compatibilityDate: `${string}-${string}-${string}`;
	// TODO: use string literal types
	compatibilityFlags?: string[];
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

export interface BuildOptions {
	compatibilityDate: string;
	compatibilityFlags?: string[];
}

export interface NormalizedPluginConfig {
	workers: Record<
		string,
		{
			entryPath: string;
			buildOptions: BuildOptions;
			wranglerConfigPath: string;
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

function getWorkerOptions(
	wranglerConfigPath: string,
	wranglerConfigPaths: Set<string>,
) {
	if (wranglerConfigPaths.has(wranglerConfigPath)) {
		throw new Error(
			`Duplicate Wrangler config path found: ${wranglerConfigPath}`,
		);
	}

	let miniflareWorkerOptions: { workerOptions: SourcelessWorkerOptions };

	try {
		miniflareWorkerOptions =
			unstable_getMiniflareWorkerOptions(wranglerConfigPath);
	} catch (error) {
		return {};
	}

	const { ratelimits, ...workerOptions } = miniflareWorkerOptions.workerOptions;

	wranglerConfigPaths.add(wranglerConfigPath);

	return workerOptions;
}

export function normalizePluginConfig(
	pluginConfig: PluginConfig,
	viteConfig: vite.ResolvedConfig,
): NormalizedPluginConfig {
	const wranglerConfigPaths = new Set<string>();
	const workers = Object.fromEntries(
		Object.entries(pluginConfig.workers ?? {}).map(([name, options]) => {
			const wranglerConfigPath = path.resolve(
				viteConfig.root,
				options.wranglerConfig ?? './wrangler.toml',
			);

			const workerOptions = getWorkerOptions(
				wranglerConfigPath,
				wranglerConfigPaths,
			);

			return [
				name,
				{
					entryPath: options.main,
					buildOptions: {
						compatibilityDate: options.compatibilityDate,
						compatibilityFlags: options.compatibilityFlags,
					},
					workerOptions: { ...workerOptions, name },
					wranglerConfigPath,
					assetsBinding: options.assetsBinding,
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
