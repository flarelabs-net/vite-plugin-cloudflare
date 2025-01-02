import { renderServerResponse } from '../framework/ssr';

type CloudflareEnv = {
	SERVER: Fetcher;
};

export default {
	async fetch(request, { SERVER }) {
		const serverResponse = await SERVER.fetch(request);

		return renderServerResponse(request, serverResponse);
	},
} satisfies ExportedHandler<CloudflareEnv>;
