import { DurableObject } from 'cloudflare:workers';

export class Counter extends DurableObject {
	#count = 0;

	override fetch(request: Request) {
		return Response.json({ count: this.#count++ });
	}
}

export default {
	async fetch(request, env, ctx) {
		const id = env.DURABLE_OBJECT.idFromName('counter');
		const stub = env.DURABLE_OBJECT.get(id);

		const response = await stub.fetch(request);

		return response;
		// const url = new URL(request.url);
		// const fetchResponse = await env.WORKER_B.fetch(request);
		// const fetchResult = await fetchResponse.json();
		// const rpcResult = await env.WORKER_B.add(4, 5);
		// const namedEntrypointResult = await env.NAMED_ENTRYPOINT.multiply(3, 4);

		// return Response.json({
		// 	name: 'Worker A',
		// 	pathname: url.pathname,
		// 	worker_b_fetch_result: fetchResult,
		// 	worker_b_rpc_result: rpcResult,
		// 	named_entrypoint_result: namedEntrypointResult,
		// });
	},
} satisfies ExportedHandler<Env>;
