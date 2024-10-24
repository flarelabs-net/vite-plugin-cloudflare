import { getTextResponse, isBuild, serverLogs } from '~utils';
import { expect, test } from 'vitest';

test.runIf(!isBuild)('basic', async () => {
	expect(await getTextResponse()).toMatchInlineSnapshot(`"Hello World!"`);
	expect(serverLogs.info.join()).toContain('__console log__');
	expect(serverLogs.errors.join()).toContain('__console error__');
	expect(serverLogs.errors.join()).toContain('__console warn__');
});
