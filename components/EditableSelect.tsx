import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface EditableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  italic?: boolean;
}

export const EditableSelect: React.FC<EditableSelectProps> = ({ 
  value, 
  onChange, 
  options, 
  placeholder, 
  className = "",
  italic = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter options based on input, but always show all if input is focused and empty-ish
  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(value.toLowerCase()) && opt !== value
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option: string) => {
    onChange(option);
    setIsOpen(false);
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      <div className="relative flex items-center group">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={`w-full bg-white/50 border border-slate-300 rounded px-3 py-2 text-sm text-slate-700 
            focus:border-indigo-500 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500
            placeholder-slate-400 pr-8 transition-colors ${italic ? 'italic text-slate-500' : ''}`}
        />
        <div 
            className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-slate-600"
        >
            <ChevronDown size={14} />
        </div>
      </div>

      {isOpen && (filteredOptions.length > 0 || options.length > 0) && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-56 overflow-y-auto text-sm py-1">
          {/* If there are specific matches, show them first */}
          {filteredOptions.length > 0 ? (
             filteredOptions.map((option, idx) => (
                <li
                  key={`${option}-${idx}`}
                  onClick={() => handleSelect(option)}
                  className="px-3 py-2 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer text-slate-700 truncate"
                >
                  {option}
                </li>
             ))
          ) : (
            /* Fallback: If no input or no matches, show all */
            options.map((option, idx) => (
                <li
                  key={`${option}-${idx}-all`}
                  onClick={() => handleSelect(option)}
                  className={`px-3 py-2 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer text-slate-700 truncate ${option === value ? 'bg-slate-50 font-medium' : ''}`}
                >
                  {option}
                </li>
             ))
          )}
          {options.length === 0 && (
             <li className="px-3 py-2 text-slate-400 italic">No existing options</li>
          )}
        </ul>
      )}
    </div>
  );
};