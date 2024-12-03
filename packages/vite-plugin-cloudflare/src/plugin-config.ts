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

type Defined<T> = Exclude<T, undefined>;

export type AssetsOnlyConfig = Config & { assets: Defined<Config['assets']> };

export type WorkerConfig = Config & {
	name: Defined<Config['name']>;
	main: Defined<Config['main']>;
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
	wranglerConfigPaths: Set<string>;
}

interface AssetsOnlyPluginConfig extends BasePluginConfig {
	type: 'assets-only';
	config: AssetsOnlyConfig;
}

export interface WorkersPluginConfig extends BasePluginConfig {
	type: 'workers';
	workers: Record<string, WorkerConfig>;
	entryWorkerEnvironmentName: string;
	wranglerConfigPaths: Set<string>;
}

export type ResolvedPluginConfig = AssetsOnlyPluginConfig | WorkersPluginConfig;

function getConfigResult(
	configPath: string,
	userConfig: vite.UserConfig,
	wranglerConfigPaths: Set<string>,
	isEntryWorker?: boolean,
): AssetsOnlyResult | WorkerResult {
	if (wranglerConfigPaths.has(configPath)) {
		throw new Error(`Duplicate Wrangler config path found: ${configPath}`);
	}

	const wranglerConfig = readConfig(configPath, {
		// We use the mode from the user config rather than the resolved config for now so that the mode has to be set explicitly. Otherwise, some things don't work as expected when `development` and `production` environments are not present.
		env: userConfig.mode,
	});

	wranglerConfigPaths.add(configPath);

	if (isEntryWorker && !wranglerConfig.main) {
		invariant(
			wranglerConfig.assets,
			`No main or assets field provided in ${wranglerConfig.configPath}`,
		);

		return {
			type: 'assets-only',
			config: { ...wranglerConfig, assets: wranglerConfig.assets },
		};
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

// We can't rely on `readConfig` from Wrangler to find the config as it may be relative to a different root that's set by the user.
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

	const entryConfigResult = getConfigResult(
		configPath,
		userConfig,
		wranglerConfigPaths,
		true,
	);

	if (entryConfigResult.type === 'assets-only') {
		return { ...entryConfigResult, wranglerConfigPaths };
	}

	const entryWorkerConfig = entryConfigResult.config;

	const entryWorkerEnvironmentName =
		pluginConfig.viteEnvironmentName ??
		workerNameToEnvironmentName(entryWorkerConfig.name);

	const workers = {
		[entryWorkerEnvironmentName]: entryWorkerConfig,
	};

	for (const auxiliaryWorker of pluginConfig.auxiliaryWorkers ?? []) {
		const configResult = getConfigResult(
			path.join(root, auxiliaryWorker.wranglerConfig),
			userConfig,
			wranglerConfigPaths,
		);

		invariant(
			configResult.type === 'worker',
			'Unexpected error: received AssetsOnlyResult with auxiliary workers.',
		);

		const workerConfig = configResult.config;

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
