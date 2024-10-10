import { invariant } from './shared';
import type { WorkerOptions } from 'miniflare';

function errorMessage(workerName: string) {
	return `${workerName} does not match a worker name.`;
}

export function getWorkerEntrypointNames(
	workers: Array<Pick<WorkerOptions, 'serviceBindings'> & { name: string }>,
) {
	const workerEntrypointNames = Object.fromEntries(
		workers.map((workerOptions) => [workerOptions.name, new Set<string>()]),
	);

	for (const worker of workers) {
		if (worker.serviceBindings === undefined) {
			continue;
		}

		for (const value of Object.values(worker.serviceBindings)) {
			if (
				typeof value === 'object' &&
				'name' in value &&
				typeof value.name === 'string' &&
				value.entrypoint !== undefined &&
				value.entrypoint !== 'default'
			) {
				const entrypointNames = workerEntrypointNames[value.name];
				invariant(entrypointNames, errorMessage(value.name));

				entrypointNames.add(value.entrypoint);
			}
		}
	}

	return workerEntrypointNames;
}

export function getDurableObjectClassNames(
	workers: Array<Pick<WorkerOptions, 'durableObjects'> & { name: string }>,
) {
	const durableObjectClassNames = Object.fromEntries(
		workers.map((workerOptions) => [workerOptions.name, new Set<string>()]),
	);

	for (const worker of workers) {
		if (worker.durableObjects === undefined) {
			continue;
		}

		for (const value of Object.values(worker.durableObjects)) {
			if (typeof value === 'string') {
				const classNames = durableObjectClassNames[worker.name];
				invariant(classNames, errorMessage(worker.name));

				classNames.add(value);
			} else if (typeof value === 'object') {
				if (value.scriptName) {
					const classNames = durableObjectClassNames[value.scriptName];
					invariant(classNames, errorMessage(value.scriptName));

					classNames.add(value.className);
				} else {
					const classNames = durableObjectClassNames[worker.name];
					invariant(classNames, errorMessage(worker.name));

					classNames.add(value.className);
				}
			}
		}
	}

	return durableObjectClassNames;
}
