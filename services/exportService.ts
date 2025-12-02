
import { ScriptNode, NodeType, ProjectFile } from "../types";

declare const XLSX: any;
declare const html2canvas: any;

// Helper to trigger download
const downloadFile = (content: string, fileName: string, contentType: string) => {
  const a = document.createElement("a");
  const file = new Blob([content], { type: contentType });
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
};

// --- Full Project Save ---
export const saveProjectFile = (projectData: ProjectFile) => {
    const jsonString = JSON.stringify(projectData, null, 2);
    downloadFile(jsonString, `${projectData.title.replace(/\s+/g, '_')}.json`, 'application/json');
};

// --- Export just the data (for game engines) ---
export const exportToJson = (nodes: ScriptNode[], title: string = "story_script") => {
  const jsonString = JSON.stringify(nodes, null, 2);
  downloadFile(jsonString, `${title}_data.json`, 'application/json');
};

export const exportToExcel = (nodes: ScriptNode[], title: string = "story_script") => {
  if (typeof XLSX === 'undefined') {
    alert("Excel library not loaded. Please refresh.");
    return;
  }

  // Flatten data for Excel
  const rows = nodes.map(node => {
    // Basic fields
    const row: any = {
      ID: node.id,
      Type: node.type,
      Character: node.character,
      Text: node.text,
      Scene: node.scene || '',
      Sprite: node.characterArt || '',
      Expression: node.expression || '',
      NextNode: node.nextId || ''
    };

    // Format choices into a string if present
    if (node.type === NodeType.CHOICE && node.choices.length > 0) {
      row.Choices = node.choices.map(c => `[${c.label} -> ${c.targetNodeId || 'None'}]`).join('; ');
    } else {
      row.Choices = '';
    }

    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Script");
  XLSX.writeFile(workbook, `${title}.xlsx`);
};

export const exportToPng = async (elementId: string, title: string = "story_flowchart") => {
  if (typeof html2canvas === 'undefined') {
    alert("Image library not loaded. Please refresh.");
    return;
  }

  const element = document.getElementById(elementId);
  if (!element) return;

  try {
    // Capture the element
    const canvas = await html2canvas(element, {
      backgroundColor: '#f8fafc', // match bg-slate-50
      scale: 2, // higher resolution
      ignoreElements: (element: Element) => {
        // Ignore the floating toolbar controls in the corner
        return element.classList.contains('graph-controls');
      }
    });

    const link = document.createElement('a');
    link.download = `${title}.png`;
    link.href = canvas.toDataURL();
    link.click();
  } catch (err) {
    console.error("Export failed", err);
    alert("Failed to export image.");
  }
};
