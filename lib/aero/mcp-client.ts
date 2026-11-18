/**
 * Client-side integration helper for connecting BirdBrains (and sibling Aero apps)
 * to the Aero OAuth 2.1 + MCP + BYOK Gateway.
 *
 * All OAuth access tokens remain strictly on the gateway server; the browser only
 * holds an HttpOnly `aero_session` cookie and never sees raw MCP tokens.
 */

const DEFAULT_GATEWAY_URL =
  process.env.NEXT_PUBLIC_AERO_GATEWAY_URL ?? 'http://localhost:3000';

export interface ConnectMcpServerParams {
  resourceUri: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  redirectUri?: string;
  gatewayUrl?: string;
}

/**
 * Returns the Aero Gateway OAuth 2.1 + PKCE S256 + RFC 8707 authorization URL
 * to redirect the user's browser to when binding an external MCP server.
 */
export function buildAeroMcpConnectUrl(params: ConnectMcpServerParams): string {
  const base = params.gatewayUrl ?? DEFAULT_GATEWAY_URL;
  const url = new URL('/api/oauth/authorize', base);
  url.searchParams.set('app', 'BIRDBRAINS');
  url.searchParams.set('resource', params.resourceUri);
  url.searchParams.set('authorization_endpoint', params.authorizationEndpoint);
  url.searchParams.set('token_endpoint', params.tokenEndpoint);
  if (params.redirectUri) {
    url.searchParams.set('redirect_uri', params.redirectUri);
  }
  return url.toString();
}

/**
 * Executes a tool on a bound MCP server via the Aero Gateway's Just-in-Time
 * server-side token retrieval endpoint.
 */
export async function executeAeroMcpTool(params: {
  resourceUri: string;
  toolName: string;
  arguments?: Record<string, unknown>;
  gatewayUrl?: string;
}): Promise<unknown> {
  const base = params.gatewayUrl ?? DEFAULT_GATEWAY_URL;
  const res = await fetch(`${base}/api/mcp/execute`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resourceUri: params.resourceUri,
      toolName: params.toolName,
      arguments: params.arguments ?? {},
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `MCP tool execution failed (${res.status})`);
  }

  return res.json();
}

/**
 * Revokes and removes a bound MCP server OAuth token on the Aero Gateway.
 */
export async function revokeAeroMcpResource(
  resourceUri: string,
  gatewayUrl = DEFAULT_GATEWAY_URL
): Promise<void> {
  const res = await fetch(`${gatewayUrl}/api/oauth/revoke`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource: resourceUri }),
  });

  if (!res.ok) {
    throw new Error(`Failed to revoke MCP resource (${res.status})`);
  }
}

/**
 * Sends a prompt through the Aero BYOK AI Gateway (`/api/ai/chat`),
 * enforcing the user's server-side BYOK tier and Zero Data Retention routing.
 */
export async function streamAeroByokChat(params: {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  gatewayUrl?: string;
}): Promise<Response> {
  const base = params.gatewayUrl ?? DEFAULT_GATEWAY_URL;
  const res = await fetch(`${base}/api/ai/chat`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.message ?? err.error ?? `BYOK chat failed (${res.status})`);
  }

  return res;
}
