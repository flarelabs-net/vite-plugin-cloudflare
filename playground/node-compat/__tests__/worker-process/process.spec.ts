import { expect, test } from 'vitest';
import { getTextResponse } from '../../../__test-utils__';

// TODO: reintroduce test
test.skip('should support process global', async () => {
	const result = await getTextResponse();
	expect(result).toBe(`OK!`);
});
