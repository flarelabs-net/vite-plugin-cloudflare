import { describe, expect, test } from 'vitest';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import * as vite from 'vite';
import { cloudflare } from '@flarelabs-net/vite-plugin-cloudflare';
import { assertIsFetchableDevEnvironment, UNKNOWN_HOST } from './utils';

const root = fileURLToPath(new URL('.', import.meta.url));

describe('durable objects', () => {
	const fixtureRoot = path.join(root, './fixtures/durable-objects');

	test('retains in-memory state', async () => {
		const server = await vite.createServer({
			plugins: [
				cloudflare({
					workers: {
						worker: {
							main: path.join(fixtureRoot, 'worker-a', 'index.ts'),
							wranglerConfig: path.join(
								fixtureRoot,
								'worker-a',
								'wrangler.toml',
							),
						},
					},
				}),
			],
		});

		const worker = server.environments.worker;
		assertIsFetchableDevEnvironment(worker);

		const response = await worker.dispatchFetch(new Request(UNKNOWN_HOST));
		const result = await response.json();

		expect(result).toEqual({ resultA: { count: 0 }, resultB: { count: 3 } });
	});

	test('can access `ctx.storage`', async () => {
		const server = await vite.createServer({
			plugins: [
				cloudflare({
					workers: {
						worker: {
							main: path.join(fixtureRoot, 'worker-b', 'index.ts'),
							wranglerConfig: path.join(
								fixtureRoot,
								'worker-b',
								'wrangler.toml',
							),
						},
					},
				}),
			],
		});

		const worker = server.environments.worker;
		assertIsFetchableDevEnvironment(worker);

		const responseA = await worker.dispatchFetch(
			new Request(new URL('?name=A', UNKNOWN_HOST)),
		);
		const resultA = await responseA.json();

		expect(resultA).toEqual({ name: 'A', count: 0 });

		await worker.dispatchFetch(
			new Request(new URL('increment?name=A', UNKNOWN_HOST)),
		);
		await worker.dispatchFetch(
			new Request(new URL('increment?name=A', UNKNOWN_HOST)),
		);

		const responseB = await worker.dispatchFetch(
			new Request(new URL('?name=A', UNKNOWN_HOST)),
		);
		const resultB = await responseB.json();

		expect(resultB).toEqual({ name: 'A', count: 2 });
	});

	test('isolates Durable Object instances', async () => {
		const server = await vite.createServer({
			plugins: [
				cloudflare({
					workers: {
						worker: {
							main: path.join(fixtureRoot, 'worker-b', 'index.ts'),
							wranglerConfig: path.join(
								fixtureRoot,
								'worker-b',
								'wrangler.toml',
							),
						},
					},
				}),
			],
		});

		const worker = server.environments.worker;
		assertIsFetchableDevEnvironment(worker);

		await worker.dispatchFetch(
			new Request(new URL('increment?name=A', UNKNOWN_HOST)),
		);
		await worker.dispatchFetch(
			new Request(new URL('increment?name=A', UNKNOWN_HOST)),
		);

		const responseA = await worker.dispatchFetch(
			new Request(new URL('?name=A', UNKNOWN_HOST)),
		);
		const resultA = await responseA.json();

		const responseB = await worker.dispatchFetch(
			new Request(new URL('?name=B', UNKNOWN_HOST)),
		);
		const resultB = await responseB.json();

		expect(resultA).toEqual({ name: 'A', count: 2 });
		expect(resultB).toEqual({ name: 'B', count: 0 });
	});
});
