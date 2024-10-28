import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cloudflare } from '@flarelabs-net/vite-plugin-cloudflare';
import * as vite from 'vite';
import { describe, expect, test } from 'vitest';
import { getWorker, MockLogger, UNKNOWN_HOST } from '../test-helpers/src/utils';
import type { TaskResult } from 'vitest';

const root = fileURLToPath(new URL('.', import.meta.url));

describe('node.js compatibility', async () => {
	test('basic basic nodejs properties', async ({ onTestFinished }) => {
		const { worker } = await createServer('worker-basic', onTestFinished);
		const response = await worker.dispatchFetch(new Request(UNKNOWN_HOST));
		await expect(response.text()).resolves.toBe(`"OK!"`);
	});

	test('should support process global', async ({ onTestFinished }) => {
		const { worker } = await createServer('worker-process', onTestFinished);
		const response = await worker.dispatchFetch(new Request(UNKNOWN_HOST));
		const body = await response.text();
		expect(body).toMatchInlineSnapshot(`"OK!"`);
	});

	// Disabling actually querying the database in CI since we are getting this error:
	// > too many connections for role 'reader'
	test.runIf(!process.env.CI)(
		'should be able to use pg library',
		async ({ onTestFinished }) => {
			const { worker } = await createServer('worker-postgres', onTestFinished);
			const response = await worker.dispatchFetch(new Request(UNKNOWN_HOST));
			const body = await response.text();
			const result = JSON.parse(body) as { id: string };
			expect(result.id).toEqual('1');
		},
	);

	test('should be able to call `getRandomValues()` bound to any object', async ({
		onTestFinished,
	}) => {
		const { worker } = await createServer('worker-random', onTestFinished);
		const response = await worker.dispatchFetch(new Request(UNKNOWN_HOST));
		const body = await response.json();
		expect(body).toEqual([
			expect.any(String),
			expect.any(String),
			expect.any(String),
			expect.any(String),
		]);
	});

	test('crypto.X509Certificate is implemented', async ({ onTestFinished }) => {
		const { worker } = await createServer('worker-crypto', onTestFinished);
		const response = await worker.dispatchFetch(new Request(UNKNOWN_HOST));
		await expect(response.text()).resolves.toBe(`"OK!"`);
	});

	test.skip('import unenv aliased 3rd party packages (e.g. cross-env)', async ({
		onTestFinished,
	}) => {
		const { worker } = await createServer('worker-cross-env', onTestFinished);
		const response = await worker.dispatchFetch(new Request(UNKNOWN_HOST));
		await expect(response.text()).resolves.toBe(`"OK!"`);
	});
});

async function createServer(
	workerId: string,
	onTestFinished: (fn: OnTestFinishedHandler) => void,
) {
	const customLogger = new MockLogger();
	const server = await vite.createServer({
		customLogger,
		plugins: [
			cloudflare({
				workers: {
					worker: {
						main: path.join(root, `${workerId}/index.ts`),
						wranglerConfig: path.join(root, `${workerId}/wrangler.toml`),
					},
				},
				persistTo: false,
			}),
		],
	});
	const worker = getWorker(server);
	onTestFinished(() => server.close());
	return { customLogger, worker };
}

type OnTestFinishedHandler = (result: TaskResult) => Promise<void>;
