
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ScriptNode, NodeType, ViewMode, ViewOptions, FilterOptions, ScriptFile, OutlineFile, FileSystemFileHandle, OutlineNode, OutlineEdge, AppMode } from './types';
import { Toolbar } from './components/Toolbar';
import { TableView } from './components/TableView';
import { GraphView } from './components/GraphView';
import { OutlineView } from './components/OutlineView';
import { Inspector } from './components/Inspector';
import { OutlineInspector } from './components/OutlineInspector';
import { exportToJson, exportToExcel, exportToPng, saveProjectFile } from './services/exportService';

const INITIAL_NODES: ScriptNode[] = [
  {
    id: 'start-node',
    type: NodeType.START,
    character: 'System',
    text: 'The story begins here.',
    choices: [],
    nextId: 'node-1',
    position: { x: 100, y: 100 },
    scene: 'bg_black'
  },
  {
    id: 'node-1',
    type: NodeType.MONOLOGUE,
    character: 'Hero',
    text: 'The weather on Sunday is terrible... I am standing on the runway.',
    choices: [],
    nextId: null,
    position: { x: 500, y: 100 },
    scene: 'bg_runway',
    expression: 'gloom'
  }
];

const AUTOSAVE_SCRIPT_KEY = 'storyweaver_script_v2';
const AUTOSAVE_OUTLINE_KEY = 'storyweaver_outline_v2';

const App: React.FC = () => {
  // --- Mode State ---
  const [appMode, setAppMode] = useState<AppMode>('SCRIPT');
  const [scriptViewMode, setScriptViewMode] = useState<ViewMode>('GRAPH');

  // --- Script Workspace State ---
  const [scriptTitle, setScriptTitle] = useState("Untitled Script");
  const [nodes, setNodes] = useState<ScriptNode[]>(INITIAL_NODES);
  const [scriptZoom, setScriptZoom] = useState(1.0);
  const [scriptFileHandle, setScriptFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // --- Outline Workspace State ---
  const [outlineTitle, setOutlineTitle] = useState("Untitled Outline");
  const [outlineNodes, setOutlineNodes] = useState<OutlineNode[]>([]);
  const [outlineEdges, setOutlineEdges] = useState<OutlineEdge[]>([]);
  const [outlineZoom, setOutlineZoom] = useState(1.0);
  const [outlineFileHandle, setOutlineFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [selectedOutlineNodeId, setSelectedOutlineNodeId] = useState<string | null>(null);

  // --- Common UI State ---
  const [isAutoSaved, setIsAutoSaved] = useState(true);
  
  // Visibility & Filters (Script only)
  const [viewOptions, setViewOptions] = useState<ViewOptions>({
      showScene: true,
      showArt: true,
      showExpression: true,
      showLogic: true,
      enableColorCoding: true
  });
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
      character: '',
      scene: '',
      characterArt: '',
      expression: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- History Management (Dual Stack) ---
  
  // Script History
  const [scriptHistory, setScriptHistory] = useState<ScriptNode[][]>([INITIAL_NODES]);
  const [scriptHistoryIndex, setScriptHistoryIndex] = useState(0);

  // Outline History
  const [outlineHistory, setOutlineHistory] = useState<{nodes: OutlineNode[], edges: OutlineEdge[]}[]>([{ nodes: [], edges: [] }]);
  const [outlineHistoryIndex, setOutlineHistoryIndex] = useState(0);

  const historyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Autosave & Load ---

  useEffect(() => {
      // Load Script
      const savedScript = localStorage.getItem(AUTOSAVE_SCRIPT_KEY);
      if (savedScript) {
          try {
              const parsed: ScriptFile = JSON.parse(savedScript);
              if (parsed.fileType === 'SCRIPT' && Array.isArray(parsed.nodes)) {
                  setNodes(parsed.nodes);
                  setScriptTitle(parsed.title);
                  setScriptZoom(parsed.zoom || 1.0);
                  if (parsed.viewOptions) setViewOptions(parsed.viewOptions);
                  setScriptHistory([parsed.nodes]);
                  setScriptHistoryIndex(0);
              }
          } catch (e) { console.error("Script autosave load failed", e); }
      }

      // Load Outline
      const savedOutline = localStorage.getItem(AUTOSAVE_OUTLINE_KEY);
      if (savedOutline) {
          try {
              const parsed: OutlineFile = JSON.parse(savedOutline);
              if (parsed.fileType === 'OUTLINE' && Array.isArray(parsed.nodes)) {
                  setOutlineNodes(parsed.nodes);
                  setOutlineEdges(parsed.edges);
                  setOutlineTitle(parsed.title);
                  setOutlineZoom(parsed.zoom || 1.0);
                  setOutlineHistory([{ nodes: parsed.nodes, edges: parsed.edges }]);
                  setOutlineHistoryIndex(0);
              }
          } catch (e) { console.error("Outline autosave load failed", e); }
      }
  }, []);

  // Autosave Effect
  useEffect(() => {
      setIsAutoSaved(false);
      const timer = setTimeout(() => {
          // Save Script
          const scriptData: ScriptFile = {
              fileType: 'SCRIPT',
              title: scriptTitle,
              nodes,
              zoom: scriptZoom,
              pan: {x: 0, y: 0},
              viewOptions,
              version: '1.0.0',
              lastModified: Date.now()
          };
          localStorage.setItem(AUTOSAVE_SCRIPT_KEY, JSON.stringify(scriptData));

          // Save Outline
          const outlineData: OutlineFile = {
              fileType: 'OUTLINE',
              title: outlineTitle,
              nodes: outlineNodes,
              edges: outlineEdges,
              zoom: outlineZoom,
              pan: {x: 0, y: 0},
              version: '1.0.0',
              lastModified: Date.now()
          };
          localStorage.setItem(AUTOSAVE_OUTLINE_KEY, JSON.stringify(outlineData));
          
          setIsAutoSaved(true);
      }, 1000);
      return () => clearTimeout(timer);
  }, [nodes, outlineNodes, outlineEdges, scriptTitle, outlineTitle, viewOptions, scriptZoom, outlineZoom]);


  // --- History Logic ---

  const pushScriptHistory = useCallback((newNodes: ScriptNode[], immediate = false) => {
      if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);
      
      const commit = () => {
          setScriptHistory(prev => {
              const current = prev[scriptHistoryIndex];
              // Safety check: ensure current state exists before comparing
              if (!current) return prev;

              if (JSON.stringify(current) === JSON.stringify(newNodes)) return prev;
              
              const sliced = prev.slice(0, scriptHistoryIndex + 1);
              sliced.push(newNodes);
              if (sliced.length > 50) sliced.shift();
              return sliced;
          });
          setScriptHistoryIndex(prev => Math.min(prev + 1, 49)); 
      };

      if (immediate) commit();
      else historyTimeoutRef.current = setTimeout(commit, 800);
  }, [scriptHistoryIndex]);

  const pushOutlineHistory = useCallback((newNodes: OutlineNode[], newEdges: OutlineEdge[], immediate = false) => {
      if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);

      const commit = () => {
        setOutlineHistory(prev => {
            const current = prev[outlineHistoryIndex];
            // Safety check: ensure current state exists before accessing properties
            if (!current) return prev;

            if (JSON.stringify(current.nodes) === JSON.stringify(newNodes) && 
                JSON.stringify(current.edges) === JSON.stringify(newEdges)) return prev;
            
            const sliced = prev.slice(0, outlineHistoryIndex + 1);
            sliced.push({ nodes: newNodes, edges: newEdges });
            if (sliced.length > 50) sliced.shift();
            return sliced;
        });
        setOutlineHistoryIndex(prev => Math.min(prev + 1, 49));
      };

      if (immediate) commit();
      else historyTimeoutRef.current = setTimeout(commit, 800);
  }, [outlineHistoryIndex]);


  const handleUndo = () => {
      if (appMode === 'SCRIPT') {
          if (scriptHistoryIndex > 0) {
              const newIndex = scriptHistoryIndex - 1;
              setScriptHistoryIndex(newIndex);
              setNodes(scriptHistory[newIndex]);
          }
      } else {
          if (outlineHistoryIndex > 0) {
              const newIndex = outlineHistoryIndex - 1;
              setOutlineHistoryIndex(newIndex);
              setOutlineNodes(outlineHistory[newIndex].nodes);
              setOutlineEdges(outlineHistory[newIndex].edges);
          }
      }
  };

  const handleRedo = () => {
      if (appMode === 'SCRIPT') {
          if (scriptHistoryIndex < scriptHistory.length - 1) {
              const newIndex = scriptHistoryIndex + 1;
              setScriptHistoryIndex(newIndex);
              setNodes(scriptHistory[newIndex]);
          }
      } else {
          if (outlineHistoryIndex < outlineHistory.length - 1) {
              const newIndex = outlineHistoryIndex + 1;
              setOutlineHistoryIndex(newIndex);
              setOutlineNodes(outlineHistory[newIndex].nodes);
              setOutlineEdges(outlineHistory[newIndex].edges);
          }
      }
  };

  // --- Logic ---

  const globalLists = useMemo(() => {
    const chars = new Set<string>();
    const scenes = new Set<string>();
    const arts = new Set<string>();
    const exprs = new Set<string>();
    nodes.forEach(node => {
      if (node.character) chars.add(node.character);
      if (node.scene) scenes.add(node.scene);
      if (node.characterArt) arts.add(node.characterArt);
      if (node.expression) exprs.add(node.expression);
    });
    return {
      knownCharacters: Array.from(chars).sort(),
      knownScenes: Array.from(scenes).sort(),
      knownArts: Array.from(arts).sort(),
      knownExpressions: Array.from(exprs).sort(),
    };
  }, [nodes]);

  // Script Actions
  const handleUpdateNode = (updatedNode: ScriptNode) => {
    const newNodes = nodes.map(n => n.id === updatedNode.id ? updatedNode : n);
    setNodes(newNodes);
    const oldNode = nodes.find(n => n.id === updatedNode.id);
    const immediate = oldNode && (oldNode.type !== updatedNode.type || oldNode.nextId !== updatedNode.nextId);
    pushScriptHistory(newNodes, !!immediate);
  };

  const handleUpdateNodes = (updatedNodes: ScriptNode[]) => {
    const nodeMap = new Map(updatedNodes.map(n => [n.id, n]));
    const newNodes = nodes.map(n => nodeMap.get(n.id) || n);
    setNodes(newNodes);
    pushScriptHistory(newNodes, true);
  };

  const handleAddNode = () => {
    const shortId = Math.random().toString(36).substring(2, 7);
    const newNode: ScriptNode = {
      id: `node-${shortId}`,
      type: NodeType.DIALOGUE,
      character: '',
      text: '',
      choices: [],
      nextId: null,
      position: { x: 400 + Math.random() * 50, y: 300 + Math.random() * 50 }
    };
    const newNodes = [...nodes, newNode];
    setNodes(newNodes);
    setSelectedNodeId(newNode.id);
    pushScriptHistory(newNodes, true);
  };

  const handleDeleteNode = (id: string) => {
    const newNodes = nodes.filter(n => n.id !== id);
    setNodes(newNodes);
    if (selectedNodeId === id) setSelectedNodeId(null);
    pushScriptHistory(newNodes, true);
  };

  const handleReorderNodes = (from: number, to: number) => {
      const newNodes = [...nodes];
      const [moved] = newNodes.splice(from, 1);
      newNodes.splice(to, 0, moved);
      setNodes(newNodes);
      pushScriptHistory(newNodes, true);
  };

  // Outline Actions
  const handleUpdateOutline = (newNodes: OutlineNode[], newEdges: OutlineEdge[]) => {
      setOutlineNodes(newNodes);
      setOutlineEdges(newEdges);
      // Logic: If node count changed or edge count changed, immediate commit.
      // Otherwise (moving nodes), rely on debounce.
      const prevNodesCount = outlineHistory[outlineHistoryIndex]?.nodes.length || 0;
      const prevEdgesCount = outlineHistory[outlineHistoryIndex]?.edges.length || 0;
      const isStructureChange = newNodes.length !== prevNodesCount || newEdges.length !== prevEdgesCount;
      
      pushOutlineHistory(newNodes, newEdges, isStructureChange); 
  };

  const handleAddOutlineNode = () => {
      const newNode: OutlineNode = {
          id: `outline-${Date.now()}`,
          position: { x: 400 - (200/2) + Math.random()*50, y: 300 - (120/2) + Math.random()*50 },
          width: 200,
          height: 120,
          title: 'New Card',
          content: '',
          color: 'white',
          type: 'DEFAULT'
      };
      // For ADD, we pass a new array. The `handleUpdateOutline` will detect length change and commit immediately.
      handleUpdateOutline([...outlineNodes, newNode], outlineEdges);
      setSelectedOutlineNodeId(newNode.id);
  };

  const handleUpdateOutlineNode = (updatedNode: OutlineNode) => {
      const newNodes = outlineNodes.map(n => n.id === updatedNode.id ? updatedNode : n);
      handleUpdateOutline(newNodes, outlineEdges);
  };

  const handleDeleteOutlineNode = (id: string) => {
      const newNodes = outlineNodes.filter(n => n.id !== id);
      const newEdges = outlineEdges.filter(e => e.sourceId !== id && e.targetId !== id);
      handleUpdateOutline(newNodes, newEdges);
      if (selectedOutlineNodeId === id) setSelectedOutlineNodeId(null);
  };

  // --- File Actions ---

  const handleNewProject = () => {
      if (confirm(`Create new ${appMode === 'SCRIPT' ? 'Script' : 'Outline'}? Unsaved changes in this mode will be lost.`)) {
          if (appMode === 'SCRIPT') {
              setNodes(INITIAL_NODES);
              setScriptTitle("Untitled Script");
              setScriptFileHandle(null);
              setScriptHistory([INITIAL_NODES]);
              setScriptHistoryIndex(0);
          } else {
              setOutlineNodes([]);
              setOutlineEdges([]);
              setOutlineTitle("Untitled Outline");
              setOutlineFileHandle(null);
              setOutlineHistory([{ nodes: [], edges: [] }]);
              setOutlineHistoryIndex(0);
          }
      }
  };

  const handleSaveProject = async () => {
      if (appMode === 'SCRIPT') {
          const data: ScriptFile = {
              fileType: 'SCRIPT',
              title: scriptTitle,
              nodes,
              zoom: scriptZoom,
              pan: {x:0, y:0},
              viewOptions,
              version: '1.0.0',
              lastModified: Date.now()
          };
          if (scriptFileHandle) {
              const w = await scriptFileHandle.createWritable();
              await w.write(JSON.stringify(data, null, 2));
              await w.close();
              alert("Script saved!");
          } else {
              handleSaveAs();
          }
      } else {
          const data: OutlineFile = {
              fileType: 'OUTLINE',
              title: outlineTitle,
              nodes: outlineNodes,
              edges: outlineEdges,
              zoom: outlineZoom,
              pan: {x:0, y:0},
              version: '1.0.0',
              lastModified: Date.now()
          };
          if (outlineFileHandle) {
              const w = await outlineFileHandle.createWritable();
              await w.write(JSON.stringify(data, null, 2));
              await w.close();
              alert("Outline saved!");
          } else {
              handleSaveAs();
          }
      }
  };

  const handleSaveAs = async () => {
      const isScript = appMode === 'SCRIPT';
      const title = isScript ? scriptTitle : outlineTitle;
      const suggestedName = `${title.replace(/\s+/g, '_')}_${isScript ? 'script' : 'outline'}.json`;

      const data = isScript ? {
          fileType: 'SCRIPT',
          title: scriptTitle,
          nodes,
          zoom: scriptZoom,
          pan: {x:0, y:0},
          viewOptions,
          version: '1.0.0',
          lastModified: Date.now()
      } : {
          fileType: 'OUTLINE',
          title: outlineTitle,
          nodes: outlineNodes,
          edges: outlineEdges,
          zoom: outlineZoom,
          pan: {x:0, y:0},
          version: '1.0.0',
          lastModified: Date.now()
      };

      if ('showSaveFilePicker' in window) {
          try {
              const handle = await (window as any).showSaveFilePicker({
                  suggestedName,
                  types: [{ description: 'JSON Project File', accept: { 'application/json': ['.json'] } }],
              });
              
              if (isScript) setScriptFileHandle(handle);
              else setOutlineFileHandle(handle);

              const w = await handle.createWritable();
              await w.write(JSON.stringify(data, null, 2));
              await w.close();
              
              if (handle.name) {
                  const newName = handle.name.replace('.json', '').replace(/_(script|outline)$/, '');
                  if (isScript) setScriptTitle(newName);
                  else setOutlineTitle(newName);
              }
          } catch (e: any) { if(e.name !== 'AbortError') alert("Save failed"); }
      } else {
          saveProjectFile(data as any); // Fallback download
      }
  };

  const handleOpenProjectClick = async () => {
      if ('showOpenFilePicker' in window) {
          try {
              const [handle] = await (window as any).showOpenFilePicker({
                  types: [{ description: 'JSON Project File', accept: { 'application/json': ['.json'] } }],
                  multiple: false
              });
              const file = await handle.getFile();
              const text = await file.text();
              const parsed = JSON.parse(text);

              if (parsed.fileType === 'SCRIPT' || (Array.isArray(parsed.nodes) && !parsed.edges)) {
                  // Load Script
                  setAppMode('SCRIPT');
                  setNodes(parsed.nodes);
                  setScriptTitle(parsed.title || file.name.replace('.json', ''));
                  if (parsed.viewOptions) setViewOptions(parsed.viewOptions);
                  setScriptZoom(parsed.zoom || 1.0);
                  setScriptFileHandle(handle);
                  setScriptHistory([parsed.nodes]);
                  setScriptHistoryIndex(0);
                  setSelectedNodeId(null);
              } else if (parsed.fileType === 'OUTLINE' || (Array.isArray(parsed.nodes) && parsed.edges)) {
                  // Load Outline
                  setAppMode('OUTLINE');
                  setOutlineNodes(parsed.nodes);
                  setOutlineEdges(parsed.edges || []);
                  setOutlineTitle(parsed.title || file.name.replace('.json', ''));
                  setOutlineZoom(parsed.zoom || 1.0);
                  setOutlineFileHandle(handle);
                  setOutlineHistory([{ nodes: parsed.nodes, edges: parsed.edges || [] }]);
                  setOutlineHistoryIndex(0);
                  setSelectedOutlineNodeId(null);
              } else {
                  alert("Unknown file format.");
              }
          } catch (e: any) { if (e.name !== 'AbortError') console.error(e); }
      } else {
          if (fileInputRef.current) fileInputRef.current.click();
      }
  };

  // Export Logic Wrapper
  const handleExport = (format: 'json' | 'excel' | 'png') => {
      if (appMode === 'SCRIPT') {
          if (format === 'json') exportToJson(nodes, scriptTitle);
          if (format === 'excel') exportToExcel(nodes, scriptTitle);
          if (format === 'png') exportToPng(scriptViewMode === 'GRAPH' ? 'graph-canvas-container' : 'table-container', scriptTitle);
      } else {
           // Outline export logic
           if (format === 'json') exportToJson(outlineNodes as any, outlineTitle); // Raw dump
           if (format === 'png') exportToPng('outline-canvas-container', outlineTitle);
           if (format === 'excel') alert("Excel export not available for Outline mode yet.");
      }
  };


  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 text-slate-900 font-sans">
      <input type="file" ref={fileInputRef} className="hidden" />

      <Toolbar 
        appMode={appMode}
        setAppMode={setAppMode}
        viewMode={scriptViewMode}
        setViewMode={setScriptViewMode}
        
        // Common
        onAddNode={appMode === 'SCRIPT' ? handleAddNode : handleAddOutlineNode}
        onExport={handleExport}
        isAutoSaved={isAutoSaved}
        
        // Settings
        viewOptions={viewOptions}
        onToggleViewOption={(k) => setViewOptions(p => ({...p, [k]: !p[k]}))}
        filterOptions={filterOptions}
        onFilterChange={(k, v) => setFilterOptions(p => ({...p, [k]: v}))}
        
        // Zoom
        zoom={appMode === 'SCRIPT' ? scriptZoom : outlineZoom}
        onZoomChange={appMode === 'SCRIPT' ? setScriptZoom : setOutlineZoom}
        
        // Project
        projectTitle={appMode === 'SCRIPT' ? scriptTitle : outlineTitle}
        setProjectTitle={appMode === 'SCRIPT' ? setScriptTitle : setOutlineTitle}
        onNewProject={handleNewProject}
        onSaveProject={handleSaveProject}
        onSaveAs={handleSaveAs}
        onOpenProject={handleOpenProjectClick}
        
        // History
        canUndo={appMode === 'SCRIPT' ? scriptHistoryIndex > 0 : outlineHistoryIndex > 0}
        canRedo={appMode === 'SCRIPT' ? scriptHistoryIndex < scriptHistory.length - 1 : outlineHistoryIndex < outlineHistory.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />
      
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col min-w-0">
            {appMode === 'SCRIPT' ? (
                scriptViewMode === 'TABLE' ? (
                    <div id="table-container" className="flex-1 overflow-auto">
                        <TableView 
                            nodes={nodes} 
                            onUpdateNode={handleUpdateNode}
                            onDeleteNode={handleDeleteNode}
                            onSelectNode={setSelectedNodeId}
                            onReorderNodes={handleReorderNodes}
                            selectedNodeId={selectedNodeId}
                            viewOptions={viewOptions}
                            filterOptions={filterOptions}
                            lists={globalLists}
                            zoom={scriptZoom}
                        />
                    </div>
                ) : (
                    <GraphView 
                        nodes={nodes}
                        onUpdateNode={handleUpdateNode}
                        onUpdateNodes={handleUpdateNodes}
                        onSelectNode={setSelectedNodeId}
                        selectedNodeId={selectedNodeId}
                        viewOptions={viewOptions}
                        filterOptions={filterOptions}
                        lists={globalLists}
                        zoom={scriptZoom}
                    />
                )
            ) : (
                <OutlineView 
                    nodes={outlineNodes}
                    edges={outlineEdges}
                    onUpdate={handleUpdateOutline}
                    zoom={outlineZoom}
                    selectedNodeId={selectedOutlineNodeId}
                    onSelectNode={setSelectedOutlineNodeId}
                    onDeleteNode={handleDeleteOutlineNode}
                />
            )}
        </div>

        {appMode === 'SCRIPT' && (
            <Inspector 
                node={nodes.find(n => n.id === selectedNodeId) || null}
                allNodes={nodes}
                onUpdate={handleUpdateNode}
                onClose={() => setSelectedNodeId(null)}
                lists={globalLists}
            />
        )}
        
        {appMode === 'OUTLINE' && (
            <OutlineInspector 
                node={outlineNodes.find(n => n.id === selectedOutlineNodeId) || null}
                onUpdate={handleUpdateOutlineNode}
                onDelete={handleDeleteOutlineNode}
                onClose={() => setSelectedOutlineNodeId(null)}
            />
        )}
      </div>
    </div>
  );
};

export default App;
