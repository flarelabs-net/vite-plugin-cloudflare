import { expect, test } from 'vitest';
import { getTextResponse, isBuild, serverLogs } from '../../__test-utils__';

test.runIf(!isBuild)(
	'allows using `import.meta.hot.send` in fetch handler',
	async () => {
		expect(await getTextResponse()).toEqual('OK');
	},
);
