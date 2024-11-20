export interface WrapperEnv {
	__VITE_ROOT__: string;
	__VITE_ENTRY_PATH__: string;
	__VITE_FETCH_MODULE__: {
		fetch: (request: Request) => Promise<Response>;
	};
	__VITE_UNSAFE_EVAL__: {
		eval: (code: string, filename: string) => Function;
	};
	__VITE_RUNNER_OBJECT__: { get(id: 'singleton'): Fetcher };
	[key: string]: unknown;
}

export function stripInternalEnv(internalEnv: WrapperEnv) {
	const {
		__VITE_ROOT__,
		__VITE_ENTRY_PATH__,
		__VITE_FETCH_MODULE__,
		__VITE_UNSAFE_EVAL__,
		__VITE_RUNNER_OBJECT__,
		...userEnv
	} = internalEnv;

	return userEnv;
}
