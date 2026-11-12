import type { INodeProperties } from 'n8n-workflow';
import { clientLocator, contactDataFields } from './shared';

const contactLocator: INodeProperties = {
	displayName: 'Contact',
	name: 'contactId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'The contact to work with',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: { searchListMethod: 'searchContacts', searchable: true },
		},
		{
			displayName: 'ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. 8a2e4c61-1d3b-4f7a-b9e0-5c6d7e8f9a01',
		},
	],
};

export const contactOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['contact'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a contact in the CRM of a client',
				action: 'Create a contact',
			},
			{
				name: 'Create or Update',
				value: 'upsert',
				description: 'Create a new record, or update the current one if it already exists (upsert)',
				action: 'Create or update a contact',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a contact with its custom fields',
				action: 'Get a contact',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many contacts from the CRM of a client',
				action: 'Get many contacts',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update the data, stage or custom fields of a contact',
				action: 'Update a contact',
			},
		],
		default: 'create',
	},
];

const writeOps = ['create', 'upsert'];

export const contactFields: INodeProperties[] = [
	{
		...clientLocator,
		displayOptions: { show: { resource: ['contact'] } },
	},

	// Get / Update: which contact
	{
		...contactLocator,
		displayOptions: { show: { resource: ['contact'], operation: ['get', 'update'] } },
	},

	// Create / Create or Update
	{
		displayName: 'At least a name, an email or a phone is required',
		name: 'identityNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { resource: ['contact'], operation: writeOps } },
	},
	...contactDataFields(true)
		.slice(0, 3)
		.map((field) => ({
			...field,
			displayOptions: { show: { resource: ['contact'], operation: writeOps } },
		})),
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['contact'], operation: writeOps } },
		options: contactDataFields(false),
	},

	// Update
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['contact'], operation: ['update'] } },
		description: 'Only the fields you add are changed. An empty value clears that field.',
		options: contactDataFields(true),
	},

	// Get Many
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		displayOptions: { show: { resource: ['contact'], operation: ['getAll'] } },
		default: false,
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		displayOptions: { show: { resource: ['contact'], operation: ['getAll'], returnAll: [false] } },
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['contact'], operation: ['getAll'] } },
		options: [
			{
				displayName: 'Created After',
				name: 'from',
				type: 'dateTime',
				default: '',
			},
			{
				displayName: 'Created Before',
				name: 'to',
				type: 'dateTime',
				default: '',
			},
			{
				displayName: 'Origin Names or IDs',
				name: 'channels',
				type: 'multiOptions',
				typeOptions: {
					loadOptionsMethod: 'getChannels',
					loadOptionsDependsOn: ['clientId.value'],
				},
				default: [],
				description:
					'Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Search',
				name: 'q',
				type: 'string',
				default: '',
				description: 'Search in name, email and phone',
			},
			{
				displayName: 'Stage Names or IDs',
				name: 'stages',
				type: 'multiOptions',
				typeOptions: {
					loadOptionsMethod: 'getStagesWithNone',
					loadOptionsDependsOn: ['clientId.value'],
				},
				default: [],
				description:
					'Only contacts in these stages. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
		],
	},
];
