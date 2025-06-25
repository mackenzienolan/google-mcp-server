interface ApiKey {
  id: string;
  name: string;
  active: boolean;
  lastUsed: Date | null;
  createdAt: Date;
}

interface ApiKeyCardProps {
  apiKey: ApiKey;
  onDelete: (id: string) => void;
}

export function ApiKeyCard({ apiKey, onDelete }: ApiKeyCardProps) {
  const formatDate = (date: Date | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-gray-900">{apiKey.name}</h4>
            <span
              className={`px-2 py-1 text-xs rounded-full ${
                apiKey.active
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {apiKey.active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="mt-1 text-sm text-gray-600">
            <p>Created: {formatDate(apiKey.createdAt)}</p>
            <p>Last used: {formatDate(apiKey.lastUsed)}</p>
          </div>
        </div>
        <button
          onClick={() => onDelete(apiKey.id)}
          className="text-red-600 hover:text-red-800 text-sm font-medium"
        >
          Delete
        </button>
      </div>
    </div>
  );
}