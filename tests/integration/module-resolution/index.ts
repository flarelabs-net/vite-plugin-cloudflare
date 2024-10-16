const allowedPaths = new Set([
	'/require-ext',
	'/require-no-ext',
	'/require-json',
	'/cloudflare-imports',
	'/external-cloudflare-imports',

	'/third-party/react',
	'/third-party/remix',
	'/third-party/discord-api-types',
	'/third-party/slash-create',
]);

// Needed by the react 3rd party library
// Turning on nodejs_compat v2 causes the `slash-create` library to fail
globalThis.process = { env: {} } as (typeof globalThis)['process'];

export default {
	async fetch(request) {
		const url = new URL(request.url);
		const path = url.pathname;

		if (allowedPaths.has(path)) {
			const mod = await import(/* @vite-ignore */ `./src${path}`);
			return Response.json(mod.default);
		}

		return new Response(`path not found: '${path}'`, { status: 404 });
	},
} satisfies ExportedHandler;
