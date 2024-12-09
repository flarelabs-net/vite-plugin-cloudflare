import { describe, expect, test } from 'vitest';
import { getJsonResponse } from '../../__test-utils__';

describe('multi-worker basic functionality', async () => {
	test('entry worker returns a response', async () => {
		const result = await getJsonResponse();
		expect(result).toEqual({ name: 'Worker A' });
	});
});
