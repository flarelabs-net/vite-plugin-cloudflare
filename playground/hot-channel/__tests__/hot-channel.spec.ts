import { expect, test } from 'vitest';
import { isBuild, serverLogs } from '../../__test-utils__';

test.runIf(!isBuild)('receives custom events', async () => {
	expect(serverLogs.info.join()).toContain('__event-data-received__');
});
