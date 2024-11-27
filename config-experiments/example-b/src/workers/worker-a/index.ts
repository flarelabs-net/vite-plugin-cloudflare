import { DurableObject, WorkerEntrypoint } from 'cloudflare:workers';
import { defineBindings } from '../../cloudflare.config';

const bindings = defineBindings(({ resources, workers }) => ({
	KV_BINDING: resources.kvNamespaces.exampleNamespace,
	SERVICE_BINDING: workers.workerA.default,
	WORKER_ENTRYPOINT_SERVICE_BINDING: workers.workerA.NamedEntrypoint,
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
