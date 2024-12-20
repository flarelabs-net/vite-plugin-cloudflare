import assert from 'node:assert';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as vite from 'vite';
import type { ResolvedPluginConfig } from './plugin-config';

interface DeployConfig {
	configPath: string;
	auxiliaryWorkers: Array<{ configPath: string }>;
}

export async function writeDeployConfig(
	resolvedPluginConfig: ResolvedPluginConfig,
	resolvedViteConfig: vite.ResolvedConfig,
) {
	const deployConfigDirectory = path.resolve(
		resolvedViteConfig.root,
		'.wrangler',
		'deploy',
	);

	await fsp.mkdir(deployConfigDirectory, { recursive: true });

	if (resolvedPluginConfig.type === 'assets-only') {
		const clientOutputDirectory =
			resolvedViteConfig.environments.client?.build.outDir;

		assert(
			clientOutputDirectory,
			'Unexpected error: client environment output directory is undefined',
		);

		const deployConfig: DeployConfig = {
			configPath: path.relative(
				deployConfigDirectory,
				path.resolve(clientOutputDirectory, 'wrangler.json'),
			),
			auxiliaryWorkers: [],
		};

		await fsp.writeFile(
			path.join(deployConfigDirectory, 'config.json'),
			JSON.stringify(deployConfig),
		);
	} else {
		const workerConfigPaths = Object.fromEntries(
			Object.keys(resolvedPluginConfig.workers).map((environmentName) => {
				const outputDirectory =
					resolvedViteConfig.environments[environmentName]?.build.outDir;

				assert(
					outputDirectory,
					`Unexpected error: ${environmentName} environment output directory is undefined`,
				);

				const configPath = path.relative(
					deployConfigDirectory,
					path.resolve(
						resolvedViteConfig.root,
						outputDirectory,
						'wrangler.json',
					),
				);

				return [environmentName, configPath];
			}),
		);

		const { entryWorkerEnvironmentName } = resolvedPluginConfig;
		const configPath = workerConfigPaths[entryWorkerEnvironmentName];

		assert(
			configPath,
			`Unexpected error: ${entryWorkerEnvironmentName} environment output directory is undefined`,
		);

		const auxiliaryWorkers = Object.entries(workerConfigPaths)
			.filter(
				([environmentName]) => environmentName !== entryWorkerEnvironmentName,
			)
			.map(([_, configPath]) => ({ configPath }));

		const deployConfig: DeployConfig = { configPath, auxiliaryWorkers };

		await fsp.writeFile(
			path.join(deployConfigDirectory, 'config.json'),
			JSON.stringify(deployConfig),
		);
	}
}
