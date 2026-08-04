# mcp-seo-ai-visibility

SEO AI-Visibility MCP — does brand X appear in an LLM's answer (GEO / AI-SEO)

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `seo_llm_answer` | Does `<brand>` appear in ChatGPT's answer for `<question>` — runs a prompt through an LLM and returns its answer plus any cited sources/links, for AI-visibility (GEO) analysis: see what an LLM says about a brand, topic, or query and which sources it cites. Example: seo_llm_answer({ user_prompt: "What are the best running shoe brands?", model_name: "gpt-4o", _apiKey: "your-base64-key" }) |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "seo-ai-visibility": {
      "url": "https://gateway.pipeworx.io/seo-ai-visibility/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Seo Ai Visibility data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
