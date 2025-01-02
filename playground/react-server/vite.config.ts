import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { cloudflare } from '@flarelabs-net/vite-plugin-cloudflare';
import react from '@vitejs/plugin-react';
import { clientTransform, serverTransform } from 'unplugin-rsc';
import * as vite from 'vite';
import { defineConfig } from 'vite';

export default defineConfig({
	environments: {
		client: {
			build: {
				rollupOptions: {
					input: 'src/browser/entry.browser.tsx',
				},
			},
		},
		// server: {},
		// ssr: {},
	},
	plugins: [
		react(),
		reactServerDOM({
			clientEnvironment: 'client',
			serverEnvironments: ['server'],
			ssrEnvironments: ['ssr'],
		}),
		cloudflare({
			persistState: false,
			configPath: 'src/ssr/wrangler.toml',
			auxiliaryWorkers: [
				{
					configPath: 'src/server/wrangler.toml',
				},
			],
		}),
	],
});

function reactServerDOM({
	clientEnvironment,
	serverEnvironments: _serverEnvironments,
	ssrEnvironments: _ssrEnvironments,
}: {
	clientEnvironment: string;
	serverEnvironments: string[];
	ssrEnvironments: string[];
}): vite.Plugin {
	let env: vite.ConfigEnv;
	const serverEnvironments = new Set(_serverEnvironments);
	const ssrEnvironments = new Set(_ssrEnvironments);

	const clientEntries = new Set<string>();
	const clientModules = new Map<string, string>();
	const serverModules = new Map<string, string>();
	let clientOutput: vite.Rollup.RollupOutput | undefined;

	const referencesServer = path.resolve('src/framework/references.server.ts');
	const referencesSsr = path.resolve('src/framework/references.ssr.ts');
	const referencesClient = path.resolve('src/framework/references.client.ts');

	function generateId(
		filename: string,
		directive: 'use client' | 'use server',
	) {
		if (env.command === 'build') {
			const hash = crypto
				.createHash('sha256')
				.update(filename)
				.digest('hex')
				.slice(0, 8);

			if (directive === 'use server') {
				serverModules.set(filename, hash);
				return hash;
			}

			clientModules.set(filename, hash);
			return hash;
		}

		if (directive === 'use server') {
			return filename;
		}

		return filename;
	}

	return {
		name: 'react-server-dom',
		enforce: 'post',
		config(userConfig, _env) {
			env = _env;

			return vite.mergeConfig<vite.UserConfig, vite.UserConfig>(userConfig, {
				builder: {
					sharedConfigBuild: true,
					sharedPlugins: true,
					async buildApp(builder) {
						let needsRebuild = true;
						let isFirstBuild = true;

						let serverOutputs!: vite.Rollup.RollupOutput[];
						let ssrOutputs!: vite.Rollup.RollupOutput[];

						while (needsRebuild) {
							needsRebuild = false;

							const lastClientModulesCount = clientModules.size;
							const lastServerModulesCount = serverModules.size;

							serverOutputs = (await Promise.all(
								_serverEnvironments.map((env) =>
									builder.build(builder.environments[env]!),
								),
							)) as vite.Rollup.RollupOutput[];

							const clientModuleFilenames = clientModules.keys();
							builder.environments[
								clientEnvironment
							]!.config.build.rollupOptions.input = [
								...new Set([
									...rollupInputsToArray(
										builder.environments[clientEnvironment]!.config.build
											.rollupOptions.input,
									),
									...clientModuleFilenames,
								]),
							];

							const [clientBuild, ...ssrBuilds] = await Promise.all([
								builder.build(builder.environments[clientEnvironment]!),
								..._ssrEnvironments.map((env) =>
									builder.build(builder.environments[env]!),
								),
							]);
							clientOutput = clientBuild as vite.Rollup.RollupOutput;
							ssrOutputs = ssrBuilds as vite.Rollup.RollupOutput[];

							if (
								(isFirstBuild && (clientModules.size || serverModules.size)) ||
								lastClientModulesCount !== clientModules.size ||
								lastServerModulesCount !== serverModules.size
							) {
								needsRebuild = true;
							}
							isFirstBuild = false;
						}

						const clientOutDir =
							builder.environments[clientEnvironment]!.config.build.outDir;
						for (let i = 0; i < serverOutputs.length; i++) {
							const output = serverOutputs[i]!;
							const env = _serverEnvironments[i]!;
							const outDir = builder.environments[env]!.config.build.outDir;
							moveStaticAssets(output, outDir, clientOutDir);
						}
						for (let i = 0; i < ssrOutputs.length; i++) {
							const output = ssrOutputs[i]!;
							const env = _ssrEnvironments[i]!;
							const outDir = builder.environments[env]!.config.build.outDir;
							moveStaticAssets(output, outDir, clientOutDir);
						}
					},
				},
			});
		},
		configEnvironment(name, userConfig) {
			if (name === clientEnvironment) {
				return vite.mergeConfig<
					vite.EnvironmentOptions,
					vite.EnvironmentOptions
				>(userConfig, {
					build: {
						manifest: true,
						rollupOptions: {
							preserveEntrySignatures: 'exports-only',
						},
					},
				});
			}

			if (serverEnvironments.has(name)) {
				return vite.mergeConfig<
					vite.EnvironmentOptions,
					vite.EnvironmentOptions
				>(userConfig, {
					build: {
						emitAssets: true,
						ssrManifest: true,
						rollupOptions: {
							preserveEntrySignatures: 'exports-only',
						},
					},
					resolve: {
						conditions: ['react-server'],
					},
				});
			}

			if (ssrEnvironments.has(name)) {
				return vite.mergeConfig<
					vite.EnvironmentOptions,
					vite.EnvironmentOptions
				>(userConfig, {
					build: {
						emitAssets: true,
						ssrManifest: true,
						rollupOptions: {
							preserveEntrySignatures: 'exports-only',
						},
					},
				});
			}
		},
		configResolved(config) {
			const environment = config.environments[clientEnvironment];
			if (!environment) throw new Error(`Client environment ${env} not found`);
			let inputs = rollupInputsToArray(environment.build.rollupOptions.input);
			for (const input of inputs) {
				clientEntries.add(path.resolve(input));
			}
		},
		transform(code, id) {
			const ext = id.slice(id.lastIndexOf('.'));
			if (EXTENSIONS_TO_TRANSFORM.has(ext)) {
				if (serverEnvironments.has(this.environment.name)) {
					const transformed = serverTransform(code, id, {
						id: generateId,
						importClient: 'registerClientReference',
						importFrom: referencesServer,
						importServer: 'registerServerReference',
					});
					code = transformed.code;
				} else if (ssrEnvironments.has(this.environment.name)) {
					const transformed = clientTransform(code, id, {
						id: generateId,
						importFrom:
							this.environment.name === clientEnvironment
								? referencesClient
								: referencesSsr,
						importServer: 'createServerReference',
					});
					code = transformed.code;
				}
			}

			return code;
		},
		resolveId(id) {
			if (id === 'virtual:browser-entry') {
				return '\0virtual:browser-entry';
			}
			if (id === 'virtual:react-manifest') {
				return '\0virtual:react-manifest';
			}
		},
		async load(id) {
			if (id === '\0virtual:browser-entry') {
				const inputs = rollupInputsToArray(
					this.environment.config.build.rollupOptions.input,
				);

				const resolved = await this.resolve(inputs[0]!);
				if (!resolved) {
					throw new Error(`Could not resolve ${inputs[0]}`);
				}

				return `${react.preambleCode.replace(
					'__BASE__',
					this.environment.config.base,
				)};import(${JSON.stringify(resolved.id)});`;
			}

			if (id === '\0virtual:react-manifest') {
				if (env.command === 'serve') {
					if (serverEnvironments.has(this.environment.name)) {
						return `
            export const manifest = {
              resolveClientReferenceMetadata(clientReference) {
                const split = clientReference.$$id.split("#");
                return [split[0], split.slice(1).join("#")];
              },
              resolveServerReference(serverReference) {
                const [id, ...rest] = serverReference.split("#");
                const name = rest.join("#");
                let modPromise;
                return {
                  preload: async () => {
                    if (modPromise) {
                      return modPromise;
                    }

                    modPromise = import(/* @vite-ignore */ id);
                    return modPromise
                      .then((mod) => {
                        modPromise.mod = mod;
                      })
                      .catch((error) => {
                        modPromise.error = error;
                      });
                  },
                  get: () => {
                    if (!modPromise) {
                      throw new Error(\`Module "\${id}" not preloaded\`);
                    }
                    if ("error" in modPromise) {
                      throw modPromise.error;
                    }
                    return modPromise.mod[name];
                  },
                };
              },
            };
          `;
					}

					return `
            ${ssrEnvironments.has(this.environment.name) ? `export const bootstrapModules = [${JSON.stringify('/@id/__x00__virtual:browser-entry')}];` : []}

            export const manifest = {
              resolveClientReference([id, name]) {
                let modPromise;
                return {
                  preload: async () => {
                    if (modPromise) {
                      return modPromise;
                    }

                    modPromise = import(/* @vite-ignore */ id);
                    return modPromise
                      .then((mod) => {
                        modPromise.mod = mod;
                      })
                      .catch((error) => {
                        modPromise.error = error;
                      });
                  },
                  get: () => {
                    if (!modPromise) {
                      throw new Error(\`Module "\${id}" not preloaded\`);
                    }
                    if ("error" in modPromise) {
                      throw modPromise.error;
                    }
                    return modPromise.mod[name];
                  },
                };
              },
            };
          `;
				}

				if (this.environment.name === clientEnvironment) {
					return `
            export const manifest = {
              resolveClientReference([id, name, ...chunks]) {
                let modPromise;
                return {
                  preload: async () => {
                    if (modPromise) {
                      return modPromise;
                    }

                    for (const chunk of chunks) {
                      import(/* @vite-ignore */ chunk);
                    }

                    modPromise = import(/* @vite-ignore */ chunks[0]);
                    return modPromise
                      .then((mod) => {
                        modPromise.mod = mod;
                      })
                      .catch((error) => {
                        modPromise.error = error;
                      });
                  },
                  get: () => {
                    if (!modPromise) {
                      throw new Error(\`Module "\${id}" not preloaded\`);
                    }
                    if ("error" in modPromise) {
                      throw modPromise.error;
                    }
                    return modPromise.mod[name];
                  },
                };
              },
            };
          `;
				}

				if (serverEnvironments.has(this.environment.name)) {
					const manifestAsset = clientOutput?.output.find(
						(asset) => asset.fileName === '.vite/manifest.json',
					);
					const manifestSource =
						manifestAsset?.type === 'asset' && (manifestAsset.source as string);
					const manifest = JSON.parse(manifestSource || '{}');

					return `
            const serverModules = {
              ${Array.from(serverModules)
								.map(([filename, hash]) => {
									return `${JSON.stringify(
										hash,
									)}: () => import(${JSON.stringify(filename)}),`;
								})
								.join('  \n')}
            };

						const referenceChunks = {
							${Array.from(clientModules)
								.map(([filename, hash]) => {
									const relative = vite.normalizePath(
										path.relative(
											path.resolve(this.environment.config.root),
											filename,
										),
									);
									return `${JSON.stringify(hash)}: ${JSON.stringify(
										collectChunks(
											this.environment.config.base,
											relative,
											manifest,
										),
									)},`;
								})
								.join('  \n')}
						};
            
            export const manifest = {
              resolveClientReferenceMetadata(clientReference) {
                const split = clientReference.$$id.split("#");
                return [split[0], split.slice(1).join("#"), ...(referenceChunks[split[0]] || [])];
              },
              resolveServerReference(serverReference) {
                const [id, ...rest] = serverReference.split("#");
                const name = rest.join("#");
                let modPromise;
                return {
                  preload: async () => {
                    if (modPromise) {
                      return modPromise;
                    }

                    modPromise = serverModules[id]();
                    return modPromise
                      .then((mod) => {
                        modPromise.mod = mod;
                      })
                      .catch((error) => {
                        modPromise.error = error;
                      });
                  },
                  get: () => {
                    if (!modPromise) {
                      throw new Error(\`Module "\${id}" not preloaded\`);
                    }
                    if ("error" in modPromise) {
                      throw modPromise.error;
                    }
                    return modPromise.mod[name];
                  },
                };
              },
            };
          `;
				}

				const bootstrapModules: string[] = [];
				if (clientOutput) {
					const manifestAsset = clientOutput?.output.find(
						(asset) => asset.fileName === '.vite/manifest.json',
					);
					const manifestSource =
						manifestAsset?.type === 'asset' && (manifestAsset.source as string);
					const manifest = JSON.parse(manifestSource || '{}');

					bootstrapModules.push(
						...collectChunks(
							this.environment.config.base,
							path.relative(
								path.resolve(this.environment.config.root),
								Array.from(clientEntries)[0]!,
							),
							manifest,
						),
					);
				}

				return `
          export const bootstrapModules = ${JSON.stringify([
						...new Set(bootstrapModules),
					])};
              
          const clientModules = {
            ${Array.from(clientModules)
							.map(([filename, hash]) => {
								return `${JSON.stringify(
									hash,
								)}: () => import(${JSON.stringify(filename)}),`;
							})
							.join('  \n')}
          };

          export const manifest = {
            resolveClientReference([id, name, ...chunks]) {
              let modPromise;
              return {
                preload: async () => {
                  if (modPromise) {
                    return modPromise;
                  }

                  modPromise = clientModules[id]();
                  return modPromise
                    .then((mod) => {
                      modPromise.mod = mod;
                    })
                    .catch((error) => {
                      modPromise.error = error;
                    });
                },
                get: () => {
                  if (!modPromise) {
                    throw new Error(\`Module "\${id}" not preloaded\`);
                  }
                  if ("error" in modPromise) {
                    throw modPromise.error;
                  }
                  return modPromise.mod[name];
                },
              };
            },
          };
        `;
			}
		},
	};
}

function rollupInputsToArray(
	rollupInputs: vite.Rollup.InputOption | undefined,
) {
	return Array.isArray(rollupInputs)
		? rollupInputs
		: typeof rollupInputs === 'string'
			? [rollupInputs]
			: rollupInputs
				? Object.values(rollupInputs)
				: [];
}

function collectChunks(
	base: string,
	forFilename: string,
	manifest: Record<string, { file: string; imports: string[] }>,
	collected: Set<string> = new Set(),
) {
	if (manifest[forFilename]) {
		collected.add(base + manifest[forFilename].file);
		for (const imp of manifest[forFilename].imports ?? []) {
			collectChunks(base, imp, manifest, collected);
		}
	}

	return Array.from(collected);
}

function moveStaticAssets(
	output: vite.Rollup.RollupOutput,
	outDir: string,
	clientOutDir: string,
) {
	const manifestAsset = output.output.find(
		(asset) => asset.fileName === '.vite/ssr-manifest.json',
	);
	if (!manifestAsset || manifestAsset.type !== 'asset')
		throw new Error('could not find manifest');
	const manifest = JSON.parse(manifestAsset.source as string);

	const processed = new Set<string>();
	for (const assets of Object.values(manifest) as string[][]) {
		for (const asset of assets) {
			const fullPath = path.join(outDir, asset.slice(1));

			if (asset.endsWith('.js') || processed.has(fullPath)) continue;
			processed.add(fullPath);

			if (!fs.existsSync(fullPath)) continue;

			const relative = path.relative(outDir, fullPath);
			fs.renameSync(fullPath, path.join(clientOutDir, relative));
		}
	}
}

const EXTENSIONS_TO_TRANSFORM = new Set([
	'.js',
	'.jsx',
	'.cjs',
	'.cjsx',
	'.mjs',
	'.mjsx',
	'.ts',
	'.tsx',
	'.cts',
	'.ctsx',
	'.mts',
	'.mtsx',
]);
