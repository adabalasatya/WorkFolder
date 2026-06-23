"use client";

import { useMemo } from "react";
import { useStore } from "../lib/store";
import type { Folder, NoteFile } from "../lib/types";
import { ChevronLeftIcon } from "./icons";

const W = 1400;
const H = 900;

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
  const centerR = 50;
  const childFolderR = 32;
  const fileR = 12;
  const orbitChild = 280;
  const orbitFile = 140;

  const subFolders = state.folders.filter((f) => f.parentId === folder.id);
  const files = state.files.filter((f) => f.folderId === folder.id);

  const children: Array<
    | { kind: "folder"; folder: Folder }
    | { kind: "file"; file: NoteFile }
  > = [
    ...subFolders.map((f) => ({ kind: "folder" as const, folder: f })),
    ...files.map((f) => ({ kind: "file" as const, file: f })),
  ];

  const N = Math.max(children.length, 1);

  const positioned = children.map((child, idx) => {
    const angle = (idx / N) * Math.PI * 2 - Math.PI / 2;
    const orbit = child.kind === "folder" ? orbitChild : orbitChild * 0.65;
    const x = cx + orbit * Math.cos(angle);
    const y = cy + orbit * Math.sin(angle);
    return { child, x, y, angle, orbit };
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={compact ? "w-full" : "w-full h-full"}
      style={compact ? { maxHeight: 360 } : undefined}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Connections from center to each child */}
      {positioned.map(({ child, x, y }) => {
        const key =
          child.kind === "folder"
            ? `l-folder-${child.folder.id}`
            : `l-file-${child.file.id}`;
        return (
          <line
            key={key}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke={
              child.kind === "folder" ? folder.color : "var(--border)"
            }
            strokeWidth={child.kind === "folder" ? 1.4 : 1}
            strokeDasharray={child.kind === "folder" ? undefined : "2 4"}
            opacity={child.kind === "folder" ? 0.7 : 1}
          />
        );
      })}

      {/* File nodes — also expand sub-files of sub-folders below */}
      {positioned.map(({ child, x, y, angle }) => {
        if (child.kind === "file") {
          const file = child.file;
          const labelOffset = 26;
          const lx = x + labelOffset * Math.cos(angle);
          const ly = y + labelOffset * Math.sin(angle);
          const anchor =
            Math.cos(angle) > 0.3
              ? "start"
              : Math.cos(angle) < -0.3
              ? "end"
              : "middle";
          return (
            <g
              key={`file-${file.id}`}
              className="cursor-pointer"
              onClick={() =>
                dispatch({
                  type: "SET_VIEW",
                  payload: {
                    view: "editor",
                    folderId: folder.id,
                    fileId: file.id,
                  },
                })
              }
            >
              {file.isCompleted ? (
                <>
                  <circle
                    cx={x}
                    cy={y}
                    r={fileR}
                    fill="var(--success)"
                    opacity={0.18}
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={fileR}
                    fill="none"
                    stroke="var(--success)"
                    strokeWidth={2}
                  />
                  <path
                    d={`M ${x - 4} ${y} L ${x - 1} ${y + 3} L ${x + 5} ${y - 3}`}
                    stroke="var(--success)"
                    strokeWidth={2}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              ) : (
                <circle
                  cx={x}
                  cy={y}
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
                {truncate(file.title.replace(/\.md$/i, ""), 16)}
              </text>
            </g>
          );
        }

        // Subfolder bubble
        const sub = child.folder;
        const lines = wrapLabel(sub.name, 11);
        const longest = Math.max(...lines.map((l) => l.length));
        const fontSize = longest <= 10 ? 11 : longest <= 13 ? 10 : 9;
        const lineHeight = fontSize + 2;
        const totalH = (lines.length - 1) * lineHeight;
        return (
          <g
            key={`folder-${sub.id}`}
            className="cursor-pointer"
            onClick={() =>
              dispatch({
                type: "SET_VIEW",
                payload: { view: "folder", folderId: sub.id },
              })
            }
          >
            <circle
              cx={x}
              cy={y}
              r={childFolderR + 4}
              fill={sub.color}
              opacity={0.12}
            />
            <circle
              cx={x}
              cy={y}
              r={childFolderR}
              fill="var(--surface)"
              stroke={sub.color}
              strokeWidth={2.5}
            />
            <text
              x={x}
              y={y - totalH / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={fontSize}
              fontWeight={600}
              fill="var(--foreground)"
              style={{ pointerEvents: "none" }}
            >
              {lines.map((line, i) => (
                <tspan key={i} x={x} dy={i === 0 ? 0 : lineHeight}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}

      {/* Center node = folder */}
      <g
        className="cursor-pointer"
        onClick={() =>
          dispatch({
            type: "SET_VIEW",
            payload: { view: "folder", folderId: folder.id },
          })
        }
      >
        <circle
          cx={cx}
          cy={cy}
          r={centerR + 6}
          fill={folder.color}
          opacity={0.18}
        />
        <circle
          cx={cx}
          cy={cy}
          r={centerR}
          fill={folder.color}
          stroke={folder.color}
          strokeWidth={2}
        />
        {wrapLabel(folder.name, 12).map((line, i, arr) => (
          <text
            key={i}
            x={cx}
            y={cy + 5 + (i - (arr.length - 1) / 2) * 16}
            textAnchor="middle"
            fontSize={14}
            fontWeight={700}
            fill="#fff"
            style={{ pointerEvents: "none" }}
          >
            {line}
          </text>
        ))}
      </g>
    </svg>
  );
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
