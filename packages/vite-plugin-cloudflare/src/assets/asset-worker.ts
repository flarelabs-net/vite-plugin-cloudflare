// @ts-ignore
import AssetWorker from '@cloudflare/workers-shared/dist/asset-worker.mjs';
import { UNKNOWN_HOST } from '../shared';
import type { WorkerEntrypoint } from 'cloudflare:workers';

interface Env {
	__VITE_ASSET_EXISTS__: Fetcher;
	__VITE_FETCH_ASSET__: Fetcher;
}

export default class CustomAssetWorker extends (AssetWorker as typeof WorkerEntrypoint<Env>) {
	override async fetch(request: Request): Promise<Response> {
		const response = await super.fetch!(request);
		const headers = new Headers(response.headers);
		headers.delete('ETag');
		headers.delete('Cache-Control');

		// Do we need to do anything else here to duplicate the original response?
		return new Response(response.body, {
			status: response.status,
			headers,
		});
	}
	async unstable_getByETag(
		eTag: string,
	): Promise<{ readableStream: ReadableStream; contentType: string }> {
		const url = new URL(eTag, UNKNOWN_HOST);
		const response = await this.env.__VITE_FETCH_ASSET__.fetch(url);

		if (!response.body) {
			throw new Error(`Unexpected error. No HTML found for ${eTag}.`);
		}

		return { readableStream: response.body, contentType: 'text/html' };
	}
	async unstable_exists(pathname: string): Promise<string | null> {
		// We need this regex to avoid getting `//` as a pathname, which results in an invalid URL. Should this be fixed upstream?
		const url = new URL(pathname.replace(/^\/{2,}/, '/'), UNKNOWN_HOST);
		const response = await this.env.__VITE_ASSET_EXISTS__.fetch(url);
		const exists = await response.json();

		return exists ? pathname : null;
	}
}
