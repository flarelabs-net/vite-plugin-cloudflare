import { getEnv } from './context';
import { Counter } from './counter';

export async function App() {
	const env = getEnv();
	const stub = env.COUNTER.get(env.COUNTER.idFromName(''));
	const count = await stub.getCounterValue();

	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<title>React Server</title>
			</head>
			<body>
				<h1>Hello, World!</h1>
				<Counter
					count={count}
					increment={async () => {
						'use server';

						const env = getEnv();
						const stub = env.COUNTER.get(env.COUNTER.idFromName(''));
						await stub.increment();
					}}
				/>
			</body>
		</html>
	);
}
