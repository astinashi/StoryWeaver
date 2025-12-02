import React, { useRef, useState, useMemo } from 'react';
import { ScriptNode, NodeType, ViewOptions, FilterOptions, GlobalLists, getNodeLabel } from '../types';
import { MessageSquare, GitFork, Flag, PlayCircle, Brain, Sparkles } from 'lucide-react';
import { EditableSelect } from './EditableSelect';

interface GraphViewProps {
  nodes: ScriptNode[];
  onUpdateNode: (node: ScriptNode) => void;
  onUpdateNodes: (nodes: ScriptNode[]) => void;
  onSelectNode: (id: string) => void;
  selectedNodeId: string | null;
  viewOptions: ViewOptions;
  filterOptions: FilterOptions;
  lists: GlobalLists;
  zoom: number;
}

const NODE_WIDTH = 320;
const LAYER_SPACING = 420; // Increased to fit wider nodes
const GRID_SIZE = 20;

// Constants for layout calculation
const HEADER_HEIGHT = 45; // Increased
const BASE_PADDING = 32; // p-4 * 2
const FIELD_HEIGHT = 60; // Label + Input + Margin (increased)
const TEXT_AREA_HEIGHT = 90; // Label + Textarea (increased)
const LOGIC_HEADER_HEIGHT = 30; 
const CHOICE_ROW_HEIGHT = 40; 
const SINGLE_NEXT_HEIGHT = 25; 

export const GraphView: React.FC<GraphViewProps> = ({ 
    nodes, 
    onUpdateNode, 
    onUpdateNodes,
    onSelectNode, 
    selectedNodeId,
    viewOptions,
    filterOptions,
    lists,
    zoom
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Dragging Nodes
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [nodeDragOffset, setNodeDragOffset] = useState({ x: 0, y: 0 });

  // --- Helper to calculate dynamic node height ---
  const calculateNodeHeight = (node: ScriptNode) => {
    let height = HEADER_HEIGHT + BASE_PADDING;
    height += FIELD_HEIGHT; // Character

    if (viewOptions.showScene) height += FIELD_HEIGHT;
    if (viewOptions.showArt) height += FIELD_HEIGHT;
    if (viewOptions.showExpression) height += FIELD_HEIGHT;

    height += TEXT_AREA_HEIGHT;

    if (viewOptions.showLogic) {
        if (node.type === NodeType.CHOICE) {
            height += LOGIC_HEADER_HEIGHT;
            height += (node.choices.length * CHOICE_ROW_HEIGHT);
        } else if (node.type !== NodeType.END) {
            height += SINGLE_NEXT_HEIGHT + 15;
        }
    }

    return height;
  };

  // --- Auto Layout (Same Logic, updated spacing) ---
  const handleAutoLayout = () => {
    if (nodes.length === 0) return;

    const adj: Record<string, string[]> = {};
    const revAdj: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};
    
    nodes.forEach(n => {
        adj[n.id] = [];
        revAdj[n.id] = [];
        if (inDegree[n.id] === undefined) inDegree[n.id] = 0;
    });

    nodes.forEach(n => {
        const targets: string[] = [];
        if (n.type === NodeType.CHOICE) {
            n.choices.forEach(c => { if(c.targetNodeId) targets.push(c.targetNodeId); });
        } else if (n.nextId) {
            targets.push(n.nextId);
        }
        const uniqueTargets = [...new Set(targets)];

        uniqueTargets.forEach(t => {
            if (adj[n.id]) adj[n.id].push(t);
            if (revAdj[t]) revAdj[t].push(n.id);
            inDegree[t] = (inDegree[t] || 0) + 1;
        });
    });

    const layers: Record<number, string[]> = {};
    const nodeLayer: Record<string, number> = {};
    
    let queue: { id: string, layer: number }[] = [];
    
    nodes.filter(n => n.type === NodeType.START).forEach(n => {
        queue.push({ id: n.id, layer: 0 });
    });
    nodes.filter(n => inDegree[n.id] === 0 && n.type !== NodeType.START).forEach(n => {
         queue.push({ id: n.id, layer: 0 });
    });
    if (queue.length === 0 && nodes.length > 0) queue.push({ id: nodes[0].id, layer: 0 });

    while (queue.length > 0) {
        const { id, layer } = queue.shift()!;
        if (nodeLayer[id] !== undefined && nodeLayer[id] >= layer) continue;
        nodeLayer[id] = layer;
        
        const children = adj[id] || [];
        children.forEach(childId => {
            if (layer < 50) {
                queue.push({ id: childId, layer: layer + 1 });
            }
        });
    }

    nodes.forEach(n => {
        if (nodeLayer[n.id] === undefined) nodeLayer[n.id] = 0;
    });

    Object.entries(nodeLayer).forEach(([id, layer]) => {
        if (!layers[layer]) layers[layer] = [];
        layers[layer].push(id);
    });

    const maxLayer = Math.max(...Object.keys(layers).map(Number));

    if (layers[0]) {
        layers[0].sort((a, b) => {
            const nodeA = nodes.find(n => n.id === a)!;
            const nodeB = nodes.find(n => n.id === b)!;
            if (nodeA.type === NodeType.START) return -1;
            if (nodeB.type === NodeType.START) return 1;
            return 0;
        });
    }

    for (let l = 1; l <= maxLayer; l++) {
        const currentLayerNodes = layers[l] || [];
        const prevLayerNodes = layers[l-1] || [];
        const parentPositions: Record<string, number> = {};
        prevLayerNodes.forEach((pid, idx) => { parentPositions[pid] = idx; });
        const nodeBarycenter: Record<string, number> = {};
        
        currentLayerNodes.forEach(nid => {
            const parents = revAdj[nid] || [];
            const relevantParents = parents.filter(p => parentPositions[p] !== undefined);
            if (relevantParents.length > 0) {
                const sum = relevantParents.reduce((acc, p) => acc + parentPositions[p], 0);
                nodeBarycenter[nid] = sum / relevantParents.length;
            } else {
                nodeBarycenter[nid] = currentLayerNodes.indexOf(nid);
            }
        });

        layers[l].sort((a, b) => nodeBarycenter[a] - nodeBarycenter[b]);
    }

    const newNodes = [...nodes];
    const layerKeys = Object.keys(layers).map(Number).sort((a, b) => a - b);
    
    const NODE_GAP = 60;

    layerKeys.forEach(l => {
        const layerNodesIds = layers[l];
        let currentY = 100;

        layerNodesIds.forEach((nid) => {
            const nodeIndex = newNodes.findIndex(n => n.id === nid);
            if (nodeIndex !== -1) {
                const node = newNodes[nodeIndex];
                const height = calculateNodeHeight(node);

                newNodes[nodeIndex] = {
                    ...node,
                    position: {
                        x: 100 + (l * LAYER_SPACING),
                        y: currentY
                    }
                };
                currentY += height + NODE_GAP;
            }
        });
    });

    onUpdateNodes(newNodes);
  };

  const isNodeVisible = (node: ScriptNode) => {
      const matchChar = !filterOptions.character || node.character.toLowerCase().includes(filterOptions.character.toLowerCase());
      const matchScene = !filterOptions.scene || (node.scene || '').toLowerCase().includes(filterOptions.scene.toLowerCase());
      const matchArt = !filterOptions.characterArt || (node.characterArt || '').toLowerCase().includes(filterOptions.characterArt.toLowerCase());
      const matchExpr = !filterOptions.expression || (node.expression || '').toLowerCase().includes(filterOptions.expression.toLowerCase());
      return matchChar && matchScene && matchArt && matchExpr;
  }

  const getNodeStyles = (type: NodeType) => {
    if (!viewOptions.enableColorCoding) {
        return 'bg-white border-slate-300 hover:border-slate-400';
    }
    switch(type) {
        case NodeType.DIALOGUE: return 'bg-blue-50/80 border-blue-300 hover:border-blue-400';
        case NodeType.MONOLOGUE: return 'bg-slate-100/80 border-slate-300 hover:border-slate-400';
        case NodeType.CHOICE: return 'bg-purple-50/80 border-purple-300 hover:border-purple-400';
        case NodeType.END: return 'bg-red-50/80 border-red-300 hover:border-red-400';
        case NodeType.START: return 'bg-green-50/80 border-green-300 hover:border-green-400';
        default: return 'bg-white border-slate-300';
    }
  }

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && !draggingNodeId) {
      setIsDraggingCanvas(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingCanvas) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    } else if (draggingNodeId) {
        const node = nodes.find(n => n.id === draggingNodeId);
        if(node) {
            // Drag logic accounting for zoom
            // Mouse moves in screen space. 
            // We want to calculate new node position in node space.
            // ScreenX = OffsetX + (NodeX * Zoom)
            // NodeX = (ScreenX - OffsetX) / Zoom
            // DeltaNodeX = DeltaScreenX / Zoom
            // Here we use absolute position tracking with offset
            
            const currentMouseX = (e.clientX - offset.x) / zoom;
            const currentMouseY = (e.clientY - offset.y) / zoom;

            onUpdateNode({
                ...node,
                position: {
                    x: currentMouseX - nodeDragOffset.x,
                    y: currentMouseY - nodeDragOffset.y
                }
            });
        }
    }
  };

  const handleMouseUp = () => {
    setIsDraggingCanvas(false);
    setDraggingNodeId(null);
  };

  const getPath = (start: {x: number, y: number}, end: {x: number, y: number}) => {
    const sx = start.x;
    const sy = start.y;
    const ex = end.x;
    const ey = end.y;
    const dist = Math.abs(ex - sx) * 0.5;
    const cp1x = sx + Math.max(dist, 50);
    const cp1y = sy;
    const cp2x = ex - Math.max(dist, 50);
    const cp2y = ey;
    return `M ${sx} ${sy} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${ex} ${ey}`;
  };

  const getCubicBezierMidpoint = (p0: {x:number, y:number}, p1: {x:number, y:number}, p2: {x:number, y:number}, p3: {x:number, y:number}, t: number) => {
      const mt = 1 - t;
      const mt2 = mt * mt;
      const mt3 = mt2 * mt;
      const t2 = t * t;
      const t3 = t2 * t;

      const x = mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x;
      const y = mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y;
      return { x, y };
  };

  const renderConnections = () => {
    const elements: React.ReactElement[] = [];
    
    nodes.forEach(node => {
        const isSourceDimmed = !isNodeVisible(node);
        const nodeHeight = calculateNodeHeight(node);
        const startX = node.position.x + NODE_WIDTH;
        const startY = node.position.y + (nodeHeight / 2);

        if (node.type === NodeType.CHOICE) {
             node.choices.forEach((choice, idx) => {
                 if (choice.targetNodeId) {
                     const target = nodes.find(n => n.id === choice.targetNodeId);
                     if (target) {
                         const isTargetDimmed = !isNodeVisible(target);
                         const targetX = target.position.x;
                         const targetY = target.position.y + 20;

                         const dist = Math.abs(targetX - startX) * 0.5;
                         const cp1 = { x: startX + Math.max(dist, 50), y: startY };
                         const cp2 = { x: targetX - Math.max(dist, 50), y: targetY };
                         
                         const pathD = `M ${startX} ${startY} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${targetX} ${targetY}`;

                         elements.push(
                             <path
                                key={`${node.id}-${choice.id}`}
                                d={pathD}
                                stroke={isSourceDimmed || isTargetDimmed ? "#e2e8f0" : "#a855f7"}
                                strokeWidth="3"
                                fill="none"
                                className="transition-colors"
                             />
                         );

                         const mid = getCubicBezierMidpoint(
                             {x: startX, y: startY}, 
                             cp1, 
                             cp2, 
                             {x: targetX, y: targetY}, 
                             0.5
                         );
                         
                         if (!isSourceDimmed && !isTargetDimmed) {
                             elements.push(
                                <g key={`label-${node.id}-${choice.id}`}>
                                    <rect 
                                        x={mid.x - (choice.label.length * 4 + 10)} 
                                        y={mid.y - 12} 
                                        width={(choice.label.length * 8) + 20} 
                                        height={24} 
                                        fill="white" 
                                        rx="4"
                                        stroke="#e9d5ff"
                                        strokeWidth="1"
                                    />
                                    <text
                                        x={mid.x}
                                        y={mid.y}
                                        dominantBaseline="middle"
                                        textAnchor="middle"
                                        className="text-xs font-medium fill-purple-700 pointer-events-none"
                                    >
                                        {choice.label.length > 20 ? choice.label.slice(0, 18) + '..' : choice.label}
                                    </text>
                                </g>
                             );
                         }

                         elements.push(
                            <circle 
                                key={`dot-${node.id}-${choice.id}`}
                                cx={startX} cy={startY} r={4} fill="#a855f7"
                            />
                         )
                     }
                 }
             });
        } else {
            if (node.nextId) {
                const target = nodes.find(n => n.id === node.nextId);
                if (target) {
                    const isTargetDimmed = !isNodeVisible(target);
                    const targetX = target.position.x;
                    const targetY = target.position.y + 20;

                    elements.push(
                        <path
                           key={`${node.id}-next`}
                           d={getPath({x: startX, y: startY}, {x: targetX, y: targetY})}
                           stroke={isSourceDimmed || isTargetDimmed ? "#e2e8f0" : "#cbd5e1"}
                           strokeWidth="3"
                           fill="none"
                           className="transition-colors"
                        />
                    );
                }
            }
        }
    });
    return elements;
  };

  return (
    <div 
        id="graph-canvas-container"
        ref={containerRef}
        className="flex-1 overflow-hidden bg-slate-50 relative cursor-grab active:cursor-grabbing"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
            backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
            backgroundSize: `${GRID_SIZE * zoom}px ${GRID_SIZE * zoom}px`, // Scale grid visual
            backgroundPosition: `${offset.x % (GRID_SIZE * zoom)}px ${offset.y % (GRID_SIZE * zoom)}px`
        }}
    >
        {/* Floating Tools */}
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 graph-controls">
            <button 
                onClick={handleAutoLayout}
                className="bg-white p-2.5 rounded-lg shadow-md border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all group relative"
                title="Smart Organize"
            >
                <Sparkles size={22} />
                <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    Smart Organize
                </span>
            </button>
        </div>

        {/* Scaled Content Container */}
        <div 
            style={{ 
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
                width: '100%',
                height: '100%',
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: 'none' // Let events pass through to nodes
            }}
        >
            <svg className="absolute top-0 left-0 overflow-visible z-0" style={{ width: 1, height: 1 }}>
                {renderConnections()}
            </svg>

            {nodes.map(node => {
                const isVisible = isNodeVisible(node);
                const displayLabel = getNodeLabel(node);
                
                return (
                <div
                    key={node.id}
                    className={`absolute border rounded-lg shadow-sm pointer-events-auto transition-all group flex flex-col
                        ${selectedNodeId === node.id ? 'ring-2 ring-indigo-500/50 z-10' : 'z-0'}
                        ${isVisible ? 'opacity-100' : 'opacity-30 grayscale'}
                        ${getNodeStyles(node.type)}
                    `}
                    style={{
                        left: node.position.x,
                        top: node.position.y,
                        width: NODE_WIDTH
                    }}
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        onSelectNode(node.id);
                        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
                        
                        // Calculate offset in Node Space
                        const clickX = (e.clientX - offset.x) / zoom;
                        const clickY = (e.clientY - offset.y) / zoom;

                        setNodeDragOffset({
                            x: clickX - node.position.x,
                            y: clickY - node.position.y
                        });
                        setDraggingNodeId(node.id);
                    }}
                >
                    {/* Header Handle */}
                    <div className={`px-4 py-2 border-b border-black/5 rounded-t-lg flex items-center justify-between cursor-move h-[45px]
                         ${node.type === NodeType.START ? 'bg-green-100/50' : 
                           node.type === NodeType.END ? 'bg-red-100/50' : 
                           node.type === NodeType.CHOICE ? 'bg-purple-100/50' : 
                           node.type === NodeType.MONOLOGUE ? 'bg-slate-200/50' : 'bg-blue-100/50'}
                    `}>
                        <div className="flex items-center gap-2 text-sm font-bold tracking-wider text-slate-700 truncate mr-2" title={displayLabel}>
                             {node.type === NodeType.DIALOGUE && <MessageSquare size={16} className="text-blue-600 shrink-0"/>}
                             {node.type === NodeType.MONOLOGUE && <Brain size={16} className="text-slate-600 shrink-0"/>}
                             {node.type === NodeType.CHOICE && <GitFork size={16} className="text-purple-600 shrink-0"/>}
                             {node.type === NodeType.END && <Flag size={16} className="text-red-600 shrink-0"/>}
                             {node.type === NodeType.START && <PlayCircle size={16} className="text-green-600 shrink-0"/>}
                             <span className="truncate">{displayLabel}</span>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-3">
                        {/* Character Field */}
                        <div className="h-[60px]">
                             <label className="text-xs text-slate-500 uppercase font-bold mb-1 block">Character</label>
                             <EditableSelect
                                value={node.character}
                                onChange={(val) => onUpdateNode({...node, character: val})}
                                options={lists.knownCharacters}
                                placeholder={node.type === NodeType.MONOLOGUE ? "(Internal)" : "Name..."}
                                italic={node.type === NodeType.MONOLOGUE}
                             />
                        </div>

                        {/* Optional Visual Fields */}
                        {viewOptions.showScene && (
                            <div className="h-[60px]">
                                <label className="text-xs text-slate-500 uppercase font-bold mb-1 block">Scene</label>
                                <EditableSelect
                                    value={node.scene || ''}
                                    onChange={(val) => onUpdateNode({...node, scene: val})}
                                    options={lists.knownScenes}
                                    placeholder="bg_..."
                                />
                            </div>
                        )}
                        {viewOptions.showArt && (
                            <div className="h-[60px]">
                                <label className="text-xs text-slate-500 uppercase font-bold mb-1 block">Art/Sprite</label>
                                <EditableSelect
                                    value={node.characterArt || ''}
                                    onChange={(val) => onUpdateNode({...node, characterArt: val})}
                                    options={lists.knownArts}
                                    placeholder="ch_..."
                                />
                            </div>
                        )}
                        {viewOptions.showExpression && (
                            <div className="h-[60px]">
                                <label className="text-xs text-slate-500 uppercase font-bold mb-1 block">Expression</label>
                                <EditableSelect
                                    value={node.expression || ''}
                                    onChange={(val) => onUpdateNode({...node, expression: val})}
                                    options={lists.knownExpressions}
                                    placeholder="ex_..."
                                />
                            </div>
                        )}

                        <div className="h-[90px]">
                             <label className="text-xs text-slate-500 uppercase font-bold mb-1 block">Text</label>
                             <textarea 
                                className={`w-full bg-white/50 border border-slate-200 rounded px-2 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-500 resize-none focus:bg-white ${node.type === NodeType.MONOLOGUE ? 'italic text-slate-600' : ''}`}
                                rows={3}
                                value={node.text}
                                onChange={(e) => onUpdateNode({...node, text: e.target.value})}
                                placeholder={node.type === NodeType.MONOLOGUE ? "Internal thought..." : "Say something..."}
                             />
                        </div>
                        
                        {/* Logic Connections */}
                        {viewOptions.showLogic && (
                            <div className="pt-2 border-t border-black/5">
                                {node.type === NodeType.CHOICE ? (
                                    <div className="space-y-0">
                                        <span className="text-xs text-slate-500 uppercase font-bold block mb-1 h-[25px]">Options</span>
                                        {node.choices.map((choice, idx) => (
                                            <div key={choice.id} className="flex items-center gap-1 bg-white/50 p-2 rounded border border-slate-200 mb-1 h-[36px]">
                                                <div className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0"></div>
                                                <span className="text-sm text-slate-600 truncate flex-1">{choice.label || 'Empty Option'}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    node.type !== NodeType.END && (
                                        <div className="flex items-center justify-between text-sm text-slate-500 h-[25px]">
                                            <span>Next:</span>
                                            <span className="font-mono text-slate-600 font-medium truncate ml-2">
                                                {node.nextId ? getNodeLabel(nodes.find(n => n.id === node.nextId)!) : 'None'}
                                            </span>
                                        </div>
                                    )
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )})}
        </div>
        
        <div className="absolute bottom-4 right-4 bg-white border border-slate-200 p-2 rounded-lg text-xs text-slate-500 pointer-events-none shadow-sm graph-controls">
            Pan: Drag Canvas • Move: Drag Nodes • Organize: Use Wand
        </div>
    </div>
  );
};