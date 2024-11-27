import { defineConfig } from './utils';
import * as workerA from './workers/worker-a';

export const { defineBindings } = defineConfig({
	environments: {
		production: {
			d1Databases: {
				exampleDatabase: {
					databaseName: 'Production database',
					databaseId: '12345',
				},
			},
			kvNamespaces: {
				exampleNamespace: {
					id: '12345',
				},
			},
			vars: {
				EXAMPLE_VAR: 'Production var',
			},
		},
		staging: {
			d1Databases: {
				exampleDatabase: {
					databaseName: 'Staging database',
					databaseId: '12345',
				},
			},
			kvNamespaces: {
				exampleNamespace: {
					id: '12345',
				},
			},
			vars: {
				EXAMPLE_VAR: 'Staging var',
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
				observability: {
					enabled: environment === 'production' ? true : false,
				},
				triggers: { crons: ['Trigger'] },
			}),
		},
	},
});
