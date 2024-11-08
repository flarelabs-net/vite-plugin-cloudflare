export default {
	fetch(request) {
		return new Response('Hello from API');
	},
} satisfies ExportedHandler;
