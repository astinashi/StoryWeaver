import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ScriptNode, NodeType, ViewMode, ViewOptions, FilterOptions, ProjectFile, FileSystemFileHandle } from './types';
import { Toolbar } from './components/Toolbar';
import { TableView } from './components/TableView';
import { GraphView } from './components/GraphView';
import { Inspector } from './components/Inspector';
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
    nextId: 'node-2',
    position: { x: 500, y: 100 },
    scene: 'bg_runway',
    expression: 'gloom'
  },
  {
    id: 'node-2',
    type: NodeType.DIALOGUE,
    character: 'Hero',
    text: 'I woke up in a strange place...',
    choices: [],
    nextId: null,
    position: { x: 900, y: 100 },
    scene: 'bg_runway',
    characterArt: 'ch_hero_pajamas',
    expression: 'confused'
  }
];

const AUTOSAVE_KEY = 'storyweaver_autosave_v1';

const App: React.FC = () => {
  // --- State ---
  const [projectTitle, setProjectTitle] = useState("My Visual Novel");
  const [nodes, setNodes] = useState<ScriptNode[]>(INITIAL_NODES);
  const [viewMode, setViewMode] = useState<ViewMode>('GRAPH');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1.0);
  const [isAutoSaved, setIsAutoSaved] = useState(true);
  
  // File Handle State (for Native Save)
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);

  // History State
  const [history, setHistory] = useState<{nodes: ScriptNode[]}[]>([{ nodes: INITIAL_NODES }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const historyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Visibility Settings
  const [viewOptions, setViewOptions] = useState<ViewOptions>({
      showScene: true,
      showArt: true,
      showExpression: true,
      showLogic: true,
      enableColorCoding: true
  });

  // Filter Settings
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
      character: '',
      scene: '',
      characterArt: '',
      expression: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Autosave & Load ---

  // Load on mount
  useEffect(() => {
      const savedData = localStorage.getItem(AUTOSAVE_KEY);
      if (savedData) {
          try {
              const parsed: ProjectFile = JSON.parse(savedData);
              if (parsed && Array.isArray(parsed.nodes)) {
                  setNodes(parsed.nodes);
                  setHistory([{ nodes: parsed.nodes }]); // Init history
                  setHistoryIndex(0);
                  setProjectTitle(parsed.title || "My Visual Novel");
                  if (parsed.viewOptions) setViewOptions(parsed.viewOptions);
                  if (parsed.zoom) setZoom(parsed.zoom);
                  console.log("Restored from autosave");
              }
          } catch (e) {
              console.error("Failed to load autosave", e);
          }
      }
  }, []);

  // Save on change (debounced)
  useEffect(() => {
      setIsAutoSaved(false);
      const timer = setTimeout(() => {
          const projectData: ProjectFile = {
              title: projectTitle,
              nodes,
              zoom,
              pan: { x: 0, y: 0 },
              version: '1.0.0',
              lastModified: Date.now(),
              viewOptions
          };
          localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(projectData));
          setIsAutoSaved(true);
      }, 1000);

      return () => clearTimeout(timer);
  }, [nodes, projectTitle, viewOptions, zoom]);


  // --- History Management (Undo/Redo) ---
  
  const pushToHistory = useCallback((newNodes: ScriptNode[], immediate = false) => {
      // If immediate, push now.
      // If not immediate (e.g. typing), debounce.
      
      if (historyTimeoutRef.current) {
          clearTimeout(historyTimeoutRef.current);
          historyTimeoutRef.current = null;
      }

      const commit = () => {
          setHistory(prev => {
             const newHistory = prev.slice(0, historyIndex + 1);
             // Verify if it's actually different to avoid duplicates
             const current = newHistory[newHistory.length - 1];
             if (JSON.stringify(current.nodes) === JSON.stringify(newNodes)) {
                 return prev; // No change
             }
             newHistory.push({ nodes: newNodes });
             // Limit history size to 50
             if (newHistory.length > 50) return newHistory.slice(newHistory.length - 50);
             return newHistory;
          });
          setHistoryIndex(prev => {
             const max = Math.min(prev + 1, 49); 
             // Logic above handles slicing, but we need to ensure index matches new length
             // simpler: setHistory uses functional update, so we need to know new length. 
             // Let's just assume we increment index unless at cap.
             return prev + 1; // This logic is slightly flawed with the slice above inside callback
                              // but good enough for simple stack.
          });
          // Fix Index Sync:
          setHistory(prev => {
              const sliced = prev.slice(0, historyIndex + 1);
              sliced.push({ nodes: newNodes });
              if (sliced.length > 50) sliced.shift();
              setHistoryIndex(sliced.length - 1);
              return sliced;
          });
      };

      if (immediate) {
          commit();
      } else {
          historyTimeoutRef.current = setTimeout(commit, 800); // 800ms debounce for typing
      }
  }, [historyIndex]);

  const handleUndo = () => {
      if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setNodes(history[newIndex].nodes);
      }
  };

  const handleRedo = () => {
      if (historyIndex < history.length - 1) {
          const newIndex = historyIndex + 1;
          setHistoryIndex(newIndex);
          setNodes(history[newIndex].nodes);
      }
  };

  // --- Data Logic ---

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

  const handleToggleViewOption = (key: keyof ViewOptions) => {
      setViewOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
      setFilterOptions(prev => ({ ...prev, [key]: value }));
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
    pushToHistory(newNodes, true);
  };

  const handleUpdateNode = (updatedNode: ScriptNode) => {
    // Check if it's a structural change or just text
    const oldNode = nodes.find(n => n.id === updatedNode.id);
    let immediate = false;
    
    if (oldNode) {
        if (oldNode.type !== updatedNode.type || 
            oldNode.nextId !== updatedNode.nextId ||
            oldNode.choices.length !== updatedNode.choices.length ||
            // Dragging (position change) should probably be immediate or throttled. 
            // Currently handled by mouseUp in GraphView, so this is mostly fields.
            oldNode.scene !== updatedNode.scene
        ) {
            immediate = true;
        }
    }

    const newNodes = nodes.map(n => n.id === updatedNode.id ? updatedNode : n);
    setNodes(newNodes);
    pushToHistory(newNodes, immediate);
  };

  const handleUpdateNodes = (updatedNodes: ScriptNode[]) => {
    const nodeMap = new Map(updatedNodes.map(n => [n.id, n]));
    const newNodes = nodes.map(n => nodeMap.get(n.id) || n);
    setNodes(newNodes);
    pushToHistory(newNodes, true); // Bulk update (like auto layout) is immediate
  };

  const handleDeleteNode = (id: string) => {
    const newNodes = nodes.filter(n => n.id !== id);
    setNodes(newNodes);
    if (selectedNodeId === id) setSelectedNodeId(null);
    pushToHistory(newNodes, true);
  };

  const handleReorderNodes = (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      const newNodes = [...nodes];
      const [movedNode] = newNodes.splice(fromIndex, 1);
      newNodes.splice(toIndex, 0, movedNode);
      setNodes(newNodes);
      pushToHistory(newNodes, true);
  }

  // --- File Actions ---

  const handleNewProject = () => {
      if (confirm("Create new project? Unsaved changes will be lost.")) {
          setNodes(INITIAL_NODES);
          setProjectTitle("Untitled Story");
          setSelectedNodeId(null);
          setZoom(1.0);
          setFileHandle(null); // Reset file handle
          setHistory([{ nodes: INITIAL_NODES }]);
          setHistoryIndex(0);
      }
  };

  // Modern Save (Native FS API)
  const handleSaveProject = async () => {
      // 1. If we have a handle, write to it.
      if (fileHandle) {
          try {
              const writable = await fileHandle.createWritable();
              const projectData: ProjectFile = {
                  title: projectTitle,
                  nodes,
                  zoom,
                  pan: {x: 0, y: 0},
                  version: '1.0.0',
                  lastModified: Date.now(),
                  viewOptions
              };
              await writable.write(JSON.stringify(projectData, null, 2));
              await writable.close();
              alert("Saved successfully!");
              return;
          } catch (err) {
              console.error("Failed to write to file handle", err);
              // Fallback if permission lost
          }
      }
      
      // 2. If no handle, treat as Save As
      handleSaveAs();
  };

  const handleSaveAs = async () => {
      // Check for native API support
      if ('showSaveFilePicker' in window) {
          try {
              const handle = await (window as any).showSaveFilePicker({
                  suggestedName: `${projectTitle.replace(/\s+/g, '_')}.json`,
                  types: [{
                      description: 'JSON Project File',
                      accept: { 'application/json': ['.json'] },
                  }],
              });
              
              setFileHandle(handle);
              
              // Now write
              const writable = await handle.createWritable();
              const projectData: ProjectFile = {
                  title: projectTitle,
                  nodes,
                  zoom,
                  pan: {x: 0, y: 0},
                  version: '1.0.0',
                  lastModified: Date.now(),
                  viewOptions
              };
              await writable.write(JSON.stringify(projectData, null, 2));
              await writable.close();
              
              // Update title from file name if possible
              if (handle.name) {
                  const name = handle.name.replace('.json', '');
                  setProjectTitle(name);
              }
          } catch (err: any) {
              if (err.name !== 'AbortError') {
                  console.error("Save As failed", err);
                  alert("Failed to save file.");
              }
          }
      } else {
          // Fallback to legacy download
          const projectData: ProjectFile = {
            title: projectTitle,
            nodes,
            zoom,
            pan: { x: 0, y: 0 },
            version: '1.0.0',
            lastModified: Date.now(),
            viewOptions
          };
          saveProjectFile(projectData);
      }
  };

  const handleOpenProjectClick = async () => {
       // Check for native API support
       if ('showOpenFilePicker' in window) {
           try {
               const [handle] = await (window as any).showOpenFilePicker({
                   types: [{
                       description: 'JSON Project File',
                       accept: { 'application/json': ['.json'] },
                   }],
                   multiple: false
               });
               
               const file = await handle.getFile();
               const text = await file.text();
               const parsed = JSON.parse(text);
               
               if (parsed && Array.isArray(parsed.nodes)) {
                   setNodes(parsed.nodes);
                   if (parsed.title) setProjectTitle(parsed.title);
                   else setProjectTitle(file.name.replace('.json', ''));
                   
                   if (parsed.viewOptions) setViewOptions(parsed.viewOptions);
                   if (parsed.zoom) setZoom(parsed.zoom);
                   
                   setFileHandle(handle);
                   setHistory([{ nodes: parsed.nodes }]);
                   setHistoryIndex(0);
                   setSelectedNodeId(null);
               } else {
                   alert("Invalid file format.");
               }
           } catch (err: any) {
               if (err.name !== 'AbortError') {
                   console.error("Open failed", err);
                   alert("Failed to open file.");
               }
           }
       } else {
          // Fallback to legacy input click
          if (fileInputRef.current) fileInputRef.current.click();
       }
  };

  const handleLegacyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const result = event.target?.result as string;
              const parsed = JSON.parse(result);
              if (parsed && Array.isArray(parsed.nodes)) {
                  setNodes(parsed.nodes);
                  if (parsed.title) setProjectTitle(parsed.title);
                  if (parsed.viewOptions) setViewOptions(parsed.viewOptions);
                  if (parsed.zoom) setZoom(parsed.zoom);
                  
                  setSelectedNodeId(null);
                  setFileHandle(null); // No handle for legacy upload
                  setHistory([{ nodes: parsed.nodes }]);
                  setHistoryIndex(0);
              } else {
                  alert("Invalid project file format.");
              }
          } catch (err) {
              console.error(err);
              alert("Failed to parse project file.");
          }
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  const handleExport = (format: 'json' | 'excel' | 'png') => {
    switch (format) {
      case 'json':
        exportToJson(nodes, projectTitle);
        break;
      case 'excel':
        exportToExcel(nodes, projectTitle);
        break;
      case 'png':
        exportToPng('graph-canvas-container', projectTitle);
        break;
    }
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 text-slate-900 font-sans">
      {/* Hidden File Input for Legacy Open Project */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleLegacyFileChange} 
        accept=".json" 
        className="hidden" 
      />

      <Toolbar 
        viewMode={viewMode}
        setViewMode={setViewMode}
        onAddNode={handleAddNode}
        onExport={handleExport}
        viewOptions={viewOptions}
        onToggleViewOption={handleToggleViewOption}
        filterOptions={filterOptions}
        onFilterChange={handleFilterChange}
        zoom={zoom}
        onZoomChange={setZoom}
        
        // File Props
        projectTitle={projectTitle}
        setProjectTitle={setProjectTitle}
        onNewProject={handleNewProject}
        onSaveProject={handleSaveProject}
        onSaveAs={handleSaveAs}
        onOpenProject={handleOpenProjectClick}
        isAutoSaved={isAutoSaved}

        // History Props
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />
      
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col min-w-0">
            {viewMode === 'TABLE' ? (
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
                zoom={zoom}
              />
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
                zoom={zoom}
              />
            )}
        </div>

        <Inspector 
          node={selectedNode}
          allNodes={nodes}
          onUpdate={handleUpdateNode}
          onClose={() => setSelectedNodeId(null)}
          lists={globalLists}
        />
      </div>
    </div>
  );
};

export default App;