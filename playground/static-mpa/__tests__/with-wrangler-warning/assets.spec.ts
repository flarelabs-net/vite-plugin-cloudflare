import { expect, test } from 'vitest';
import { isBuild, serverLogs } from '../../../__test-utils__';

test('wrangler warnings are present in the terminal', async () => {
	const expectedWarning = expect.stringMatching(
		/your worker config \(at `playground-temp\/static-mpa\/wrangler.with-warning.toml`\) contains the following configuration options which are ignored since they are not applicable when using Vite:[\s\S]+preserve_file_names/,
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
