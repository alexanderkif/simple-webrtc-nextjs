interface WaitingRoomProps {
  shareLink: string;
  onCopyLink: () => void;
  onCancel: () => void;
}

export default function WaitingRoom({ shareLink, onCopyLink, onCancel }: WaitingRoomProps) {
  return (
    <div className="bg-zinc-900 rounded-2xl p-8 max-w-md mx-auto text-center">
      <div className="space-y-6">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
        <div>
          <p className="text-white text-lg font-medium mb-2">
            Ожидание подключения...
          </p>
          <p className="text-zinc-400 text-sm mb-4">
            Поделитесь этой ссылкой со вторым пользователем:
          </p>
          <div className="p-4 bg-zinc-800 rounded-lg break-all">
            <code className="text-green-400 text-sm font-mono">{shareLink}</code>
          </div>
        </div>
        <button
          onClick={onCopyLink}
          className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
        >
          Скопировать ссылку
        </button>
        <button
          onClick={onCancel}
          className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
        >
          Отменить
        </button>
      </div>
    </div>
  );
}
