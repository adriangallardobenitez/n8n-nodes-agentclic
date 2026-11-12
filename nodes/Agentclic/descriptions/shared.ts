import type { INodeProperties } from 'n8n-workflow';

/** Client picker, used by every Contact operation. */
export const clientLocator: INodeProperties = {
	displayName: 'Client',
	name: 'clientId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'The client whose CRM you want to work with',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: { searchListMethod: 'searchClients', searchable: true },
		},
		{
			displayName: 'ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. 3f1c2a8e-5b7d-4e19-9a62-0c4d8b7e1f20',
		},
	],
};

/** Contact fields shared by Create, Create or Update and Update. */
export function contactDataFields(includeIdentity: boolean): INodeProperties[] {
	const identity: INodeProperties[] = [
		{
			displayName: 'Name',
			name: 'name',
			type: 'string',
			default: '',
			description: 'Full name of the contact (up to 160 characters)',
		},
		{
			displayName: 'Email',
			name: 'email',
			type: 'string',
			placeholder: 'name@email.com',
			default: '',
			description: 'Email of the contact. Stored in lowercase.',
		},
		{
			displayName: 'Phone',
			name: 'phone',
			type: 'string',
			default: '',
			description:
				'Phone of the contact. Normalized like in the Agentclic panel (e.g. "600 11 22 33" and "600112233" are the same).',
		},
	];
	const rest: INodeProperties[] = [
		{
			displayName: 'Company',
			name: 'company',
			type: 'string',
			default: '',
		},
		{
			displayName: 'Notes',
			name: 'notes',
			type: 'string',
			typeOptions: { rows: 3 },
			default: '',
			description: 'Notes about the contact (up to 2,000 characters)',
		},
		{
			displayName: 'Stage Name or ID',
			name: 'stageId',
			type: 'options',
			typeOptions: { loadOptionsMethod: 'getStages', loadOptionsDependsOn: ['clientId.value'] },
			default: '',
			description:
				'CRM stage of the contact. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		},
		{
			displayName: 'Custom Fields',
			name: 'customFields',
			type: 'fixedCollection',
			typeOptions: { multipleValues: true },
			placeholder: 'Add Custom Field',
			default: {},
			options: [
				{
					displayName: 'Field',
					name: 'field',
					values: [
						{
							displayName: 'Field Name or ID',
							name: 'fieldId',
							type: 'options',
							typeOptions: {
								loadOptionsMethod: 'getCustomFields',
								loadOptionsDependsOn: ['clientId.value'],
							},
							default: '',
							description:
								'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
						},
						{
							displayName: 'Value',
							name: 'value',
							type: 'string',
							default: '',
							description: 'An empty value clears the field',
						},
					],
				},
			],
		},
	];
	return includeIdentity ? [...identity, ...rest] : rest;
}
