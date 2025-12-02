import React from 'react';
import { ScriptNode, NodeType, GlobalLists, getNodeLabel } from '../types';
import { X, Plus, Trash } from 'lucide-react';
import { EditableSelect } from './EditableSelect';

interface InspectorProps {
  node: ScriptNode | null;
  allNodes: ScriptNode[];
  onUpdate: (node: ScriptNode) => void;
  onClose: () => void;
  lists: GlobalLists;
}

export const Inspector: React.FC<InspectorProps> = ({ node, allNodes, onUpdate, onClose, lists }) => {
  if (!node) {
    return (
      <div className="w-96 bg-white border-l border-slate-200 p-8 flex flex-col items-center justify-center text-slate-400 text-sm">
        <p>Select a node to edit details</p>
      </div>
    );
  }

  const handleAddChoice = () => {
    if (node.type !== NodeType.CHOICE) return;
    const newChoice = {
        id: Math.random().toString(36).substr(2, 9),
        label: 'New Choice',
        targetNodeId: null
    };
    onUpdate({
        ...node,
        choices: [...node.choices, newChoice]
    });
  };

  const handleUpdateChoice = (choiceId: string, field: 'label' | 'targetNodeId', value: string) => {
    if (node.type !== NodeType.CHOICE) return;
    const updatedChoices = node.choices.map(c => 
        c.id === choiceId ? { ...c, [field]: value } : c
    );
    onUpdate({ ...node, choices: updatedChoices });
  };

  const handleDeleteChoice = (choiceId: string) => {
      if(node.type !== NodeType.CHOICE) return;
      onUpdate({
          ...node,
          choices: node.choices.filter(c => c.id !== choiceId)
      });
  }

  return (
    <div className="w-96 bg-white border-l border-slate-200 flex flex-col shadow-xl z-10">
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 shrink-0 bg-slate-50">
        <span className="font-bold text-slate-800 text-lg">Inspector</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">ID</label>
            <input disabled value={node.id} className="w-full bg-slate-100 border border-slate-200 rounded px-3 py-2 text-xs font-mono text-slate-500 cursor-not-allowed" />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Node Type</label>
            <select 
                value={node.type}
                onChange={(e) => onUpdate({...node, type: e.target.value as NodeType})}
                className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-base text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
                {Object.values(NodeType).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Character Name</label>
            <EditableSelect
                value={node.character}
                onChange={(val) => onUpdate({...node, character: val})}
                options={lists.knownCharacters}
                placeholder="e.g. Hero"
                className="w-full"
            />
          </div>

          {/* New Asset Fields */}
          <div className="p-4 bg-slate-50 rounded border border-slate-200 space-y-4">
              <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Visual Assets</h4>
              <div>
                <label className="block text-[10px] uppercase text-slate-500 mb-1">Scene / Background</label>
                <EditableSelect
                    value={node.scene || ''}
                    onChange={(val) => onUpdate({...node, scene: val})}
                    options={lists.knownScenes}
                    placeholder="bg_garden"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-[10px] uppercase text-slate-500 mb-1">Art / Sprite</label>
                    <EditableSelect
                        value={node.characterArt || ''}
                        onChange={(val) => onUpdate({...node, characterArt: val})}
                        options={lists.knownArts}
                        placeholder="ch_01"
                    />
                </div>
                <div>
                    <label className="block text-[10px] uppercase text-slate-500 mb-1">Expression</label>
                    <EditableSelect
                        value={node.expression || ''}
                        onChange={(val) => onUpdate({...node, expression: val})}
                        options={lists.knownExpressions}
                        placeholder="smile"
                    />
                </div>
              </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold uppercase text-slate-400">
                    {node.type === NodeType.MONOLOGUE ? 'Internal Thought' : 'Dialogue / Text'}
                </label>
            </div>
            <textarea 
                value={node.text}
                onChange={(e) => onUpdate({...node, text: e.target.value})}
                className={`w-full bg-white border border-slate-300 rounded px-3 py-2 text-base text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[120px] ${node.type === NodeType.MONOLOGUE ? 'italic' : ''}`}
                placeholder={node.type === NodeType.MONOLOGUE ? "Thoughts..." : "What happens?"}
            />
          </div>
        </div>

        {/* Logic Section */}
        <div className="pt-4 border-t border-slate-200">
            <h3 className="text-xs font-bold uppercase text-slate-400 mb-4">Flow Control</h3>

            {node.type === NodeType.CHOICE ? (
                <div className="space-y-3">
                    {node.choices.map((choice, idx) => (
                        <div key={choice.id} className="bg-slate-50 p-3 rounded border border-slate-200 relative group">
                            <button 
                                onClick={() => handleDeleteChoice(choice.id)}
                                className="absolute top-2 right-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash size={14} />
                            </button>
                            
                            <label className="text-[10px] text-slate-500 block mb-1">Label {idx + 1}</label>
                            <input 
                                value={choice.label}
                                onChange={(e) => handleUpdateChoice(choice.id, 'label', e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-sm mb-3 focus:border-purple-500 focus:outline-none"
                            />
                            
                            <label className="text-[10px] text-slate-500 block mb-1">Target Node</label>
                            <select 
                                value={choice.targetNodeId || ''}
                                onChange={(e) => handleUpdateChoice(choice.id, 'targetNodeId', e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs text-slate-700"
                            >
                                <option value="">Select Target...</option>
                                {allNodes.filter(n => n.id !== node.id).map(n => (
                                    <option key={n.id} value={n.id}>{getNodeLabel(n)}</option>
                                ))}
                            </select>
                        </div>
                    ))}
                    <button 
                        onClick={handleAddChoice}
                        className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 rounded text-sm text-slate-500 flex items-center justify-center gap-2 border border-dashed border-slate-300"
                    >
                        <Plus size={14} /> Add Choice
                    </button>
                </div>
            ) : node.type !== NodeType.END ? (
                <div>
                     <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Next Node</label>
                     <select 
                        value={node.nextId || ''}
                        onChange={(e) => onUpdate({...node, nextId: e.target.value})}
                        className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                     >
                        <option value="">None (Stop)</option>
                        {allNodes.filter(n => n.id !== node.id).map(n => (
                            <option key={n.id} value={n.id}>{getNodeLabel(n)}</option>
                        ))}
                     </select>
                </div>
            ) : (
                <p className="text-sm text-slate-400 italic">This node ends the script execution.</p>
            )}
        </div>

      </div>
    </div>
  );
};