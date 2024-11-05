import { getNodeCompat } from 'miniflare';
import type { SourcelessWorkerOptions } from 'wrangler';

/**
 * Returns true if the given combination of compat dates and flags means that we need Node.js compatibility.
 */
export function isNodeCompat({
	compatibilityDate,
	compatibilityFlags,
}: SourcelessWorkerOptions): boolean {
	const nodeCompatMode = getNodeCompat(
		compatibilityDate,
		compatibilityFlags ?? [],
	).mode;
	if (nodeCompatMode === 'v2') {
		return true;
	}
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
	return false;
}

/**
 * Get the import statement and export name to be used for the given global inject setting.
 */
export function getGlobalModuleContents([globalName, globalInject]: [
	string,
	string | string[],
]) {
	if (typeof globalInject === 'string') {
		const moduleSpecifier = globalInject;
		// the mapping is a simple string, indicating a default export, so the string is just the module specifier.
		return `import var_${globalName} from "${moduleSpecifier}";\nglobalThis.${globalName} = var_${globalName};\n`;
	}

	// the mapping is a 2 item tuple, indicating a named export, made up of a module specifier and an export name.
	const [moduleSpecifier, exportName] = globalInject;
	return `import var_${globalName} from "${moduleSpecifier}";\nglobalThis.${globalName} = var_${globalName}.${exportName};\n`;
}
