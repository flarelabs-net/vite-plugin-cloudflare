import html from './index.html?raw';
import { DurableObject } from 'cloudflare:workers';

interface Env {
	WEBSOCKET_SERVER: DurableObjectNamespace<WebSocketServer>;
}

export class WebSocketServer extends DurableObject {
	#currentlyConnectedWebSockets = 0;

	override async fetch(request: Request) {
		const { 0: client, 1: server } = new WebSocketPair();

		server.accept();
		this.#currentlyConnectedWebSockets += 1;

		server.addEventListener('message', (event) => {
			console.log('DO received client event', event);
			server.send(
				`[Durable Object] currentlyConnectedWebSockets: ${this.#currentlyConnectedWebSockets}`,
			);
		});

		server.addEventListener('close', (event) => {
			console.log('CLOSE');
			this.#currentlyConnectedWebSockets -= 1;
			server.close(event.code, 'Durable Object is closing WebSocket');
		});

		return new Response(null, { status: 101, webSocket: client });
	}
}

export default {
	async fetch(request, env) {
		if (request.url.endsWith('/websocket')) {
			const upgradeHeader = request.headers.get('Upgrade');

			if (!upgradeHeader || upgradeHeader !== 'websocket') {
				return new Response('Durable Object expected Upgrade: websocket', {
					status: 426,
				});
			}

			const id = env.WEBSOCKET_SERVER.idFromName('');
			const stub = env.WEBSOCKET_SERVER.get(id);

			return stub.fetch(request);
		}

		return new Response(html, { headers: { 'content-type': 'text/html' } });
	},
} satisfies ExportedHandler<Env>;
