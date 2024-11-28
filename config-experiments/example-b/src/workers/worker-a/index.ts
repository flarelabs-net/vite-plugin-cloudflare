import { DurableObject } from 'cloudflare:workers';
import { defineBindings } from '../../cloudflare.config';

export const bindings = defineBindings(({ resources, vars, workers }) => ({
	D1_BINDING: resources.d1Databases.exampleDatabase,
	KV_BINDING: resources.kvNamespaces.exampleNamespace,
	QUEUE_BINDING: resources.queueProducers.exampleQueue,
	VAR_BINDING: vars.exampleVar,
	DURABLE_OBJECT_BINDING: workers.workerA.Counter,
	SERVICE_BINDING: workers.workerB.default,
	RPC_SERVICE_BINDING: workers.workerB.NamedEntrypoint,
}));

type Env = typeof bindings;

export class Counter extends DurableObject<Env> {
	increment() {}
}

export default {
	fetch(request, env) {
		return new Response('Worker A');
	},
} satisfies ExportedHandler<Env>;
