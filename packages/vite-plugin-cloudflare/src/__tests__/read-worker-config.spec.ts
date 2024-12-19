import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { readWorkerConfig } from '../worker-config';

describe('readWorkerConfig', () => {
	test('should read a simple wrangler.toml file', () => {
		const { config, nonApplicable } = readWorkerConfig(
			fileURLToPath(new URL('fixtures/simple-wrangler.toml', import.meta.url)),
		);
		expect(typeof config).toEqual('object');

		expect(config.ai).toBeUndefined();
		expect(config.alias).toBeUndefined();
		expect(config.base_dir).toBeUndefined();
		expect(config.build).toEqual({
			command: undefined,
			cwd: undefined,
			watch_dir: './src',
		});
		expect(config.compatibility_flags).toEqual([]);
		expect(config.define).toEqual({});
		expect(config.find_additional_modules).toBeUndefined();
		expect(config.main).toMatch(/index\.ts$/);
		expect(config.minify).toBeUndefined();
		expect(config.name).toEqual('my-worker');
		expect(config.node_compat).toBeUndefined();
		expect(config.no_bundle).toBeUndefined();
		expect(config.preserve_file_names).toBeUndefined();
		expect(config.rules).toEqual([]);
		expect(config.site).toBeUndefined();
		expect(config.tsconfig).toBeUndefined();
		expect(config.upload_source_maps).toBeUndefined();

		expect(nonApplicable).toEqual({
			replacedByVite: new Set(),
			notRelevant: new Set(),
			overridden: new Set(),
		});
	});

	test('should collect non applicable configs', () => {
		const { config, nonApplicable } = readWorkerConfig(
			fileURLToPath(
				new URL(
					'fixtures/wrangler-with-fields-to-ignore.toml',
					import.meta.url,
				),
			),
		);

		expect(typeof config).toEqual('object');

		expect(config.ai).toBeUndefined();
		expect(config.alias).toEqual({
			'my-test': './my-test.ts',
			'my-test-a': './my-test-a.ts',
		});
		expect(config.base_dir).toMatch(/src$/);
		expect(config.build).toEqual({
			command: 'npm run build',
			cwd: 'build_cwd',
			watch_dir: expect.stringMatching(/build_watch_dir/),
		});
		expect(config.compatibility_flags).toEqual([]);
		expect(config.define).toEqual({
			'define-a': 'a',
			'define-b': 'b',
		});
		expect(config.find_additional_modules).toBe(false);
		expect(config.main).toMatch(/index\.ts$/);
		expect(config.minify).toBe(true);
		expect(config.name).toEqual('my-worker');
		expect(config.node_compat).toEqual(false);
		expect(config.no_bundle).toEqual(false);
		expect(config.preserve_file_names).toBe(true);
		expect(config.rules).toEqual([
			{ type: 'Text', globs: ['**/*.md'], fallthrough: true },
		]);
		expect(config.site).toEqual({
			bucket: './public',
			'entry-point': undefined,
			exclude: ['ignore_dir'],
			include: ['upload_dir'],
		});
		expect(config.tsconfig).toMatch(/tsconfig\.custom\.json$/);
		expect(config.upload_source_maps).toBe(false);

		expect(nonApplicable.replacedByVite).toEqual(
			new Set(['define', 'alias', 'minify']),
		);
		expect(nonApplicable.notRelevant).toEqual(
			new Set([
				'base_dir',
				'build',
				'find_additional_modules',
				'no_bundle',
				'node_compat',
				'preserve_file_names',
				'site',
				'tsconfig',
				'upload_source_maps',
			]),
		);
		expect(nonApplicable.overridden).toEqual(new Set(['rules']));
	});
});
