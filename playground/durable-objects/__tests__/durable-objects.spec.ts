import { getTextResponse, isBuild } from '~utils';
import { describe, expect, test } from 'vitest';

describe.runIf(!isBuild)('in-worker defined durable objects', async () => {
	test('can bind and use a Durable Object defined in the worker', async () => {
		expect(await getTextResponse('/?name=my-do')).toMatchInlineSnapshot(
			`"Durable Object 'my-do' count: 0"`,
		);
		expect(
			await getTextResponse('/increment?name=my-do'),
		).toMatchInlineSnapshot(`"Durable Object 'my-do' count: 1"`);
		expect(
			await getTextResponse('/increment?name=my-do'),
		).toMatchInlineSnapshot(`"Durable Object 'my-do' count: 2"`);
		expect(
			await getTextResponse('/decrement?name=my-do'),
		).toMatchInlineSnapshot(`"Durable Object 'my-do' count: 1"`);
	});
});
