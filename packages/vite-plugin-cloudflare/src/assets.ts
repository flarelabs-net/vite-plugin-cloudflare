import type { Miniflare } from 'miniflare';

export const ROUTER_WORKER_NAME = '__router-worker__';
export const ASSET_WORKER_NAME = '__asset-worker__';

export function getRouterWorker(miniflare: Miniflare) {
	return miniflare.getWorker(ROUTER_WORKER_NAME);
}
