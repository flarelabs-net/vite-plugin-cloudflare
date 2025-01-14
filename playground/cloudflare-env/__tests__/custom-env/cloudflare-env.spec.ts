import { expect, test } from 'vitest';
import { getTextResponse } from '../../../__test-utils__';

test('returns the correct custom-env var when CLOUDFLARE_ENV=custom-env', async () => {
	expect(await getTextResponse()).toEqual('Custom env var');
});
