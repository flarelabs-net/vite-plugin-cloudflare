import { defineConfig } from './types';
import * as workerA from './workers/worker-a' with { type: 'cloudflare-worker' };
import * as workerB from './workers/worker-b' with { type: 'cloudflare-worker' };

export const { config, defineBindings } = defineConfig({});
