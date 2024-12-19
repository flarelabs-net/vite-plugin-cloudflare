import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { unstable_readConfig } from 'wrangler';
import { name } from '../package.json';
import type { AssetsOnlyConfig, WorkerConfig } from './plugin-config';
import type { Unstable_Config } from 'wrangler';

export type WorkerRawConfigDetails = {
	config: Unstable_Config;
	nonApplicable: {
		replacedByVite: Set<
			Extract<
				keyof Unstable_Config,
				keyof NonApplicableWorkerConfigsInfo['replacedByVite']
			>
		>;
		notRelevant: Set<
			Extract<
				keyof Unstable_Config,
				NonApplicableWorkerConfigsInfo['notRelevant'][number]
			>
		>;
		overridden: Set<
			Extract<
				keyof Unstable_Config,
				NonApplicableWorkerConfigsInfo['overridden'][number]
			>
		>;
	};
};

type NonApplicableWorkerConfigsInfo = typeof nonApplicableWorkerConfigs;

/**
 * Set of worker config options that are not applicable when using Vite
 */
export const nonApplicableWorkerConfigs = {
	/**
	 * Object containing configs that have a vite replacement, the object's field contain details about the config's replacement
	 */
	replacedByVite: {
		alias: {
			viteReplacement: 'resolve.alias',
			viteDocs: 'https://vite.dev/config/shared-options.html#resolve-alias',
		},
		define: {
			viteReplacement: 'define',
			viteDocs: 'https://vite.dev/config/shared-options.html#define',
		},
		minify: {
			viteReplacement: 'build.minify',
			viteDocs: 'https://vite.dev/config/build-options.html#build-minify',
		},
	},
	/**
	 * All the configs that are not relevant when using Vite (meaning that in the context of a Vite
	 * application they lose their purpose/meaning)
	 */
	notRelevant: [
		'base_dir',
		'build',
		'find_additional_modules',
		'no_bundle',
		'node_compat',
		'preserve_file_names',
		'site',
		'tsconfig',
		'upload_source_maps',
	],
	/**
	 * All the configs that get overridden by our plugin
	 */
	overridden: ['rules'],
} as const;

/**
 * The non applicable configs that can be and default to `undefined`
 */
const nullableNonApplicable = [
	'alias',
	'base_dir',
	'find_additional_modules',
	'minify',
	'no_bundle',
	'node_compat',
	'preserve_file_names',
	'site',
	'tsconfig',
	'upload_source_maps',
] as const;

export function readWorkerConfig(configPath: string): WorkerRawConfigDetails {
	const nonApplicable: WorkerRawConfigDetails['nonApplicable'] = {
		replacedByVite: new Set(),
		notRelevant: new Set(),
		overridden: new Set(),
	};
	const config = unstable_readConfig({ config: configPath }, {});

	nullableNonApplicable.forEach((prop) => {
		if (config[prop] !== undefined) {
			if (isReplacedByVite(prop)) {
				nonApplicable.replacedByVite.add(prop);
			}

			if (isNotRelevant(prop)) {
				nonApplicable.notRelevant.add(prop);
			}

			if (isOverridden(prop)) {
				nonApplicable.overridden.add(prop);
			}
		}
	});

	// config.build is always defined as an object and by default it has the `command` and `cwd` fields
	// set to `undefined` but the `watch_dir` field set to `"./src"`, so to check if the user set it
	// we need to check `command` and `cwd`
	if (config.build.command || config.build.cwd) {
		nonApplicable.notRelevant.add('build');
	}

	if (Object.keys(config.define).length > 0) {
		nonApplicable.replacedByVite.add('define');
	}

	if (config.rules.length > 0) {
		nonApplicable.overridden.add('rules');
	}

	return { config, nonApplicable };
}

export function getWarningForWorkersResolvedConfigs(
	configs:
		| {
				entryWorker: AssetsOnlyWorkerResolvedConfig;
		  }
		| {
				entryWorker: WorkerWithServerLogicResolvedConfig;
				auxiliaryWorkers: WorkerResolvedConfig[];
		  },
): string | undefined {
	if (
		!('auxiliaryWorkers' in configs) ||
		configs.auxiliaryWorkers.length === 0
	) {
		const nonApplicableLines = getWorkerNonApplicableWarnLines(
			configs.entryWorker,
			`  - `,
		);

		if (nonApplicableLines.length === 0) {
			return;
		}

		const lines = [
			`\n\n\x1b[43mWARNING\x1b[0m: your worker config${configs.entryWorker.config.configPath ? ` (at \`${path.relative('', configs.entryWorker.config.configPath)}\`)` : ''} contains` +
				' the following configuration options which are ignored since they are not applicable when using Vite:',
		];

		nonApplicableLines.forEach((line) => lines.push(line));

		lines.push('');
		return lines.join('\n');
	}

	const lines: string[] = [];

	const processWorkerResolvedConfig = (
		workerResolvedConfig: WorkerResolvedConfig,
		isEntryWorker = false,
	) => {
		const nonApplicableLines = getWorkerNonApplicableWarnLines(
			workerResolvedConfig,
			`    - `,
		);

		if (nonApplicableLines.length > 0) {
			lines.push(
				`  - (${isEntryWorker ? 'entry' : 'auxiliary'}) worker${workerResolvedConfig.config.name ? ` "${workerResolvedConfig.config.name}"` : ''}${workerResolvedConfig.config.configPath ? ` (config at \`${path.relative('', workerResolvedConfig.config.configPath)}\`)` : ''}`,
			);
			nonApplicableLines.forEach((line) => lines.push(line));
		}
	};

	processWorkerResolvedConfig(configs.entryWorker, true);
	configs.auxiliaryWorkers.forEach((resolvedConfig) =>
		processWorkerResolvedConfig(resolvedConfig),
	);

	if (lines.length === 0) {
		return;
	}

	return [
		'\n\x1b[43mWARNING\x1b[0m: your workers configs contain configuration options which are ignored since they are not applicable when using Vite:',
		...lines,
		'',
	].join('\n');
}

function getWorkerNonApplicableWarnLines(
	workerResolvedConfig: WorkerResolvedConfig,
	linePrefix: string,
): string[] {
	const lines: string[] = [];

	const { replacedByVite, notRelevant, overridden } =
		workerResolvedConfig.nonApplicable;

	for (const config of replacedByVite) {
		lines.push(
			`${linePrefix}\`${config}\` which is replaced by Vite's \`${nonApplicableWorkerConfigs.replacedByVite[config].viteReplacement}\` (docs: ${nonApplicableWorkerConfigs.replacedByVite[config].viteDocs})`,
		);
	}

	if (notRelevant.size > 0)
		lines.push(
			`${linePrefix}${[...notRelevant].map((config) => `\`${config}\``).join(', ')} which ${notRelevant.size > 1 ? 'are' : 'is'} not relevant in the context of a Vite project`,
		);

	if (overridden.size > 0)
		lines.push(
			`${linePrefix}${[...overridden].map((config) => `\`${config}\``).join(', ')} which ${overridden.size > 1 ? 'are' : 'is'} overridden by \`${name}\``,
		);

	return lines;
}

function isReplacedByVite(
	configName: string,
): configName is keyof NonApplicableWorkerConfigsInfo['replacedByVite'] {
	return configName in nonApplicableWorkerConfigs['replacedByVite'];
}

function isNotRelevant(
	configName: string,
): configName is NonApplicableWorkerConfigsInfo['notRelevant'][number] {
	return nonApplicableWorkerConfigs.notRelevant.includes(configName as any);
}

function isOverridden(
	configName: string,
): configName is NonApplicableWorkerConfigsInfo['overridden'][number] {
	return nonApplicableWorkerConfigs.overridden.includes(configName as any);
}

export type WorkerResolvedConfig =
	| AssetsOnlyWorkerResolvedConfig
	| WorkerWithServerLogicResolvedConfig;

interface WorkerResolvedConfigBase {
	nonApplicable: WorkerRawConfigDetails['nonApplicable'];
}

export interface AssetsOnlyWorkerResolvedConfig
	extends WorkerResolvedConfigBase {
	type: 'assets-only';
	config: AssetsOnlyConfig;
}

export interface WorkerWithServerLogicResolvedConfig
	extends WorkerResolvedConfigBase {
	type: 'worker';
	config: WorkerConfig;
}

export function getWorkerResolvedConfig(
	configPath: string,
	configPaths: Set<string>,
	isEntryWorker?: boolean,
): WorkerResolvedConfig {
	if (configPaths.has(configPath)) {
		throw new Error(`Duplicate Wrangler config path found: ${configPath}`);
	}

	const { config: workerConfig, nonApplicable } = readWorkerConfig(configPath);

	configPaths.add(configPath);

	if (isEntryWorker && !workerConfig.main) {
		assert(
			workerConfig.assets,
			`No main or assets field provided in ${workerConfig.configPath}`,
		);

		return {
			type: 'assets-only',
			config: { ...workerConfig, assets: workerConfig.assets },
			nonApplicable,
		};
	}

	assert(
		workerConfig.main,
		`No main field provided in ${workerConfig.configPath}`,
	);

	assert(
		workerConfig.name,
		`No name field provided in ${workerConfig.configPath}`,
	);

	return {
		type: 'worker',
		config: {
			...workerConfig,
			name: workerConfig.name,
			main: workerConfig.main,
		},
		nonApplicable,
	};
}

// We can't rely on `readConfig` from Wrangler to find the config as it may be relative to a different root that's set by the user.
export function findWranglerConfig(root: string): string | undefined {
	for (const extension of ['json', 'jsonc', 'toml']) {
		const configPath = path.join(root, `wrangler.${extension}`);

		if (fs.existsSync(configPath)) {
			return configPath;
		}
	}
}
