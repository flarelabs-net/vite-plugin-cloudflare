import { expect, test, vi } from 'vitest';
import { getJsonResponse } from '../../__test-utils__';

test('creates a Workflow with an ID', async () => {
	const instanceId = 'test-id';

	expect(await getJsonResponse(`/create?id=${instanceId}`)).toEqual({
		id: instanceId,
		status: {
			status: 'running',
			output: [],
		},
	});

	await vi.waitFor(
		async () => {
			expect(await getJsonResponse(`/get?id=${instanceId}`)).toEqual({
				status: 'running',
				output: [{ output: 'First step result' }],
			});
		},
		{ timeout: 5000 },
	);

	await vi.waitFor(
		async () => {
			expect(await getJsonResponse(`/get?id=${instanceId}`)).toEqual({
				status: 'complete',
				output: [
					{ output: 'First step result' },
					{ output: 'Second step result' },
				],
			});
		},
		{ timeout: 5000 },
	);
});
