import { auth, signIn } from '@/lib/auth';
import { SessionManager } from '@/lib/redis-session-manager';

interface PageProps {
  searchParams: { session?: string };
}

export default async function McpAuthPage({ searchParams }: PageProps) {
  const session = await auth();
  const mcpSessionId = searchParams.session;

  if (!mcpSessionId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600">Invalid authorization link. Please try again from Claude Desktop.</p>
        </div>
      </div>
    );
  }

  // Check if session exists and is valid
  const mcpSession = await SessionManager.getSession(mcpSessionId);
  if (!mcpSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Session Expired</h1>
          <p className="text-gray-600">
            This authorization link has expired. Please run the &quot;authorize_google&quot; tool again in Claude Desktop.
          </p>
        </div>
      </div>
    );
  }

  // If user is already signed in, authorize the session
  if (session?.user?.id) {
    if (mcpSession.status === 'pending') {
      await SessionManager.authorizeSession(mcpSessionId, session.user.id);
    }
    
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <div className="text-green-600 text-6xl mb-4">✓</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Authorization Complete!</h1>
          <p className="text-gray-600 mb-6">
            Your Google Docs access has been authorized for Claude Desktop.
          </p>
          <p className="text-sm text-gray-500">
            You can now close this window and use Google Docs tools in Claude Desktop.
          </p>
        </div>
      </div>
    );
  }

  // User needs to sign in first
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Authorize Claude Desktop
          </h1>
          <p className="text-gray-600">
            Sign in with Google to authorize Claude Desktop access to your Google Docs
          </p>
        </div>
        
        <form action={async () => {
          'use server';
          await signIn('google', {
            callbackUrl: `/auth/mcp?session=${mcpSessionId}`,
          });
        }}>
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Authorize with Google
          </button>
        </form>
        
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">What we&apos;ll access:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Read and write your Google Docs</li>
            <li>• List your Google Drive documents</li>
            <li>• Create new documents</li>
          </ul>
        </div>
      </div>
    </div>
  );
}