
import React, { useState } from 'react';
import { LayoutGrid, Network, Download, Plus, Filter, Eye, Palette, ChevronDown, FileJson, FileSpreadsheet, Image as ImageIcon, Minus, Search, FolderOpen, Save, FilePlus, Undo2, Redo2, Presentation, ScrollText, PenTool, CheckCircle, Clock, StickyNote } from 'lucide-react';
import { ViewMode, ViewOptions, FilterOptions, AppMode } from '../types';

interface ToolbarProps {
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;

  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  onAddNode: () => void;
  onExport: (format: 'json' | 'excel' | 'png') => void;
  
  viewOptions: ViewOptions;
  onToggleViewOption: (key: keyof ViewOptions) => void;
  
  filterOptions: FilterOptions;
  onFilterChange: (key: keyof FilterOptions, value: string) => void;
  
  zoom: number;
  onZoomChange: (zoom: number) => void;

  // File & Project Props
  projectTitle: string;
  setProjectTitle: (title: string) => void;
  onNewProject: () => void;
  onSaveProject: () => void;
  onSaveAs: () => void;
  onOpenProject: () => void;
  isAutoSaved: boolean;

  // History Props
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ 
  appMode,
  setAppMode,
  viewMode, 
  setViewMode, 
  onAddNode, 
  onExport,
  viewOptions,
  onToggleViewOption,
  filterOptions,
  onFilterChange,
  zoom,
  onZoomChange,
  projectTitle,
  setProjectTitle,
  onNewProject,
  onSaveProject,
  onSaveAs,
  onOpenProject,
  isAutoSaved,
  canUndo,
  canRedo,
  onUndo,
  onRedo
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);

  const activeFiltersCount = Object.values(filterOptions).filter(Boolean).length;

  const handleZoomIn = () => onZoomChange(Math.min(zoom + 0.1, 2.0));
  const handleZoomOut = () => onZoomChange(Math.max(zoom - 0.1, 0.5));
  const handleZoomReset = () => onZoomChange(1.0);

  return (
    <div className="flex flex-col border-b border-slate-200 bg-white z-20 shadow-sm relative">
      {/* Top Bar */}
      <div className="h-16 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-6">
          
          {/* Main Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
             <button
                onClick={() => setAppMode('SCRIPT')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-all ${
                    appMode === 'SCRIPT' 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
             >
                <ScrollText size={16} />
                Script
             </button>
             <button
                onClick={() => setAppMode('OUTLINE')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-all ${
                    appMode === 'OUTLINE' 
                    ? 'bg-emerald-600 text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
             >
                <Presentation size={16} />
                Outline
             </button>
          </div>

          <div className="h-6 w-px bg-slate-200"></div>

          {/* File & Title Area */}
          <div className="flex items-center gap-3">
             {/* File Menu */}
             <div className="relative">
                <button 
                    onClick={() => setShowFileMenu(!showFileMenu)}
                    className="flex items-center gap-1 text-slate-700 font-bold hover:bg-slate-100 px-2 py-1 rounded transition-colors"
                >
                    File
                    <ChevronDown size={14} className="text-slate-400" />
                </button>
                
                {showFileMenu && (
                    <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50">
                        <button onClick={() => { onNewProject(); setShowFileMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm text-slate-700 flex items-center gap-2">
                            <FilePlus size={14} /> New {appMode === 'SCRIPT' ? 'Script' : 'Outline'}
                        </button>
                        <button onClick={() => { onOpenProject(); setShowFileMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm text-slate-700 flex items-center gap-2">
                            <FolderOpen size={14} /> Open File...
                        </button>
                        <div className="border-t border-slate-100 my-1"></div>
                        <button onClick={() => { onSaveProject(); setShowFileMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm text-slate-700 flex items-center gap-2">
                            <Save size={14} /> Save {appMode === 'SCRIPT' ? 'Script' : 'Outline'}
                        </button>
                        <button onClick={() => { onSaveAs(); setShowFileMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm text-slate-700 flex items-center gap-2 pl-9">
                             Save As...
                        </button>
                    </div>
                )}
             </div>

             {/* Undo / Redo */}
             <div className="flex items-center gap-1 ml-1">
                 <button 
                    onClick={onUndo} 
                    disabled={!canUndo}
                    className="p-1.5 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Undo"
                 >
                    <Undo2 size={18} />
                 </button>
                 <button 
                    onClick={onRedo} 
                    disabled={!canRedo}
                    className="p-1.5 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Redo"
                 >
                    <Redo2 size={18} />
                 </button>
             </div>

             <div className="h-5 w-px bg-slate-200 mx-1"></div>

             {/* Editable Title */}
             <input 
                type="text"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                className="text-lg font-semibold text-slate-700 bg-transparent border border-transparent hover:border-slate-300 focus:border-indigo-500 rounded px-2 py-0.5 outline-none transition-colors w-64 truncate"
                placeholder={appMode === 'SCRIPT' ? "Script Name" : "Outline Name"}
             />

             {/* Autosave Status */}
             <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium select-none ml-2">
                {isAutoSaved ? (
                    <>
                        <CheckCircle size={12} className="text-green-500" />
                        <span>Saved</span>
                    </>
                ) : (
                    <>
                        <Clock size={12} className="animate-pulse text-amber-500" />
                        <span>...</span>
                    </>
                )}
             </div>
          </div>
          
          {/* Script Mode View Toggle */}
          {appMode === 'SCRIPT' && (
            <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200 ml-4">
                <button
                onClick={() => setViewMode('TABLE')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'TABLE' 
                    ? 'bg-white text-slate-800 shadow-sm border border-slate-200' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                >
                <LayoutGrid size={16} />
                Table
                </button>
                <button
                onClick={() => setViewMode('GRAPH')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'GRAPH' 
                    ? 'bg-white text-slate-800 shadow-sm border border-slate-200' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                >
                <Network size={16} />
                Graph
                </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
            
            {/* Zoom Controls */}
            <div className="flex items-center bg-white border border-slate-200 rounded-lg mr-2">
                <button 
                    onClick={handleZoomOut} 
                    className="p-2 hover:bg-slate-50 text-slate-600 border-r border-slate-100"
                    title="Zoom Out"
                >
                    <Minus size={14} />
                </button>
                <button 
                    onClick={handleZoomReset}
                    className="px-3 py-2 text-xs font-mono font-medium text-slate-600 min-w-[3rem] text-center hover:bg-slate-50"
                    title="Reset Zoom"
                >
                    {Math.round(zoom * 100)}%
                </button>
                <button 
                    onClick={handleZoomIn} 
                    className="p-2 hover:bg-slate-50 text-slate-600 border-l border-slate-100"
                    title="Zoom In"
                >
                    <Plus size={14} />
                </button>
            </div>

          {/* Script Options (Only show in Script Mode) */}
          {appMode === 'SCRIPT' && (
              <>
                <div className="relative">
                    <button
                    onClick={() => setShowViewMenu(!showViewMenu)}
                    className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${showViewMenu ? 'bg-slate-100 border-slate-300 text-slate-900' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'}`}
                    >
                    <Eye size={16} />
                    Fields
                    </button>
                    
                    {showViewMenu && (
                    <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-slate-200 py-2 z-50">
                        <div className="px-3 pb-2 mb-2 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase">Visible Fields</div>
                        <label className="flex items-center px-4 py-2 hover:bg-slate-50 cursor-pointer">
                        <input type="checkbox" checked={viewOptions.showScene} onChange={() => onToggleViewOption('showScene')} className="mr-2 rounded text-indigo-600 focus:ring-indigo-500" />
                        <span className="text-sm text-slate-700">Scene / BG</span>
                        </label>
                        <label className="flex items-center px-4 py-2 hover:bg-slate-50 cursor-pointer">
                        <input type="checkbox" checked={viewOptions.showArt} onChange={() => onToggleViewOption('showArt')} className="mr-2 rounded text-indigo-600 focus:ring-indigo-500" />
                        <span className="text-sm text-slate-700">Character Art</span>
                        </label>
                        <label className="flex items-center px-4 py-2 hover:bg-slate-50 cursor-pointer">
                        <input type="checkbox" checked={viewOptions.showExpression} onChange={() => onToggleViewOption('showExpression')} className="mr-2 rounded text-indigo-600 focus:ring-indigo-500" />
                        <span className="text-sm text-slate-700">Expression</span>
                        </label>
                        <label className="flex items-center px-4 py-2 hover:bg-slate-50 cursor-pointer">
                        <input type="checkbox" checked={viewOptions.showLogic} onChange={() => onToggleViewOption('showLogic')} className="mr-2 rounded text-indigo-600 focus:ring-indigo-500" />
                        <span className="text-sm text-slate-700">Flow Logic</span>
                        </label>
                        <div className="my-2 border-t border-slate-100" />
                        <label className="flex items-center px-4 py-2 hover:bg-slate-50 cursor-pointer">
                        <input type="checkbox" checked={viewOptions.enableColorCoding} onChange={() => onToggleViewOption('enableColorCoding')} className="mr-2 rounded text-indigo-600 focus:ring-indigo-500" />
                        <div className="flex items-center gap-2">
                            <Palette size={14} className="text-slate-500" />
                            <span className="text-sm text-slate-700">Color Coding</span>
                        </div>
                        </label>
                    </div>
                    )}
                </div>

                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${showFilters || activeFiltersCount > 0 ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'}`}
                >
                    <Filter size={16} />
                    Filter
                    {activeFiltersCount > 0 && (
                    <span className="bg-indigo-600 text-white text-[10px] px-1.5 rounded-full min-w-[1.25rem] text-center">
                        {activeFiltersCount}
                    </span>
                    )}
                </button>
              </>
          )}

          <div className="h-6 w-px bg-slate-200 mx-1" />

          {/* Add Node Button (Dynamic based on mode) */}
          <button
            onClick={onAddNode}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm text-white ${appMode === 'SCRIPT' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
          >
            <Plus size={16} />
            {appMode === 'SCRIPT' ? 'Add Node' : 'Add Card'}
          </button>
          
          {/* Export Menu */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
            >
              <Download size={16} />
              Export
              <ChevronDown size={14} className="text-slate-400" />
            </button>
            
            {showExportMenu && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50">
                 <div className="px-4 py-2 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                     Export Current Data
                 </div>
                 <button onClick={() => { onExport('json'); setShowExportMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm text-slate-700 flex items-center gap-2">
                    <FileJson size={14} /> JSON ({appMode === 'SCRIPT' ? 'Script' : 'Outline'})
                 </button>
                 {appMode === 'SCRIPT' && (
                    <button onClick={() => { onExport('excel'); setShowExportMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm text-slate-700 flex items-center gap-2">
                        <FileSpreadsheet size={14} /> Excel (Table)
                    </button>
                 )}
                 <button onClick={() => { onExport('png'); setShowExportMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm text-slate-700 flex items-center gap-2">
                    <ImageIcon size={14} /> PNG (Screenshot)
                 </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter Bar (Script Only) */}
      {showFilters && appMode === 'SCRIPT' && (
        <div className="bg-slate-50 border-t border-slate-200 p-4 grid grid-cols-4 gap-4 animate-in slide-in-from-top-2 duration-200">
           <div className="space-y-1">
             <label className="text-xs font-semibold text-slate-500 uppercase">Character</label>
             <input 
                list="list-characters"
                value={filterOptions.character}
                onChange={(e) => onFilterChange('character', e.target.value)}
                placeholder="Filter by Name..."
                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
             />
           </div>
           <div className="space-y-1">
             <label className="text-xs font-semibold text-slate-500 uppercase">Scene / BG</label>
             <input 
                list="list-scenes"
                value={filterOptions.scene}
                onChange={(e) => onFilterChange('scene', e.target.value)}
                placeholder="Filter by Scene ID..."
                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
             />
           </div>
           <div className="space-y-1">
             <label className="text-xs font-semibold text-slate-500 uppercase">Art / Sprite</label>
             <input 
                list="list-arts"
                value={filterOptions.characterArt}
                onChange={(e) => onFilterChange('characterArt', e.target.value)}
                placeholder="Filter by Sprite ID..."
                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
             />
           </div>
           <div className="space-y-1">
             <label className="text-xs font-semibold text-slate-500 uppercase">Expression</label>
             <input 
                list="list-expressions"
                value={filterOptions.expression}
                onChange={(e) => onFilterChange('expression', e.target.value)}
                placeholder="Filter by Expression..."
                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
             />
           </div>
        </div>
      )}
    </div>
  );
};
