import type { INodeProperties } from 'n8n-workflow';

import { workspaceField } from './shared';

const showFor = (operation: string[]) => ({
	show: { resource: ['media'], operation },
});

export const mediaOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['media'] } },
		options: [
			{
				name: 'Import From URL',
				value: 'import',
				description: 'Add an image, video or PDF to the media library from a public URL',
				action: 'Import media from a URL',
			},
			{
				name: 'Upload',
				value: 'upload',
				description: 'Upload a file from an earlier step (binary data) to the media library',
				action: 'Upload media',
			},
		],
		default: 'upload',
	},
];

export const mediaFields: INodeProperties[] = [
	{ ...workspaceField, displayOptions: showFor(['import', 'upload']) },
	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		displayOptions: showFor(['upload']),
		hint: 'The name of the input field containing the file',
	},
	{
		displayName: 'URL',
		name: 'url',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'https://example.com/photo.jpg',
		displayOptions: showFor(['import']),
		description: 'A public http(s) address of an image, video or PDF',
	},
	{
		displayName: 'File Name',
		name: 'filename',
		type: 'string',
		default: '',
		displayOptions: showFor(['import', 'upload']),
		description: "Name shown in PostDaily's media library. Defaults to the file's own name.",
	},
];
