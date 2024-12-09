import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { unstable_readConfig } from 'wrangler';
import { name } from '../package.json';
import type { AssetsOnlyConfig, WorkerConfig } from './plugin-config';
import type { Optional } from './utils';
import type { Unstable_Config } from 'wrangler';

type RawWorkerConfig = Unstable_Config;

export namespace WorkersConfigurations {
	export type Worker = AssetsOnlyWorker | WorkerWithServerLogic;

	export type SanitizedWorkerConfig = Omit<
		RawWorkerConfig,
		keyof NonApplicable.All
	>;

	interface WorkerBase {
		raw: RawWorkerConfig;
		nonApplicable: NonApplicable.Map;
	}

	export interface AssetsOnlyWorker extends WorkerBase {
		type: 'assets-only';
		config: AssetsOnlyConfig;
	}

	export interface WorkerWithServerLogic extends WorkerBase {
		type: 'worker';
		config: WorkerConfig;
	}

	export namespace NonApplicable {
		type NonApplicableWorkerConfigsInfo = typeof nonApplicableWorkerConfigs;

		export type Map = {
			replacedByVite: Set<
				Extract<
					keyof RawWorkerConfig,
					keyof NonApplicableWorkerConfigsInfo['replacedByVite']
				>
			>;
			notRelevant: Set<
				Extract<
					keyof RawWorkerConfig,
					NonApplicableWorkerConfigsInfo['notRelevant'][number]
				>
			>;
			overridden: Set<
				Extract<
					keyof RawWorkerConfig,
					NonApplicableWorkerConfigsInfo['overridden'][number]
				>
			>;
		};

		export type All = ReplacedByVite | NotRelevant | Overridden;

		export type ReplacedByVite =
			keyof NonApplicableWorkerConfigsInfo['replacedByVite'];

		export type NotRelevant =
			NonApplicableWorkerConfigsInfo['notRelevant'][number];

		export type Overridden =
			NonApplicableWorkerConfigsInfo['overridden'][number];
	}
}

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

function readWorkerConfig(configPath: string): {
	raw: RawWorkerConfig;
	config: WorkersConfigurations.SanitizedWorkerConfig;
	nonApplicable: WorkersConfigurations.NonApplicable.Map;
} {
	const nonApplicable: WorkersConfigurations.NonApplicable.Map = {
		replacedByVite: new Set(),
		notRelevant: new Set(),
		overridden: new Set(),
	};
	const config: Optional<Unstable_Config, 'build' | 'define'> =
		unstable_readConfig({ config: configPath }, {});
	const raw = structuredClone(config) as Unstable_Config;

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
		delete config[prop];
	});

	// config.build is always defined as an object and by default it has the `command` and `cwd` fields
	// set to `undefined` but the `watch_dir` field set to `"./src"`, so to check if the user set it
	// we need to check `command` and `cwd`
	if (config.build && (config.build.command || config.build.cwd)) {
		nonApplicable.notRelevant.add('build');
	}
	delete config['build'];

	if (config.define && Object.keys(config.define).length > 0) {
		nonApplicable.replacedByVite.add('define');
	}
	delete config['define'];

	if (config.rules.length > 0) {
		nonApplicable.overridden.add('rules');
	}
	// Note: we cannot touch rules since Miniflare relies on this config being there

	return {
		raw,
		nonApplicable,
		config: config as WorkersConfigurations.SanitizedWorkerConfig,
	};
}

export function getWarningForWorkersConfigs(
	configs:
		| {
				entryWorker: WorkersConfigurations.AssetsOnlyWorker;
		  }
		| {
				entryWorker: WorkersConfigurations.WorkerWithServerLogic;
				auxiliaryWorkers: WorkersConfigurations.Worker[];
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

	const processWorkerConfig = (
		workerConfig: WorkersConfigurations.Worker,
		isEntryWorker = false,
	) => {
		const nonApplicableLines = getWorkerNonApplicableWarnLines(
			workerConfig,
			`    - `,
		);

		if (nonApplicableLines.length > 0) {
			lines.push(
				`  - (${isEntryWorker ? 'entry' : 'auxiliary'}) worker${workerConfig.config.name ? ` "${workerConfig.config.name}"` : ''}${workerConfig.config.configPath ? ` (config at \`${path.relative('', workerConfig.config.configPath)}\`)` : ''}`,
			);
			nonApplicableLines.forEach((line) => lines.push(line));
		}
	};

	processWorkerConfig(configs.entryWorker, true);
	configs.auxiliaryWorkers.forEach((config) => processWorkerConfig(config));

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
	workerConfig: WorkersConfigurations.Worker,
	linePrefix: string,
): string[] {
	const lines: string[] = [];

	const { replacedByVite, notRelevant, overridden } =
		workerConfig.nonApplicable;

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
): configName is WorkersConfigurations.NonApplicable.ReplacedByVite {
	return configName in nonApplicableWorkerConfigs['replacedByVite'];
}

function isNotRelevant(
	configName: string,
): configName is WorkersConfigurations.NonApplicable.NotRelevant {
	return nonApplicableWorkerConfigs.notRelevant.includes(configName as any);
}

function isOverridden(
	configName: string,
): configName is WorkersConfigurations.NonApplicable.Overridden {
	return nonApplicableWorkerConfigs.overridden.includes(configName as any);
}

export function getWorkerConfig(
	configPath: string,
	opts?: {
		visitedConfigPaths?: Set<string>;
		isEntryWorker?: boolean;
	},
): WorkersConfigurations.Worker {
	if (opts?.visitedConfigPaths?.has(configPath)) {
		throw new Error(`Duplicate Wrangler config path found: ${configPath}`);
	}

	const { raw, config, nonApplicable } = readWorkerConfig(configPath);

	opts?.visitedConfigPaths?.add(configPath);

	if (opts?.isEntryWorker && !config.main) {
		assert(
			config.assets,
			`No main or assets field provided in ${config.configPath}`,
		);

		return {
			raw: config,
			type: 'assets-only',
			config: { ...config, assets: config.assets },
			nonApplicable,
		};
	}

	assert(config.main, `No main field provided in ${config.configPath}`);

	assert(config.name, `No name field provided in ${config.configPath}`);

	return {
		type: 'worker',
		raw,
		config: {
			...config,
			name: config.name,
			main: config.main,
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
