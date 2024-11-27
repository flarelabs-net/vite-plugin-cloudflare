import MagicString from 'magic-string';
import { getNodeCompat } from 'miniflare';
import * as unenv from 'unenv';
import type { BuildOptions } from './plugin-config';
import type { SourcelessWorkerOptions } from 'wrangler';

const preset = unenv.env(unenv.nodeless, unenv.cloudflare);
const CLOUDFLARE_VIRTUAL_PREFIX = '\0cloudflare-';

/**
 * Returns true if the given combination of compat dates and flags means that we need Node.js compatibility.
 */
export function isNodeCompat({
	compatibilityDate,
	compatibilityFlags,
}: BuildOptions): boolean {
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
 * If the current environment needs Node.js compatibility,
 * then inject the necessary global polyfills into the code.
 */
export function injectGlobalCode(
	id: string,
	code: string,
	buildOptions: BuildOptions,
) {
	if (!isNodeCompat(buildOptions)) {
		return;
	}

	const injectedCode = Object.entries(preset.inject)
		.map(([globalName, globalInject]) => {
			if (typeof globalInject === 'string') {
				const moduleSpecifier = globalInject;
				// the mapping is a simple string, indicating a default export, so the string is just the module specifier.
				return `import var_${globalName} from "${moduleSpecifier}";\nglobalThis.${globalName} = var_${globalName};\n`;
			}

			// the mapping is a 2 item tuple, indicating a named export, made up of a module specifier and an export name.
			const [moduleSpecifier, exportName] = globalInject;
			return `import var_${globalName} from "${moduleSpecifier}";\nglobalThis.${globalName} = var_${globalName}.${exportName};\n`;
		})
		.join('\n');

	const modified = new MagicString(code);
	modified.prepend(injectedCode);
	return {
		code: modified.toString(),
		map: modified.generateMap({ hires: 'boundary', source: id }),
	};
}

/**
 * We only want to alias Node.js built-ins if the environment has Node.js compatibility turned on.
 * But Vite only allows us to configure aliases at the shared options level, not per environment.
 * So instead we alias these to a virtual module, which are then handled with environment specific code in the `resolveId` handler
 */
export function getNodeCompatAliases() {
	return Object.fromEntries(
		Object.keys(preset.alias).map((from) => [
			from,
			CLOUDFLARE_VIRTUAL_PREFIX + from,
		]),
	);
}

/**
 * Convert any virtual module Id that was generated by the aliases returned from `getNodeCompatAliases()`
 * back to real a module Id and whether it is an external (built-in) package or not.
 */
export function resolveNodeAliases(source: string, buildOptions: BuildOptions) {
	if (
		!source.startsWith(CLOUDFLARE_VIRTUAL_PREFIX) ||
		!isNodeCompat(buildOptions)
	) {
		return;
	}

	const from = source.slice(CLOUDFLARE_VIRTUAL_PREFIX.length);
	const alias = preset.alias[from];
	if (alias) {
		return {
			id: alias,
			external: preset.external.includes(alias),
		};
	}
}

/**
 * Get an array of modules that should be considered external.
 */
export function getNodeCompatExternals(): string[] {
	return preset.external;
}
