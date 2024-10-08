import { getNodeCompat } from 'miniflare';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env, nodeless, cloudflare } from 'unenv';

const rootPath = fileURLToPath(new URL('./', import.meta.url));

/**
 * Get Miniflare modules and code snippets that are needed if running in Nodejs compat mode.
 */
export function getNodeCompatModules(
	compatibilityDate: string | undefined,
	compatibilityFlags: string[] = [],
	modulesRoot: string,
) {
	if (getNodeCompat(compatibilityDate, compatibilityFlags).mode !== 'v2') {
		return { nodeModules: [], nodeWrappers: [] };
	}

	const { alias, inject } = env(nodeless, cloudflare);

	const nodeWrappers = Object.entries(inject).map(
		([globalName, globalInject]) =>
			getGlobalModuleContents(rootPath, globalName, globalInject),
	);

	const nodeModules = Object.entries(alias)
		.filter(
			([importSpecifier]) =>
				importSpecifier !== 'node:process' && importSpecifier !== 'process',
		)
		.filter(([, modulePath]) => modulePath.startsWith('unenv'))
		.map(([importSpecifier, modulePath]) => {
			return {
				type: 'ESModule',
				path: path.join(modulesRoot, importSpecifier),
				contents: `export { default } from '${rootPath}${modulePath}.mjs';`,
			} as const;
		});

	return { nodeModules, nodeWrappers };
}

/**
 * Get the import statement and export name to be used for the given global inject setting.
 */
function getGlobalModuleContents(
	rootPath: string,
	globalName: string,
	globalInject: string | string[],
) {
	if (typeof globalInject === 'string') {
		const moduleSpecifier = globalInject;
		// the mapping is a simple string, indicating a default export, so the string is just the module specifier.
		return `
import var_${globalName} from "${rootPath}${moduleSpecifier}.mjs";
console.log("setting ${globalName} global");
globalThis.${globalName} = var_${globalName};
console.log("set ${globalName} global", ${globalName});
`;
	}

	// the mapping is a 2 item tuple, indicating a named export, made up of a module specifier and an export name.
	const [moduleSpecifier, exportName] = globalInject;
	return `import { ${exportName} } from "${rootPath}${moduleSpecifier}.mjs";\nconsole.log("setting ${globalName} global");\nglobalThis.${globalName} = ${exportName};`;
}
