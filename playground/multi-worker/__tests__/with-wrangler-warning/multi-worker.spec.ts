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
				: /**
					note: when testing previews we want this warning only onces, just for the build process
					      previewing the application should not trigger the warning since that'll rely on the
					      wrangler.json we generate (which should be sanitized)
				   */
					[expectedWarning],
		);
	});

	test('entry worker returns a response', async () => {
		const result = await getJsonResponse();
		expect(result).toEqual({ name: 'Worker A' });
	});
});
