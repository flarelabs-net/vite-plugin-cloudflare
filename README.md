# `@cloudflare/vite-plugin`

[Intro](#intro) | [Quick Start](#quick-start) | [Tutorial](#tutorial) | [API](#api) | [Migrating from `wrangler dev`](#migrating-from-wrangler-dev)

## Intro

The Cloudflare Vite plugin enables a full-featured integration between Vite and the Workers runtime.
Your Worker code runs inside [workerd](https://github.com/cloudflare/workerd), matching the production behavior as closely as possible and providing confidence as you develop and deploy your applications.

### Features

- Provides direct access to Workers runtime APIs and bindings
- Supports Workers Assets, enabling you to build static sites, SPAs, and full-stack applications
- Leverages Vite's hot module replacement for consistently fast updates
- Supports `vite preview` for previewing your build output in the Workers runtime prior to deployment

## Quick start

### Install the dependencies

```sh
npm install @cloudflare/vite-plugin wrangler --save-dev
```

### Add the plugin to your Vite config

```ts
// vite.config.ts

import { defineConfig } from 'vite'
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig({
  plugins: [cloudflare()],
})
```

### Create your Worker config file

```toml
# wrangler.toml

name = "my-worker"
compatibility_date = "2024-12-30"
main = "./src/index.ts"
```

### Create your Worker entry file

```ts
// src/index.ts

export default {
  fetch() {
    return new Response(`Running in ${navigator.userAgent}!`)
  },
}
```

You can now develop (`npm run dev`), build (`npm run build`), preview (`npm run preview`), and deploy (`npm exec wrangler deploy`) your application.

## Tutorial

In this tutorial, you will create a React SPA that can be deployed as a Worker with Workers Assets.
Then, you will add an API Worker that can be accessed from the front-end code.
We will develop, build and preview the application using Vite before finally deploying to Cloudflare.

### Set up and configure the React SPA

#### Scaffold a Vite project

Let's start by creating a React TypeScript project with Vite.

```sh
npm create vite@latest cloudflare-vite-tutorial -- --template react-ts
```

Open the `cloudflare-vite-tutorial` directory in your editor of choice.

#### Add the Cloudflare dependencies

```sh
npm install @cloudflare/vite-plugin wrangler --save-dev
```

#### Add the plugin to your Vite config

```ts
// vite.config.ts

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig({
  plugins: [react(), cloudflare()],
})
```

#### Create your Worker config file

```toml
# wrangler.toml

name = "cloudflare-vite-tutorial"
compatibility_date = "2024-12-30"
assets = { not_found_handling = "single-page-application" }
```

We have set the [`not_found_handling`](https://developers.cloudflare.com/workers/static-assets/routing/#not_found_handling--404-page--single-page-application--none) value to `single-page-application`.
This means that all not found requests will serve the `index.html` file.
With the Cloudflare plugin, the `assets` routing configuration is used in place of Vite's default behavior.
This ensures that your application's routing works the same way while developing as it does when deployed to production.

Note that the [`directory`](https://developers.cloudflare.com/workers/static-assets/binding/#directory) field is not used when configuring assets with Vite.
The `directory` in the output configuration will automatically point to the client build output.

> [!NOTE]
> When using the Cloudflare Vite plugin, the Worker config (e.g. `wrangler.toml`) that you provide is the input configuration file.
> A separate output `wrangler.json` file is created when you run `vite build`.
> This output file is a snapshot of your configuration at the time of the build and is modified to reference your build artifacts.
> It is the configuration that is used for preview and deployment.

#### Run the development server

Run `npm run dev` to verify that your application is working as expected.

For a purely front-end application, you could now build (`npm run build`), preview (`npm run preview`), and deploy (`npm exec wrangler deploy`) your application.
We're going to go a step further, however, and add an API Worker.

### Add an API Worker

#### Configure TypeScript for your Worker code

```sh
npm install @cloudflare/workers-types --save-dev
```

```jsonc
// tsconfig.worker.json

{
  "extends": "./tsconfig.node.json",
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.worker.tsbuildinfo",
    "types": ["@cloudflare/workers-types/2023-07-01", "vite/client"],
  },
  "include": ["api"],
}
```

```jsonc
// tsconfig.json

{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.worker.json" },
  ],
}
```

#### Add to your Worker configuration

```toml
# wrangler.toml

name = "cloudflare-vite-tutorial"
compatibility_date = "2024-12-30"
assets = { not_found_handling = "single-page-application", binding = "ASSETS" }
main = "./api/index.ts"
```

The assets `binding` defined here will allow us to access the assets functionality from our Worker.

#### Add your API Worker

```ts
// api/index.ts

interface Env {
  ASSETS: Fetcher
}

export default {
  fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/')) {
      return Response.json({
        name: 'Cloudflare',
      })
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
```

The Worker above will be invoked for any request not matching a static asset.
It returns a JSON response if the `pathname` starts with `/api/` and otherwise passes the incoming request through to the asset binding.
This means that for paths that do not start with `/api/`, the `not_found_handling` behavior defined in the Worker config will be evaluated and the `index.html` file will be returned, enabling SPA navigations.

#### Call the API from the client

Edit `src/App.tsx` so that it includes an additional button that calls the API and sets some state.
You can replace the file contents with the following code.

```tsx
// src/App.tsx

import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [name, setName] = useState('unknown')

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
              .then((data) => setName(data.name))
          }}
          aria-label="get name"
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
  )
}

export default App
```

Now, if you click the button, it will display 'Name from API is: Cloudflare'.

Let's have a look at hot module reloading in action.
Increment the counter to update the application state in the browser.
Next, edit `api/index.ts` by changing the `name` it returns to `'Cloudflare Workers'`.
If you click the button again, it will display the new `name` while preserving the previously set counter value.
With Vite and the Cloudflare plugin, you can iterate on the client and server parts of your app quickly without losing UI state between edits.

#### Build your application

Run `vite build` to build your application.

If you inspect the `dist` directory, you will see that it contains two subdirectories: `client` and `cloudflare-vite-tutorial`.
The `cloudflare-vite-tutorial` directory contains your Worker code and the output `wrangler.json` configuration.

#### Preview your application

Run `vite preview` to validate that your application runs as expected.
This command will run your build output locally in the Workers runtime, closely matching its behaviour in production.

#### Deploy to Cloudflare

Run `npm exec wrangler deploy` to deploy your application to Cloudflare.
This command will automatically use the output `wrangler.json` that was included in the build output.

### Next steps

In this tutorial, we created an SPA that could be deployed as a Worker with Workers Assets.
We then added an API Worker that could be accessed from the front-end code and deployed to Cloudflare.
Possible next steps include:

- Adding a binding to another Cloudflare service such as a [KV namespace](https://developers.cloudflare.com/kv/) or [D1 database](https://developers.cloudflare.com/d1/)
- Expanding the API to include additional routes
- Using a library, such as [tRPC](https://trpc.io/) or [Hono](https://hono.dev/), in your API Worker

## API

### `cloudflare`

The `cloudflare` plugin should be included in the Vite `plugins` array:

```ts
// vite.config.ts

import { defineConfig } from 'vite'
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig({
  plugins: [cloudflare()],
})
```

It accepts an optional `PluginConfig` parameter.

### `interface PluginConfig`

- `configPath?: string`

  An optional path to your Worker config file.
  By default, a `wrangler.toml`, `wrangler.json`, or `wrangler.jsonc` file in the root of your application will be used as the Worker config.

- `viteEnvironment?: { name?: string }`

  Optional Vite environment options.
  By default, the environment name is the Worker name with `-` characters replaced with `_`.
  Setting the name here will override this.

- `persistState?: boolean | { path: string }`

  An optional override for state persistence.
  By default, state is persisted to `.wrangler/state` in a `v3` subdirectory.
  A custom `path` can be provided or, alternatively, persistence can be disabled by setting the value to `false`.

- `auxiliaryWorkers?: Array<AuxiliaryWorkerConfig>`

  An optional array of auxiliary workers.
  You can use [service bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/) to call auxiliary workers from your main (entry) Worker.
  All requests are routed through your entry Worker.
  During the build, each Worker is output to a separate subdirectory of `dist`.

> [!NOTE]
> When running `wrangler deploy`, only your main (entry) Worker will be deployed.
> If using multiple Workers, it is your responsibility to deploy them individually.
> You can inspect the `dist` directory and then run `wrangler deploy -c path-to-worker-output-config` for each.

### `interface AuxiliaryWorkerConfig`

- `configPath: string`

  A required path to your Worker config file.

- `viteEnvironment?: { name?: string }`

  Optional Vite environment options.
  By default, the environment name is the Worker name with `-` characters replaced with `_`.
  Setting the name here will override this.

## Migrating from `wrangler dev`

Migrating from `wrangler dev` is straightforward and you can follow the instructions in the [Quick Start](#quick-start) to get started.
There are a few key differences to highlight:

### Input and output Worker config files

In the Vite integration, your Worker config file (e.g. `wrangler.toml`) is the input configuration and a separate output configuration is created as part of the build.
This output file is a snapshot of your configuration at the time of the build and is modified to reference your build artifacts.
It is the configuration that is used for preview and deployment.

### Redundant fields in the Wrangler config file

There are various options in the Worker config file that are ignored when using Vite, as they are either no longer applicable or are replaced by Vite equivalents.
If these options are provided then warnings will be printed to the console with suggestions for how to proceed.
Examples where the Vite configuration should be used instead include `alias` and `define`.
