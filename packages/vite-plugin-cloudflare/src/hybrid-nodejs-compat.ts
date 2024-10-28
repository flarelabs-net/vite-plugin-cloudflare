import assert from 'node:assert';
import { builtinModules } from 'node:module';
import { getNodeCompat } from 'miniflare';
import dedent from 'ts-dedent';
import type { Plugin, PluginBuild } from 'esbuild';
import type { Environment } from 'unenv';
import type { SourcelessWorkerOptions } from 'wrangler';

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

export function nodejsHybridPlugin(unenv: Environment | undefined): Plugin {
	return {
		name: 'hybrid-nodejs_compat',
		setup(build) {
			if (unenv) {
				build.initialOptions.external = unenv.external;
				handleRequireCallsToNodeJSBuiltins(build);
				handleUnenvAliasedPackages(build, unenv.alias, unenv.external);
			}
		},
	};
}

/**
 * We must convert `require()` calls for Node.js modules to a virtual ES Module that can be imported avoiding the require calls.
 * We do this by creating a special virtual ES module that re-exports the library in an onLoad handler.
 * The onLoad handler is triggered by matching the "namespace" added to the resolve.
 */
function handleRequireCallsToNodeJSBuiltins(build: PluginBuild) {
	const NODEJS_MODULES_RE = new RegExp(
		`^(node:)?(${builtinModules.join('|')})$`,
	);

	build.onResolve({ filter: NODEJS_MODULES_RE }, (args) => {
		if (args.kind === 'require-call') {
			return {
				path: args.path,
				namespace: 'node-built-in-modules',
			};
		}
	});
	build.onLoad(
		{ filter: /.*/, namespace: 'node-built-in-modules' },
		({ path }) => {
			return {
				contents: dedent`
        import libDefault from '${path}';
        module.exports = libDefault;`,
				loader: 'js',
			};
		},
	);
}

function handleUnenvAliasedPackages(
	build: PluginBuild,
	alias: Record<string, string>,
	external: string[],
) {
	// esbuild expects alias paths to be absolute
	const aliasAbsolute: Record<string, string> = {};
	for (const [module, unresolvedAlias] of Object.entries(alias)) {
		try {
			aliasAbsolute[module] = require
				.resolve(unresolvedAlias)
				.replace(/\.cjs$/, '.mjs');
		} catch (e) {
			// this is an alias for package that is not installed in the current app => ignore
			console.log('ignoring package', module);
		}
	}

	const UNENV_ALIAS_RE = new RegExp(
		`^(${Object.keys(aliasAbsolute).join('|')})$`,
	);

	build.onResolve({ filter: UNENV_ALIAS_RE }, (args) => {
		const unresolvedAlias = alias[args.path];
		assert(unresolvedAlias, 'Unenv alias missing for ' + args.path);
		// Resolve the alias to its absolute path and potentially mark it as external
		console.log('resolve as import', {
			path: args.path,
			alias: aliasAbsolute[args.path],
			external: external.includes(unresolvedAlias),
		});
		return {
			path: aliasAbsolute[args.path],
			external: external.includes(unresolvedAlias),
		};
	});
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
