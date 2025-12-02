
import React, { useState } from 'react';
import { ScriptNode, NodeType, ViewOptions, FilterOptions, GlobalLists, getNodeLabel } from '../types';
import { MessageSquare, GitFork, Flag, PlayCircle, Trash2, Brain, GripVertical } from 'lucide-react';
import { EditableSelect } from './EditableSelect';

interface TableViewProps {
  nodes: ScriptNode[];
  onUpdateNode: (node: ScriptNode) => void;
  onDeleteNode: (id: string) => void;
  onSelectNode: (id: string) => void;
  onReorderNodes: (fromIndex: number, toIndex: number) => void;
  selectedNodeId: string | null;
  viewOptions: ViewOptions;
  filterOptions: FilterOptions;
  lists: GlobalLists;
  zoom: number;
}

export const TableView: React.FC<TableViewProps> = ({ 
  nodes, 
  onUpdateNode, 
  onDeleteNode,
  onSelectNode,
  onReorderNodes,
  selectedNodeId,
  viewOptions,
  filterOptions,
  lists,
  zoom
}) => {
  
  const [draggedNodeIndex, setDraggedNodeIndex] = useState<number | null>(null);

  const getTypeIcon = (type: NodeType) => {
    switch (type) {
      case NodeType.DIALOGUE: return <MessageSquare size={18} className="text-blue-500" />;
      case NodeType.MONOLOGUE: return <Brain size={18} className="text-slate-500" />;
      case NodeType.CHOICE: return <GitFork size={18} className="text-purple-500" />;
      case NodeType.END: return <Flag size={18} className="text-red-500" />;
      case NodeType.START: return <PlayCircle size={18} className="text-green-500" />;
    }
  };

  const getRowColor = (type: NodeType) => {
    if (!viewOptions.enableColorCoding) return '';
    switch (type) {
      case NodeType.DIALOGUE: return 'bg-blue-50/50 hover:bg-blue-100/50';
      case NodeType.MONOLOGUE: return 'bg-slate-100/50 hover:bg-slate-200/50';
      case NodeType.CHOICE: return 'bg-purple-50/50 hover:bg-purple-100/50';
      case NodeType.END: return 'bg-red-50/50 hover:bg-red-100/50';
      case NodeType.START: return 'bg-green-50/50 hover:bg-green-100/50';
      default: return '';
    }
  };

  const filteredNodes = nodes.filter(node => {
      const matchChar = !filterOptions.character || node.character.toLowerCase().includes(filterOptions.character.toLowerCase());
      const matchScene = !filterOptions.scene || (node.scene || '').toLowerCase().includes(filterOptions.scene.toLowerCase());
      const matchArt = !filterOptions.characterArt || (node.characterArt || '').toLowerCase().includes(filterOptions.characterArt.toLowerCase());
      const matchExpr = !filterOptions.expression || (node.expression || '').toLowerCase().includes(filterOptions.expression.toLowerCase());
      return matchChar && matchScene && matchArt && matchExpr;
  });

  // Only allow reordering if no filters are active (otherwise indices are messed up)
  const isReorderEnabled = filteredNodes.length === nodes.length;

  const handleDragStart = (e: React.DragEvent, index: number) => {
      if (!isReorderEnabled) return;
      setDraggedNodeIndex(index);
      e.dataTransfer.effectAllowed = "move";
      // Optional: set custom drag image
  };

  const handleDragOver = (e: React.DragEvent) => {
      if (!isReorderEnabled) return;
      e.preventDefault(); // Necessary to allow dropping
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
      if (!isReorderEnabled || draggedNodeIndex === null) return;
      e.preventDefault();
      onReorderNodes(draggedNodeIndex, dropIndex);
      setDraggedNodeIndex(null);
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50 p-6">
      <div 
        className="inline-block align-middle pb-20 origin-top-left transition-transform"
        style={{ 
            transform: `scale(${zoom})`,
            width: `${100 / zoom}%`
        }}
      >
        <div className="border border-slate-200 rounded-lg shadow-sm bg-white">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="w-10 px-0 py-4"></th>
                <th scope="col" className="px-6 py-4 text-left text-sm font-semibold text-slate-500 uppercase tracking-wider w-28">Type</th>
                {viewOptions.showScene && <th scope="col" className="px-6 py-4 text-left text-sm font-semibold text-slate-500 uppercase tracking-wider w-40">Scene</th>}
                <th scope="col" className="px-6 py-4 text-left text-sm font-semibold text-slate-500 uppercase tracking-wider w-40">Character</th>
                {viewOptions.showArt && <th scope="col" className="px-6 py-4 text-left text-sm font-semibold text-slate-500 uppercase tracking-wider w-40">Art/Sprite</th>}
                {viewOptions.showExpression && <th scope="col" className="px-6 py-4 text-left text-sm font-semibold text-slate-500 uppercase tracking-wider w-40">Expression</th>}
                <th scope="col" className="px-6 py-4 text-left text-sm font-semibold text-slate-500 uppercase tracking-wider">Content / Text</th>
                {viewOptions.showLogic && <th scope="col" className="px-6 py-4 text-left text-sm font-semibold text-slate-500 uppercase tracking-wider w-56">Next Logic</th>}
                <th scope="col" className="px-6 py-4 text-right text-sm font-semibold text-slate-500 uppercase tracking-wider w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredNodes.map((node, index) => (
                <tr 
                  key={node.id} 
                  draggable={isReorderEnabled}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`transition-colors 
                    ${selectedNodeId === node.id ? 'bg-indigo-50 border-l-2 border-indigo-500' : viewOptions.enableColorCoding ? getRowColor(node.type) : 'hover:bg-slate-50'}
                    ${draggedNodeIndex === index ? 'opacity-50' : 'opacity-100'}
                  `}
                  onClick={() => onSelectNode(node.id)}
                >
                  {/* Drag Handle */}
                  <td className="px-0 py-5 align-top text-center cursor-move text-slate-300 hover:text-slate-500">
                      <GripVertical size={16} className="inline-block mt-2" />
                  </td>

                  <td className="px-6 py-5 whitespace-nowrap align-top">
                    <div className="flex items-center gap-2 mt-1.5">
                      {getTypeIcon(node.type)}
                      <select
                        value={node.type}
                        onChange={(e) => onUpdateNode({ ...node, type: e.target.value as NodeType })}
                        className="bg-transparent text-base text-slate-700 focus:outline-none focus:text-slate-900 cursor-pointer font-medium"
                      >
                        {Object.values(NodeType).map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                  
                  {viewOptions.showScene && (
                      <td className="px-6 py-5 whitespace-nowrap align-top">
                        <EditableSelect
                          value={node.scene || ''}
                          onChange={(val) => onUpdateNode({ ...node, scene: val })}
                          options={lists.knownScenes}
                          placeholder="bg_..."
                        />
                      </td>
                  )}

                  <td className="px-6 py-5 whitespace-nowrap align-top">
                    <EditableSelect
                      value={node.character}
                      onChange={(val) => onUpdateNode({ ...node, character: val })}
                      options={lists.knownCharacters}
                      placeholder={node.type === NodeType.MONOLOGUE ? '(Internal)' : 'Narrator'}
                      italic={node.type === NodeType.MONOLOGUE}
                    />
                  </td>

                  {viewOptions.showArt && (
                      <td className="px-6 py-5 whitespace-nowrap align-top">
                         <EditableSelect
                          value={node.characterArt || ''}
                          onChange={(val) => onUpdateNode({ ...node, characterArt: val })}
                          options={lists.knownArts}
                          placeholder="ch_..."
                        />
                      </td>
                  )}

                  {viewOptions.showExpression && (
                      <td className="px-6 py-5 whitespace-nowrap align-top">
                        <EditableSelect
                          value={node.expression || ''}
                          onChange={(val) => onUpdateNode({ ...node, expression: val })}
                          options={lists.knownExpressions}
                          placeholder="default"
                        />
                      </td>
                  )}

                  <td className="px-6 py-5 align-top">
                    <textarea
                      value={node.text}
                      onChange={(e) => onUpdateNode({ ...node, text: e.target.value })}
                      placeholder={node.type === NodeType.MONOLOGUE ? "Internal thought..." : "Dialogue text..."}
                      rows={1}
                      className={`w-full bg-white/50 border border-slate-200 rounded px-3 py-2 text-base text-slate-700 focus:border-indigo-500 focus:outline-none placeholder-slate-400 resize-none overflow-hidden focus:bg-white ${node.type === NodeType.MONOLOGUE ? 'italic text-slate-600' : ''}`}
                      style={{ minHeight: '44px' }}
                      onInput={(e) => {
                        e.currentTarget.style.height = 'auto';
                        e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                      }}
                    />
                  </td>

                  {viewOptions.showLogic && (
                    <td className="px-6 py-5 whitespace-nowrap text-base text-slate-500 align-top pt-6">
                        {node.type === NodeType.CHOICE ? (
                        <span className="text-purple-600 font-medium">{node.choices.length} branches</span>
                        ) : node.type === NodeType.END ? (
                        <span className="text-red-500 font-medium">End of Line</span>
                        ) : (
                        <div className="flex items-center gap-2">
                            <span>Go to:</span>
                            <select
                            value={node.nextId || ''}
                            onChange={(e) => onUpdateNode({ ...node, nextId: e.target.value || null })}
                            className="bg-white/50 border border-slate-300 rounded px-2 py-1 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none max-w-[150px] truncate"
                            >
                            <option value="">None</option>
                            {nodes.filter(n => n.id !== node.id).map(n => (
                                <option key={n.id} value={n.id}>
                                  {getNodeLabel(n)}
                                </option>
                            ))}
                            </select>
                        </div>
                        )}
                    </td>
                  )}

                  <td className="px-6 py-5 whitespace-nowrap text-right text-sm font-medium align-top pt-6">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteNode(node.id);
                      }}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1"
                    >
                      <Trash2 size={20} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredNodes.length === 0 && (
                  <tr>
                      <td colSpan={10} className="px-6 py-12 text-center text-slate-400 text-base">
                          No nodes match the current filters.
                      </td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
