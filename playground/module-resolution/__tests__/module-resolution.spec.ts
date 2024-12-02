import { afterAll, describe, expect, test } from 'vitest';
import {
	getJsonResponse,
	getTextResponse,
	isBuild,
	page,
	serverLogs,
	viteTestUrl,
} from '../../__test-utils__';

describe('module resolution', async () => {
	afterAll(() => {
		const unexpectedErrors = serverLogs.errors.filter(
			(error) => !error.includes('@non-existing/pkg'),
		);
		expect(unexpectedErrors).toEqual([]);
	});

	describe('basic module resolution', () => {
		test('`require` js/cjs files with specifying their file extension', async () => {
			const result = await getJsonResponse('/require-ext');
			expect(result).toEqual({
				'(requires/ext) hello.cjs (wrong-extension)': null,
				'(requires/ext) helloWorld': 'hello (.js) world (.cjs)',
				'(requires/ext) world.js (wrong-extension)': null,
			});
		});

		test('`require` js/cjs files without specifying their file extension', async () => {
			const result = await getJsonResponse('/require-no-ext');
			expect(result).toEqual({
				'(requires/no-ext) helloWorld': 'hello (.js) world (.cjs)',
			});
		});

		test('`require` json files', async () => {
			const result = await getJsonResponse('/require-json');
			expect(result).toEqual({
				'(requires/json) package name':
					'@playground/module-resolution-requires',
				'(requires/json) package version': '1.0.0',
			});
		});
	});

	describe('Cloudflare specific module resolution', () => {
		test('internal imports from `cloudflare:*`', async () => {
			const result = await getJsonResponse('/cloudflare-imports');

			// TODO: in dev as `DurableObject.name` we get 'DurableObject', but in
			//       preview we get 'DurableObjectBase', this difference is most
			//       likely incorrect and we need to investigate the reason
			//       (https://github.com/flarelabs-net/vite-plugin-cloudflare/issues/81)
			const durableObjectName = isBuild ? 'DurableObjectBase' : 'DurableObject';

			expect(result).toEqual({
				'(cloudflare:workers) WorkerEntrypoint.name': 'WorkerEntrypoint',
				'(cloudflare:workers) DurableObject.name': durableObjectName,
				'(cloudflare:sockets) typeof connect': 'function',
			});
		});

		test('external imports from `cloudflare:*`', async () => {
			const result = await getJsonResponse('/external-cloudflare-imports');

			// TODO: in dev as `DurableObject.name` we get 'DurableObject', but in
			//       preview we get 'DurableObjectBase', this difference is most
			//       likely incorrect and we need to investigate the reason
			//       (https://github.com/flarelabs-net/vite-plugin-cloudflare/issues/81)
			const durableObjectName = isBuild ? 'DurableObjectBase' : 'DurableObject';

			expect(result).toEqual({
				'(EXTERNAL) (cloudflare:workers) DurableObject.name': durableObjectName,
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
		// TODO: we skip this test on build because a `ReferenceError: process is not defined` is thrown
		//       we need to investigate why
		//       (https://github.com/flarelabs-net/vite-plugin-cloudflare/issues/82)
		test.skipIf(isBuild)('react', async () => {
			const result = await getJsonResponse('/third-party/react');
			expect(result).toEqual({
				'(react) reactVersionsMatch': true,
				'(react) typeof React': 'object',
				'(react) typeof React.cloneElement': 'function',
			});
		});

		// Note: this test is skipped during build because the remix import does not work in preview
		//       because there seem to be an IO operation being performed at the top level of the
		//       generated remix bundled module, this is a legitimate issue and a workerd known quirk/bug.
		//       We should however still investigate this and understand why the same does not apply in dev
		//       mode (I think the reason can be either because esbuild bundles the code differently compared
		//       to rollup during dev pre-bundling or because the extra runner orchestration we have in dev
		//       somehow solves the issue)
		test.skipIf(isBuild)('@remix-run/cloudflare', async () => {
			const result = await getJsonResponse('/third-party/remix');
			expect(result).toEqual({
				'(remix) remixRunCloudflareCookieName':
					'my-remix-run-cloudflare-cookie',
				'(remix) typeof cloudflare json({})': 'object',
			});
		});

		test('discord-api-types/v10', async () => {
			const result = await getJsonResponse('/third-party/discord-api-types');
			expect(result).toEqual({
				'(discord-api-types/v10) RPCErrorCodes.InvalidUser': 4010,
				'(discord-api-types/v10) Utils.isLinkButton({})': false,
			});
		});

		test('slash-create', async () => {
			const result = await getJsonResponse('/third-party/slash-create');
			expect(result).toEqual({
				'(slash-create/web) VERSION': '6.2.1',
				'(slash-create/web) myCollection.random()': 54321,
				'(slash-create/web) slashCreatorInstance is instance of SlashCreator':
					true,
			});
		});
	});

	describe('user aliases', () => {
		test('imports from an aliased package', async () => {
			const result = await getTextResponse('/@alias/test');
			expect(result).toBe('OK!');
		});
	});

	describe.skipIf(isBuild)('dev user errors', () => {
		test('imports from a non existing package', async () => {
			await page.goto(`${viteTestUrl}/@non-existing/pkg`);
			const errorText = await page
				.locator('vite-error-overlay pre.message')
				.textContent();
			expect(errorText).toContain("Cannot find module '@non-existing/pkg'");
		});
	});
});
