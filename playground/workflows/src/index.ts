import { WorkflowEntrypoint } from 'cloudflare:workers';
import type { WorkflowEvent, WorkflowStep } from 'cloudflare:workers';

interface Env {
	MY_WORKFLOW: Workflow;
}

export class MyWorkflow extends WorkflowEntrypoint<Env> {
	override async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
		await step.do('first step', async () => {
			return {
				output: 'First step result',
			};
		});

		await step.sleep('sleep', '1 second');

		await step.do('second step', async () => {
			return {
				output: 'Second step result',
			};
		});
	}
}

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const id = url.searchParams.get('instance-id');

		if (!id) {
			return new Response(null, { status: 404 });
		}

		if (url.pathname === '/create') {
			const instance = await env.MY_WORKFLOW.create({ id });

			return Response.json(await instance.status());
		}

		const instance = await env.MY_WORKFLOW.get(id);

		return Response.json(await instance.status());
	},
} satisfies ExportedHandler<Env>;
