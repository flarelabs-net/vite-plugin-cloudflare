import { defineConfig } from './utils';
import * as workerA from './workers/worker-a';

export const { defineBindings } = defineConfig({
	environments: {
		production: {
			kvNamespaces: {
				exampleNamespace: {
					id: '12345',
				},
			},
		},
	},
	workers: {
		workerA: {
			build: {
				module: workerA,
				compatibilityDate: '2024-11-27',
			},
			runtime: (environment) => ({}),
		},
	},
});

// const bindings = defineBindings(({ resources, workers }) => ({
// 	KV_BINDING: resources.kvNamespaces.exampleNamespace,
// 	SERVICE_BINDING: workers.workerA.default,
// 	WORKER_ENTRYPOINT_SERVICE_BINDING: workers.workerA.NamedEntrypoint,
// 	DURABLE_OBJECT_BINDING: workers.workerA.Counter,
// }));
