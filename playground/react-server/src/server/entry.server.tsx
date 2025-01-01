import * as stream from 'node:stream';
// @ts-expect-error - no types yet
import RSD from '@jacob-ebey/react-server-dom-vite/server';
import { DurableObject } from 'cloudflare:workers';
// @ts-expect-error - no types yet
import { manifest } from 'virtual:react-manifest';
import { UNSAFE_ContextStorage } from '../app/context';
import type { CloudflareEnv, UNSAFE_Context } from '../app/context';
import type { ReactFormState } from 'react-dom/client';

export class Counter extends DurableObject {
	async getCounterValue() {
		let value = ((await this.ctx.storage.get('value')) as number) || 0;

		return value;
	}

	async increment(amount = 1) {
		let value = ((await this.ctx.storage.get('value')) as number) || 0;
		value += amount;
		await this.ctx.storage.put('value', value);

		return value;
	}

	async decrement(amount = 1) {
		let value = ((await this.ctx.storage.get('value')) as number) || 0;
		value -= amount;
		await this.ctx.storage.put('value', value);

		return value;
	}
}

export type ServerPayload = {
	formState?: ReactFormState;
	returnValue?: unknown;
	root: React.JSX.Element;
};

export class Server extends DurableObject<CloudflareEnv> {
	override async fetch(request: Request) {
		const ctx: UNSAFE_Context = {
			env: this.env,
		};

		return await UNSAFE_ContextStorage.run(ctx, async () => {
			let formState: ReactFormState | undefined;
			let returnValue: unknown | undefined;

			const actionId = request.headers.get('rsc-action');
			try {
				if (actionId) {
					const reference = manifest.resolveServerReference(actionId);
					await reference.preload();
					const action = reference.get() as ((
						...args: unknown[]
					) => unknown) & {
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

			const { App } = await import('../app/app');
			const root = <App />;

			const payload = {
				formState,
				returnValue,
				root,
			} satisfies ServerPayload;

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
}

export default {
	fetch(request) {
		return new Response('Do not use this handler directly', {
			status: 400,
		});
	},
} satisfies ExportedHandler<CloudflareEnv>;
