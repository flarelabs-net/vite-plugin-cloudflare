import.meta.hot?.on('custom-event', (payload) => {
	console.log(`__${payload}-received__`);
});

export default {
	async fetch() {
		return new Response('OK');
	},
};
