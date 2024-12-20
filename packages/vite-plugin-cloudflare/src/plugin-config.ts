import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vite from 'vite';
import { unstable_readConfig } from 'wrangler';
import type { Unstable_Config } from 'wrangler';

export type PersistState = boolean | { path: string };

interface PluginWorkerConfig {
	configPath: string;
	viteEnvironment?: { name?: string };
}

export interface PluginConfig extends Partial<PluginWorkerConfig> {
	auxiliaryWorkers?: PluginWorkerConfig[];
	persistState?: PersistState;
}

type Defined<T> = Exclude<T, undefined>;

export type AssetsOnlyConfig = Unstable_Config & {
	assets: Defined<Unstable_Config['assets']>;
};

export type WorkerConfig = Unstable_Config & {
	name: Defined<Unstable_Config['name']>;
	main: Defined<Unstable_Config['main']>;
};

interface AssetsOnlyResult {
	type: 'assets-only';
	config: AssetsOnlyConfig;
}

interface WorkerResult {
	type: 'worker';
	config: WorkerConfig;
}

interface BasePluginConfig {
	configPaths: Set<string>;
	persistState: PersistState;
}

interface AssetsOnlyPluginConfig extends BasePluginConfig {
	type: 'assets-only';
	config: AssetsOnlyConfig;
}

interface WorkersPluginConfig extends BasePluginConfig {
	type: 'workers';
	workers: Record<string, WorkerConfig>;
	entryWorkerEnvironmentName: string;
}

export type ResolvedPluginConfig = AssetsOnlyPluginConfig | WorkersPluginConfig;

function getConfigResult(
	configPath: string,
	configPaths: Set<string>,
	isEntryWorker?: boolean,
): AssetsOnlyResult | WorkerResult {
	if (configPaths.has(configPath)) {
		throw new Error(`Duplicate Wrangler config path found: ${configPath}`);
	}

	const wranglerConfig = unstable_readConfig({ config: configPath }, {});

	configPaths.add(configPath);

	if (isEntryWorker && !wranglerConfig.main) {
		assert(
			wranglerConfig.assets,
			`No main or assets field provided in ${wranglerConfig.configPath}`,
		);

		return {
			type: 'assets-only',
			config: { ...wranglerConfig, assets: wranglerConfig.assets },
		};
	}

	assert(
		wranglerConfig.main,
		`No main field provided in ${wranglerConfig.configPath}`,
	);

	assert(
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

// We can't rely on `readConfig` from Wrangler to find the config as it may be relative to a different root that's set by the user.
function findWranglerConfig(root: string): string | undefined {
	for (const extension of ['json', 'jsonc', 'toml']) {
		const configPath = path.join(root, `wrangler.${extension}`);

		if (fs.existsSync(configPath)) {
			return configPath;
		}
	}
}

// Worker names can only contain alphanumeric characters and '-' whereas environment names can only contain alphanumeric characters and '$', '_'
function workerNameToEnvironmentName(workerName: string) {
	return workerName.replaceAll('-', '_');
}

export function resolvePluginConfig(
	pluginConfig: PluginConfig,
	userConfig: vite.UserConfig,
): ResolvedPluginConfig {
	const configPaths = new Set<string>();
	const persistState = pluginConfig.persistState ?? true;
	const root = userConfig.root ? path.resolve(userConfig.root) : process.cwd();

	const configPath = pluginConfig.configPath
		? path.resolve(root, pluginConfig.configPath)
		: findWranglerConfig(root);

	assert(
		configPath,
		`Config not found. Have you created a wrangler.json(c) or wrangler.toml file?`,
	);

	const entryConfigResult = getConfigResult(configPath, configPaths, true);

	if (entryConfigResult.type === 'assets-only') {
		return { ...entryConfigResult, configPaths, persistState };
	}

	const entryWorkerConfig = entryConfigResult.config;

	const entryWorkerEnvironmentName =
		pluginConfig.viteEnvironment?.name ??
		workerNameToEnvironmentName(entryWorkerConfig.name);

	const workers = {
		[entryWorkerEnvironmentName]: entryWorkerConfig,
	};

	for (const auxiliaryWorker of pluginConfig.auxiliaryWorkers ?? []) {
		const configResult = getConfigResult(
			path.resolve(root, auxiliaryWorker.configPath),
			configPaths,
		);

		assert(
			configResult.type === 'worker',
			'Unexpected error: received AssetsOnlyResult with auxiliary workers.',
		);

		const workerConfig = configResult.config;

		const workerEnvironmentName =
			auxiliaryWorker.viteEnvironment?.name ??
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
		configPaths,
		persistState,
		workers,
		entryWorkerEnvironmentName,
	};
}
