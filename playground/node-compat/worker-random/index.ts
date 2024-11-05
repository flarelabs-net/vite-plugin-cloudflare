import nodeCrypto, { getRandomValues, webcrypto } from 'crypto';
import assert from 'node:assert';

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		return testGetRandomValues();
	},
};

function testGetRandomValues() {
	// TODO: fix this
	// assert(
	// 	webcrypto.getRandomValues === getRandomValues,
	// 	'Unexpected identity for webcrypto.getRandomValues',
	// );
	assert(
		nodeCrypto.getRandomValues === getRandomValues,
		'Unexpected identity for nodeCrypto.getRandomValues',
	);
	return Response.json([
		crypto.getRandomValues(new Uint8Array(6)).toString(), // global
		webcrypto.getRandomValues(new Uint8Array(6)).toString(), // webcrypto
		nodeCrypto.getRandomValues(new Uint8Array(6)).toString(), // namespace import
		getRandomValues(new Uint8Array(6)).toString(), // named import
	]);
}