export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		return testPostgresLibrary(env, ctx);
	},
};

async function testPostgresLibrary(env: Env, ctx: ExecutionContext) {
	const { Client } = await import('pg');
	const client = new Client({
		user: env.DB_USERNAME,
		password: env.DB_PASSWORD,
		host: env.DB_HOSTNAME,
		port: Number(env.DB_PORT),
		database: env.DB_NAME,
	});
	await client.connect();
	const result = await client.query(`SELECT * FROM rnc_database`);
	// Return the first row as JSON
	const resp = new Response(JSON.stringify(result.rows[0]), {
		headers: { 'Content-Type': 'application/json' },
	});

	// Clean up the client
	ctx.waitUntil(client.end());
	return resp;
}
