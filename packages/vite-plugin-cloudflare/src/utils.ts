import * as path from 'node:path';
import { Request as MiniflareRequest } from 'miniflare';
import * as vite from 'vite';

export function getOutputDirectory(
	userConfig: vite.UserConfig,
	environmentName: string,
) {
	const rootOutputDirectory = userConfig.build?.outDir ?? 'dist';

	return (
		userConfig.environments?.[environmentName]?.build?.outDir ??
		path.join(rootOutputDirectory, environmentName)
	);
}

export function toMiniflareRequest(request: Request): MiniflareRequest {
	return new MiniflareRequest(request.url, {
		method: request.method,
		headers: [['accept-encoding', 'identity'], ...request.headers],
		body: request.body,
		duplex: 'half',
	});
}

export type Optional<T, K extends keyof T> = Omit<T, K> & Pick<Partial<T>, K>;
