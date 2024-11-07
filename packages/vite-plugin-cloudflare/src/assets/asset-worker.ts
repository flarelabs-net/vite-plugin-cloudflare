// @ts-ignore
import AssetWorker from '@cloudflare/workers-shared/dist/asset-worker.mjs';
import type { WorkerEntrypoint } from 'cloudflare:workers';

interface Env {
	__VITE_FETCH_HTML__: Fetcher;
}

export default class CustomAssetWorker extends (AssetWorker as typeof WorkerEntrypoint<Env>) {
	override async fetch(request: Request): Promise<Response> {
		const response = await this.env.__VITE_FETCH_HTML__.fetch(request);

		return response;
	}
	unstable_exists(pathname: string): Promise<string | null> {
		return new Promise((resolve) => resolve(null));
	}
}
