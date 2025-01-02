import { AsyncLocalStorage } from 'node:async_hooks';
import * as stream from 'node:stream';
// @ts-expect-error - no types yet
import RSD from '@jacob-ebey/react-server-dom-vite/server';
// @ts-expect-error - no types yet
import { manifest } from 'virtual:react-manifest';
import type React from 'react';
import type { ReactFormState } from 'react-dom/client';

export type UNSAFE_ServerPayload = {
	formState?: ReactFormState;
	returnValue?: unknown;
	root: React.JSX.Element;
};

declare global {
	interface AppEnvironment {}
}

export type UNSAFE_Context = {
	actionState?: {
		state?: unknown;
		error?: unknown;
	};
	env: AppEnvironment;
	url: URL;
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

export function getURL() {
	return ctx().url;
}

export function renderApp(
	request: Request,
	env: AppEnvironment,
	root: React.JSX.Element,
) {
	const url = new URL(request.url);

	const ctx: UNSAFE_Context = {
		env,
		url,
	};

	return UNSAFE_ContextStorage.run(ctx, async () => {
		let formState: ReactFormState | undefined;
		let returnValue: unknown | undefined;

		const actionId = request.headers.get('rsc-action');
		try {
			if (actionId) {
				const reference = manifest.resolveServerReference(actionId);
				await reference.preload();
				const action = reference.get() as ((...args: unknown[]) => unknown) & {
					$$typeof: symbol;
				};
				if (action.$$typeof !== Symbol.for('react.server.reference')) {
					throw new Error('Invalid action');
				}

				const body = request.headers
					.get('Content-Type')
					?.match(/^multipart\/form-data/)
					? await request.formData()
					: await request.text();
				const args = await RSD.decodeReply(body, manifest);

				returnValue = action.apply(null, args);
				try {
					await returnValue;
				} catch {}
			} else if (request.method === 'POST') {
				const formData = await request.formData();
				const action = await RSD.decodeAction(formData, manifest);
				formState = await RSD.decodeFormState(
					await action(),
					formData,
					manifest,
				);
			}
		} catch (error) {
			ctx.actionState = {
				error,
			};
		}

		const payload = {
			formState,
			returnValue,
			root,
		} satisfies UNSAFE_ServerPayload;

		const { abort, pipe } = RSD.renderToPipeableStream(payload, manifest);

		request.signal.addEventListener('abort', () => abort());

		const body = stream.Readable.toWeb(
			pipe(new stream.PassThrough()),
		) as ReadableStream<Uint8Array>;

		return new Response(body, {
			headers: {
				'Content-Type': 'text/x-component',
			},
		});
	});
}
