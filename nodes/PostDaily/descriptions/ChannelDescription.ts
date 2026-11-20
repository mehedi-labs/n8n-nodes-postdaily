import type { INodeProperties } from 'n8n-workflow';

import { workspaceField } from './shared';

export const channelOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['channel'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List connected channels, their limits and whether each can post now',
				action: 'Get many channels',
			},
		],
		default: 'getAll',
	},
];

export const channelFields: INodeProperties[] = [
	{ ...workspaceField, displayOptions: { show: { resource: ['channel'], operation: ['getAll'] } } },
	{
		displayName: 'Network',
		name: 'network',
		type: 'string',
		default: '',
		placeholder: 'instagram',
		displayOptions: { show: { resource: ['channel'], operation: ['getAll'] } },
		description: 'Only channels on this network. Leave empty for all.',
	},
];
