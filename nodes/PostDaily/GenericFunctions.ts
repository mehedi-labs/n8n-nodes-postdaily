import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

/** Sent as the User-Agent so PostDaily can count calls from this node. Keep in step with package.json. */
export const NODE_VERSION = '0.2.0';

type PostDailyContext = IExecuteFunctions | ILoadOptionsFunctions;

type Route = {
	method: IHttpRequestMethods;
	/** Path under the base URL; `{postId}` or `{mediaId}` is filled from the arguments. */
	path: string;
	/** Send the arguments as query parameters rather than a JSON body. */
	query?: boolean;
};

/** PostDaily REST API v1 (https://api.postdaily.app/v1), one route per operation. */
const ROUTES: Record<string, Route> = {
	list_workspaces: { method: 'GET', path: '/workspaces', query: true },
	list_channels: { method: 'GET', path: '/channels', query: true },
	list_posts: { method: 'GET', path: '/posts', query: true },
	get_post: { method: 'GET', path: '/posts/{postId}' },
	create_post: { method: 'POST', path: '/posts' },
	update_post: { method: 'PATCH', path: '/posts/{postId}' },
	delete_post: { method: 'DELETE', path: '/posts/{postId}' },
	retry_post: { method: 'POST', path: '/posts/{postId}/retry' },
	import_media: { method: 'POST', path: '/media/imports' },
	create_media_upload: { method: 'POST', path: '/media/uploads' },
	complete_media_upload: { method: 'POST', path: '/media/uploads/{mediaId}/complete' },
};

type ErrorBody = { error?: { code?: string; message?: string; hint?: string | null } };

/** Query values as PostDaily reads them: lists comma-separated, everything else as text. */
function toQuery(args: IDataObject): IDataObject {
	return Object.fromEntries(
		Object.entries(args).map(([name, value]) => [
			name,
			Array.isArray(value) ? value.join(',') : String(value),
		]),
	);
}

/**
 * Calls one PostDaily REST endpoint, named by the operation, and returns its
 * JSON. A refusal (bad input, plan limit, an access level that does not
 * allow it, a channel that needs reconnecting...) becomes a NodeApiError
 * carrying PostDaily's own message and hint.
 */
export async function callPostDaily(
	this: PostDailyContext,
	operation: string,
	args: IDataObject,
	itemIndex = 0,
): Promise<IDataObject> {
	const route = ROUTES[operation];

	if (!route) {
		throw new NodeApiError(
			this.getNode(),
			{ message: `Unknown operation ${operation}` },
			{ itemIndex },
		);
	}

	const rest: IDataObject = { ...args };
	const missing = [...route.path.matchAll(/\{(\w+)\}/g)]
		.map((match) => match[1] ?? '')
		.find((name) => String(rest[name] ?? '').trim() === '');

	if (missing) {
		throw new NodeOperationError(
			this.getNode(),
			`${missing === 'postId' ? 'Post ID' : 'Media ID'} is required`,
			{
				itemIndex,
				description:
					'It is empty for this item. Check the expression, or the step that should have produced it.',
			},
		);
	}

	const credentials = await this.getCredentials('postDailyApi');
	const path = route.path.replace(/\{(\w+)\}/g, (_match, name: string) => {
		const value = encodeURIComponent(String(rest[name] ?? ''));
		delete rest[name];
		return value;
	});
	const options: IHttpRequestOptions = {
		method: route.method,
		url: `${String(credentials.baseUrl).replace(/\/+$/, '')}${path}`,
		headers: { 'User-Agent': `n8n-nodes-postdaily/${NODE_VERSION}` },
		json: true,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
	};

	if (route.query) {
		options.qs = toQuery(rest);
	} else if (route.method !== 'GET' && route.method !== 'DELETE') {
		options.body = rest;
	}

	let response: { statusCode: number; body: unknown };

	try {
		response = await this.helpers.httpRequestWithAuthentication.call(this, 'postDailyApi', options);
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
	}

	if (response.statusCode >= 400) {
		const failure = (response.body as ErrorBody | undefined)?.error;
		const message = failure?.message ?? `PostDaily answered HTTP ${response.statusCode}`;

		throw new NodeApiError(this.getNode(), (response.body ?? {}) as JsonObject, {
			itemIndex,
			httpCode: String(response.statusCode),
			message: failure?.code ? `${failure.code}: ${message}` : message,
			description: failure?.hint ?? undefined,
		});
	}

	return (response.body ?? {}) as IDataObject;
}

/** Splits "a, b ,c" into ["a", "b", "c"]. */
export function splitList(value: unknown): string[] {
	return String(value ?? '')
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);
}

/** FNV-1a over a string, as 16 hex characters (two 32-bit halves). Not for security: only to tell requests apart. */
function fingerprint(text: string): string {
	let a = 0x811c9dc5;
	let b = 0x01000193 ^ text.length;

	for (let index = 0; index < text.length; index++) {
		const code = text.charCodeAt(index);
		a = Math.imul(a ^ code, 0x01000193) >>> 0;
		b = Math.imul(b ^ code, 0x5bd1e995) >>> 0;
	}

	return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

/**
 * The idempotency key used when the user sets none. It is built from the
 * execution, the node and what is being sent, so:
 * - a retried step (same content) gets the same key and creates nothing new;
 * - each round of a Loop Over Items, where the item index is always 0 but the
 *   content differs, gets its own key.
 */
export function defaultIdempotencyKey(
	executionId: string,
	nodeId: string,
	args: IDataObject,
): string {
	return `n8n-${executionId}-${nodeId}-${fingerprint(JSON.stringify(args))}`.slice(0, 200);
}
