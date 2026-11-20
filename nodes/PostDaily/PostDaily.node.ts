import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { channelFields, channelOperations } from './descriptions/ChannelDescription';
import { mediaFields, mediaOperations } from './descriptions/MediaDescription';
import { postFields, postOperations } from './descriptions/PostDescription';
import { callPostDaily, splitList } from './GenericFunctions';

/**
 * PostDaily's list tools page at most 50 items per call. Programmatic style
 * because uploading a file takes three dependent calls (start the upload,
 * PUT the bytes, confirm it) that the declarative style cannot express.
 */
const PAGE_SIZE = 50;

/** Adds `media` from the comma-separated ID and URL fields, IDs first. */
function mediaArg(fields: IDataObject): IDataObject[] | undefined {
	const media = [
		...splitList(fields.mediaIds).map((mediaId) => ({ mediaId })),
		...splitList(fields.mediaUrls).map((url) => ({ url })),
	];

	return media.length > 0 ? media : undefined;
}

/** Parses the Network Options JSON field; an empty list means "leave as is". */
function channelSettingsArg(
	this: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): IDataObject[] | undefined {
	if (value === undefined || value === '' || value === '[]') {
		return undefined;
	}

	let parsed: unknown = value;

	if (typeof value === 'string') {
		try {
			parsed = JSON.parse(value);
		} catch {
			parsed = undefined;
		}
	}

	if (!Array.isArray(parsed)) {
		throw new NodeOperationError(this.getNode(), 'Network Options must be a JSON list', {
			itemIndex,
			description: 'For example: [{"channel": "youtube", "options": {"youtube": {"title": "My video"}}}]',
		});
	}

	return parsed.length > 0 ? (parsed as IDataObject[]) : undefined;
}

/** Drops undefined and empty-string values so PostDaily sees only what was set. */
function compact(args: IDataObject): IDataObject {
	return Object.fromEntries(
		Object.entries(args).filter(([, value]) => value !== undefined && value !== ''),
	) as IDataObject;
}

export class PostDaily implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'PostDaily',
		name: 'postDaily',
		icon: { light: 'file:postdaily.svg', dark: 'file:postdaily.dark.svg' },
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Draft, queue and schedule social media posts to Instagram, Facebook, TikTok, YouTube, LinkedIn, X and more',
		defaults: { name: 'PostDaily' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'postDailyApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Channel', value: 'channel' },
					{ name: 'Media', value: 'media' },
					{ name: 'Post', value: 'post' },
				],
				default: 'post',
			},
			...postOperations,
			...postFields,
			...mediaOperations,
			...mediaFields,
			...channelOperations,
			...channelFields,
		],
	};

	methods = {
		loadOptions: {
			async getWorkspaces(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const data = await callPostDaily.call(this, 'list_workspaces', {});
				const workspaces = (data.workspaces as IDataObject[] | undefined) ?? [];

				return workspaces.map((workspace) => ({
					name: String(workspace.name),
					value: String(workspace.id),
				}));
			},

			async getChannels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const workspaceId = this.getCurrentNodeParameter('workspaceId') as string | undefined;
				const data = await callPostDaily.call(
					this,
					'list_channels',
					compact({ workspaceId: workspaceId || undefined }),
				);
				const channels = (data.channels as IDataObject[] | undefined) ?? [];

				return channels.map((channel) => ({
					name: `${String(channel.networkName ?? channel.network)} · ${String(channel.handle ?? channel.name)}`,
					value: String(channel.id),
					description: channel.status === 'ok' ? undefined : 'Needs reconnecting in PostDaily',
				}));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const results = await runOperation.call(this, resource, operation, i);

				for (const json of results) {
					returnData.push({ json, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}

				if (error instanceof NodeOperationError) {
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex: i,
						description: error.description ?? undefined,
					});
				}

				throw new NodeApiError(this.getNode(), error as JsonObject, {
					itemIndex: i,
					message: (error as Error).message,
					description: error instanceof NodeApiError ? (error.description ?? undefined) : undefined,
				});
			}
		}

		return [returnData];
	}
}

async function runOperation(
	this: IExecuteFunctions,
	resource: string,
	operation: string,
	i: number,
): Promise<IDataObject[]> {
	const workspace = () =>
		(this.getNodeParameter('workspaceId', i, '') as string) || undefined;
	const defaultKey = () =>
		`n8n-${this.getExecutionId()}-${this.getNode().id}-${i}`.slice(0, 200);

	if (resource === 'post') {
		if (operation === 'create') {
			const mode = this.getNodeParameter('mode', i) as string;
			const fields = this.getNodeParameter('additionalFields', i) as IDataObject;

			if (mode === 'now' && !this.getNodeParameter('confirmPublishNow', i, false)) {
				throw new NodeOperationError(this.getNode(), 'Publish Now needs Confirm Publish Now', {
					itemIndex: i,
					description:
						'Turn on Confirm Publish Now to let this workflow publish with no person checking the post, or choose Draft, Add to Queue or Schedule.',
				});
			}

			const result = await callPostDaily.call(
				this,
				'create_post',
				compact({
					workspaceId: workspace(),
					channels: this.getNodeParameter('channels', i) as string[],
					text: this.getNodeParameter('text', i) as string,
					mode,
					scheduledAt:
						mode === 'scheduled' ? (this.getNodeParameter('scheduledAt', i) as string) : undefined,
					confirmPublish: mode === 'now' ? true : undefined,
					confirmWarnings: fields.continueDespiteWarnings === true ? true : undefined,
					firstComment: fields.firstComment as string | undefined,
					idempotencyKey: (fields.idempotencyKey as string) || defaultKey(),
					media: mediaArg(fields),
					channelSettings: channelSettingsArg.call(this, fields.channelSettings, i),
					requestApproval: fields.requestApproval === true ? true : undefined,
					tags: splitList(fields.tags).length > 0 ? splitList(fields.tags) : undefined,
					timezone: fields.timezone as string | undefined,
					title: fields.title as string | undefined,
				}),
				i,
			);

			if (result.outcome === 'needs_confirmation') {
				throw new NodeOperationError(this.getNode(), String(result.summary ?? 'PostDaily needs a confirmation'), {
					itemIndex: i,
					description:
						'PostDaily found warnings and saved nothing. Fix the post, or turn on Continue Despite Warnings.',
				});
			}

			return [result];
		}

		if (operation === 'get') {
			return [
				await callPostDaily.call(this, 'get_post', { postId: this.getNodeParameter('postId', i) as string }, i),
			];
		}

		if (operation === 'getAll') {
			const returnAll = this.getNodeParameter('returnAll', i) as boolean;
			const limit = returnAll ? Infinity : (this.getNodeParameter('limit', i) as number);
			const filters = this.getNodeParameter('filters', i) as IDataObject;
			const posts: IDataObject[] = [];
			let cursor: string | undefined;

			do {
				const page = await callPostDaily.call(
					this,
					'list_posts',
					compact({
						workspaceId: workspace(),
						channels: splitList(filters.channels).length > 0 ? splitList(filters.channels) : undefined,
						statuses:
							(filters.statuses as string[] | undefined)?.length ? filters.statuses : undefined,
						search: filters.search as string | undefined,
						from: filters.from as string | undefined,
						to: filters.to as string | undefined,
						limit: Math.min(PAGE_SIZE, limit - posts.length),
						cursor,
					}),
					i,
				);

				posts.push(...((page.posts as IDataObject[] | undefined) ?? []));
				cursor = (page.nextCursor as string | null | undefined) ?? undefined;
			} while (cursor && posts.length < limit);

			return posts.slice(0, limit);
		}

		if (operation === 'update') {
			const fields = this.getNodeParameter('updateFields', i) as IDataObject;

			return [
				await callPostDaily.call(
					this,
					'update_post',
					compact({
						postId: this.getNodeParameter('postId', i) as string,
						text: fields.text as string | undefined,
						title: fields.title as string | undefined,
						firstComment: fields.firstComment as string | undefined,
						channels: splitList(fields.channels).length > 0 ? splitList(fields.channels) : undefined,
						tags: splitList(fields.tags).length > 0 ? splitList(fields.tags) : undefined,
						media: mediaArg(fields),
						channelSettings: channelSettingsArg.call(this, fields.channelSettings, i),
						expectedVersion: (fields.expectedVersion as number | undefined) || undefined,
					}),
					i,
				),
			];
		}

		if (operation === 'delete') {
			return [
				await callPostDaily.call(this, 'delete_post', { postId: this.getNodeParameter('postId', i) as string }, i),
			];
		}

		if (operation === 'retry') {
			return [
				await callPostDaily.call(
					this,
					'retry_post',
					compact({
						postId: this.getNodeParameter('postId', i) as string,
						channel: (this.getNodeParameter('channel', i, '') as string) || undefined,
						confirmPublish: this.getNodeParameter('confirmRetry', i, false) ? true : undefined,
					}),
					i,
				),
			];
		}
	}

	if (resource === 'media') {
		const filename = (this.getNodeParameter('filename', i, '') as string) || undefined;

		if (operation === 'import') {
			return [
				await callPostDaily.call(
					this,
					'import_media',
					compact({
						workspaceId: workspace(),
						url: this.getNodeParameter('url', i) as string,
						filename,
						idempotencyKey: defaultKey(),
					}),
					i,
				),
			];
		}

		if (operation === 'upload') {
			const property = this.getNodeParameter('binaryPropertyName', i) as string;
			const binary = this.helpers.assertBinaryData(i, property);
			const bytes = await this.helpers.getBinaryDataBuffer(i, property);
			const started = await callPostDaily.call(
				this,
				'create_media_upload',
				compact({
					workspaceId: workspace(),
					contentType: binary.mimeType,
					filename: filename ?? binary.fileName ?? 'upload',
					sizeBytes: bytes.length,
				}),
				i,
			);

			await this.helpers.httpRequest({
				method: 'PUT',
				url: String(started.uploadUrl),
				headers: (started.headers as IDataObject | undefined) ?? { 'Content-Type': binary.mimeType },
				body: bytes,
				json: false,
			});

			return [
				await callPostDaily.call(
					this,
					'complete_media_upload',
					compact({ workspaceId: workspace(), mediaId: String(started.mediaId) }),
					i,
				),
			];
		}
	}

	if (resource === 'channel' && operation === 'getAll') {
		const data = await callPostDaily.call(
			this,
			'list_channels',
			compact({
				workspaceId: workspace(),
				network: (this.getNodeParameter('network', i, '') as string) || undefined,
			}),
			i,
		);

		return (data.channels as IDataObject[] | undefined) ?? [];
	}

	throw new NodeOperationError(this.getNode(), `Unsupported operation: ${resource} ${operation}`, {
		itemIndex: i,
	});
}
