'use client';

import { useState, useRef, useEffect } from 'react';

interface Option {
  id: number;
  name: string;
}

interface MultiSelectProps {
  options: Option[];
  value: number[];
  onChange: (selectedIds: number[]) => void;
  placeholder?: string;
}

export default function MultiSelect({ options, value, onChange, placeholder = 'Select items...' }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOptions = options.filter(opt => value.includes(opt.id));
  const filteredOptions = options.filter(opt =>
    opt.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (id: number) => {
    if (value.includes(id)) {
      onChange(value.filter(v => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const handleRemove = (id: number, e: React.MouseEvent<SVGSVGElement>) => {
    e.stopPropagation();
    onChange(value.filter(v => v !== id));
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      {/* Selected Items Display */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex flex-wrap gap-2 items-center px-3 py-2 border border-gray-300 rounded-lg bg-white cursor-pointer hover:border-gray-400 focus-within:ring-2 focus-within:ring-blue-500"
      >
        {selectedOptions.length === 0 ? (
          <span className="text-gray-500 text-sm">{placeholder}</span>
        ) : (
          selectedOptions.map(option => (
            <span
              key={option.id}
              className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2"
            >
              {option.name}
              <svg
                onClick={(e: React.MouseEvent<SVGSVGElement>) => handleRemove(option.id, e)}
                className="w-4 h-4 cursor-pointer hover:text-blue-900"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          ))
        )}
        <svg
          className={`ml-auto w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200">
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Options List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">No items found</div>
            ) : (
              filteredOptions.map(option => (
                <label
                  key={option.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-blue-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={value.includes(option.id)}
                    onChange={() => handleSelect(option.id)}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <span className="text-sm">{option.name}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
