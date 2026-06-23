"use client";

import { useMemo } from "react";
import { useStore } from "../lib/store";
import type { Folder, NoteFile } from "../lib/types";
import { ChevronLeftIcon } from "./icons";

const W = 1600;
const H = 1100;

type MNode = {
  id: string;
  kind: "folder" | "file";
  label: string;
  color: string;
  folder?: Folder;
  file?: NoteFile;
  children: MNode[];
  x: number;
  y: number;
  depth: number;
  _px?: number;
  _py?: number;
};

export default function MindMap() {
  const { state, dispatch } = useStore();

  const selectedFolder = state.currentFolderId
    ? state.folders.find((f) => f.id === state.currentFolderId) ?? null
    : null;

  const rootFolders = useMemo(
    () => state.folders.filter((f) => !f.parentId),
    [state.folders]
  );

  if (state.folders.length === 0) {
    return (
      <div className="p-10 fade-in">
        <h1 className="text-2xl font-semibold">Mind map</h1>
        <p className="text-sm text-[var(--muted)] mt-2">
          Add a folder to see it on the mind map.
        </p>
      </div>
    );
  }

  const goBack = () => {
    if (selectedFolder) {
      dispatch({
        type: "SET_VIEW",
        payload: {
          view: "folder",
          folderId: selectedFolder.id,
          fileId: null,
        },
      });
    } else {
      dispatch({
        type: "SET_VIEW",
        payload: { view: "dashboard", folderId: null, fileId: null },
      });
    }
  };

  return (
    <div className="h-full w-full fade-in flex flex-col">
      <div className="px-6 pt-4 pb-2 flex items-center gap-3">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-[var(--surface-2)] text-sm transition"
        >
          <ChevronLeftIcon size={14} /> Back
        </button>
        <div className="text-sm text-[var(--muted)] truncate">
          {selectedFolder
            ? `Mind map · ${selectedFolder.name}`
            : "Mind map · All folders"}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {selectedFolder ? (
          <FolderMindMap folder={selectedFolder} />
        ) : (
          <div className="flex flex-col gap-8 p-6">
            {rootFolders.map((folder) => (
              <div key={folder.id}>
                <div
                  className="text-xs uppercase tracking-[0.15em] mb-2 font-medium"
                  style={{ color: folder.color }}
                >
                  {folder.name}
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                  <FolderMindMap folder={folder} compact />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FolderMindMap({
  folder,
  compact = false,
}: {
  folder: Folder;
  compact?: boolean;
}) {
  const { state, dispatch } = useStore();
  const cx = W / 2;
  const cy = H / 2;

  const tree = useMemo(
    () => buildTree(folder, state.folders, state.files),
    [folder, state.folders, state.files]
  );

  const maxDepth = treeDepth(tree);

  // Concentric ring radii grow with depth; deeper rings are farther out.
  const ringRadius = (depth: number) => {
    if (depth === 0) return 0;
    const base = 240;
    const step = Math.max(120, 220 - depth * 25);
    return base + (depth - 1) * step;
  };

  layoutTree(tree, cx, cy, ringRadius);

  const edges: Array<{
    from: MNode;
    to: MNode;
    color: string;
    dashed: boolean;
  }> = [];
  walk(tree, (node) => {
    node.children.forEach((c) => {
      edges.push({
        from: node,
        to: c,
        color: c.kind === "folder" ? c.color : "var(--border)",
        dashed: c.kind === "file",
      });
    });
  });

  const allNodes: MNode[] = [];
  walk(tree, (n) => allNodes.push(n));

  // Bounds → fit viewBox so nothing clips when depth is large.
  const pad = 60;
  const minX = Math.min(...allNodes.map((n) => n.x)) - pad;
  const maxX = Math.max(...allNodes.map((n) => n.x)) + pad;
  const minY = Math.min(...allNodes.map((n) => n.y)) - pad;
  const maxY = Math.max(...allNodes.map((n) => n.y)) + pad;
  const vbW = Math.max(W, maxX - minX);
  const vbH = Math.max(H, maxY - minY);
  const vbX = minX - (vbW - (maxX - minX)) / 2;
  const vbY = minY - (vbH - (maxY - minY)) / 2;

  return (
    <svg
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      className={compact ? "w-full" : "w-full h-full"}
      style={
        compact
          ? { maxHeight: 360 }
          : { minHeight: 540, height: Math.min(900, 300 + maxDepth * 180) }
      }
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Edges first so nodes sit on top */}
      {edges.map((e, i) => (
        <line
          key={i}
          x1={e.from.x}
          y1={e.from.y}
          x2={e.to.x}
          y2={e.to.y}
          stroke={e.color}
          strokeWidth={e.dashed ? 1 : 1.3}
          strokeDasharray={e.dashed ? "2 4" : undefined}
          opacity={e.dashed ? 1 : 0.7}
        />
      ))}

      {/* Nodes */}
      {allNodes.map((n) => {
        if (n === tree) return null; // root rendered last
        if (n.kind === "file" && n.file) {
          return (
            <FileNode
              key={n.id}
              node={n}
              folderId={folder.id}
              onOpen={(fid, fileId) =>
                dispatch({
                  type: "SET_VIEW",
                  payload: {
                    view: "editor",
                    folderId: fid,
                    fileId,
                  },
                })
              }
              // Files belong to their parent folder in the tree.
              parentFolderId={(n.file as NoteFile).folderId}
            />
          );
        }
        if (n.kind === "folder" && n.folder) {
          return (
            <FolderNode
              key={n.id}
              node={n}
              isRoot={false}
              onOpen={(fid) =>
                dispatch({
                  type: "SET_VIEW",
                  payload: { view: "folder", folderId: fid },
                })
              }
            />
          );
        }
        return null;
      })}

      {/* Root node on top so its label is never overlapped */}
      <FolderNode
        node={tree}
        isRoot
        onOpen={(fid) =>
          dispatch({
            type: "SET_VIEW",
            payload: { view: "folder", folderId: fid },
          })
        }
      />
    </svg>
  );
}

function FolderNode({
  node,
  isRoot,
  onOpen,
}: {
  node: MNode;
  isRoot: boolean;
  onOpen: (id: string) => void;
}) {
  const r = isRoot ? 48 : Math.max(22, 36 - node.depth * 3);
  const fontSize = isRoot ? 13 : Math.max(8, 11 - Math.max(0, node.depth - 1));
  const lines = wrapLabel(node.label, isRoot ? 12 : 11);
  const lineHeight = fontSize + 2;
  const totalH = (lines.length - 1) * lineHeight;
  return (
    <g
      className="cursor-pointer"
      onClick={() => onOpen(node.folder!.id)}
    >
      <circle
        cx={node.x}
        cy={node.y}
        r={r + (isRoot ? 6 : 4)}
        fill={node.color}
        opacity={isRoot ? 0.18 : 0.12}
      />
      <circle
        cx={node.x}
        cy={node.y}
        r={r}
        fill={isRoot ? node.color : "var(--surface)"}
        stroke={node.color}
        strokeWidth={isRoot ? 2 : 2.2}
      />
      <text
        x={node.x}
        y={node.y - totalH / 2 + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={fontSize}
        fontWeight={isRoot ? 700 : 600}
        fill={isRoot ? "#fff" : "var(--foreground)"}
        style={{ pointerEvents: "none" }}
      >
        {lines.map((line, i) => (
          <tspan key={i} x={node.x} dy={i === 0 ? 0 : lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function FileNode({
  node,
  folderId: _rootFolderId,
  parentFolderId,
  onOpen,
}: {
  node: MNode;
  folderId: string;
  parentFolderId: string;
  onOpen: (folderId: string, fileId: string) => void;
}) {
  const fileR = 11;
  // Push label outward along the radial direction.
  const dx = node.x - (node._px ?? node.x);
  const dy = node.y - (node._py ?? node.y);
  const len = Math.hypot(dx, dy) || 1;
  const lx = node.x + 18 * (dx / len);
  const ly = node.y + 18 * (dy / len);
  const anchor =
    dx / len > 0.3 ? "start" : dx / len < -0.3 ? "end" : "middle";
  const isDone = !!node.file?.isCompleted;
  return (
    <g
      className="cursor-pointer"
      onClick={() => onOpen(parentFolderId, node.file!.id)}
    >
      {isDone ? (
        <>
          <circle
            cx={node.x}
            cy={node.y}
            r={fileR}
            fill="var(--success)"
            opacity={0.18}
          />
          <circle
            cx={node.x}
            cy={node.y}
            r={fileR}
            fill="none"
            stroke="var(--success)"
            strokeWidth={2}
          />
          <path
            d={`M ${node.x - 4} ${node.y} L ${node.x - 1} ${node.y + 3} L ${node.x + 5} ${node.y - 3}`}
            stroke="var(--success)"
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <circle
          cx={node.x}
          cy={node.y}
          r={fileR}
          fill="var(--surface)"
          stroke="var(--border)"
          strokeWidth={1.5}
        />
      )}
      <text
        x={lx}
        y={ly}
        fill="var(--muted)"
        fontSize={12}
        dominantBaseline="middle"
        textAnchor={anchor}
        style={{ pointerEvents: "none" }}
      >
        {truncate(node.label.replace(/\.md$/i, ""), 16)}
      </text>
    </g>
  );
}

/* ----------------------- Tree helpers ----------------------- */

function buildTree(
  folder: Folder,
  folders: Folder[],
  files: NoteFile[]
): MNode {
  const buildFolder = (f: Folder, depth: number): MNode => {
    const subs = folders.filter((x) => x.parentId === f.id);
    const ff = files.filter((x) => x.folderId === f.id);
    return {
      id: f.id,
      kind: "folder",
      label: f.name,
      color: f.color,
      folder: f,
      depth,
      x: 0,
      y: 0,
      children: [
        ...subs.map((s) => buildFolder(s, depth + 1)),
        ...ff.map<MNode>((file) => ({
          id: file.id,
          kind: "file",
          label: file.title,
          color: f.color,
          file,
          depth: depth + 1,
          x: 0,
          y: 0,
          children: [],
        })),
      ],
    };
  };
  return buildFolder(folder, 0);
}

function treeDepth(node: MNode): number {
  if (node.children.length === 0) return node.depth;
  return Math.max(...node.children.map(treeDepth));
}

function walk(node: MNode, cb: (n: MNode) => void) {
  cb(node);
  node.children.forEach((c) => walk(c, cb));
}

function layoutTree(
  root: MNode,
  cx: number,
  cy: number,
  ringRadius: (depth: number) => number
) {
  root.x = cx;
  root.y = cy;
  // Allocate full circle to the root's children, starting from the top.
  const N = root.children.length;
  if (N === 0) return;
  root.children.forEach((child, i) => {
    const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
    placeNode(child, cx, cy, angle, ringRadius);
    const childSpan = (Math.PI * 2) / Math.max(N, 1);
    layoutChildren(
      child,
      angle,
      Math.min(childSpan * 1.1, Math.PI * 0.9),
      ringRadius
    );
  });
}

function placeNode(
  node: MNode,
  parentX: number,
  parentY: number,
  angle: number,
  ringRadius: (depth: number) => number
) {
  const r = ringRadius(node.depth);
  // Distance from root center if we use polar coords from center, but we
  // want each ring to expand from root. We pre-set node.x relative to
  // a central anchor — here we project from the parent along the outward
  // angle so deeper levels fan outward neatly.
  node.x = parentX + (r - ringRadius(node.depth - 1)) * Math.cos(angle);
  node.y = parentY + (r - ringRadius(node.depth - 1)) * Math.sin(angle);
  node._px = parentX;
  node._py = parentY;
}

function layoutChildren(
  node: MNode,
  outwardAngle: number,
  span: number,
  ringRadius: (depth: number) => number
) {
  const N = node.children.length;
  if (N === 0) return;
  const startAngle = outwardAngle - span / 2;
  // For a single child, place it exactly along the parent's outward direction.
  // For multiple, distribute evenly within the sector.
  node.children.forEach((child, i) => {
    const t = N === 1 ? 0.5 : i / (N - 1);
    const angle = startAngle + t * span;
    placeNode(child, node.x, node.y, angle, ringRadius);
    const subSpan = Math.min(span / Math.max(N, 1) * 1.3, Math.PI * 0.7);
    layoutChildren(child, angle, subSpan, ringRadius);
  });
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function wrapLabel(name: string, maxLen: number): string[] {
  const trimmed = name.trim();
  if (trimmed.length <= maxLen) return [trimmed];
  const words = trimmed.split(/\s+/);
  if (words.length === 1) return [trimmed];
  let bestSplit = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ").length;
    const b = words.slice(i).join(" ").length;
    const diff = Math.abs(a - b);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestSplit = i;
    }
  }
  return [
    words.slice(0, bestSplit).join(" "),
    words.slice(bestSplit).join(" "),
  ];
}
