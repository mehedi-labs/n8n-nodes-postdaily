import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class PostDailyApi implements ICredentialType {
	name = 'postDailyApi';

	displayName = 'PostDaily API';

	icon: Icon = {
		light: 'file:../nodes/PostDaily/postdaily.svg',
		dark: 'file:../nodes/PostDaily/postdaily.dark.svg',
	};

	documentationUrl = 'https://www.postdaily.app/help/connect-with-an-api-key';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			placeholder: 'pd_live_...',
			description:
				'Create one in PostDaily under Settings → AI agents → API key. A Drafts only key can create and edit drafts but never schedule or publish.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			required: true,
			default: 'https://api.postdaily.app/v1',
			description: 'Leave as it is unless PostDaily support gives you another address',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			method: 'GET',
			baseURL: '={{$credentials.baseUrl}}',
			url: '/workspaces',
		},
	};
}
