# `@cloudflare/vite-plugin`

## Intro

The Cloudflare Vite plugin enables a full featured integration between Vite and the Workers runtime.
Your Worker code runs inside [workerd](https://github.com/cloudflare/workerd), matching the production behaviour as closely as possible and providing confidence as you develop and deploy your applications.

### Features

- Provides direct access to Workers runtime APIs and bindings
- Supports Workers Assets, enabling you to build static sites, SPAs and full-stack applications
- Leverages Vite's hot-module reloading for consistently fast updates
- Supports `vite preview` for previewing your build output in the Workers runtime prior to deployment

## Quick Start

### Install the plugin

```sh
npm install @cloudflare/vite-plugin --save-dev
```

### Add the plugin to your Vite config

```ts
// vite.config.ts

import { cloudflare } from '@cloudflare/vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [cloudflare()],
});
```

### Create your Worker config file

```toml
# wrangler.toml

name = "my-worker"
main = "./src/index.ts"
compatibility_date = "2024-12-05"
```

### Create your Worker entry file

```ts
// src/index.ts

export default {
	fetch() {
		return new Response(`Running in ${navigator.userAgent}!`);
	},
};
```
