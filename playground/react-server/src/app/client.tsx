import { createContext, use, useMemo, useSyncExternalStore } from 'react';

export type UNSAFE_RouterState = {
	to?: URL;
	url: URL;
};

export const UNSAFE_RouterContext = createContext<
	UNSAFE_RouterState | undefined
>(undefined);

function ctx() {
	const ctx = use(UNSAFE_RouterContext);
	if (!ctx) {
		throw new Error('No router context found');
	}
	return ctx;
}

export function useLocation() {
	const url = ctx().url;
	return useMemo(() => new URL(url), [url]);
}

export function useNavigation() {
	const to = ctx().to;
	return useMemo(() => {
		if (!to) {
			return {
				state: 'idle',
			};
		}
		return {
			state: 'navigating',
			location: new URL(to),
		};
	}, [to]);
}
