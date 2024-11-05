import { expect, test } from 'vitest';
import { getTextResponse, isBuild } from '../../../__test-utils__';

test.runIf(!isBuild)('crypto.X509Certificate is implemented', async () => {
	const result = await getTextResponse();
	expect(result).toBe(`"OK!"`);
});
