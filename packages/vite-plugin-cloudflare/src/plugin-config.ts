import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vite from 'vite';
import { readConfig } from 'wrangler';
import { invariant } from './shared';
import type { Config } from 'wrangler';

export interface PluginConfig {
	wranglerConfig?: string;
	viteEnvironmentName?: string;
	auxiliaryWorkers?: Array<{
		wranglerConfig: string;
		viteEnvironmentName?: string;
	}>;
}

interface BaseConfig {
	wranglerConfigPaths: Set<string>;
}

export type WorkerConfig = Config & { name: string; main: string };

interface AssetsOnlyResult {
	type: 'assets-only';
	config: Config;
}

interface WorkerResult {
	type: 'worker';
	config: WorkerConfig;
}

type AssetsOnlyConfig = BaseConfig & AssetsOnlyResult;

export interface WorkersConfig extends BaseConfig {
	type: 'workers';
	workers: Record<string, WorkerConfig>;
	entryWorkerEnvironmentName: string;
	wranglerConfigPaths: Set<string>;
}

export type ResolvedPluginConfig = AssetsOnlyConfig | WorkersConfig;

function getConfig(
	configPath: string,
	userConfig: vite.UserConfig,
	wranglerConfigPaths: Set<string>,
	isEntryWorker?: boolean,
): AssetsOnlyResult | WorkerResult {
	if (wranglerConfigPaths.has(configPath)) {
		throw new Error(`Duplicate Wrangler config path found: ${configPath}`);
	}

	const wranglerConfig = readConfig(configPath, {
		// We use the mode from the user config rather than the resolved config for now so that the mode has to be set explicitly. Otherwise, some things don't work as expected when a `development` and `production` environment are not set.
		env: userConfig.mode,
	});

	wranglerConfigPaths.add(configPath);

	if (isEntryWorker && !wranglerConfig.main) {
		invariant(
			wranglerConfig.assets,
			`No main or assets field provided in ${wranglerConfig.configPath}`,
		);

		return { type: 'assets-only', config: wranglerConfig };
	}

	invariant(
		wranglerConfig.main,
		`No main field provided in ${wranglerConfig.configPath}`,
	);

	invariant(
		wranglerConfig.name,
		`No name field provided in ${wranglerConfig.configPath}`,
	);

	return {
		type: 'worker',
		config: {
			...wranglerConfig,
			name: wranglerConfig.name,
			main: wranglerConfig.main,
		},
	};
}

// We can't rely on `readConfig` from Wrangler to find the config as it may be relative to a different root set by the user.
function findWranglerConfig(root: string): string | undefined {
	for (const extension of ['json', 'jsonc', 'toml']) {
		const configPath = path.join(root, `wrangler.${extension}`);

		if (fs.existsSync(configPath)) {
			return configPath;
		}
	}
}

// Worker names can only contain alphanumeric characters and '_' whereas environment names can only contain alphanumeric characters and '$', '_'
function workerNameToEnvironmentName(workerName: string) {
	return workerName.split('-').join('_');
}

export function resolvePluginConfig(
	pluginConfig: PluginConfig,
	userConfig: vite.UserConfig,
): ResolvedPluginConfig {
	const wranglerConfigPaths = new Set<string>();
	const root = userConfig.root ? path.resolve(userConfig.root) : process.cwd();

	const configPath = pluginConfig.wranglerConfig
		? path.join(root, pluginConfig.wranglerConfig)
		: findWranglerConfig(root);

	invariant(
		configPath,
		`Config not found. Have you created a wrangler.json or wrangler.toml file?`,
	);

	const entryResult = getConfig(
		configPath,
		userConfig,
		wranglerConfigPaths,
		true,
	);

	if (entryResult.type === 'assets-only') {
		return { ...entryResult, wranglerConfigPaths };
	}

	const workerConfig = entryResult.config;

	const entryWorkerEnvironmentName =
		pluginConfig.viteEnvironmentName ??
		workerNameToEnvironmentName(workerConfig.name);

	const workers = {
		[entryWorkerEnvironmentName]: workerConfig,
	};

	for (const auxiliaryWorker of pluginConfig.auxiliaryWorkers ?? []) {
		const workerResult = getConfig(
			path.join(root, auxiliaryWorker.wranglerConfig),
			userConfig,
			wranglerConfigPaths,
		);

		invariant(workerResult.type === 'worker', 'Unexpected error');

		const workerConfig = workerResult.config;

		const workerEnvironmentName =
			auxiliaryWorker.viteEnvironmentName ??
			workerNameToEnvironmentName(workerConfig.name);

		if (workers[workerEnvironmentName]) {
			throw new Error(
				`Duplicate Vite environment name found: ${workerEnvironmentName}`,
			);
		}

		workers[workerEnvironmentName] = workerConfig;
	}

	return {
		type: 'workers',
		wranglerConfigPaths,
		workers,
		entryWorkerEnvironmentName,
	};
}

// export interface WorkerOptions {
// 	main: string;
// 	wranglerConfig?: string;
// 	// TODO: tighten up types so assets can only be bound to entry worker
// 	assetsBinding?: string;
// 	overrides?: vite.EnvironmentOptions;
// }

// export interface PluginConfig<
// 	TWorkers extends Record<string, WorkerOptions> = Record<
// 		string,
// 		WorkerOptions
// 	>,
// 	TEntryWorker extends string = Extract<keyof TWorkers, string>,
// > {
// 	workers?: TWorkers;
// 	entryWorker?: TEntryWorker;
// 	assets?: AssetConfig;
// 	persistTo?: string | false;
// }

// export interface NormalizedPluginConfig {
// 	workers: Record<
// 		string,
// 		{
// 			entryPath: string;
// 			wranglerConfigPath: string;
// 			wranglerConfig: Config;
// 			assetsBinding?: string;
// 			workerOptions: SourcelessWorkerOptions & { name: string };
// 		}
// 	>;
// 	entryWorkerName?: string;
// 	assets: AssetConfig;
// 	persistPath: string | false;
// 	wranglerConfigPaths: Set<string>;
// }

// const DEFAULT_PERSIST_PATH = '.wrangler/state/v3';

// export function normalizePluginConfig(
// 	pluginConfig: PluginConfig,
// 	viteConfig: vite.ResolvedConfig,
// 	mode?: string,
// ): NormalizedPluginConfig {
// 	const wranglerConfigPaths = new Set<string>();
// 	const workers = Object.fromEntries(
// 		Object.entries(pluginConfig.workers ?? {}).map(([name, options]) => {
// 			const wranglerConfigPath = path.resolve(
// 				viteConfig.root,
// 				options.wranglerConfig ?? './wrangler.toml',
// 			);

// 			if (wranglerConfigPaths.has(wranglerConfigPath)) {
// 				throw new Error(
// 					`Duplicate Wrangler config path found: ${wranglerConfigPath}`,
// 				);
// 			}

// 			const wranglerConfig = readConfig(wranglerConfigPath, {
// 				env: mode,
// 			});

// 			wranglerConfigPaths.add(wranglerConfigPath);

// 			// We'll need to change this to `${name}-${mode}` when the `mode` is present but this is non-trivial because service bindings etc. will need updating
// 			wranglerConfig.name = name;

// 			const miniflareWorkerOptions =
// 				unstable_getMiniflareWorkerOptions(wranglerConfig);

// 			const { ratelimits, ...workerOptions } =
// 				miniflareWorkerOptions.workerOptions;

// 			return [
// 				name,
// 				{
// 					assetsBinding: options.assetsBinding,
// 					entryPath: options.main,
// 					wranglerConfigPath,
// 					wranglerConfig,
// 					// `unstable_getMiniflareWorkerOptions` always sets the `name` to undefined so we have to add it again here
// 					workerOptions: { ...workerOptions, name },
// 				},
// 			];
// 		}),
// 	);

// 	const assets = pluginConfig.assets ?? {};

// 	const persistPath =
// 		pluginConfig.persistTo === false
// 			? false
// 			: path.resolve(
// 					viteConfig.root,
// 					pluginConfig.persistTo ?? DEFAULT_PERSIST_PATH,
// 				);

// 	return {
// 		workers,
// 		entryWorkerName: pluginConfig.entryWorker,
// 		assets,
// 		persistPath,
// 		wranglerConfigPaths,
// 	};
// }
