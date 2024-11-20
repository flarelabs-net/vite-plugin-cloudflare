export default {
	async fetch() {
		import.meta.hot?.send('event');
		return new Response('OK');
	},
};
