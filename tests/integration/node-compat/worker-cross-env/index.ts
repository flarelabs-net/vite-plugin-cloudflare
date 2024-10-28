import crossFetch, { Headers } from 'cross-fetch';

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		return testImportUenvAliasedPackages();
	},
};

async function testImportUenvAliasedPackages() {
	const errors = [
		...(typeof crossFetch === 'function'
			? []
			: [
					'Expected `fetch` to be a function (default export) but got ' +
						typeof crossFetch,
				]),
		,
		typeof Headers === 'function'
			? []
			: [
					'Expected `Headers` to be a function (named export) but got ' +
						typeof Headers,
				],
	];
	if (errors.length > 0) {
		return new Response('NOT OK:\n' + errors.join('\n'));
	}
	return new Response(`"OK!"`);
}
