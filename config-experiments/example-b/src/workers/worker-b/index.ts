import { WorkerEntrypoint } from 'cloudflare:workers';

export class NamedEntrypoint extends WorkerEntrypoint {
	add(a: number, b: number) {
		return a + b;
	}
}

export default {
	fetch(request) {
		return new Response('Worker B');
	},
} satisfies ExportedHandler;
