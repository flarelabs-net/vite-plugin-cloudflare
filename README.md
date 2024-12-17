# `@cloudflare/vite-plugin`

The Cloudflare Vite plugin enables a full featured integration between Vite and the Workers runtime.
Your Worker code runs inside [workerd](https://github.com/cloudflare/workerd), matching the production behaviour as closely as possible and providing confidence as you develop and deploy your applications.

- Provides direct access to Workers runtime APIs and bindings
- Supports Workers Assets, enabling you to build static sites, SPAs and full-stack applications
- Leverages Vite's hot-module reloading for consistently fast updates
- Supports `vite preview` for previewing your build output in the Workers runtime prior to deployment
