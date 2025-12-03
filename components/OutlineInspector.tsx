import React from 'react';
import { OutlineNode, OutlineNodeType, OutlineColor } from '../types';
import { X, Trash2, Diamond, Flag, Square, Palette } from 'lucide-react';

interface OutlineInspectorProps {
  node: OutlineNode | null;
  onUpdate: (node: OutlineNode) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const OutlineInspector: React.FC<OutlineInspectorProps> = ({ node, onUpdate, onDelete, onClose }) => {
  if (!node) {
    return (
      <div className="w-80 bg-white border-l border-slate-200 p-8 flex flex-col items-center justify-center text-slate-400 text-sm z-10 shadow-xl">
        <p>Select a card to edit details</p>
      </div>
    );
  }

  const colors: { value: OutlineColor; label: string; bg: string; border: string }[] = [
    { value: 'white', label: 'White', bg: 'bg-white', border: 'border-slate-300' },
    { value: 'blue', label: 'Blue', bg: 'bg-blue-50', border: 'border-blue-300' },
    { value: 'green', label: 'Green', bg: 'bg-green-50', border: 'border-green-300' },
    { value: 'yellow', label: 'Yellow', bg: 'bg-amber-50', border: 'border-amber-300' },
    { value: 'red', label: 'Red', bg: 'bg-red-50', border: 'border-red-300' },
  ];

  return (
    <div className="w-96 bg-white border-l border-slate-200 flex flex-col shadow-xl z-10">
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 shrink-0 bg-slate-50">
        <span className="font-bold text-slate-800 text-lg">Card Details</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* Title */}
        <div>
           <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Title</label>
           <input 
              value={node.title}
              onChange={(e) => onUpdate({...node, title: e.target.value})}
              className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-base font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
              placeholder="Card Title"
           />
        </div>

        {/* Type Selector */}
        <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Card Type</label>
            <div className="flex bg-slate-100 p-1 rounded-lg">
                <button 
                    onClick={() => onUpdate({...node, type: 'DEFAULT'})}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${node.type === 'DEFAULT' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Square size={16} /> Default
                </button>
                <button 
                    onClick={() => onUpdate({...node, type: 'CHOICE'})}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${node.type === 'CHOICE' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Diamond size={16} /> Choice
                </button>
                <button 
                    onClick={() => onUpdate({...node, type: 'END'})}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${node.type === 'END' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Flag size={16} /> End
                </button>
            </div>
        </div>

        {/* Color Selector */}
        <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Color Label</label>
            <div className="flex gap-2">
                {colors.map(c => (
                    <button
                        key={c.value}
                        onClick={() => onUpdate({...node, color: c.value})}
                        className={`w-8 h-8 rounded-full border-2 ${c.bg} ${c.border} ${node.color === c.value ? 'ring-2 ring-offset-2 ring-indigo-500' : 'hover:scale-110'} transition-all`}
                        title={c.label}
                    />
                ))}
            </div>
        </div>

        {/* Content */}
        <div>
           <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Description / Content</label>
           <textarea 
              value={node.content}
              onChange={(e) => onUpdate({...node, content: e.target.value})}
              className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none min-h-[150px] resize-none"
              placeholder="Enter plot details, ideas, or dialogue sketches..."
           />
        </div>

        {/* Dimensions */}
        <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Width</label>
                <input 
                    type="number"
                    value={node.width}
                    onChange={(e) => onUpdate({...node, width: Math.max(100, parseInt(e.target.value) || 200)})}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-sm"
                />
             </div>
             <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Height</label>
                <input 
                    type="number"
                    value={node.height}
                    onChange={(e) => onUpdate({...node, height: Math.max(60, parseInt(e.target.value) || 120)})}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-sm"
                />
             </div>
        </div>

        <div className="pt-6 mt-6 border-t border-slate-200">
            <button 
                onClick={() => onDelete(node.id)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-medium transition-colors"
            >
                <Trash2 size={18} />
                Delete Card
            </button>
        </div>

      </div>
    </div>
  );
};