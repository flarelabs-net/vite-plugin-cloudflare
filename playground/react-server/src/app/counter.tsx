'use client';

import { useActionState, useOptimistic } from 'react';
import { Button } from './components/ui/button';

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
			Count: {optimisticCount} <Button type="submit">Increment</Button>
		</form>
	);
}
