import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeListSearchResult,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { accountOperations } from './descriptions/AccountDescription';
import { clientFields, clientOperations } from './descriptions/ClientDescription';
import { contactFields, contactOperations } from './descriptions/ContactDescription';
import {
	AgentclicApiError,
	agentclicApiRequest,
	toNodeApiError,
	tryAgentclicApiRequest,
} from './transport';

const PAGE_SIZE = 100;

type CustomFieldsParam = { field?: Array<{ fieldId: string; value: string }> };

/**
 * Builds the contact body for the API.
 * - create: empty values are left out.
 * - update: every field the user added is sent; empty clears it (stage → null).
 */
function buildContactBody(fields: IDataObject, mode: 'create' | 'update'): IDataObject {
	const body: IDataObject = {};
	for (const key of ['name', 'email', 'phone', 'company', 'notes']) {
		if (!(key in fields)) continue;
		const value = String(fields[key] ?? '').trim();
		if (mode === 'update' || value !== '') body[key] = value;
	}
	if ('stageId' in fields) {
		const stage = String(fields.stageId ?? '').trim();
		if (stage !== '') body.stageId = stage;
		else if (mode === 'update') body.stageId = null;
	}
	const custom = (fields.customFields as CustomFieldsParam | undefined)?.field ?? [];
	if (custom.length > 0) {
		const map: IDataObject = {};
		for (const { fieldId, value } of custom) {
			if (!fieldId) continue;
			map[fieldId] = value === '' ? null : value;
		}
		if (Object.keys(map).length > 0) body.customFields = map;
	}
	return body;
}

function currentClientId(this: ILoadOptionsFunctions): string {
	const clientId = this.getCurrentNodeParameter('clientId', { extractValue: true }) as
		| string
		| undefined;
	return (clientId ?? '').trim();
}

async function crmOptions(this: ILoadOptionsFunctions): Promise<IDataObject> {
	const clientId = currentClientId.call(this);
	if (!clientId) return {};
	return await agentclicApiRequest.call(
		this,
		'GET',
		`/clients/${encodeURIComponent(clientId)}/contacts/options`,
	);
}

export class Agentclic implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Agentclic',
		name: 'agentclic',
		icon: { light: 'file:agentclic.svg', dark: 'file:agentclic.dark.svg' },
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Manage the clients and CRM contacts of your Agentclic account',
		defaults: { name: 'Agentclic' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'agentclicApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Account', value: 'account' },
					{ name: 'Client', value: 'client' },
					{ name: 'Contact', value: 'contact' },
				],
				default: 'contact',
			},
			...accountOperations,
			...clientOperations,
			...clientFields,
			...contactOperations,
			...contactFields,
		],
	};

	methods = {
		listSearch: {
			async searchClients(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				const response = await agentclicApiRequest.call(this, 'GET', '/clients');
				const term = (filter ?? '').toLowerCase();
				const results = ((response.items as IDataObject[]) ?? [])
					.map((client) => {
						const name = String(client.name ?? '');
						const company = client.company ? ` (${String(client.company)})` : '';
						return { name: `${name}${company}`, value: String(client.id) };
					})
					.filter((option) => !term || option.name.toLowerCase().includes(term));
				return { results };
			},

			async searchContacts(
				this: ILoadOptionsFunctions,
				filter?: string,
				paginationToken?: string,
			): Promise<INodeListSearchResult> {
				const clientId = currentClientId.call(this);
				if (!clientId) return { results: [] };
				const qs: IDataObject = { limit: 50 };
				if (filter) qs.q = filter;
				if (paginationToken) qs.cursor = paginationToken;
				const response = await agentclicApiRequest.call(
					this,
					'GET',
					`/clients/${encodeURIComponent(clientId)}/contacts`,
					undefined,
					qs,
				);
				const results = ((response.items as IDataObject[]) ?? []).map((contact) => {
					const label =
						String(contact.name ?? '') ||
						String(contact.email ?? '') ||
						String(contact.phone ?? '') ||
						String(contact.id);
					const extra = contact.name && contact.email ? ` · ${String(contact.email)}` : '';
					return { name: `${label}${extra}`, value: String(contact.id) };
				});
				return {
					results,
					paginationToken: (response.nextCursor as string | null) ?? undefined,
				};
			},
		},

		loadOptions: {
			async getStages(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const options = await crmOptions.call(this);
				return ((options.stages as IDataObject[]) ?? []).map((stage) => ({
					name: String(stage.name),
					value: String(stage.id),
				}));
			},

			async getStagesWithNone(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const options = await crmOptions.call(this);
				const stages = ((options.stages as IDataObject[]) ?? []).map((stage) => ({
					name: String(stage.name),
					value: String(stage.id),
				}));
				return [{ name: 'No Stage', value: 'none' }, ...stages];
			},

			async getCustomFields(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const options = await crmOptions.call(this);
				return ((options.fields as IDataObject[]) ?? []).map((field) => ({
					name: String(field.name),
					value: String(field.id),
					description: field.type ? `Type: ${String(field.type)}` : undefined,
				}));
			},

			async getChannels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const options = await crmOptions.call(this);
				return ((options.channels as string[]) ?? []).map((channel) => ({
					name: channel,
					value: channel,
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
				for (const json of results) returnData.push({ json, pairedItem: { item: i } });
			} catch (error) {
				if (this.continueOnFail()) {
					const message =
						error instanceof AgentclicApiError
							? `${error.code}: ${error.message}`
							: (error as Error).message;
					const json: IDataObject = { error: message };
					if (error instanceof AgentclicApiError) {
						json.code = error.code;
						json.status = error.status;
						if (Object.keys(error.details).length > 0) json.details = error.details;
					}
					returnData.push({ json, pairedItem: { item: i } });
					continue;
				}
				if (error instanceof AgentclicApiError) throw toNodeApiError.call(this, error, i);
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
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
	if (resource === 'account' && operation === 'get') {
		return [await agentclicApiRequest.call(this, 'GET', '/me')];
	}

	if (resource === 'client' && operation === 'getAll') {
		const response = await agentclicApiRequest.call(this, 'GET', '/clients');
		const clients = (response.items as IDataObject[]) ?? [];
		const returnAll = this.getNodeParameter('returnAll', i) as boolean;
		return returnAll ? clients : clients.slice(0, this.getNodeParameter('limit', i) as number);
	}

	if (resource === 'contact') {
		const clientId = String(
			this.getNodeParameter('clientId', i, '', { extractValue: true }) ?? '',
		).trim();
		if (!clientId) {
			throw new NodeOperationError(this.getNode(), 'Choose a client', { itemIndex: i });
		}
		const base = `/clients/${encodeURIComponent(clientId)}/contacts`;

		const contactPath = () => {
			const contactId = String(
				this.getNodeParameter('contactId', i, '', { extractValue: true }) ?? '',
			).trim();
			if (!contactId) {
				throw new NodeOperationError(this.getNode(), 'Choose a contact', { itemIndex: i });
			}
			return `${base}/${encodeURIComponent(contactId)}`;
		};

		const writeBody = () => {
			const fields: IDataObject = {
				name: this.getNodeParameter('name', i, '') as string,
				email: this.getNodeParameter('email', i, '') as string,
				phone: this.getNodeParameter('phone', i, '') as string,
				...(this.getNodeParameter('additionalFields', i, {}) as IDataObject),
			};
			const body = buildContactBody(fields, 'create');
			if (!body.name && !body.email && !body.phone) {
				throw new NodeOperationError(this.getNode(), 'Set at least a name, an email or a phone', {
					itemIndex: i,
				});
			}
			return body;
		};

		const unwrap = (response: IDataObject) => (response.contact as IDataObject) ?? response;

		switch (operation) {
			case 'create':
				return [unwrap(await agentclicApiRequest.call(this, 'POST', base, writeBody()))];

			case 'upsert': {
				const body = writeBody();
				const created = await tryAgentclicApiRequest.call(this, 'POST', base, body);
				if (!created.error) return [unwrap(created.data)];
				const existingId =
					created.error.code === 'CONTACT_EXISTS'
						? (created.error.details.contactId as string | undefined)
						: undefined;
				if (!existingId) throw created.error;
				const updated = await agentclicApiRequest.call(
					this,
					'PATCH',
					`${base}/${encodeURIComponent(existingId)}`,
					body,
				);
				return [unwrap(updated)];
			}

			case 'get':
				return [unwrap(await agentclicApiRequest.call(this, 'GET', contactPath()))];

			case 'update': {
				const path = contactPath();
				const body = buildContactBody(
					this.getNodeParameter('updateFields', i, {}) as IDataObject,
					'update',
				);
				if (Object.keys(body).length === 0) {
					throw new NodeOperationError(this.getNode(), 'Add at least one field to update', {
						itemIndex: i,
					});
				}
				return [unwrap(await agentclicApiRequest.call(this, 'PATCH', path, body))];
			}

			case 'getAll': {
				const returnAll = this.getNodeParameter('returnAll', i) as boolean;
				const limit = returnAll ? Infinity : (this.getNodeParameter('limit', i) as number);
				const filters = this.getNodeParameter('filters', i, {}) as IDataObject;
				const qs: IDataObject = {};
				if (filters.q) qs.q = filters.q;
				if (Array.isArray(filters.stages) && filters.stages.length > 0) {
					qs.stages = filters.stages.join(',');
				}
				if (Array.isArray(filters.channels) && filters.channels.length > 0) {
					qs.channels = filters.channels.join(',');
				}
				if (filters.from) qs.from = new Date(filters.from as string).toISOString();
				if (filters.to) qs.to = new Date(filters.to as string).toISOString();

				const contacts: IDataObject[] = [];
				let cursor: string | null = null;
				do {
					const pageQs: IDataObject = {
						...qs,
						limit: Math.min(PAGE_SIZE, limit - contacts.length),
					};
					if (cursor) pageQs.cursor = cursor;
					const response = await agentclicApiRequest.call(this, 'GET', base, undefined, pageQs);
					contacts.push(...((response.items as IDataObject[]) ?? []));
					cursor = (response.nextCursor as string | null) ?? null;
				} while (cursor && contacts.length < limit);
				return contacts.slice(0, limit);
			}
		}
	}

	throw new NodeOperationError(
		this.getNode(),
		`The operation "${operation}" is not supported for "${resource}"`,
		{ itemIndex: i },
	);
}
