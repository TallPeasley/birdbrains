'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  KeyRound,
  Link2,
  Lock,
  Play,
  ShieldCheck,
  Unplug,
} from 'lucide-react';
import {
  bindAeroMcpApiKey,
  buildAeroMcpConnectUrl,
  executeAeroMcpTool,
  listAeroMcpResources,
  revokeAeroMcpResource,
  streamAeroByokChat,
} from '@/lib/aero/mcp-client';

export default function AeroMcpPanel() {
  const [resourceUri, setResourceUri] = useState('http://127.0.0.1:27123/mcp');
  const [authEndpoint, setAuthEndpoint] = useState('http://127.0.0.1:27123/oauth/authorize');
  const [tokenEndpoint, setTokenEndpoint] = useState('http://127.0.0.1:27123/oauth/token');
  const [apiKey, setApiKey] = useState('');

  const [toolName, setToolName] = useState('chirp_complete_job');
  const [toolArgs, setToolArgs] = useState(
    '{"jobId":"job-auto-1","title":"Follow up on tutoring lead","source":"ANTIGRAVITY"}'
  );
  const [useFirstParty, setUseFirstParty] = useState(true);

  const [model, setModel] = useState('anthropic/claude-sonnet-4-20250514');
  const [prompt, setPrompt] = useState('Summarize the latest study notes.');

  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function handleConnect() {
    window.location.href = buildAeroMcpConnectUrl({
      resourceUri,
      authorizationEndpoint: authEndpoint,
      tokenEndpoint,
    });
  }

  async function handleBindKey() {
    if (!apiKey.trim()) {
      setStatusMsg('Enter a Bearer API key first.');
      return;
    }
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await bindAeroMcpApiKey({ resourceUri, apiKey: apiKey.trim() });
      setApiKey('');
      setStatusMsg(`Encrypted key bound to ${res.resource}.`);
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Failed to bind API key.');
    } finally {
      setBusy(false);
    }
  }

  async function handleListAll() {
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await listAeroMcpResources();
      setOutput(JSON.stringify(res, null, 2));
      setStatusMsg(`Loaded ${res.length} external MCP bindings.`);
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Failed to list resources.');
    } finally {
      setBusy(false);
    }
  }

  async function handleExecuteTool() {
    setBusy(true);
    setStatusMsg(null);
    setOutput(null);
    try {
      const parsedArgs = JSON.parse(toolArgs) as Record<string, unknown>;
      const result = await executeAeroMcpTool({
        resourceUri: useFirstParty ? 'aero://first-party' : resourceUri,
        toolName,
        arguments: parsedArgs,
      });
      setOutput(JSON.stringify(result, null, 2));
      setStatusMsg('Tool executed server-side.');
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'MCP execution failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke() {
    setBusy(true);
    setStatusMsg(null);
    try {
      await revokeAeroMcpResource(resourceUri);
      setStatusMsg(`Revoked OAuth token binding for ${resourceUri}.`);
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Revocation failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleByokChat() {
    setBusy(true);
    setStatusMsg(null);
    setOutput(null);
    try {
      const res = await streamAeroByokChat({
        model,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = await res.text();
      setOutput(text);
      setStatusMsg('BYOK gateway response received.');
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'BYOK chat failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full space-y-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Aero MCP, Auto Jobs &amp; BYOK Integrations
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            First-party Aero tools run via session; external MCP servers (Obsidian, TickTick)
            bind via OAuth 2.1 + PKCE or encrypted local Bearer keys.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={handleListAll}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          List Bound MCP Servers
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-medium">
            <Link2 className="h-4 w-4 text-indigo-600" />
            <h2>1. Connect External MCP (OAuth 2.1 / API Key)</h2>
          </div>

          <label className="block text-xs font-medium text-slate-700">
            Canonical MCP Resource URI
            <input
              type="url"
              value={resourceUri}
              onChange={(e) => setResourceUri(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Local Bearer API Key (Obsidian / TickTick)
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste plugin API key"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-700">
              Auth Endpoint
              <input
                type="url"
                value={authEndpoint}
                onChange={(e) => setAuthEndpoint(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              Token Endpoint
              <input
                type="url"
                value={tokenEndpoint}
                onChange={(e) => setTokenEndpoint(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleBindKey}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <Lock className="h-3.5 w-3.5" />
              Save Encrypted Key
            </button>
            <button
              type="button"
              onClick={handleConnect}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              OAuth 2.1 + PKCE
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleRevoke}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Unplug className="h-3.5 w-3.5" />
              Revoke
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-medium">
            <Play className="h-4 w-4 text-indigo-600" />
            <h2>2. First-Party &amp; JIT Tool Execution</h2>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={useFirstParty}
              onChange={(e) => setUseFirstParty(e.target.checked)}
            />
            First-Party Aero Tool (no OAuth required)
          </label>

          <label className="block text-xs font-medium text-slate-700">
            Tool Name
            <input
              type="text"
              value={toolName}
              onChange={(e) => setToolName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            JSON Arguments
            <textarea
              rows={3}
              value={toolArgs}
              onChange={(e) => setToolArgs(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
            />
          </label>

          <button
            type="button"
            disabled={busy}
            onClick={handleExecuteTool}
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Run Tool Server-Side
          </button>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-medium">
            <KeyRound className="h-4 w-4 text-indigo-600" />
            <h2>3. BYOK AI Gateway Test</h2>
          </div>

          <label className="block text-xs font-medium text-slate-700">
            Model ID
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="anthropic/claude-sonnet-4-20250514">
                anthropic/claude-sonnet-4-20250514 (ZDR Certified)
              </option>
              <option value="openai/gpt-4o">openai/gpt-4o (ZDR Certified)</option>
              <option value="google/gemini-2.5-pro">
                google/gemini-2.5-pro (ZDR Certified)
              </option>
              <option value="openai/gpt-4o-mini">
                openai/gpt-4o-mini (Standard Only)
              </option>
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Prompt
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <button
            type="button"
            disabled={busy}
            onClick={handleByokChat}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Send via BYOK Gateway
          </button>
        </section>
      </div>

      {statusMsg ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
          {statusMsg}
        </div>
      ) : null}

      {output ? (
        <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
          {output}
        </pre>
      ) : null}
    </div>
  );
}
