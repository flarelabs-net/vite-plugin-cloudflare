import { AsyncLocalStorage } from 'node:async_hooks';
import type { Counter } from '../server/entry.server';

export type CloudflareEnv = {
	COUNTER: DurableObjectNamespace<Counter>;
	SERVER: DurableObjectNamespace;
};

export type UNSAFE_Context = {
	actionState?: {
		state?: unknown;
		error?: unknown;
	};
	env: CloudflareEnv;
};

export const UNSAFE_ContextStorage = new AsyncLocalStorage<UNSAFE_Context>();

function ctx() {
	const ctx = UNSAFE_ContextStorage.getStore();
	if (!ctx) {
		throw new Error('No context store found');
	}
	return ctx;
}

export function getActionState<T>(action: unknown) {
	return ctx().actionState ?? {};
}

export function setActionState<T>(state: T) {
	ctx().actionState = {
		state,
	};
}

export function getEnv() {
	return ctx().env;
}
