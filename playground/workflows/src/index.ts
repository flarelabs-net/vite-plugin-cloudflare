import { WorkflowEntrypoint } from 'cloudflare:workers';
import type { WorkflowEvent, WorkflowStep } from 'cloudflare:workers';

interface Env {
	MY_WORKFLOW: Workflow;
}

interface Params {}

export class MyWorkflow extends WorkflowEntrypoint<Env, Params> {
	override async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
		let state = step.do('my first step', async () => {});

		step.do('my second step', async () => {});
	}
}

export default {
	async fetch(request, env) {
		const instance = await env.MY_WORKFLOW.create();

		return Response.json({
			id: instance.id,
		});
	},
} satisfies ExportedHandler<Env>;
