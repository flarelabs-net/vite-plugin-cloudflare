import { getTextResponse, isBuild } from '~utils';
import { describe, expect, test } from 'vitest';

describe.runIf(!isBuild)('external durable objects', async () => {
	test('can use `scriptName` to bind to a Durable Object defined in another Worker', async () => {
		expect(await getTextResponse('/?name=my-do')).toMatchInlineSnapshot(
			`"From worker-a: {"name":"my-do","count":0}"`,
		);
		expect(
			await getTextResponse('/increment?name=my-do'),
		).toMatchInlineSnapshot(`"From worker-a: {"name":"my-do","count":1}"`);
		expect(
			await getTextResponse('/increment?name=my-do'),
		).toMatchInlineSnapshot(`"From worker-a: {"name":"my-do","count":2}"`);
		expect(await getTextResponse('/?name=my-do')).toMatchInlineSnapshot(
			`"From worker-a: {"name":"my-do","count":2}"`,
		);
	});
});
