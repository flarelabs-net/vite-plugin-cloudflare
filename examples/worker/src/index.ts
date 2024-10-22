import { maxLength } from '@cloudflare-dev-module-resolution/builtins/cjs';
import { RPCErrorCodes, Utils } from 'discord-api-types/v10';
import React, { version as ReactVersion } from 'react';
import { Collection, SlashCreator, VERSION } from 'slash-create/web';
import { OK } from 'zod';

const slashCreatorInstance = new SlashCreator({
	applicationID: 'xxx',
});

const myCollection = new Collection([['a number', 54321]]);
export default {
	async fetch() {
		return Response.json({
			userAgent: navigator.userAgent,
			'zod.OK.name': OK.name,
			'typeof React': typeof React,
			'react version': ReactVersion,
			'(slash-create/web) VERSION': VERSION,
			'(slash-create/web) slashCreatorInstance is instance of SlashCreator':
				slashCreatorInstance instanceof SlashCreator,
			'(slash-create/web) myCollection.random()': myCollection.random(),
			'(discord-api-types/v10) Utils.isLinkButton({})': Utils.isLinkButton(
				{} as any,
			),
			'(discord-api-types/v10) RPCErrorCodes.InvalidUser':
				RPCErrorCodes.InvalidUser,
			'node:buffer MAX_LENGTH': maxLength,
		});
	},
};
