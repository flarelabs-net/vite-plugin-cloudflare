import type { EnvironmentOptions } from 'vite';

export interface CloudflareEnvironmentOptions {
	main: string;
	wranglerConfig?: string;
	overrides?: EnvironmentOptions;
}

export interface PluginConfig<
	T extends Record<string, CloudflareEnvironmentOptions>,
> {
	workers: T;
	entryWorker?: keyof T;
	persistTo?: string | false;
}
