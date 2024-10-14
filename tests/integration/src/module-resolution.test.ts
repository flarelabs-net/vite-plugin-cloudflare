import { beforeEach, describe, expect, test } from 'vitest';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import * as vite from 'vite';
import { cloudflare } from '@flarelabs-net/vite-plugin-cloudflare';
import { assertIsFetchableDevEnvironment, UNKNOWN_HOST } from './utils';

const root = fileURLToPath(new URL('./', import.meta.url));
const fixtureRoot = path.join(root, 'fixtures', 'module-resolution');

let server: vite.ViteDevServer;
let customLogger: MockLogger;

describe('module resolution', async () => {
	beforeEach(async () => {
		customLogger = new MockLogger();
		server = await vite.createServer({
			customLogger,
			plugins: [
				cloudflare({
					workers: {
						worker: {
							main: path.join(fixtureRoot, 'index.ts'),
							wranglerConfig: path.join(fixtureRoot, 'wrangler.toml'),
							overrides: {
								resolve: {
									// We're testing module resolution for external modules, so let's treat everything as external
									// (if we were not to do this all the packages in cloudflare-dev-module-resolution/packages
									// wouldn't be treated as such)
									external: true,
								},
							},
						},
					},
					persistTo: false,
				}),
			],
		});
	});

	describe('basic module resolution', () => {
		test('`require` js/cjs files with specifying their file extension', async () => {
			const response = await getWorker(server).dispatchFetch(
				new Request(new URL('/require-ext', UNKNOWN_HOST)),
			);
			const result = await response.json();

			expect(getFallbackErrors(customLogger)).toMatchInlineSnapshot(`
				[
				  ".%2Fhello.cjs",
				  ".%2Fworld.js",
				]
			`);

			expect(result).toEqual({
				'(requires/ext) hello.cjs (wrong-extension)': null,
				'(requires/ext) helloWorld': 'hello (.js) world (.cjs)',
				'(requires/ext) world.js (wrong-extension)': null,
			});
		});

		test('`require` js/cjs files without specifying their file extension', async () => {
			const response = await getWorker(server).dispatchFetch(
				new Request(new URL('/require-no-ext', UNKNOWN_HOST)),
			);
			const result = await response.json();

			expect(result).toEqual({
				'(requires/no-ext) helloWorld': 'hello (.js) world (.cjs)',
			});
		});

		test('`require` json files', async () => {
			const response = await getWorker(server).dispatchFetch(
				new Request(new URL('/require-json', UNKNOWN_HOST)),
			);
			const result = await response.json();

			expect(result).toEqual({
				'(requires/json) package name':
					'@cloudflare-dev-module-resolution/requires',
				'(requires/json) package version': '1.0.0',
			});
		});
	});

	describe('Cloudflare specific module resolution', () => {
		test('internal imports from `cloudflare:*`', async () => {
			const response = await getWorker(server).dispatchFetch(
				new Request(new URL('/cloudflare-imports', UNKNOWN_HOST)),
			);
			const result = await response.json();

			expect(result).toEqual({
				'(cloudflare:workers) WorkerEntrypoint.name': 'WorkerEntrypoint',
				'(cloudflare:workers) DurableObject.name': 'DurableObject',
				'(cloudflare:sockets) typeof connect': 'function',
			});
		});

		test('external imports from `cloudflare:*`', async () => {
			const response = await getWorker(server).dispatchFetch(
				new Request(new URL('/external-cloudflare-imports', UNKNOWN_HOST)),
			);
			const result = await response.json();

			expect(result).toEqual({
				'(EXTERNAL) (cloudflare:workers) DurableObject.name': 'DurableObject',
			});
		});
	});

	/**
	 *  These tests check that module resolution works as intended for various third party npm packages (these tests are more
	 *  realistic but less helpful than the other ones (these can be considered integration tests whilst the other unit tests)).
	 *
	 *  These are packages that involve non-trivial module resolutions (and that in the past we had issues with), they have no
	 *  special meaning to us.
	 */
	describe('third party packages resolutions', () => {
		test('react', async () => {
			const response = await getWorker(server).dispatchFetch(
				new Request(new URL('/third-party/react', UNKNOWN_HOST)),
			);
			const result = await response.json();

			expect(result).toEqual({
				'(react) reactVersionsMatch': true,
				'(react) typeof React': 'object',
				'(react) typeof React.cloneElement': 'function',
			});
		});

		test('@remix-run/cloudflare', async () => {
			const response = await getWorker(server).dispatchFetch(
				new Request(new URL('/third-party/remix', UNKNOWN_HOST)),
			);
			const result = await response.json();

			expect(result).toEqual({
				'(remix) remixRunCloudflareCookieName':
					'my-remix-run-cloudflare-cookie',
				'(remix) typeof cloudflare json({})': 'object',
			});
		});

		test('discord-api-types/v10', async () => {
			const response = await getWorker(server).dispatchFetch(
				new Request(new URL('/third-party/discord-api-types', UNKNOWN_HOST)),
			);
			const result = await response.json();

			expect(result).toEqual({
				'(discord-api-types/v10) RPCErrorCodes.InvalidUser': 4010,
				'(discord-api-types/v10) Utils.isLinkButton({})': false,
			});
		});

		test('slash-create', async () => {
			const response = await getWorker(server).dispatchFetch(
				new Request(new URL('/third-party/slash-create', UNKNOWN_HOST)),
			);
			const result = await response.json();

			expect(result).toEqual({
				'(slash-create/web) VERSION': '6.2.1',
				'(slash-create/web) myCollection.random()': 54321,
				'(slash-create/web) slashCreatorInstance is instance of SlashCreator':
					true,
			});
		});
	});
});

function getWorker(server: vite.ViteDevServer) {
	const worker = server.environments.worker;
	assertIsFetchableDevEnvironment(worker);
	return worker;
}

class MockLogger implements vite.Logger {
	logs: string[][] = [];
	hasWarned = false;

	info(msg: string, options?: vite.LogOptions): void {
		this.logs.push(['info', msg]);
	}
	warn(msg: string, options?: vite.LogOptions): void {
		this.hasWarned = true;
		this.logs.push(['warn', msg]);
	}
	warnOnce(msg: string, options?: vite.LogOptions): void {
		this.hasWarned = true;
		this.logs.push(['warnOnce', msg]);
	}
	error(msg: string, options?: vite.LogErrorOptions): void {
		this.logs.push(['error', msg]);
	}
	clearScreen(type: vite.LogType): void {
		this.logs.push(['clear screen']);
	}
	hasErrorLogged(error: Error | vite.Rollup.RollupError): boolean {
		throw new Error('Not implemented');
	}
}

function getFallbackErrors(logger: MockLogger) {
	return logger.logs
		.map(
			(log) =>
				log[0] === 'error' &&
				log[1]?.match(
					/Fallback service failed to fetch module;.+rawSpecifier=(.+)(:?&|\n)/,
				)?.[1],
		)
		.filter(Boolean);
}
