import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useDebounce } from '../../hooks/useDebounce';
import { useEffect, useState } from 'react';
import { cn } from '../../utils/cn';

interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  debounceMs?: number;
  className?: string;
  initialValue?: string;
}

export function SearchBar({
  placeholder = 'Search...',
  onSearch,
  debounceMs = 300,
  className,
  initialValue = '',
}: SearchBarProps) {
  const [query, setQuery] = useState(initialValue);
  const debouncedQuery = useDebounce(query, debounceMs);

  useEffect(() => {
    onSearch(debouncedQuery);
  }, [debouncedQuery, onSearch]);

  return (
    <div className={cn('relative', className)}>
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        <MagnifyingGlassIcon
          className="h-5 w-5 text-gray-400"
          aria-hidden="true"
        />
      </div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="block w-full rounded-md border-0 py-2 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-panw-blue sm:text-sm sm:leading-6"
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </div>
  );
}
