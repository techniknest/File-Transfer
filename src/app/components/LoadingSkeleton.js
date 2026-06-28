'use client';

export default function LoadingSkeleton({ type = 'card', count = 1 }) {
  const items = Array.from({ length: count });

  if (type === 'table') {
    return (
      <div className="w-full space-y-4 animate-pulse">
        <div className="h-10 bg-gray-800 rounded-lg w-full"></div>
        {items.map((_, idx) => (
          <div key={idx} className="h-12 bg-gray-900/60 rounded-lg w-full flex items-center px-4 space-x-4">
            <div className="h-4 bg-gray-800 rounded w-1/4"></div>
            <div className="h-4 bg-gray-800 rounded w-1/4"></div>
            <div className="h-4 bg-gray-800 rounded w-1/6"></div>
            <div className="h-4 bg-gray-800 rounded w-1/6 ml-auto"></div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className="space-y-3">
        {items.map((_, idx) => (
          <div key={idx} className="animate-pulse bg-gray-900/60 border border-gray-800/80 rounded-xl p-4 flex items-center space-x-4">
            <div className="w-10 h-10 bg-gray-800 rounded-lg"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-800 rounded w-1/3"></div>
              <div className="h-3 bg-gray-800 rounded w-1/4"></div>
            </div>
            <div className="h-8 bg-gray-800 rounded w-16"></div>
          </div>
        ))}
      </div>
    );
  }

  // Default: card style
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map((_, idx) => (
        <div key={idx} className="animate-pulse bg-gray-900/60 border border-gray-800/80 rounded-2xl p-6 space-y-4">
          <div className="w-12 h-12 bg-gray-800 rounded-xl"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-800 rounded w-1/2"></div>
            <div className="h-3 bg-gray-800 rounded w-3/4"></div>
          </div>
          <div className="h-4 bg-gray-800 rounded w-1/4 pt-2"></div>
        </div>
      ))}
    </div>
  );
}
