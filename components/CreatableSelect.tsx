'use client';

import { useState, useRef, useEffect } from 'react';

interface CreatableSelectProps {
  options: { id: number; name: string }[];
  value: string;
  onChange: (value: string, isNew: boolean) => void;
  placeholder?: string;
}

export default function CreatableSelect({
  options,
  value,
  onChange,
  placeholder = 'Search, select or type new...',
}: CreatableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter((option) =>
    option.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedOption = options.find((opt) => opt.id.toString() === value);
  const isNewEntry = searchTerm.trim() && !filteredOptions.find(opt => opt.name.toLowerCase() === searchTerm.toLowerCase());

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectExisting = (optionId: number, optionName: string) => {
    onChange(optionId.toString(), false);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleCreateNew = () => {
    if (searchTerm.trim()) {
      onChange(searchTerm.trim(), true);
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-left bg-white hover:bg-gray-50 flex justify-between items-center"
      >
        <span className={selectedOption ? 'text-gray-900' : 'text-gray-500'}>
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
          <input
            type="text"
            placeholder="Search or type new name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border-b border-gray-200 focus:outline-none rounded-t-lg"
            autoFocus
          />
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 && !isNewEntry && (
              <div className="px-4 py-2 text-gray-500 text-sm">
                No results found
              </div>
            )}
            
            {/* Existing options */}
            {filteredOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => handleSelectExisting(option.id, option.name)}
                className={`w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                  value === option.id.toString()
                    ? 'bg-blue-100 text-blue-900 font-semibold'
                    : 'text-gray-900'
                }`}
              >
                {option.name}
              </button>
            ))}
            
            {/* Create new option */}
            {isNewEntry && (
              <button
                type="button"
                onClick={handleCreateNew}
                className="w-full text-left px-4 py-2 bg-green-50 text-green-700 hover:bg-green-100 transition-colors font-medium"
              >
                + Create new: "{searchTerm}"
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
