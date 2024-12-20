import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vite from 'vite';
import type { ResolvedPluginConfig } from './plugin-config';

interface DeployConfig {
	configPath: string;
	auxiliaryWorkers: Array<{ configPath: string }>;
}

function getDeployConfigPath(root: string) {
	return path.resolve(root, '.wrangler', 'deploy', 'config.json');
}

export function getConfigPaths(root: string) {
	const deployConfigPath = getDeployConfigPath(root);
	const deployConfig = JSON.parse(
		fs.readFileSync(deployConfigPath, 'utf-8'),
	) as DeployConfig;

	return [
		{ configPath: deployConfig.configPath },
		...deployConfig.auxiliaryWorkers,
	].map(({ configPath }) =>
		path.resolve(path.dirname(deployConfigPath), configPath),
	);
}

export function writeDeployConfig(
	resolvedPluginConfig: ResolvedPluginConfig,
	resolvedViteConfig: vite.ResolvedConfig,
) {
	const deployConfigPath = getDeployConfigPath(resolvedViteConfig.root);
	const deployConfigDirectory = path.dirname(deployConfigPath);

	fs.mkdirSync(deployConfigDirectory, { recursive: true });

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
				path.resolve(
					resolvedViteConfig.root,
					clientOutputDirectory,
					'wrangler.json',
				),
			),
			auxiliaryWorkers: [],
		};

		fs.writeFileSync(deployConfigPath, JSON.stringify(deployConfig));
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

		fs.writeFileSync(deployConfigPath, JSON.stringify(deployConfig));
	}
}
