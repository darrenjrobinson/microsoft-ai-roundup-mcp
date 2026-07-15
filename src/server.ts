import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { initDb } from './db/client.js';
import { searchSchema, handleSearchMicrosoftAIRoundup } from './tools/search.js';
import { getIssueSchema, handleGetIssue } from './tools/get-issue.js';
import { listIssuesSchema, handleListIssues } from './tools/list-issues.js';
import { findToolMentionsSchema, handleFindToolMentions } from './tools/find-tool-mentions.js';

const TOOLS: Tool[] = [
  {
    name: 'search_microsoft_ai_roundup',
    description:
      "Search the full Microsoft AI Roundup (msai.ms) archive using natural language or keywords. " +
      'Returns sourced excerpts from past issues with issue number, date, and URL. ' +
      'Supports hybrid semantic + keyword search (semantic requires OPENAI_API_KEY). ' +
      "Covers all issues of Merill's weekly Microsoft AI roundup from May 2026 to present.",
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language question or keywords to search for',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10, max: 50)',
          default: 10,
        },
        mode: {
          type: 'string',
          enum: ['hybrid', 'semantic', 'keyword'],
          description: 'Search mode: hybrid (default), semantic-only, or keyword-only',
          default: 'hybrid',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_issue',
    description:
      'Retrieve the full content of a specific Microsoft AI Roundup issue by issue number or publication date. ' +
      'Returns the complete text of the newsletter with section headings preserved.',
    inputSchema: {
      type: 'object',
      properties: {
        issue_number: {
          type: 'number',
          description: 'Issue number (e.g. 4)',
        },
        date: {
          type: 'string',
          description:
            'Date in YYYY-MM-DD or YYYY-MM format to find the nearest issue (e.g. "2026-05" or "2026-05-18")',
        },
      },
    },
  },
  {
    name: 'list_issues',
    description:
      'Browse the Microsoft AI Roundup (msai.ms) archive with optional year/month filtering. ' +
      'Returns a list of issues with title, date, and URL. ' +
      'Use this to discover what issues exist before using get_issue or search_microsoft_ai_roundup.',
    inputSchema: {
      type: 'object',
      properties: {
        year: {
          type: 'number',
          description: 'Filter by year (e.g. 2026)',
        },
        month: {
          type: 'number',
          description: 'Filter by month number 1–12 (e.g. 5 for May). Requires year.',
        },
        limit: {
          type: 'number',
          description: 'Maximum issues to return (default: 50)',
          default: 50,
        },
        offset: {
          type: 'number',
          description: 'Pagination offset (default: 0)',
          default: 0,
        },
      },
    },
  },
  {
    name: 'find_tool_mentions',
    description:
      'Find community tools, GitHub projects, and Microsoft AI products/features mentioned in the Microsoft AI Roundup. ' +
      'Returns tool names, descriptions, GitHub URLs, and the issue context where they appeared. ' +
      'Optionally filter by keyword to find tools related to a specific technology or capability.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Optional filter — search by tool name, technology, or description keyword (e.g. "Copilot", "Azure AI Foundry", "agents")',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of tool mentions to return (default: 20)',
          default: 20,
        },
      },
    },
  },
];

// Resolve the package version from package.json so it is defined in one place.
// Compiled layout: dist/src/server.js → ../../package.json; ts-node dev: src/server.ts → ../package.json
function getPackageVersion(): string {
  for (const p of ['../package.json', '../../package.json']) {
    try {
      return require(p).version;
    } catch {
      // try next path
    }
  }
  return '0.0.0';
}

export async function createServer(): Promise<{ server: Server; transport: StdioServerTransport }> {
  // Initialise the database (download if needed)
  await initDb();

  const server = new Server(
    {
      name: 'microsoft-ai-roundup-mcp',
      version: getPackageVersion(),
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let text: string;

      switch (name) {
        case 'search_microsoft_ai_roundup': {
          const parsed = searchSchema.parse(args ?? {});
          text = await handleSearchMicrosoftAIRoundup(parsed);
          break;
        }
        case 'get_issue': {
          const parsed = getIssueSchema.parse(args ?? {});
          text = handleGetIssue(parsed);
          break;
        }
        case 'list_issues': {
          const parsed = listIssuesSchema.parse(args ?? {});
          text = handleListIssues(parsed);
          break;
        }
        case 'find_tool_mentions': {
          const parsed = findToolMentionsSchema.parse(args ?? {});
          text = handleFindToolMentions(parsed);
          break;
        }
        default:
          return {
            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }

      return {
        content: [{ type: 'text', text }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  return { server, transport };
}
