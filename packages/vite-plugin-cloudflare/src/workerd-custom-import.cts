module.exports = async (path: string) => {
  const result = await import(path);
  // CJS modules don't provide named exports properly in workerd, the named values can be
  // found under `default` instead, so here we spread default in the returned object
  // (this should get fixed soon: https://github.com/cloudflare/workerd/pull/2194)
  return {
    ...result,
    ...(result.default ?? {}),
  };
};
