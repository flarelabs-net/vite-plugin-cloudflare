const modules = import.meta.glob('../src/**/*.ts');

export default {
	async fetch(request) {
		const url = new URL(request.url);
		const path = url.pathname;

		const filePath = `${path.replace(/^\//, './')}.ts`;

		if (modules[filePath]) {
			const mod = await modules[filePath]();
			return Response.json((mod as { default: unknown }).default);
		}

		if (path === '/@alias/test') {
			const { test } = await import('@alias/test');
			return test();
		}

		// TODO: re-introduce this
		// if (path === '/@non-existing/pkg') {
		// 	const { test } = await import('@non-existing/pkg');
		// 	return test();
		// }

		return new Response(
			`path not found: '${path}' (the available paths are: ${Object.keys(
				modules,
			)
				.map((path) => path.replace(/^\.\//, '/').replace(/\.ts$/, ''))
				.join(', ')})`,
			{ status: 404 },
		);
	},
} satisfies ExportedHandler;
