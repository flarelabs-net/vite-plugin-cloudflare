import { DurableObject, WorkerEntrypoint } from 'cloudflare:workers';
import { defineBindings } from '../../cloudflare.config';

export const bindings = defineBindings(({ resources, vars, workers }) => ({
	D1_BINDING: resources.d1Databases.exampleDatabase,
	KV_BINDING: resources.kvNamespaces.exampleNamespace,
	QUEUE_BINDING: resources.queueProducers.exampleQueue,
	VAR_BINDING: vars.exampleVar,
	SERVICE_BINDING: workers.workerA.default,
	RPC_SERVICE_BINDING: workers.workerA.NamedEntrypoint,
	DURABLE_OBJECT_BINDING: workers.workerA.Counter,
}));

type Env = typeof bindings;

export class Counter extends DurableObject<Env> {
	increment() {}
}

export class NamedEntrypoint extends WorkerEntrypoint<Env> {
	add(a: number, b: number) {
		return a + b;
	}
}

export default {
	fetch(request, env) {
		return new Response('Worker A');
	},
} satisfies ExportedHandler<Env>;
