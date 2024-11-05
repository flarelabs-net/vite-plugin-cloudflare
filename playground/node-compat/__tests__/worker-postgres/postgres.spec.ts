import { expect, test } from 'vitest';
import { getJsonResponse, isBuild } from '../../../__test-utils__';

// Disabling actually querying the database in CI since we are getting this error:
// > too many connections for role 'reader'
test.runIf(!isBuild && !process.env.CI)(
	'should be able to use pg library',
	async () => {
		const result = await getJsonResponse();
		expect(result!.id).toEqual('1');
	},
);