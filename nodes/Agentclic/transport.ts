import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, sleep } from 'n8n-workflow';

type Context = IExecuteFunctions | ILoadOptionsFunctions;

const DEFAULT_BASE_URL = 'https://agentclic.com/api/public/pro/v1';
const MAX_RETRY_WAIT_SECONDS = 60;

/** Error returned by the Agentclic API: { error: { code, message, details } }. */
export class AgentclicApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string,
		readonly details: IDataObject = {},
	) {
		super(message);
		this.name = 'AgentclicApiError';
	}
}

const FRIENDLY_MESSAGES: Record<string, string> = {
	UNAUTHORIZED: 'The API token is missing or not valid. Check the Agentclic credential.',
	TOKEN_REVOKED: 'This API token has been revoked. Create a new one in Agentclic › Ajustes › API.',
	TOKEN_EXPIRED: 'This API token has expired. Create a new one in Agentclic › Ajustes › API.',
	PLAN_REQUIRED: 'The Agentclic API is included in the Unlimited agents plan.',
	NO_CREDITS:
		'The Agentclic account has no credits left. Top up in Agentclic › Ajustes › Créditos e IA.',
	PAYMENT_REQUIRED: 'The Agentclic account has a pending payment.',
	FORBIDDEN_SCOPE:
		'The API token does not have the required permission (Contactos · leer, or Contactos · leer y escribir).',
	RATE_LIMITED: 'Too many calls per minute with this token. Try again in a moment.',
	CONTACT_EXISTS: 'A contact with that email or phone already exists in this CRM.',
};

async function baseUrl(this: Context): Promise<string> {
	const credentials = await this.getCredentials('agentclicApi');
	const url = (credentials.baseUrl as string | undefined)?.trim() || DEFAULT_BASE_URL;
	return url.replace(/\/+$/, '');
}

function parseError(status: number, body: unknown): AgentclicApiError {
	const error = (body as { error?: IDataObject } | undefined)?.error;
	if (error && typeof error === 'object') {
		return new AgentclicApiError(
			status,
			String(error.code ?? 'ERROR'),
			String(error.message ?? `Request failed with status ${status}`),
			(error.details as IDataObject) ?? {},
		);
	}
	return new AgentclicApiError(status, 'ERROR', `Request failed with status ${status}`);
}

/**
 * Calls the Agentclic API and returns either the data or the API error.
 * A 429 is retried once after Retry-After (max 60 s).
 */
export async function tryAgentclicApiRequest(
	this: Context,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	qs?: IDataObject,
): Promise<
	{ data: IDataObject; error?: undefined } | { data?: undefined; error: AgentclicApiError }
> {
	const options: IHttpRequestOptions = {
		method,
		url: `${await baseUrl.call(this)}${path}`,
		json: true,
		ignoreHttpStatusErrors: true,
		returnFullResponse: true,
	};
	if (body !== undefined) options.body = body;
	if (qs !== undefined && Object.keys(qs).length > 0) options.qs = qs;

	for (let attempt = 0; ; attempt++) {
		const response = (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'agentclicApi',
			options,
		)) as { statusCode: number; headers: IDataObject; body: unknown };

		if (response.statusCode < 400) return { data: (response.body ?? {}) as IDataObject };

		if (response.statusCode === 429 && attempt === 0) {
			const retryAfter = Number(response.headers?.['retry-after']);
			const seconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 5;
			await sleep(Math.min(seconds, MAX_RETRY_WAIT_SECONDS) * 1000);
			continue;
		}

		return { error: parseError(response.statusCode, response.body) };
	}
}

/** Calls the Agentclic API. Throws AgentclicApiError on 4xx/5xx. */
export async function agentclicApiRequest(
	this: Context,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	qs?: IDataObject,
): Promise<IDataObject> {
	const result = await tryAgentclicApiRequest.call(this, method, path, body, qs);
	if (result.error) throw result.error;
	return result.data;
}

/** Converts an AgentclicApiError into the error n8n shows in the UI. */
export function toNodeApiError(
	this: IExecuteFunctions,
	error: AgentclicApiError,
	itemIndex: number,
): NodeApiError {
	return new NodeApiError(
		this.getNode(),
		{ code: error.code, message: error.message, details: error.details } as JsonObject,
		{
			itemIndex,
			httpCode: String(error.status),
			message: FRIENDLY_MESSAGES[error.code] ?? error.message,
			description: `${error.code}: ${error.message}`,
		},
	);
}
