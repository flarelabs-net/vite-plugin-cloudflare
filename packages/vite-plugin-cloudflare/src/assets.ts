import type { Miniflare } from 'miniflare';

export interface AssetConfig {
	htmlHandling?:
		| 'auto-trailing-slash'
		| 'force-trailing-slash'
		| 'drop-trailing-slash'
		| 'none';
	notFoundHandling?: 'single-page-application' | '404-page' | 'none';
}

export const ROUTER_WORKER_NAME = '__router-worker__';
export const ASSET_WORKER_NAME = '__asset-worker__';
export const ASSET_WORKERS_COMPATIBILITY_DATE = '2024-10-04';

export function getRouterWorker(miniflare: Miniflare) {
	return miniflare.getWorker(ROUTER_WORKER_NAME);
}