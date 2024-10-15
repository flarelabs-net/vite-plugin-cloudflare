import { OK } from 'zod';

export default {
	async fetch() {
		return new Response('Hello World! ===> ' + OK.name);
	},
};
