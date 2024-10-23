import assert from 'node:assert';
import * as path from 'node:path';
import { getNodeCompat } from 'miniflare';
import { cloudflare, env, nodeless } from 'unenv';

/**
 * Get Miniflare modules and code snippets that are needed if running in Nodejs compat mode.
 */
export function getNodeCompatModules(
	compatibilityDate: string | undefined,
	compatibilityFlags: string[] = [],
	modulesRoot: string,
) {
	const nodeCompatMode = getNodeCompat(
		compatibilityDate,
		compatibilityFlags,
	).mode;
	if (nodeCompatMode !== 'v2') {
		if (nodeCompatMode === 'legacy') {
			throw new Error(
				'Unsupported Node.js compat mode (legacy). Remove the `node_compat` setting and add the `nodejs_compat` flag instead.',
			);
		}
		if (nodeCompatMode === 'v1') {
			throw new Error(
				`Unsupported Node.js compat mode (v1). Only the v2 mode is supported, either change your compat date to "2024-09-23" or later, or set the "nodejs_compat_v2" compatibility flag`,
			);
		}
		return { nodeModules: [], nodeWrappers: [] };
	}

	const { alias, inject } = env(nodeless, cloudflare);

	const nodeWrappers = Object.entries(inject).map(
		([globalName, globalInject]) =>
			getGlobalModuleContents(globalName, globalInject),
	);

	const nodeModules = Object.entries(alias)
		.map(deAliasing(alias))
		.filter(removeProcess)
		.filter(removeIdentities)
		.map(([importSpecifier, modulePath]) => {
			modulePath = modulePath.replace(/proxy-cjs$/, 'proxy');
			return {
				type: 'ESModule' as const,
				path: path.join(modulesRoot, importSpecifier),
				contents: `export { default } from '${modulePath}';`,
			};
		});

	return { nodeModules, nodeWrappers };
}

/**
 * Get the import statement and export name to be used for the given global inject setting.
 */
function getGlobalModuleContents(
	globalName: string,
	globalInject: string | string[],
) {
	if (typeof globalInject === 'string') {
		const moduleSpecifier = globalInject;
		// the mapping is a simple string, indicating a default export, so the string is just the module specifier.
		return `import var_${globalName} from "${moduleSpecifier}";globalThis.${globalName} = var_${globalName};`;
	}

	// the mapping is a 2 item tuple, indicating a named export, made up of a module specifier and an export name.
	const [moduleSpecifier, exportName] = globalInject;
	return `import var_${globalName} from "${moduleSpecifier}";\nglobalThis.${globalName} = var_${globalName}.${exportName};`;
}

function deAliasing(alias: Record<string, string>) {
	return (
		[importSpecifier, modulePath]: [string, string],
		index: number,
	): [string, string] => {
		const breadcrumbs: (string | undefined)[] = [importSpecifier];
		// Follow the alias chain until we find an unenv polyfill
		while (!modulePath.startsWith('unenv/')) {
			breadcrumbs.push(modulePath);
			const next = alias[modulePath];
			if (next === modulePath) {
				// we have found an identity, so return as this will be filtered out
				return [modulePath, modulePath];
			}
			assert(
				next !== undefined,
				`Invalid alias chain: ${breadcrumbs.join('->')}.`,
			);
			modulePath = next;
		}
		return [importSpecifier, modulePath];
	};
}

function removeProcess([importSpecifier]: [string, string]) {
	// workerd uses an import to `node:process` internally when you access the global `process` object.
	// This causes a circular dependency if we also provide the unenv `node:process` as a pre-bundled module.
	// For now let's skip this and look into how we can resolve this... possible change to workerd required.
	return importSpecifier !== 'node:process' && importSpecifier !== 'process';
}

function removeIdentities([importSpecifier, modulePath]: [string, string]) {
	return importSpecifier !== modulePath;
}
