import { unstable_readConfig } from 'wrangler';
import type { Unstable_Config } from 'wrangler';

type WorkerConfigDetails = {
	config: Unstable_Config;
};

export function readWorkerConfig(
	configPath: string,
	mode: 'dev' | 'preview' = 'dev',
): WorkerConfigDetails {
	const config = unstable_readConfig(configPath, {});
	// TODO: clean config and collect info
	return { config };
}
