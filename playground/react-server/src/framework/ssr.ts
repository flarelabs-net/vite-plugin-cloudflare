// @ts-expect-error - no types
import RSD from '@jacob-ebey/react-server-dom-vite/client';
import RDS from 'react-dom/server';
import { injectRSCPayload } from 'rsc-html-stream/server';
// @ts-expect-error - no types yet
import { bootstrapModules, manifest } from 'virtual:react-manifest';
import type { UNSAFE_ServerPayload } from './server';

export async function renderServerResponse(
	request: Request,
	serverResponse: Response,
) {
	if (request.headers.get('Accept')?.match(/\btext\/x-component\b/)) {
		return serverResponse;
	}

	if (!serverResponse.body) {
		throw new Error('Expected response body');
	}

	const [rscA, rscB] = serverResponse.body.tee();

	const payload: UNSAFE_ServerPayload = await RSD.createFromReadableStream(
		rscA,
		manifest,
	);

	const body = await RDS.renderToReadableStream(payload.root, {
		bootstrapModules,
		// @ts-expect-error - no types yet
		formState: payload.formState,
		signal: request.signal,
	});

	const headers = new Headers(serverResponse.headers);
	headers.set('Content-Type', 'text/html; charset=utf-8');

	return new Response(body.pipeThrough(injectRSCPayload(rscB)), {
		headers,
		status: serverResponse.status,
		statusText: serverResponse.statusText,
	});
}
