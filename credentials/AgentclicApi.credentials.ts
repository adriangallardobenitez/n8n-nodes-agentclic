import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class AgentclicApi implements ICredentialType {
	name = 'agentclicApi';

	displayName = 'Agentclic API';

	icon: Icon = {
		light: 'file:../nodes/Agentclic/agentclic.svg',
		dark: 'file:../nodes/Agentclic/agentclic.dark.svg',
	};

	documentationUrl = 'https://agentclic.com/developers';

	properties: INodeProperties[] = [
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			placeholder: 'ack_live_...',
			description:
				'Token created in Agentclic under Ajustes › API. It is only shown once when you create it.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://agentclic.com/api/public/pro/v1',
			description: 'Leave the default value unless Agentclic support tells you otherwise',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl.replace(/\\/+$/, "")}}',
			url: '/me',
			method: 'GET',
		},
	};
}
