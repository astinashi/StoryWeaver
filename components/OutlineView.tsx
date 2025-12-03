import React, { useRef, useState } from 'react';
import { OutlineNode, OutlineEdge, AnchorSide, OutlineColor, OutlineNodeType } from '../types';
import { Palette, Trash2, Diamond, Flag, Square, Sparkles, X } from 'lucide-react';

interface OutlineViewProps {
  nodes: OutlineNode[];
  edges: OutlineEdge[];
  onUpdate: (nodes: OutlineNode[], edges: OutlineEdge[]) => void;
  zoom: number;
  selectedNodeId?: string | null;
  onSelectNode?: (id: string | null) => void;
  onDeleteNode?: (id: string) => void;
}

const GRID_SIZE = 40;

export const OutlineView: React.FC<OutlineViewProps> = ({ 
    nodes, edges, onUpdate, zoom, selectedNodeId, onSelectNode, onDeleteNode 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // --- Canvas Panning State ---
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // --- Node Dragging State ---
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [nodeDragOffset, setNodeDragOffset] = useState({ x: 0, y: 0 });

  // --- Edge Drawing State ---
  const [drawingEdge, setDrawingEdge] = useState<{ 
      sourceId: string, 
      anchor: AnchorSide, 
      currentPos: {x:number, y:number},
      initialLabel?: string 
  } | null>(null);

  // --- Helpers ---

  const getCanvasPos = (clientX: number, clientY: number) => {
      const x = (clientX - offset.x) / zoom;
      const y = (clientY - offset.y) / zoom;
      return { x, y };
  };

  const getAnchorPos = (node: OutlineNode, side: AnchorSide) => {
    const { x, y } = node.position;
    const { width, height } = node;
    switch (side) {
        case 'top': return { x: x + width / 2, y: y };
        case 'bottom': return { x: x + width / 2, y: y + height };
        case 'left': return { x: x, y: y + height / 2 };
        case 'right': return { x: x + width, y: y + height / 2 };
    }
  };

  const getClosestAnchor = (node: OutlineNode, point: {x: number, y: number}): AnchorSide => {
    const anchors: AnchorSide[] = ['top', 'bottom', 'left', 'right'];
    let minDist = Infinity;
    let bestAnchor: AnchorSide = 'top';

    anchors.forEach(side => {
        const pos = getAnchorPos(node, side);
        const dist = Math.sqrt(Math.pow(pos.x - point.x, 2) + Math.pow(pos.y - point.y, 2));
        if (dist < minDist) {
            minDist = dist;
            bestAnchor = side;
        }
    });
    return bestAnchor;
  };

  const getBestAnchorPair = (source: OutlineNode, target: OutlineNode): { source: AnchorSide, target: AnchorSide } => {
      const sourceCenter = { x: source.position.x + source.width/2, y: source.position.y + source.height/2 };
      const targetCenter = { x: target.position.x + target.width/2, y: target.position.y + target.height/2 };
      const dx = targetCenter.x - sourceCenter.x;
      const dy = targetCenter.y - sourceCenter.y;

      if (Math.abs(dx) > Math.abs(dy)) {
          return dx > 0 ? { source: 'right', target: 'left' } : { source: 'left', target: 'right' };
      } else {
          return dy > 0 ? { source: 'bottom', target: 'top' } : { source: 'top', target: 'bottom' };
      }
  };

  const updateNodeData = (id: string, updates: Partial<OutlineNode>) => {
      const newNodes = nodes.map(n => n.id === id ? { ...n, ...updates } : n);
      onUpdate(newNodes, edges);
  };

  const updateEdgeLabel = (edgeId: string, label: string) => {
      const newEdges = edges.map(e => e.id === edgeId ? { ...e, label } : e);
      onUpdate(nodes, newEdges);
  };

  const deleteNode = (id: string) => {
      if (onDeleteNode) onDeleteNode(id);
      else {
          const newNodes = nodes.filter(n => n.id !== id);
          const newEdges = edges.filter(e => e.sourceId !== id && e.targetId !== id);
          onUpdate(newNodes, newEdges);
      }
  };

  const cycleType = (id: string, currentType: OutlineNodeType) => {
    const types: OutlineNodeType[] = ['DEFAULT', 'CHOICE', 'END'];
    const idx = types.indexOf(currentType);
    const next = types[(idx + 1) % types.length];
    updateNodeData(id, { type: next });
  };

  const cycleColor = (id: string, currentColor: OutlineColor) => {
    const colors: OutlineColor[] = ['white', 'blue', 'green', 'yellow', 'red'];
    const idx = colors.indexOf(currentColor);
    const next = colors[(idx + 1) % colors.length];
    updateNodeData(id, { color: next });
  };

  // --- ADVANCED SMART ORGANIZE ALGORITHM ---
  const handleAutoLayout = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    if (nodes.length === 0) return;

    // Configuration
    const LAYER_SPACING_X = 350;
    const NODE_SPACING_Y = 50;

    // 1. Build Graph & In-Degrees
    const adj: Record<string, string[]> = {};
    const revAdj: Record<string, string[]> = {}; // Parents
    const inDegree: Record<string, number> = {};
    
    nodes.forEach(n => {
        adj[n.id] = [];
        revAdj[n.id] = [];
        if (inDegree[n.id] === undefined) inDegree[n.id] = 0;
    });
    
    edges.forEach(edge => {
        if (adj[edge.sourceId]) adj[edge.sourceId].push(edge.targetId);
        if (revAdj[edge.targetId]) revAdj[edge.targetId].push(edge.sourceId);
        inDegree[edge.targetId] = (inDegree[edge.targetId] || 0) + 1;
    });

    // 2. Assign Layers (Longest Path Layering via BFS/Topological-ish)
    // We treat nodes with inDegree 0 as roots.
    const nodeLayer: Record<string, number> = {};
    let queue: { id: string, layer: number }[] = [];

    // Push roots
    nodes.filter(n => inDegree[n.id] === 0).forEach(n => {
        queue.push({ id: n.id, layer: 0 });
    });
    // Fallback if circular or no roots
    if (queue.length === 0 && nodes.length > 0) queue.push({ id: nodes[0].id, layer: 0 });

    while (queue.length > 0) {
        const { id, layer } = queue.shift()!;
        if (nodeLayer[id] !== undefined && nodeLayer[id] >= layer) continue;
        nodeLayer[id] = layer;

        const children = adj[id] || [];
        children.forEach(childId => {
            if (layer < 50) queue.push({ id: childId, layer: layer + 1 });
        });
    }

    // Assign unvisited nodes to layer 0 (disconnected islands)
    nodes.forEach(n => {
        if (nodeLayer[n.id] === undefined) nodeLayer[n.id] = 0;
    });

    // Group by Layer
    const layers: Record<number, string[]> = {};
    Object.entries(nodeLayer).forEach(([id, layer]) => {
        if (!layers[layer]) layers[layer] = [];
        layers[layer].push(id);
    });

    const maxLayer = Math.max(...Object.keys(layers).map(Number));

    // 3. Crossing Minimization (Barycenter Heuristic)
    // For each layer, sort nodes based on the average position of their parents in the previous layer
    
    // Initial: Sort Layer 0 by current Y position to keep some user intent
    layers[0].sort((a, b) => {
        const nodeA = nodes.find(n => n.id === a)!;
        const nodeB = nodes.find(n => n.id === b)!;
        return nodeA.position.y - nodeB.position.y;
    });

    // Forward Pass
    for (let l = 1; l <= maxLayer; l++) {
        const currentLayerIds = layers[l] || [];
        const prevLayerIds = layers[l-1] || [];
        
        // Map parent ID to its index in the previous layer
        const parentIndexMap: Record<string, number> = {};
        prevLayerIds.forEach((id, idx) => parentIndexMap[id] = idx);

        currentLayerIds.sort((a, b) => {
            const getAvgParentIdx = (nodeId: string) => {
                const parents = revAdj[nodeId] || [];
                const validParents = parents.filter(p => parentIndexMap[p] !== undefined);
                if (validParents.length === 0) return 9999; // Push unconnected to bottom
                const sum = validParents.reduce((acc, p) => acc + parentIndexMap[p], 0);
                return sum / validParents.length;
            };
            return getAvgParentIdx(a) - getAvgParentIdx(b);
        });
    }

    // 4. Assign Coordinates (Vertical Alignment)
    let newNodes = [...nodes];
    const layerKeys = Object.keys(layers).map(Number).sort((a,b) => a - b);
    
    // We need to track the "bottom Y" of each layer to prevent overlap
    // But since we want to align with parents, we calculate "Ideal Y" first
    
    layerKeys.forEach(l => {
        const layerNodeIds = layers[l];
        let previousNodeBottomY = 100; // Start of the layer

        layerNodeIds.forEach(nid => {
            const nodeIndex = newNodes.findIndex(n => n.id === nid);
            if (nodeIndex === -1) return;
            const node = newNodes[nodeIndex];
            
            // Calculate Ideal Y based on Parents (Center of mass)
            let idealCenterY = -1;
            const parents = revAdj[nid] || [];
            
            // Filter parents that are in the PREVIOUS layer (ignore back-edges or same-layer edges for positioning)
            const validParents = parents.filter(pid => nodeLayer[pid] === l - 1);
            
            if (validParents.length > 0) {
                const parentNodes = newNodes.filter(n => validParents.includes(n.id));
                const minParentY = Math.min(...parentNodes.map(p => p.position.y));
                const maxParentY = Math.max(...parentNodes.map(p => p.position.y + p.height));
                // Center relative to the bounding box of parents
                idealCenterY = (minParentY + maxParentY) / 2;
            }

            // Determine final Y
            let finalY = previousNodeBottomY;
            
            if (idealCenterY !== -1) {
                // Try to place center of node at idealCenterY
                const potentialTopY = idealCenterY - (node.height / 2);
                // Ensure we don't overlap with the previous node in this layer
                finalY = Math.max(previousNodeBottomY, potentialTopY);
            }

            newNodes[nodeIndex] = {
                ...node,
                position: {
                    x: 100 + (l * LAYER_SPACING_X),
                    y: finalY
                }
            };

            previousNodeBottomY = finalY + node.height + NODE_SPACING_Y;
        });
    });

    // 5. Cleanup Edges
    const newEdges = edges.map(edge => ({
        ...edge,
        sourceAnchor: 'right' as AnchorSide,
        targetAnchor: 'left' as AnchorSide
    }));

    onUpdate(newNodes, newEdges);
  };

  // --- Event Handlers ---

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
      containerRef.current?.focus();
      if (e.button === 1 || (e.button === 0 && !draggingNodeId)) {
          setIsDraggingCanvas(true);
          setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
          if (onSelectNode) onSelectNode(null);
      }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (isDraggingCanvas) {
          setOffset({
              x: e.clientX - dragStart.x,
              y: e.clientY - dragStart.y
          });
      }
      else if (draggingNodeId) {
          const node = nodes.find(n => n.id === draggingNodeId);
          if (node) {
              const currentMouseX = (e.clientX - offset.x) / zoom;
              const currentMouseY = (e.clientY - offset.y) / zoom;
              const newPos = {
                  x: currentMouseX - nodeDragOffset.x,
                  y: currentMouseY - nodeDragOffset.y
              };
              const newNodes = nodes.map(n => n.id === draggingNodeId ? { ...n, position: newPos } : n);
              onUpdate(newNodes, edges);
          }
      }
      else if (drawingEdge) {
          const pos = getCanvasPos(e.clientX, e.clientY);
          setDrawingEdge({ ...drawingEdge, currentPos: pos });
      }
  };

  const handleMouseUp = () => {
      setIsDraggingCanvas(false);
      setDraggingNodeId(null);
      if (drawingEdge) setDrawingEdge(null);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
      if (e.target === containerRef.current || (e.target as HTMLElement).id === 'outline-bg') {
          const pos = getCanvasPos(e.clientX, e.clientY);
          const newNode: OutlineNode = {
              id: `outline-${Date.now()}`,
              position: { x: pos.x - 100, y: pos.y - 60 },
              width: 200,
              height: 120,
              title: 'New Card',
              content: '',
              color: 'white',
              type: 'DEFAULT'
          };
          onUpdate([...nodes, newNode], edges);
          if (onSelectNode) onSelectNode(newNode.id);
      }
  };

  const handleNodeMouseDown = (e: React.MouseEvent, node: OutlineNode) => {
      e.stopPropagation(); 
      containerRef.current?.focus(); 
      if (e.button !== 0) return;

      if (onSelectNode) onSelectNode(node.id);

      const currentMouseX = (e.clientX - offset.x) / zoom;
      const currentMouseY = (e.clientY - offset.y) / zoom;

      setNodeDragOffset({
          x: currentMouseX - node.position.x,
          y: currentMouseY - node.position.y
      });
      setDraggingNodeId(node.id);
  };

  const handleNodeMouseUp = (e: React.MouseEvent, targetNode: OutlineNode) => {
      if (drawingEdge && drawingEdge.sourceId !== targetNode.id) {
          e.stopPropagation();
          const sourceNode = nodes.find(n => n.id === drawingEdge.sourceId);
          if (sourceNode) {
              const bestPair = getBestAnchorPair(sourceNode, targetNode);
              const newEdge: OutlineEdge = {
                  id: `edge-${Date.now()}`,
                  sourceId: drawingEdge.sourceId,
                  sourceAnchor: bestPair.source,
                  targetId: targetNode.id,
                  targetAnchor: bestPair.target,
                  label: drawingEdge.initialLabel || '' // RESTORE LABEL
              };
              onUpdate(nodes, [...edges, newEdge]);
          }
          setDrawingEdge(null);
      }
  };

  const handleAnchorMouseDown = (e: React.MouseEvent, nodeId: string, anchor: AnchorSide) => {
      e.stopPropagation();
      e.preventDefault();
      const pos = getCanvasPos(e.clientX, e.clientY);
      setDrawingEdge({ sourceId: nodeId, anchor, currentPos: pos });
  };

  const handleAnchorMouseUp = (e: React.MouseEvent, targetId: string, targetAnchor: AnchorSide) => {
      e.stopPropagation();
      e.preventDefault();
      if (drawingEdge && drawingEdge.sourceId !== targetId) {
          const newEdge: OutlineEdge = {
              id: `edge-${Date.now()}`,
              sourceId: drawingEdge.sourceId,
              sourceAnchor: drawingEdge.anchor,
              targetId: targetId,
              targetAnchor: targetAnchor,
              label: drawingEdge.initialLabel || '' // RESTORE LABEL
          };
          onUpdate(nodes, [...edges, newEdge]);
      }
      setDrawingEdge(null);
  };

  const handleEdgeEndpointDown = (e: React.MouseEvent, edge: OutlineEdge, whichEnd: 'source' | 'target') => {
      e.stopPropagation();
      e.preventDefault();

      const remainingEdges = edges.filter(ed => ed.id !== edge.id);
      onUpdate(nodes, remainingEdges);

      const pos = getCanvasPos(e.clientX, e.clientY);
      const initialLabel = edge.label; 

      if (whichEnd === 'target') {
          setDrawingEdge({
              sourceId: edge.sourceId,
              anchor: edge.sourceAnchor,
              currentPos: pos,
              initialLabel
          });
      } else {
          setDrawingEdge({
              sourceId: edge.targetId,
              anchor: edge.targetAnchor,
              currentPos: pos,
              initialLabel
          });
      }
  };

  const getColorStyles = (color: OutlineColor) => {
    switch(color) {
        case 'white': return 'bg-white border-slate-300';
        case 'blue': return 'bg-blue-50 border-blue-300';
        case 'green': return 'bg-green-50 border-green-300';
        case 'yellow': return 'bg-amber-50 border-amber-300';
        case 'red': return 'bg-red-50 border-red-300';
    }
  };

  return (
      <div 
        id="outline-canvas-container"
        ref={containerRef}
        className="flex-1 overflow-hidden bg-slate-100 relative cursor-default select-none outline-none"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        tabIndex={0}
        onKeyDown={(e) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId) {
                if(document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                    deleteNode(selectedNodeId);
                }
            }
        }}
        style={{
            backgroundImage: 'radial-gradient(#cbd5e1 2px, transparent 2px)',
            backgroundSize: `${GRID_SIZE * zoom}px ${GRID_SIZE * zoom}px`,
            backgroundPosition: `${offset.x % (GRID_SIZE * zoom)}px ${offset.y % (GRID_SIZE * zoom)}px`
        }}
      >
         <div id="outline-bg" className="absolute inset-0 z-0" />

        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 graph-controls pointer-events-auto">
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

         <div 
             style={{ 
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
                width: '100%', 
                height: '100%',
                position: 'absolute',
                pointerEvents: 'none'
             }}
          >
              {/* LAYER 1: Connection Lines (Bottom) */}
              <svg className="absolute top-0 left-0 overflow-visible z-0" style={{ width: 1, height: 1 }}>
                  {edges.map(edge => {
                      const s = nodes.find(n => n.id === edge.sourceId);
                      const t = nodes.find(n => n.id === edge.targetId);
                      if (!s || !t) return null;
                      
                      const start = getAnchorPos(s, edge.sourceAnchor);
                      const end = getAnchorPos(t, edge.targetAnchor);

                      return (
                        <g key={`path-${edge.id}`}>
                            <path 
                                d={`M ${start.x} ${start.y} L ${end.x} ${end.y}`}
                                stroke="#94a3b8" strokeWidth="2" fill="none"
                                className="transition-colors hover:stroke-indigo-400"
                            />
                        </g>
                      );
                  })}

                  {drawingEdge && (
                      <path 
                         d={`M ${getAnchorPos(
                             nodes.find(n => n.id === drawingEdge.sourceId)!,
                             drawingEdge.anchor
                         ).x} ${getAnchorPos(
                             nodes.find(n => n.id === drawingEdge.sourceId)!,
                             drawingEdge.anchor
                         ).y} L ${drawingEdge.currentPos.x} ${drawingEdge.currentPos.y}`}
                         stroke="#6366f1" strokeWidth="2" strokeDasharray="5,5" fill="none"
                         style={{ pointerEvents: 'none' }}
                      />
                  )}
              </svg>

              {/* LAYER 2: Nodes (Middle) */}
              {nodes.map(node => (
                  <div
                    key={node.id}
                    className={`absolute rounded shadow-sm border flex flex-col group transition-shadow pointer-events-auto 
                        ${getColorStyles(node.color)} 
                        ${selectedNodeId === node.id ? 'ring-2 ring-indigo-500 shadow-md z-10' : 'z-0'}
                    `}
                    style={{
                        left: node.position.x,
                        top: node.position.y,
                        width: node.width,
                        height: node.height,
                    }}
                    onMouseDown={(e) => handleNodeMouseDown(e, node)}
                    onMouseUp={(e) => handleNodeMouseUp(e, node)} 
                  >
                        {/* Anchors */}
                        {['top', 'bottom', 'left', 'right'].map((side) => (
                            <div 
                                key={side}
                                className={`absolute w-3 h-3 bg-white border-2 border-slate-400 rounded-full cursor-crosshair transition-all z-50
                                    ${side === 'top' ? '-top-1.5 left-1/2 -translate-x-1/2' : ''}
                                    ${side === 'bottom' ? '-bottom-1.5 left-1/2 -translate-x-1/2' : ''}
                                    ${side === 'left' ? 'top-1/2 -left-1.5 -translate-y-1/2' : ''}
                                    ${side === 'right' ? 'top-1/2 -right-1.5 -translate-y-1/2' : ''}
                                    ${drawingEdge ? 'opacity-100 scale-150 border-indigo-500 bg-indigo-50' : 'opacity-0 group-hover:opacity-100 hover:opacity-100 hover:border-indigo-500 hover:bg-indigo-50 hover:scale-125'}
                                `}
                                onMouseDown={(e) => handleAnchorMouseDown(e, node.id, side as AnchorSide)}
                                onMouseUp={(e) => handleAnchorMouseUp(e, node.id, side as AnchorSide)}
                            />
                        ))}

                        <div className="flex items-center justify-between p-2 border-b border-black/5 cursor-move h-8 shrink-0 select-none">
                            <div className="flex items-center gap-1 overflow-hidden w-full">
                                <button onClick={(e) => { e.stopPropagation(); cycleType(node.id, node.type); }} className="text-slate-500 hover:text-slate-800 shrink-0">
                                    {node.type === 'DEFAULT' && <Square size={14} />}
                                    {node.type === 'CHOICE' && <Diamond size={14} className="fill-purple-200 text-purple-600"/>}
                                    {node.type === 'END' && <Flag size={14} className="fill-red-200 text-red-600"/>}
                                </button>
                                <input 
                                    className="bg-transparent text-xs font-bold text-slate-700 outline-none min-w-0 w-full cursor-text ml-1"
                                    value={node.title}
                                    onChange={(e) => updateNodeData(node.id, { title: e.target.value })}
                                    onMouseDown={(e) => {
                                        e.stopPropagation(); 
                                        if (onSelectNode && selectedNodeId !== node.id) onSelectNode(node.id);
                                    }}
                                    onDoubleClick={(e) => e.stopPropagation()}
                                />
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => { e.stopPropagation(); cycleColor(node.id, node.color); }} className="p-0.5 hover:bg-black/10 rounded text-slate-500"><Palette size={12} /></button>
                                <button onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }} className="p-0.5 hover:bg-red-100 hover:text-red-500 rounded text-slate-500"><Trash2 size={12} /></button>
                            </div>
                        </div>

                        <textarea 
                            className="flex-1 w-full bg-transparent p-2 text-xs text-slate-600 resize-none outline-none cursor-text font-sans"
                            value={node.content}
                            onChange={(e) => updateNodeData(node.id, { content: e.target.value })}
                            onMouseDown={(e) => {
                                e.stopPropagation(); 
                                if (onSelectNode && selectedNodeId !== node.id) onSelectNode(node.id);
                            }}
                            onDoubleClick={(e) => e.stopPropagation()}
                            placeholder="No details..."
                        />
                  </div>
              ))}

              {/* LAYER 3: Edge Controls & Labels (Top) */}
              {edges.map(edge => {
                  const s = nodes.find(n => n.id === edge.sourceId);
                  const t = nodes.find(n => n.id === edge.targetId);
                  if (!s || !t || s.type !== 'CHOICE') return null;

                  const start = getAnchorPos(s, edge.sourceAnchor);
                  const end = getAnchorPos(t, edge.targetAnchor);
                  const cx = (start.x + end.x) / 2;
                  const cy = (start.y + end.y) / 2;

                  return (
                      <div
                        key={`label-${edge.id}`}
                        className="absolute pointer-events-auto z-20"
                        style={{
                            left: cx,
                            top: cy,
                            transform: 'translate(-50%, -50%)'
                        }}
                      >
                          <input 
                             value={edge.label || ''}
                             onChange={(e) => updateEdgeLabel(edge.id, e.target.value)}
                             placeholder="Choice..."
                             className="bg-white border border-indigo-200 text-indigo-700 text-xs px-2 py-1 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 w-24 text-center"
                             onMouseDown={(e) => e.stopPropagation()}
                          />
                      </div>
                  );
              })}

              <svg className="absolute top-0 left-0 overflow-visible z-30 pointer-events-none" style={{ width: 1, height: 1 }}>
                  {edges.map(edge => {
                      const s = nodes.find(n => n.id === edge.sourceId);
                      const t = nodes.find(n => n.id === edge.targetId);
                      if (!s || !t) return null;
                      
                      const start = getAnchorPos(s, edge.sourceAnchor);
                      const end = getAnchorPos(t, edge.targetAnchor);

                      return (
                        <g key={`controls-${edge.id}`} className="pointer-events-auto group">
                            <circle 
                                cx={start.x} cy={start.y} r={6} fill="#94a3b8" 
                                className="cursor-grab hover:fill-indigo-500 hover:scale-125 transition-all opacity-50 hover:opacity-100"
                                onMouseDown={(e) => handleEdgeEndpointDown(e, edge, 'source')}
                            />
                            <circle 
                                cx={end.x} cy={end.y} r={6} fill="#94a3b8" 
                                className="cursor-grab hover:fill-indigo-500 hover:scale-125 transition-all opacity-50 hover:opacity-100"
                                onMouseDown={(e) => handleEdgeEndpointDown(e, edge, 'target')}
                            />
                            
                            <g 
                                className="opacity-0 group-hover:opacity-100 cursor-pointer"
                                onClick={() => onUpdate(nodes, edges.filter(e => e.id !== edge.id))}
                            >
                                <circle cx={(start.x + end.x)/2} cy={(start.y + end.y)/2} r={9} fill="white" stroke="#ef4444" strokeWidth={1} />
                                <X size={12} className="text-red-500" x={(start.x + end.x)/2 - 6} y={(start.y + end.y)/2 - 6} />
                            </g>
                        </g>
                      );
                  })}
              </svg>

         </div>
      </div>
  );
};