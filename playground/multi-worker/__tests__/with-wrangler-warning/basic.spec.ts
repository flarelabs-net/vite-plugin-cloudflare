import { describe, expect, test } from 'vitest';
import { getJsonResponse, isBuild, serverLogs } from '../../../__test-utils__';

describe('multi-worker basic functionality', async () => {
	test('wrangler warnings are present in the terminal', async () => {
		const expectedWarning = expect.stringMatching(
			/your workers configs contain configuration options which are ignored[\s\S]+preserve_file_names[\s\S]+tsconfig[\s\S]+build/,
		);
		expect(serverLogs.warns).toEqual(
			!isBuild
				? [expectedWarning]
				: // when testing builds we this warning twice, once when we build the application and once when we preview it
					[expectedWarning, expectedWarning],
		);
	});

	test('entry worker returns a response', async () => {
		const result = await getJsonResponse();
		expect(result).toEqual({ name: 'Worker A' });
	});
});
