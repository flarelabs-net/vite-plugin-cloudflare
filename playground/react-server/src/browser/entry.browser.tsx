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
import { api, callServer } from '../react/references.client.js';
import type { ServerPayload } from '../server/entry.server.js';

hydrateApp();

function Shell(props: { root: React.JSX.Element }) {
	const [root, setRoot] = useState(props.root);
	api.updateRoot = setRoot;
	return root;
}

async function hydrateApp() {
	const payload: ServerPayload = await createFromReadableStream(
		rscStream,
		manifest,
		{ callServer },
	);

	startTransition(() => {
		hydrateRoot(
			document,
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

				const payload: ServerPayload = await createFromFetch(
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
