import { getNodeCompat } from 'miniflare';
import type { SourcelessWorkerOptions } from 'wrangler';

export function isNodeCompat({
	compatibilityDate,
	compatibilityFlags,
}: SourcelessWorkerOptions): boolean {
	const nodeCompatMode = getNodeCompat(
		compatibilityDate,
		compatibilityFlags ?? [],
	).mode;
	if (nodeCompatMode === 'v2') {
		return true;
	}
	if (nodeCompatMode === 'legacy') {
		throw new Error(
			'Unsupported Node.js compat mode (legacy). Remove the `node_compat` setting and add the `nodejs_compat` flag instead.',
		);
	}
	if (nodeCompatMode === 'v1') {
		throw new Error(
			`Unsupported Node.js compat mode (v1). Only the v2 mode is supported, either change your compat date to "2024-09-23" or later, or set the "nodejs_compat_v2" compatibility flag`,
		);
	}
	return false;
}
