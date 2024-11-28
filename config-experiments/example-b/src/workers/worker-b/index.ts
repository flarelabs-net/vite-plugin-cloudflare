import { defineBindings } from '../../cloudflare.config';

export const bindings = defineBindings(({ resources, vars, workers }) => ({
	SERVICE_BINDING: workers.workerA.default,
}));

type Env = typeof bindings;

export default {
	fetch(request, env) {
		return new Response('Worker A');
	},
} satisfies ExportedHandler<Env>;
