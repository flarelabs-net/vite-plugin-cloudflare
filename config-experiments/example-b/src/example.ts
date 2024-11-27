// import { defineConfig } from './utils';

// export default defineConfig({
// 	keepVars: true,
// 	sendMetrics: true,
// 	environments: {
// 		staging: {
// 			accountId: 'staging-account-id',
// 			kvNamespaces: {
// 				exampleNamespace: {
// 					id: 'Staging namespace ID',
// 				},
// 			},
// 			vars: {
// 				exampleVar: 'Staging value',
// 			},
// 		},
// 		production: {
// 			accountId: 'production-account-id',
// 			kvNamespaces: {
// 				exampleNamespace: {
// 					id: 'Production namespace ID',
// 				},
// 			},
// 			vars: {
// 				exampleVar: 'Production value',
// 			},
// 		},
// 	},
// 	services: {
// 		exampleService: { service: 'workerB' },
// 	},
// 	workers: {
// 		workerA: {
// 			build: {
// 				main: './workers/worker-a/index.ts',
// 				compatibilityDate: '2024-11-26',
// 				compatibilityFlags: ['nodejs_compat'],
// 			},
// 			runtime: (environment) => ({
// 				limits: { cpuMs: 200 },
// 				logpush: true,
// 				observability: {
// 					enabled: environment === 'production' ? true : false,
// 				},
// 				triggers: { crons: ['Trigger'] },
// 			}),
// 			bindings: (resources) => ({
// 				KV_BINDING: resources.kvNamespaces.exampleNamespace,
// 				SERVICE_BINDING: resources.services.exampleService,
// 				VAR_BINDING: resources.vars.exampleVar,
// 			}),
// 		},
// 		workerB: {
// 			build: {
// 				main: './workers/worker-b/index.ts',
// 				compatibilityDate: '2024-11-26',
// 			},
// 		},
// 	},
// 	exports: (resources) => [resources.services.exampleService],
// });
