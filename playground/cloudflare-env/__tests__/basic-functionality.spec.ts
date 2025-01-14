import { expect, test } from 'vitest';
import { getTextResponse } from '../../__test-utils__';

test('returns the correct top-level var', async () => {
	expect(await getTextResponse()).toEqual('Top level');
});
