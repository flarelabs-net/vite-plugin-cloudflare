interface Env {
	MY_VAR: string;
}

export default {
	async fetch(request, env) {
		console.log('worker-env', import.meta.env);
		return new Response(env.MY_VAR);
	},
} satisfies ExportedHandler<Env>;
