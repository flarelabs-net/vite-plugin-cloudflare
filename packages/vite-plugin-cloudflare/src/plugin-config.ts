import assert from 'node:assert';
import * as path from 'node:path';
import * as vite from 'vite';
import {
	findWranglerConfig,
	getWarningForWorkersResolvedConfigs,
	getWorkerResolvedConfig,
} from './worker-config';
import type { WorkerResolvedConfig } from './worker-config';
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

	const entryWorkerResolvedConfig = getWorkerResolvedConfig(
		configPath,
		configPaths,
		true,
	);

	if (entryWorkerResolvedConfig.type === 'assets-only') {
		const workersConfigsWarning = getWarningForWorkersResolvedConfigs(
			entryWorkerResolvedConfig,
		);
		if (workersConfigsWarning) {
			console.warn(workersConfigsWarning);
		}

		return { ...entryWorkerResolvedConfig, configPaths, persistState };
	}

	const entryWorkerConfig = entryWorkerResolvedConfig.config;

	const entryWorkerEnvironmentName =
		pluginConfig.viteEnvironment?.name ??
		workerNameToEnvironmentName(entryWorkerConfig.name);

	const workers = {
		[entryWorkerEnvironmentName]: entryWorkerConfig,
	};

	const auxiliaryWorkersResolvedConfigs: WorkerResolvedConfig[] = [];

	for (const auxiliaryWorker of pluginConfig.auxiliaryWorkers ?? []) {
		const workerResolvedConfig = getWorkerResolvedConfig(
			path.resolve(root, auxiliaryWorker.configPath),
			configPaths,
		);

		auxiliaryWorkersResolvedConfigs.push(workerResolvedConfig);

		assert(
			workerResolvedConfig.type === 'worker',
			'Unexpected error: received AssetsOnlyResult with auxiliary workers.',
		);

		const workerConfig = workerResolvedConfig.config;

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

	const workersConfigsWarning = getWarningForWorkersResolvedConfigs(
		entryWorkerResolvedConfig,
		auxiliaryWorkersResolvedConfigs,
	);
	if (workersConfigsWarning) {
		console.warn(workersConfigsWarning);
	}

	return {
		type: 'workers',
		configPaths,
		persistState,
		workers,
		entryWorkerEnvironmentName,
	};
}
