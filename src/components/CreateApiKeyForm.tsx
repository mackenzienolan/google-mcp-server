'use client';

import { useState } from 'react';

interface CreateApiKeyFormProps {
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

export function CreateApiKeyForm({ onSubmit, onCancel }: CreateApiKeyFormProps) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim());
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 mb-6">
      <h4 className="font-medium text-gray-900 mb-3">Create New API Key</h4>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="keyName" className="block text-sm font-medium text-gray-700 mb-1">
            Key Name
          </label>
          <input
            type="text"
            id="keyName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Claude Desktop"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
          >
            Create Key
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}