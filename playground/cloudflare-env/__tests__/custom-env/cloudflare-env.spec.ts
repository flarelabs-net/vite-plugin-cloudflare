import { expect, test } from 'vitest';
import { getTextResponse } from '../../../__test-utils__';

test('returns the correct var when CLOUDFLARE_ENV is provided', async () => {
	expect(await getTextResponse()).toEqual('Custom env var');
});
