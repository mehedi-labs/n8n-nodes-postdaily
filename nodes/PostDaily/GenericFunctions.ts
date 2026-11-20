import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

/** Sent as the User-Agent so PostDaily can count calls from this node. Keep in step with package.json. */
export const NODE_VERSION = '0.1.0';

const MCP_PROTOCOL_VERSION = '2025-11-25';

type PostDailyContext = IExecuteFunctions | ILoadOptionsFunctions;

type ToolResult = {
	content?: Array<{ type: string; text?: string }>;
	isError?: boolean;
	structuredContent?: IDataObject;
};

type RpcReply = {
	error?: { code: number; message: string };
	result?: ToolResult;
};

/**
 * PostDaily answers a tool call as one Server-Sent Events frame
 * (`event: message` then `data: {...}`), or as plain JSON. Either way this
 * returns the JSON-RPC reply.
 */
function readReply(body: unknown): RpcReply {
	if (typeof body === 'object' && body !== null) {
		return body as RpcReply;
	}

	const text = String(body ?? '');
	const dataLine = text
		.split('\n')
		.filter((line) => line.startsWith('data:'))
		.pop();

	return JSON.parse(dataLine ? dataLine.slice(5) : text) as RpcReply;
}

/** The JSON PostDaily put after the human-readable summary, when there is no structuredContent. */
function dataFromText(result: ToolResult): IDataObject {
	const text = result.content?.find((part) => part.type === 'text')?.text ?? '';
	const start = text.indexOf('{');

	if (start === -1) {
		return { summary: text };
	}

	try {
		return JSON.parse(text.slice(start)) as IDataObject;
	} catch {
		return { summary: text };
	}
}

/**
 * PostDaily lists only the tools a key's access level allows, so a call to
 * any other tool comes back as "Tool <name> not found". Say what that means.
 */
function accessLevelMessage(text: string): { message: string; description: string } | null {
	const match = text.match(/Tool (\w+) not found/);

	if (!match) {
		return null;
	}

	return {
		message: `This API key's access level does not allow ${match[1]}`,
		description:
			'Drafts only keys can create and edit drafts; Read only keys can only read. Scheduling, publishing, deleting and retrying need a Full access key, created in PostDaily under Settings → AI agents → API key.',
	};
}

/**
 * Calls one PostDaily tool over the API-key MCP endpoint and returns its
 * result. A refusal (bad input, plan limit, a channel that needs
 * reconnecting...) becomes a NodeApiError carrying PostDaily's own message.
 */
export async function callPostDaily(
	this: PostDailyContext,
	tool: string,
	args: IDataObject,
	itemIndex = 0,
): Promise<IDataObject> {
	const credentials = await this.getCredentials('postDailyApi');
	const options: IHttpRequestOptions = {
		method: 'POST',
		url: credentials.serverUrl as string,
		headers: {
			Accept: 'application/json, text/event-stream',
			'Content-Type': 'application/json',
			'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
			'User-Agent': `n8n-nodes-postdaily/${NODE_VERSION}`,
		},
		body: JSON.stringify({
			jsonrpc: '2.0',
			id: `${tool}-${itemIndex}`,
			method: 'tools/call',
			params: { name: tool, arguments: args },
		}),
		json: false,
	};

	let reply: RpcReply;

	try {
		reply = readReply(
			await this.helpers.httpRequestWithAuthentication.call(this, 'postDailyApi', options),
		);
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
	}

	if (reply.error) {
		const access = accessLevelMessage(reply.error.message);

		throw new NodeApiError(this.getNode(), reply.error as unknown as JsonObject, {
			itemIndex,
			message: access?.message ?? reply.error.message,
			description: access?.description,
		});
	}

	const result = reply.result ?? {};

	if (result.isError) {
		const text = result.content?.find((part) => part.type === 'text')?.text ?? 'PostDaily refused the request.';
		const [first, ...rest] = text.split('\n');
		const access = accessLevelMessage(text);

		throw new NodeApiError(this.getNode(), { message: text } as JsonObject, {
			itemIndex,
			message: access?.message ?? first,
			description: access?.description ?? (rest.join('\n').trim() || undefined),
		});
	}

	return result.structuredContent ?? dataFromText(result);
}

/** Splits "a, b ,c" into ["a", "b", "c"]. */
export function splitList(value: unknown): string[] {
	return String(value ?? '')
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);
}
