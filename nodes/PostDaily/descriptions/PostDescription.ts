import type { INodeProperties } from 'n8n-workflow';

import { workspaceField } from './shared';

const showFor = (operation: string[]) => ({
	show: { resource: ['post'], operation },
});

export const postOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['post'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a post as a draft, in the queue or scheduled',
				action: 'Create a post',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a post from PostDaily (a published post stays live on the network)',
				action: 'Delete a post',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a post with its channels and status',
				action: 'Get a post',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Find posts by status, channel, text or date',
				action: 'Get many posts',
			},
			{
				name: 'Retry',
				value: 'retry',
				description: 'Publish the failed channels of a post again',
				action: 'Retry a failed post',
			},
			{
				name: 'Update',
				value: 'update',
				description: "Edit a draft's text, title, media, channels or tags",
				action: 'Update a draft',
			},
		],
		default: 'create',
	},
];

const mediaFields: INodeProperties[] = [
	{
		displayName: 'Media IDs',
		name: 'mediaIds',
		type: 'string',
		default: '',
		description:
			'Comma-separated media IDs from the Media resource (Upload or Import From URL), in the order they should appear',
	},
	{
		displayName: 'Media URLs',
		name: 'mediaUrls',
		type: 'string',
		default: '',
		description:
			'Comma-separated public image, video or PDF URLs. PostDaily imports each one before saving the post.',
	},
];

export const postFields: INodeProperties[] = [
	{ ...workspaceField, displayOptions: showFor(['create', 'getAll']) },

	// create
	{
		displayName: 'Channel Names or IDs',
		name: 'channels',
		type: 'multiOptions',
		typeOptions: { loadOptionsMethod: 'getChannels', loadOptionsDependsOn: ['workspaceId'] },
		required: true,
		default: [],
		displayOptions: showFor(['create']),
		description:
			'The channels to post to. Each one becomes its own post. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		typeOptions: { rows: 4 },
		required: true,
		default: '',
		displayOptions: showFor(['create']),
		description: 'The post text for every channel. PostDaily checks it against each network\'s limits.',
	},
	{
		displayName: 'Mode',
		name: 'mode',
		type: 'options',
		options: [
			{
				name: 'Add to Queue',
				value: 'queue',
				description: "Add to each channel's next free queue slot (needs a Full access key)",
			},
			{
				name: 'Draft',
				value: 'draft',
				description: 'Save as a draft for a person to check',
			},
			{
				name: 'Publish Now',
				value: 'now',
				description: 'Publish immediately (needs a Full access key and the confirmation below)',
			},
			{
				name: 'Schedule',
				value: 'scheduled',
				description: 'Publish at a set time (needs a Full access key)',
			},
		],
		default: 'draft',
		displayOptions: showFor(['create']),
	},
	{
		displayName: 'Scheduled At',
		name: 'scheduledAt',
		type: 'dateTime',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['post'], operation: ['create'], mode: ['scheduled'] } },
		description: 'When to publish. Without a time zone offset it is read in the workspace time zone.',
	},
	{
		displayName: 'Confirm Publish Now',
		name: 'confirmPublishNow',
		type: 'boolean',
		default: false,
		displayOptions: { show: { resource: ['post'], operation: ['create'], mode: ['now'] } },
		description:
			'Whether this workflow may publish immediately, with no person checking the post first. PostDaily refuses Publish Now without it.',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: showFor(['create']),
		options: [
			{
				displayName: 'Continue Despite Warnings',
				name: 'continueDespiteWarnings',
				type: 'boolean',
				default: false,
				description:
					'Whether to save the post even when PostDaily warns about it. When off, a warning stops this item with the warning as the error.',
			},
			{
				displayName: 'First Comment',
				name: 'firstComment',
				type: 'string',
				default: '',
				description: 'Posted as a comment right after publishing, on networks that support it',
			},
			{
				displayName: 'Idempotency Key',
				name: 'idempotencyKey',
				type: 'string',
				default: '',
				description:
					'A unique value for this post, such as an article URL. Sending the same key again returns the first result instead of creating a second post. When empty, the node uses the execution, node and item.',
			},
			...mediaFields,
			{
				displayName: 'Network Options (JSON)',
				name: 'channelSettings',
				type: 'json',
				default: '[]',
				description:
					'Per-channel text and network options, e.g. [{"channel": "youtube", "options": {"youtube": {"title": "My video"}}}]. See PostDaily\'s get_channel_options.',
			},
			{
				displayName: 'Request Approval',
				name: 'requestApproval',
				type: 'boolean',
				default: false,
				description: 'Whether to hold the post for client approval, in workspaces where approval is optional',
			},
			{
				displayName: 'Tags',
				name: 'tags',
				type: 'string',
				default: '',
				description: 'Comma-separated names of existing workspace tags',
			},
			{
				displayName: 'Time Zone',
				name: 'timezone',
				type: 'string',
				default: '',
				placeholder: 'Europe/London',
				description: 'IANA time zone for a scheduled time without an offset. Defaults to the workspace time zone.',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'Internal title shown in PostDaily (YouTube and Pinterest titles go in Network Options)',
			},
		],
	},

	// get, update, delete, retry
	{
		displayName: 'Post ID',
		name: 'postId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: showFor(['get', 'update', 'delete', 'retry']),
	},

	// update
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: showFor(['update']),
		options: [
			{
				displayName: 'Channels',
				name: 'channels',
				type: 'string',
				default: '',
				description: 'Comma-separated channel IDs, network names or @handles. Replaces the current channels.',
			},
			{
				displayName: 'Expected Version',
				name: 'expectedVersion',
				type: 'number',
				default: 0,
				description:
					'The version from Get. When set, the edit fails if someone changed the post since. 0 means do not check.',
			},
			{
				displayName: 'First Comment',
				name: 'firstComment',
				type: 'string',
				default: '',
			},
			...mediaFields,
			{
				displayName: 'Network Options (JSON)',
				name: 'channelSettings',
				type: 'json',
				default: '[]',
				description: 'Per-channel text and network options. Options merge field by field.',
			},
			{
				displayName: 'Tags',
				name: 'tags',
				type: 'string',
				default: '',
				description: 'Comma-separated names of existing workspace tags',
			},
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
			},
		],
	},

	// retry
	{
		displayName: 'Channel',
		name: 'channel',
		type: 'string',
		default: '',
		displayOptions: showFor(['retry']),
		description: 'Retry only this channel (ID, network name or @handle). Leave empty to retry every failed channel.',
	},
	{
		displayName: 'Confirm Retry',
		name: 'confirmRetry',
		type: 'boolean',
		default: false,
		displayOptions: showFor(['retry']),
		description:
			'Whether to publish again right away. When off, nothing is sent and the output lists the channels that would be retried.',
	},

	// getAll
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: showFor(['getAll']),
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		displayOptions: { show: { resource: ['post'], operation: ['getAll'], returnAll: [false] } },
		description: 'Max number of results to return',
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: showFor(['getAll']),
		options: [
			{
				displayName: 'Channels',
				name: 'channels',
				type: 'string',
				default: '',
				description: 'Comma-separated channel IDs, network names or @handles',
			},
			{
				displayName: 'From',
				name: 'from',
				type: 'dateTime',
				default: '',
				description: 'Only posts scheduled or published at or after this time',
			},
			{
				displayName: 'Search',
				name: 'search',
				type: 'string',
				default: '',
				description: 'Only posts whose text contains this',
			},
			{
				displayName: 'Statuses',
				name: 'statuses',
				type: 'multiOptions',
				options: [
					{ name: 'Awaiting Approval', value: 'awaiting_approval' },
					{ name: 'Canceled', value: 'canceled' },
					{ name: 'Draft', value: 'draft' },
					{ name: 'Failed', value: 'failed' },
					{ name: 'Partially Failed', value: 'partially_failed' },
					{ name: 'Published', value: 'published' },
					{ name: 'Publishing', value: 'publishing' },
					{ name: 'Scheduled', value: 'scheduled' },
				],
				default: [],
			},
			{
				displayName: 'To',
				name: 'to',
				type: 'dateTime',
				default: '',
				description: 'Only posts scheduled or published before this time',
			},
		],
	},
];
