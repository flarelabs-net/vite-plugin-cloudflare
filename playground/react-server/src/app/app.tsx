import { getEnv, getURL } from '../framework/server';
import { Counter } from './counter';

export async function App() {
	const env = getEnv();
	const url = getURL();

	const counterName = url.searchParams.get('name');

	const stub = counterName
		? env.COUNTER.get(env.COUNTER.idFromName(counterName))
		: null;
	const count = stub ? await stub.getCounterValue() : null;

	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<title>React Server</title>
			</head>
			<body>
				<h1>Hello, World!</h1>
				{counterName && typeof count === 'number' ? (
					<Counter
						count={count}
						increment={async () => {
							'use server';

							const env = getEnv();
							const stub = env.COUNTER.get(env.COUNTER.idFromName(counterName));
							await stub.increment();
						}}
					/>
				) : (
					<form method="GET">
						<label>
							Counter Name:
							<input name="name" />
						</label>
						<button type="submit">Activate Counter</button>
					</form>
				)}
			</body>
		</html>
	);
}
