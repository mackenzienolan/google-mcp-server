import { createVercelMcpServer } from '@vercel/mcp-adapter';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { SessionManager } from '@/lib/redis-session-manager';
import { googleDocsClient } from '@/lib/google-docs';

// Get base URL from environment or request
function getBaseUrl(request?: Request): string {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (request) {
    const url = new URL(request.url);
    return `${url.protocol}//${url.host}`;
  }
  return process.env.NEXTAUTH_URL || 'http://localhost:3000';
}

const tools: Tool[] = [
  {
    name: 'authorize_google',
    description: 'Authorize Google Docs access - call this first to enable other tools',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'read_document',
    description: 'Read the content of a Google Doc',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'The ID of the Google Doc to read',
        },
      },
      required: ['documentId'],
    },
  },
  {
    name: 'create_document',
    description: 'Create a new Google Doc',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'The title of the new document',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_document',
    description: 'Update content in a Google Doc',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'The ID of the Google Doc to update',
        },
        requests: {
          type: 'array',
          description: 'Array of update requests following Google Docs API format',
          items: {
            type: 'object',
          },
        },
      },
      required: ['documentId', 'requests'],
    },
  },
  {
    name: 'append_text',
    description: 'Append text to the end of a Google Doc',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'The ID of the Google Doc',
        },
        text: {
          type: 'string',
          description: 'Text to append to the document',
        },
      },
      required: ['documentId', 'text'],
    },
  },
  {
    name: 'list_documents',
    description: 'List Google Docs from your Drive',
    inputSchema: {
      type: 'object',
      properties: {
        pageSize: {
          type: 'number',
          description: 'Number of documents to return (max 100)',
          default: 10,
        },
      },
    },
  },
];

// Store session per MCP connection using Redis session store
import { createRedisSessionStore } from '@/lib/redis-session-store';
const sessionStore = createRedisSessionStore();

async function callTool(name: string, args: Record<string, unknown>, context: Record<string, unknown>) {
  // Get or create session for this MCP connection
  const connectionId = context.connectionId || 'default';
  const sessionId = sessionStore ? await sessionStore.getSession(connectionId as string) : null;

  try {
    switch (name) {
      case 'authorize_google': {
        // Create new session for authorization
        const session = await SessionManager.createSession();
        if (sessionStore) {
          await sessionStore.setSession(connectionId as string, session.sessionId);
        }
        
        const baseUrl = getBaseUrl(context.request);
        const authUrl = SessionManager.generateAuthUrl(session.sessionId, baseUrl);
        
        return `Please authorize Google Docs access by visiting this URL:\n\n${authUrl}\n\nAfter authorization, you can use the other Google Docs tools.`;
      }

      case 'read_document':
      case 'create_document':
      case 'update_document':
      case 'append_text':
      case 'list_documents': {
        // Check if session is authorized
        if (!sessionId) {
          return 'Please run the "authorize_google" tool first to authorize Google Docs access.';
        }

        const { authorized, userId } = await SessionManager.isSessionAuthorized(sessionId);
        if (!authorized) {
          // Check if session exists but not authorized yet
          const session = await SessionManager.getSession(sessionId);
          if (session?.status === 'pending') {
            const baseUrl = getBaseUrl(context.request);
            const authUrl = SessionManager.generateAuthUrl(sessionId, baseUrl);
            return `Authorization pending. Please complete authorization at:\n\n${authUrl}`;
          }
          
          // Session expired or invalid, create new one
          const newSession = await SessionManager.createSession();
          mcpSessions.set(connectionId, newSession.sessionId);
          const baseUrl = getBaseUrl(context.request);
          const authUrl = SessionManager.generateAuthUrl(newSession.sessionId, baseUrl);
          return `Session expired. Please authorize again:\n\n${authUrl}`;
        }

        // Execute the tool with authorized user
        return await executeGoogleDocsTool(name, args, userId!);
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    throw new Error(`Tool execution failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function executeGoogleDocsTool(name: string, args: Record<string, unknown>, userId: string): Promise<string> {
  switch (name) {
    case 'read_document': {
      const { documentId } = args as { documentId: string };
      const result = await googleDocsClient.readDocument(userId, documentId);
      return JSON.stringify(result, null, 2);
    }

    case 'create_document': {
      const { title } = args as { title: string };
      const result = await googleDocsClient.createDocument(userId, title);
      return JSON.stringify(result, null, 2);
    }

    case 'update_document': {
      const { documentId, requests } = args as {
        documentId: string;
        requests: unknown[];
      };
      const result = await googleDocsClient.updateDocument(userId, documentId, requests);
      return JSON.stringify(result, null, 2);
    }

    case 'append_text': {
      const { documentId, text } = args as {
        documentId: string;
        text: string;
      };
      const result = await googleDocsClient.appendText(userId, documentId, text);
      return result;
    }

    case 'list_documents': {
      const { pageSize = 10 } = args as { pageSize?: number };
      const result = await googleDocsClient.listDocuments(userId, pageSize);
      return JSON.stringify(result, null, 2);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

const { GET, POST } = createVercelMcpServer({
  name: 'google-docs-mcp',
  version: '1.0.0',
  tools,
  toolHandler: callTool,
});

export { GET, POST };