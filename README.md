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

### Install the dependencies

```sh
npm install @cloudflare/vite-plugin wrangler --save-dev
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

## Tutorial

In this tutorial, we're going to create a React SPA that can be deployed to Workers Assets. We'll then add an API Worker that can be accessed from the front end code. We will develop, build and preview the application using Vite before finally deploying to Cloudflare.

### Scaffold a Vite project

Let's start by creating a React TypeScript project with Vite.

```sh
npm create vite@latest cloudflare-vite-tutorial -- --template react-ts
```

Open the `cloudflare-vite-tutorial` directory in your editor of choice and install the dependencies.

```sh
npm install
```

### Add the Cloudflare dependencies

```sh
npm install @cloudflare/vite-plugin wrangler --save-dev
```

### Add the plugin to your Vite config

```ts
// vite.config.ts

import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [react(), cloudflare()],
});
```

### Create your Worker config file

```toml
# wrangler.toml

assets = {}
```

The `directory` field is not required when configuring assets with Vite.
The `directory` in the output configuration will automatically point to the client build output.

> [!NOTE]
> When using the Cloudflare Vite plugin, the `wrangler.toml` or `wrangler.json(c)` that you provide is the input configuration file.
> A separate output `wrangler.json` file is created when you run `vite build`.
> This output file is a snapshot of your configuration at the time of the build and is the configuration used for deployment.

### Configure not found handling

If you run `vite dev` you will see that your app is running.
If you navigate to a different path, however, you will get a 404 response.
This is because the not found handling is now being handled by the Cloudflare plugin rather than Vite and replicates the production behaviour that is specified in your configuration.
To make all not found requests direct to the `index.html` file, set the value to `single-page-application` in your config.

```toml
# wrangler.toml

assets = { not_found_handling = "single-page-application" }
```

Now, if you navigate to a different path, you will still see your application.
For a purely front-end application, you could now proceed to build and deploy your application.
We're going to go a step further, however, and add an API Worker.

### Add the `@cloudflare/workers-types` dependency and configure TypeScript

```sh
npm install @cloudflare/vite-plugin --save-dev
```

```json
// tsconfig.worker.json

{
	"extends": "./tsconfig.node.json",
	"compilerOptions": {
		"tsBuildInfoFile": "./node_modules/.tmp/tsconfig.worker.tsbuildinfo",
		"types": ["@cloudflare/workers-types/2023-07-01", "vite/client"]
	},
	"include": ["api"]
}
```

```json
// tsconfig.json

{
	"files": [],
	"references": [
		{ "path": "./tsconfig.app.json" },
		{ "path": "./tsconfig.node.json" },
		{ "path": "./tsconfig.worker.json" }
	]
}
```

### Add to your Worker configuration

```toml
# wrangler.toml

name = "api"
main = "./api/index.ts"
compatibility_date = "2024-12-05"
assets = { not_found_handling = "single-page-application", binding = "ASSETS" }
```

The assets `binding` will allow us to access the assets functionality from our Worker.

### Add your API Worker

```ts
// api/index.ts

interface Env {
	ASSETS: Fetcher;
}

export default {
	fetch(request, env) {
		const url = new URL(request.url);

		if (url.pathname.startsWith('/api/')) {
			return Response.json({
				name: 'Cloudflare',
			});
		}

		return env.ASSETS.fetch(request);
	},
} satisfies ExportedHandler<Env>;
```

The Worker above will be invoked for any not found path.
It returns a JSON response if the `pathname` starts with `/api/` and otherwise passes the incoming request through to the asset binding.
This means that for paths that do not start with `/api/`, the `not_found_handling` behaviour defined in the Worker config will be evaluated.

### Call the API from the client

Edit `src/App.tsx` so that it includes an additional button that calls the API and sets some state. You can replace the file contents with the following code.

```ts
// src/App.tsx

import viteLogo from '/vite.svg';
import { useState } from 'react';
import reactLogo from './assets/react.svg';
import './App.css';

function App() {
	const [count, setCount] = useState(0);
	const [name, setName] = useState('unknown');

	return (
		<>
			<div>
				<a href="https://vite.dev" target="_blank">
					<img src={viteLogo} className="logo" alt="Vite logo" />
				</a>
				<a href="https://react.dev" target="_blank">
					<img src={reactLogo} className="logo react" alt="React logo" />
				</a>
			</div>
			<h1>Vite + React</h1>
			<div className="card">
				<button
					onClick={() => setCount((count) => count + 1)}
					aria-label="increment"
				>
					count is {count}
				</button>
				<p>
					Edit <code>src/App.tsx</code> and save to test HMR
				</p>
			</div>
			<div className="card">
				<button
					onClick={() => {
						fetch('/api/')
							.then((res) => res.json() as Promise<{ name: string }>)
							.then((data) => setName(data.name));
					}}
					aria-label="get-name"
				>
					Name from API is: {name}
				</button>
				<p>
					Edit <code>api/index.ts</code> to change the name
				</p>
			</div>
			<p className="read-the-docs">
				Click on the Vite and React logos to learn more
			</p>
		</>
	);
}

export default App;
```

Now, if you click the button, it will display 'Name from API is: Cloudflare'.
Try incrementing the counter and then changing the `name` that is returned in `api/index.ts`
If you click the button again it will display the new value while the counter state is preserved.

### Build your application

Run `vite build` to build the application.
If you inspect the `dist` directory, you will see that it contains two subdirectories: `client` and `api`.
The `api` directory contains your Worker code and the output `wrangler.json` configuration.

### Preview your application

Run `vite preview` to validate that your application runs as expected. This command will run your build output locally in the Workers runtime.

### Deploy to Cloudflare

To deploy your application to Cloudflare, run `wrangler deploy`. This command will automatically use the output `wrangler.json` that was included in the build output.

### Next steps

In this tutorial we created an SPA that could be deployed using Workers Assets.
We then added an API Worker that could be accessed from the front end code.
Next, you could try expanding the API and adding a binding to another Cloudflare service such as a [KV namespace](https://developers.cloudflare.com/kv/) or [D1 database](https://developers.cloudflare.com/d1/).
