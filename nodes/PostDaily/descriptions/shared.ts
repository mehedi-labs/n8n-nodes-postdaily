import type { INodeProperties } from 'n8n-workflow';

/** Shown on operations that take a workspace. Empty means the key's only workspace. */
export const workspaceField: INodeProperties = {
	displayName: 'Workspace Name or ID',
	name: 'workspaceId',
	type: 'options',
	typeOptions: { loadOptionsMethod: 'getWorkspaces' },
	default: '',
	description:
		'Leave empty when the API key covers one workspace. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
};
