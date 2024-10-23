import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cloudflare } from '@flarelabs-net/vite-plugin-cloudflare';
import * as vite from 'vite';
import { beforeEach, describe, test } from 'vitest';
import { getWorker, MockLogger, UNKNOWN_HOST } from '../test-helpers/src/utils';
import type { FetchableDevEnvironment } from '../test-helpers/src/utils';

const root = fileURLToPath(new URL('.', import.meta.url));
let server: vite.ViteDevServer;
let customLogger: MockLogger;
let worker: FetchableDevEnvironment;

describe('service bindings', async () => {
	beforeEach(async ({ onTestFinished }) => {
		customLogger = new MockLogger();
		server = await vite.createServer({
			customLogger,
			plugins: [
				cloudflare({
					workers: {
						worker: {
							main: path.join(root, 'worker/index.ts'),
							wranglerConfig: path.join(root, 'worker/wrangler.toml'),
						},
					},
					entryWorker: 'worker',
					persistTo: false,
				}),
			],
		});
		worker = getWorker(server);
		onTestFinished(() => server.close());
	});

	test('should work when running code requiring polyfills', async ({
		expect,
	}) => {
		const response = await worker.dispatchFetch(
			new Request(new URL('test-process', UNKNOWN_HOST)),
		);
		const body = await response.text();
		expect(body).toMatchInlineSnapshot(`"OK!"`);

		// Disabling actually querying the database in CI since we are getting this error:
		// > too many connections for role 'reader'
		if (!process.env.CI) {
			const response = await worker.dispatchFetch(
				new Request(new URL('query', UNKNOWN_HOST)),
			);
			const body = await response.text();
			console.log(body);
			const result = JSON.parse(body) as { id: string };
			expect(result.id).toEqual('1');
		}
	});

	test('should be able to call `getRandomValues()` bound to any object', async ({
		expect,
	}) => {
		const response = await worker.dispatchFetch(
			new Request(new URL('test-random', UNKNOWN_HOST)),
		);
		const body = await response.json();
		expect(body).toEqual([
			expect.any(String),
			expect.any(String),
			expect.any(String),
			expect.any(String),
		]);
	});

	test('crypto.X509Certificate is implemented', async ({ expect }) => {
		const response = await worker.dispatchFetch(
			new Request(new URL('test-x509-certificate', UNKNOWN_HOST)),
		);
		await expect(response.text()).resolves.toBe(`"OK!"`);
	});

	test('import unenv aliased packages', async ({ expect }) => {
		const response = await worker.dispatchFetch(
			new Request(new URL('test-require-alias', UNKNOWN_HOST)),
		);
		await expect(response.text()).resolves.toBe(`"OK!"`);
	});
});
