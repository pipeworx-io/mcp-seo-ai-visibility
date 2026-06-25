interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * SEO AI-Visibility MCP — does brand X appear in an LLM's answer (GEO / AI-SEO)
 * via DataForSEO AI Optimization API (dataforseo.com).
 *
 * Tools:
 * - seo_llm_answer: run a prompt through an LLM and return its answer + any cited
 *   sources, so you can check whether a brand/domain shows up in AI answers.
 *
 * Distinct from the gateway meta-tool `ai_visibility_check` — this queries the LLM
 * directly via DataForSEO. Auth: DataForSEO HTTP Basic, _apiKey = base64("login:password").
 * Wave 1 = BYO-key only. Wave 2 adds a measured `cost` CostModel + realCogs flag.
 */


const BASE_URL = 'https://api.dataforseo.com';

const tools: McpToolExport['tools'] = [
  {
    name: 'seo_llm_answer',
    description:
      "Does `<brand>` appear in ChatGPT's answer for `<question>` — runs a prompt through an LLM and returns its answer plus any cited sources/links, for AI-visibility (GEO) analysis: see what an LLM says about a brand, topic, or query and which sources it cites. Example: seo_llm_answer({ user_prompt: \"What are the best running shoe brands?\", model_name: \"gpt-4o\", _apiKey: \"your-base64-key\" })",
    inputSchema: {
      type: 'object' as const,
      properties: {
        user_prompt: {
          type: 'string',
          description: 'The prompt/question to ask the LLM, e.g. "What are the best running shoe brands?"',
        },
        model_name: {
          type: 'string',
          description: 'LLM model to query (default "gpt-4o")',
        },
        _apiKey: {
          type: 'string',
          description: 'DataForSEO API key = base64("login:password") from your dataforseo.com account',
        },
      },
      required: ['user_prompt', '_apiKey'],
    },
  },
];

async function dfsPost(path: string, body: unknown, apiKey: string, tool: string) {
  if (!apiKey) {
    throw new Error(
      `${tool} requires a DataForSEO API key. Pass _apiKey = base64("login:password") from your DataForSEO account (sign up at dataforseo.com). This is a paid data source — bring your own key, or add credits at https://pipeworx.io/account.`,
    );
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `DataForSEO auth failed (HTTP ${res.status}). Check _apiKey is base64("login:password") and your account is funded/verified (data endpoints return 40104 until the account is funded). Re-encode credentials and retry.`,
    );
  }
  if (!res.ok) throw new Error(`DataForSEO ${tool} error: HTTP ${res.status}`);
  const data = (await res.json()) as DfsResponse;
  if (data.status_code !== 20000) {
    throw new Error(`DataForSEO ${tool}: ${data.status_code} ${data.status_message}`);
  }
  const task = data.tasks?.[0];
  if (!task || task.status_code !== 20000) {
    throw new Error(`DataForSEO ${tool}: ${task?.status_code ?? 'no task'} ${task?.status_message ?? ''}`.trim());
  }
  return task;
}

interface DfsResponse {
  status_code: number;
  status_message: string;
  tasks?: Array<{
    status_code: number;
    status_message: string;
    cost: number;
    result?: Array<Record<string, unknown>> | null;
  }>;
}

// The llm_responses payload nests answer text in items[].sections[].text and
// cited links in annotations/links. The exact shape isn't fully documented, so
// walk defensively: collect every string `text` and every url-ish field, and
// return the raw result as a fallback so nothing is dropped.
function collectText(node: unknown, out: string[]): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const n of node) collectText(n, out);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (typeof obj.text === 'string' && obj.text.trim()) out.push(obj.text);
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object') collectText(v, out);
  }
}

function collectUrls(node: unknown, out: Set<string>): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const n of node) collectUrls(n, out);
    return;
  }
  const obj = node as Record<string, unknown>;
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && /^https?:\/\//.test(v) && (k === 'url' || k === 'link')) out.add(v);
    else if (v && typeof v === 'object') collectUrls(v, out);
  }
}

async function llmAnswer(args: Record<string, unknown>, apiKey: string) {
  const user_prompt = args.user_prompt as string;
  if (!user_prompt) {
    throw new Error('seo_llm_answer requires a `user_prompt` (the question to ask the LLM).');
  }
  const model_name = (args.model_name as string) ?? 'gpt-4o';

  const task = await dfsPost(
    '/v3/ai_optimization/chat_gpt/llm_responses/live',
    [{ user_prompt, model_name }],
    apiKey,
    'seo_llm_answer',
  );

  const result = (task.result?.[0] ?? {}) as Record<string, unknown>;
  const textParts: string[] = [];
  const urls = new Set<string>();
  collectText(result.items ?? result, textParts);
  collectUrls(result.items ?? result, urls);

  return {
    prompt: user_prompt,
    model: model_name,
    answer: textParts.join('\n\n').trim() || null,
    sources: [...urls],
    raw: result,
  };
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const apiKey = args._apiKey as string;
  delete args._apiKey;

  switch (name) {
    case 'seo_llm_answer':
      return llmAnswer(args, apiKey);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Wave 1 (BYO-only): nominal access meter; user's own key bears DataForSEO COGS.
// Wave 2: replace with measured `cost` CostModel (~flat per prompt) + realCogs gate.
export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
