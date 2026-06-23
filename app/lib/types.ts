export interface Folder {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  parentId?: string | null;
}

export interface NoteFile {
  id: string;
  folderId: string;
  title: string;
  content: string;
  isCompleted: boolean;
  updatedAt: number;
}

export interface StreakState {
  count: number;
  lastDate: string | null;
}

export type View = "dashboard" | "folder" | "editor" | "progress" | "mindmap";

// Monochrome palette — folders no longer have a visible per-folder color.
// The field is kept on the type for backwards-compat with existing data.
export const FOLDER_COLORS = ["#111111"];
