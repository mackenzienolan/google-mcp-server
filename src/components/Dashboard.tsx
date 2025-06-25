'use client';

import { useState, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { ApiKeyCard } from './ApiKeyCard';
import { CreateApiKeyForm } from './CreateApiKeyForm';

interface ApiKey {
  id: string;
  name: string;
  active: boolean;
  lastUsed: Date | null;
  createdAt: Date;
}

interface User {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface DashboardProps {
  user: User;
}

export function Dashboard({ user }: DashboardProps) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      const response = await fetch('/api/keys');
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data);
      }
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateApiKey = async (name: string) => {
    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (response.ok) {
        const newKey = await response.json();
        setApiKeys([...apiKeys, newKey]);
        setShowCreateForm(false);
        
        // Show the API key to the user once
        alert(`Your new API key:\n\n${newKey.key}\n\nPlease save this key securely. You won't be able to see it again.`);
      }
    } catch (error) {
      console.error('Failed to create API key:', error);
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return;

    try {
      const response = await fetch(`/api/keys/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setApiKeys(apiKeys.filter(key => key.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete API key:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* User Info */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {user.image && (
              <img
                src={user.image}
                alt={user.name || 'User'}
                className="w-12 h-12 rounded-full"
              />
            )}
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {user.name}
              </h2>
              <p className="text-gray-600">{user.email}</p>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          Setup Instructions
        </h3>
        <ol className="list-decimal list-inside space-y-2 text-blue-800">
          <li>Create an API key below</li>
          <li>Add the MCP server to Claude Desktop:</li>
        </ol>
        <pre className="mt-3 p-3 bg-blue-100 rounded text-sm overflow-x-auto">
{`claude mcp add --transport sse google-docs \\
  https://your-app.vercel.app/sse \\
  --header "X-API-Key: your-api-key-here"`}
        </pre>
      </div>

      {/* API Keys Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">
            API Keys
          </h3>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Create New Key
          </button>
        </div>

        {showCreateForm && (
          <CreateApiKeyForm
            onSubmit={handleCreateApiKey}
            onCancel={() => setShowCreateForm(false)}
          />
        )}

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading API keys...</p>
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600">No API keys created yet.</p>
            <p className="text-sm text-gray-500 mt-1">
              Create your first API key to connect to Claude Desktop.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {apiKeys.map(key => (
              <ApiKeyCard
                key={key.id}
                apiKey={key}
                onDelete={handleDeleteApiKey}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}