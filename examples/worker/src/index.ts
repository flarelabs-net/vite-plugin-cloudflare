import { OK } from 'zod';
import React, { version as ReactVersion } from 'react';

export default {
	async fetch() {
		return Response.json({
			'zod.OK.name': OK.name,
			'typeof React': typeof React,
			'react version': ReactVersion,
		});
	},
};
