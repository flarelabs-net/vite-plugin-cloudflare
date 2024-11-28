import { defineConfig } from './utils';
import * as workerA from './workers/worker-a' with { type: 'cloudflare-worker' };
import * as workerB from './workers/worker-b' with { type: 'cloudflare-worker' };

export const { config, defineBindings } = defineConfig({
	keepVars: true,
	sendMetrics: true,
	environments: {
		production: {
			accountId: 'Production account ID',
			d1Databases: {
				exampleDatabase: {
					databaseName: 'Production database name',
					databaseId: 'Production database ID',
				},
			},
			kvNamespaces: {
				exampleNamespace: {
					id: 'Production namespace ID',
				},
			},
			queueProducers: {
				exampleQueue: {
					queue: 'Production queue',
				},
			},
			vars: {
				exampleVar: 'Production var',
			},
		},
		staging: {
			accountId: 'Staging account ID',
			d1Databases: {
				exampleDatabase: {
					databaseName: 'Staging database name',
					databaseId: 'Staging database ID',
				},
			},
			kvNamespaces: {
				exampleNamespace: {
					id: 'Staging namespace ID',
				},
			},
			queueProducers: {
				exampleQueue: {
					queue: 'Staging queue',
				},
			},
			vars: {
				exampleVar: 'Staging var',
			},
		},
	},
	workers: {
		workerA: {
			build: {
				module: workerA,
				compatibilityDate: '2024-11-27',
			},
			runtime: (environment) => ({
				limits: { cpuMs: 200 },
				logpush: true,
				queueConsumers: [{ queue: 'exampleQueue' }],
				observability: {
					enabled: environment === 'production' ? true : false,
				},
				triggers: { crons: ['Trigger'] },
			}),
		},
		workerB: {
			build: {
				module: workerB,
				compatibilityDate: '2024-11-27',
			},
		},
	},
});
