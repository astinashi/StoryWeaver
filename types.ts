
export enum NodeType {
  DIALOGUE = 'DIALOGUE',
  MONOLOGUE = 'MONOLOGUE',
  CHOICE = 'CHOICE',
  END = 'END',
  START = 'START'
}

export interface ChoiceOption {
  id: string;
  label: string;
  targetNodeId: string | null;
}

export interface ScriptNode {
  id: string;
  type: NodeType;
  character: string;
  text: string;
  
  // Visual Asset Fields
  scene?: string;       // Background ID/Name
  characterArt?: string; // Sprite/Tachie ID
  expression?: string;   // Facial expression
  
  choices: ChoiceOption[]; // Only used if type === CHOICE
  nextId: string | null;   // Used for DIALOGUE/START
  position: { x: number; y: number };
  metadata?: Record<string, any>; // For extra JSON fields
}

export interface ProjectData {
  title: string;
  nodes: ScriptNode[];
  zoom: number;
  pan: { x: number; y: number };
}

// Full save file structure
export interface ProjectFile extends ProjectData {
  version: string;
  lastModified: number;
  viewOptions: ViewOptions;
}

export type ViewMode = 'TABLE' | 'GRAPH';

export interface ViewOptions {
  showScene: boolean;
  showArt: boolean;
  showExpression: boolean;
  showLogic: boolean;
  enableColorCoding: boolean;
}

export interface FilterOptions {
  scene: string;
  character: string;
  characterArt: string;
  expression: string;
}

export interface GlobalLists {
  knownCharacters: string[];
  knownScenes: string[];
  knownArts: string[];
  knownExpressions: string[];
}

// Helper to generate a human-readable label for a node
export const getNodeLabel = (node: ScriptNode): string => {
  let prefix = node.character;
  
  // Custom prefixes for specific types
  if (node.type === NodeType.START) prefix = 'START';
  else if (node.type === NodeType.END) prefix = 'END';
  else if (!prefix && node.type === NodeType.MONOLOGUE) prefix = 'Internal';
  else if (!prefix) prefix = '???';

  const textPreview = node.text 
    ? (node.text.length > 25 ? node.text.slice(0, 25) + '...' : node.text) 
    : '';
  
  // Format: "Hero: Hello world... (#a1b2)"
  // If text is empty, just show ID suffix
  return `${prefix}${textPreview ? ': "' + textPreview + '"' : ''} #${node.id.slice(-4)}`;
};

// --- File System Access API Types (Polyfill-ish) ---
export interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
  isSameEntry: (other: FileSystemHandle) => Promise<boolean>;
}

export interface FileSystemFileHandle extends FileSystemHandle {
  kind: 'file';
  getFile: () => Promise<File>;
  createWritable: () => Promise<FileSystemWritableFileStream>;
}

export interface FileSystemWritableFileStream extends WritableStream {
  write: (data: any) => Promise<void>;
  seek: (position: number) => Promise<void>;
  truncate: (size: number) => Promise<void>;
}
