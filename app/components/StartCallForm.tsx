interface StartCallFormProps {
  roomName: string;
  error: string;
  onRoomNameChange: (name: string) => void;
  onStartCall: () => void;
}

export default function StartCallForm({ 
  roomName, 
  error, 
  onRoomNameChange, 
  onStartCall 
}: StartCallFormProps) {
  return (
    <div className="bg-zinc-900 rounded-2xl p-8 max-w-md mx-auto">
      <div className="space-y-6">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="roomId" className="block text-sm font-medium text-zinc-400 mb-2">
            Room Identifier
          </label>
          <input
            id="roomId"
            type="text"
            value={roomName}
            onChange={(e) => {
              // Filter characters: only a-z, 0-9, hyphen and underscore
              const filtered = e.target.value.toLowerCase().replace(/[^a-z0-9_\-]/g, '');
              onRoomNameChange(filtered);
            }}
            placeholder="Leave empty for random ID"
            pattern="[a-z0-9_\-]*"
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            maxLength={50}
          />
          <p className="mt-1 text-xs text-zinc-500">
            If room exists - join, if not - create new
          </p>
        </div>

        <button
          onClick={onStartCall}
          className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          Start Call
        </button>
      </div>
    </div>
  );
}
