import { auth } from '@/lib/auth';
import { SignInButton } from '@/components/SignInButton';
import { Dashboard } from '@/components/Dashboard';

export default async function Home() {
  const session = await auth();

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Google Docs MCP Server
          </h1>
          <p className="text-lg text-gray-600">
            Connect your Google Docs to Claude Desktop via Model Context Protocol
          </p>
        </header>

        {session ? (
          <Dashboard user={session.user} />
        ) : (
          <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                Get Started
              </h2>
              <p className="text-gray-600">
                Sign in with Google to authorize access to your Google Docs
              </p>
            </div>
            <SignInButton />
          </div>
        )}
      </div>
    </main>
  );
}
