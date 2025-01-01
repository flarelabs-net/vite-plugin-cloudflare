'use client';

import { useActionState, useOptimistic } from 'react';

export function Counter({
	count,
	increment,
}: {
	count: number;
	increment: () => Promise<void>;
}) {
	const [stateCount, actionIncrement] = useActionState(async (count) => {
		setOptimisticCount(count + 1);
		await increment();

		return count + 1;
	}, count);

	const [optimisticCount, setOptimisticCount] = useOptimistic(stateCount);

	return (
		<form action={actionIncrement}>
			Count: {optimisticCount} <button type="submit">Increment</button>
		</form>
	);
}
