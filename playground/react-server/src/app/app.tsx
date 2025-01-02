import { getEnv, getURL } from '../framework/server';
import stylesHref from './app.css?url';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
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
				<link rel="stylesheet" href={stylesHref} />
			</head>
			<body>
				<main className="container mx-auto w-full py-16 px-4 md:px-6 typography">
					<h1>Hello, World!</h1>
					{counterName && typeof count === 'number' ? (
						<Counter
							count={count}
							increment={async () => {
								'use server';

								const env = getEnv();
								const stub = env.COUNTER.get(
									env.COUNTER.idFromName(counterName),
								);
								await stub.increment();
							}}
						/>
					) : (
						<form method="GET">
							<label>
								Counter Name: <Input name="name" />
							</label>{' '}
							<Button type="submit">Activate Counter</Button>
						</form>
					)}
				</main>
			</body>
		</html>
	);
}
