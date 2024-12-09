import { beforeEach, describe } from 'node:test';
import { fileURLToPath } from 'node:url';
import { expect, test, vi } from 'vitest';
import { readWorkerConfig } from '../worker-config';

let wranglerConfigMock: any = undefined;

vi.mock('wrangler', async (importOriginal) => {
	const mod = await importOriginal<typeof import('wrangler')>();
	return {
		unstable_readConfig: (path: string) => {
			if (wranglerConfigMock === undefined) {
				return mod.unstable_readConfig(path, {});
			}

			return wranglerConfigMock;
		},
	};
});

describe('readWorkerConfig', () => {
	beforeEach(() => {
		wranglerConfigMock = undefined;
	});
	test('should read a simple wrangler.toml file', () => {
		const { config } = readWorkerConfig(
			fileURLToPath(new URL('fixtures/simple-wrangler.toml', import.meta.url)),
		);
		expect(typeof config).toEqual('object');
		expect(config.name).toEqual('my-worker');
		expect(config.main).toMatch(/index\.ts$/);
		expect(config.ai).toBeUndefined();
		expect(config.alias).toBeUndefined();
		expect(config.compatibility_flags).toEqual([]);
	});
});
