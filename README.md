# Google Docs MCP Server (Next.js)

A remote Model Context Protocol (MCP) server that provides Google Docs integration for Claude Desktop, built with Next.js and deployed on Vercel.

## Features

- **Remote MCP Server**: Deployed on Vercel with SSE transport
- **Google OAuth**: Secure authentication with Google Docs and Drive permissions
- **Web Dashboard**: User-friendly interface for managing API keys
- **Multi-user**: Support for multiple users with isolated access
- **API Key Management**: Secure token-based authentication for MCP clients

## Architecture

```
User Browser → Next.js App → Google OAuth → Database (User/Tokens)
Claude Desktop → MCP SSE Transport → API Key Auth → Google APIs
```

## Setup

### 1. Google Cloud Console Setup

1. Create a new project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Google Docs API and Google Drive API
3. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `https://your-app.vercel.app/api/auth/callback/google`
4. Copy Client ID and Client Secret

### 2. Database Setup

Create a PostgreSQL database (recommended: [Neon](https://neon.tech/) or [Supabase](https://supabase.com/))

### 3. Redis Setup

Create a Redis instance (required for Vercel MCP adapter). Recommended: [Upstash](https://upstash.com/)

### 4. Deploy to Vercel

1. Fork this repository
2. Import to Vercel
3. Add environment variables:
   ```
   NEXTAUTH_SECRET=your-random-secret
   NEXTAUTH_URL=https://your-app.vercel.app
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   DATABASE_URL=your-postgresql-url
   REDIS_URL=your-redis-url
   ```
4. Deploy

### 5. Initialize Database

After deployment, run database migrations:

```bash
pnpm db:push
```

## Usage

### Simple Setup (OAuth-on-Demand)

1. **Add MCP server to Claude Desktop** (no setup required):

```bash
claude mcp add --transport sse google-docs https://your-app.vercel.app/sse
```

Or manually add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "google-docs": {
      "command": "claude",
      "args": ["mcp", "connect", "sse", "https://your-app.vercel.app/sse"]
    }
  }
}
```

2. **First-time authorization**:
   - In Claude Desktop, run: "Use the authorize_google tool"
   - Claude will provide an authorization link
   - Click the link → browser opens → sign in with Google
   - After authorization, all Google Docs tools work automatically

3. **Available Tools**:
   - `authorize_google` - Authorize Google Docs access (run this first)
   - `read_document` - Read content from Google Docs
   - `create_document` - Create new Google Docs
   - `update_document` - Update document content with batch operations
   - `append_text` - Append text to documents
   - `list_documents` - List your Google Docs

### Alternative: API Key Setup (Advanced)

For programmatic access or multiple clients:

1. **Web Setup**:
   - Visit your deployed app: `https://your-app.vercel.app`
   - Sign in with Google
   - Create an API key

2. **Claude Desktop Setup**:
```bash
claude mcp add --transport sse google-docs \\
  https://your-app.vercel.app/sse \\
  --header "X-API-Key: your-api-key"
```

## Development

### Local Setup

1. Clone the repository
2. Install dependencies: `pnpm install`
3. Copy `.env.example` to `.env` and fill in values
4. Run database migrations: `pnpm db:push`
5. Start development server: `pnpm dev`

### Commands

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm db:generate` - Generate database migrations
- `pnpm db:push` - Push schema to database
- `pnpm db:studio` - Open Drizzle Studio

## Security

- API keys are hashed before storage
- Google refresh tokens are encrypted in database
- User isolation prevents cross-user access
- HTTPS enforced for OAuth callbacks

## Troubleshooting

### Common Issues

1. **OAuth Error**: Check redirect URI matches exactly
2. **Database Connection**: Verify DATABASE_URL format
3. **API Key Invalid**: Ensure X-API-Key header is set correctly
4. **Redis Connection**: Verify REDIS_URL for SSE transport

### Logs

Check Vercel function logs for detailed error information.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes
4. Test locally
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
