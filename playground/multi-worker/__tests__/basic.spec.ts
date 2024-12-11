import { describe, expect, test } from 'vitest';
import { getJsonResponse, serverLogs } from '../../__test-utils__';

describe('multi-worker basic functionality', async () => {
	test('wrangler warnings are not present in the terminal', async () => {
		expect(serverLogs.warns).toEqual([]);
	});

	test('entry worker returns a response', async () => {
		const result = await getJsonResponse();
		expect(result).toEqual({ name: 'Worker A' });
	});
});
