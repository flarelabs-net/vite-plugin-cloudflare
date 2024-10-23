exports.helloWorldNoExt = `${require('./hello').default} ${
	// Note: esbuild doesn't seem to be correctly resolving cjs files
	//       (do we need to tweak something ourselves or is this an esbuild bug?)
	// require('./world').default
	'world (<NOT_IMPORTED>)'
}`;
