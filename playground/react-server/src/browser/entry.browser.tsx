import {
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
}
