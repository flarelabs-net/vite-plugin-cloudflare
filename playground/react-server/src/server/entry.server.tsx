import { renderApp } from '../framework/server';
import { Counter } from './counter';

declare global {
	interface AppEnvironment {
		COUNTER: DurableObjectNamespace<Counter>;
	}
}

export { Counter };

export default {
	async fetch(request, env) {
		const { App } = await import('../app/app');

		return renderApp(request, env, <App />);
	},
} satisfies ExportedHandler<AppEnvironment>;
