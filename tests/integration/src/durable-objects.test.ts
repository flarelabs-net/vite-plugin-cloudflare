import { describe, expect, test } from 'vitest';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import * as vite from 'vite';
import { cloudflare } from '@flarelabs-net/vite-plugin-cloudflare';
import { assertIsFetchableDevEnvironment, UNKNOWN_HOST } from './utils';

const root = fileURLToPath(new URL('./', import.meta.url));

describe('durable objects', async () => {
	const fixtureRoot = path.join(root, './fixtures/durable-objects');
	const server = await vite.createServer({
		plugins: [
			cloudflare({
				workers: {
					worker: {
						main: path.join(fixtureRoot, 'worker', 'index.ts'),
						wranglerConfig: path.join(fixtureRoot, 'worker', 'wrangler.toml'),
					},
				},
			}),
		],
	});

	const worker = server.environments.worker;
	assertIsFetchableDevEnvironment(worker);

	test('retains in-memory state', async () => {
		const response = await worker.dispatchFetch(new Request(UNKNOWN_HOST));
		const result = await response.json();

		expect(result).toEqual({ resultA: { count: 0 }, resultB: { count: 3 } });
	});
});
