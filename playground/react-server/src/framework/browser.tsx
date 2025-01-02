import {
	createFromFetch,
	createFromReadableStream,
	// @ts-expect-error - no types yet
} from '@jacob-ebey/react-server-dom-vite/client';
import { startTransition, StrictMode, useState } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { rscStream } from 'rsc-html-stream/client';
// @ts-expect-error - no types yet
import { manifest } from 'virtual:react-manifest';
import { api, callServer } from './references.client.js';
import type { UNSAFE_ServerPayload } from './server.js';

function Shell(props: { root: React.JSX.Element }) {
	const [root, setRoot] = useState(props.root);
	api.updateRoot = setRoot;
	return root;
}

export async function hydrateApp(container: Element | Document = document) {
	const payload: UNSAFE_ServerPayload = await createFromReadableStream(
		rscStream,
		manifest,
		{ callServer },
	);

	startTransition(() => {
		hydrateRoot(
			container,
			<StrictMode>
				<Shell root={payload.root} />
			</StrictMode>,
			{
				formState: payload.formState,
			},
		);
	});

	window.navigation?.addEventListener('navigate', (event) => {
		if (
			!event.canIntercept ||
			event.defaultPrevented ||
			event.downloadRequest ||
			!event.userInitiated ||
			event.navigationType === 'reload'
		) {
			return;
		}

		event.intercept({
			async handler() {
				const abortController = new AbortController();
				let startedTransition = false;
				event.signal.addEventListener('abort', () => {
					if (startedTransition) return;
					abortController.abort();
				});
				const fetchPromise = fetch(event.destination.url, {
					body: event.formData,
					headers: {
						Accept: 'text/x-component',
					},
					method: event.formData ? 'POST' : 'GET',
					signal: abortController.signal,
				});

				const payload: UNSAFE_ServerPayload = await createFromFetch(
					fetchPromise,
					manifest,
					{ callServer },
				);

				startedTransition = true;
				startTransition(() => {
					api.updateRoot?.(payload.root);
				});
			},
		});
	});
}
