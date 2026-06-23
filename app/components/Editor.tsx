"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useStore } from "../lib/store";
import { renderMarkdown } from "../lib/markdown";
import {
  ArrowDownIcon,
  CheckIcon,
  ChevronLeftIcon,
  TrashIcon,
} from "./icons";

const FONT_STEPS = [10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48];

export default function Editor() {
  const { state, dispatch } = useStore();
  const file = state.files.find((f) => f.id === state.currentFileId);
  const folder = state.folders.find((f) => f.id === state.currentFolderId);
  const editorRef = useRef<HTMLDivElement>(null);
  const lastWrittenContent = useRef<string>("");
  const loadedFileId = useRef<string | null>(null);

  const initialHtml = useMemo(() => {
    const content = file?.content ?? "";
    if (!content) return "";
    // Treat as HTML if any tag is present; otherwise convert legacy markdown.
    if (/<[a-z][^>]*>/i.test(content)) return content;
    return renderMarkdown(content);
  }, [file?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mount/swap document content only when the active file actually changes.
  // Resetting innerHTML on every keystroke wipes the caret and typed text.
  useEffect(() => {
    if (!editorRef.current || !file) return;
    if (loadedFileId.current === file.id) return;
    loadedFileId.current = file.id;
    editorRef.current.innerHTML = initialHtml;
    lastWrittenContent.current = initialHtml;
    editorRef.current.focus();
  }, [file, initialHtml]);

  const flush = useCallback(() => {
    const el = editorRef.current;
    if (!el || !file) return;
    const html = el.innerHTML;
    if (html === lastWrittenContent.current) return;
    lastWrittenContent.current = html;
    dispatch({
      type: "UPDATE_FILE",
      payload: { id: file.id, content: html },
    });
  }, [dispatch, file]);

  const exec = useCallback(
    (cmd: string, value?: string) => {
      editorRef.current?.focus();
      document.execCommand("styleWithCSS", false, "true");
      document.execCommand(cmd, false, value);
      flush();
    },
    [flush]
  );

  const adjustFont = useCallback(
    (direction: 1 | -1) => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      // If nothing selected, select the current word so the change is visible.
      if (range.collapsed) {
        const node = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent ?? "";
          const offset = range.startOffset;
          let start = offset;
          let end = offset;
          while (start > 0 && /\S/.test(text[start - 1])) start--;
          while (end < text.length && /\S/.test(text[end])) end++;
          if (end > start) {
            range.setStart(node, start);
            range.setEnd(node, end);
            sel.removeAllRanges();
            sel.addRange(range);
          } else {
            return;
          }
        } else {
          return;
        }
      }
      const anchor =
        range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
          ? (range.commonAncestorContainer as Element)
          : range.commonAncestorContainer.parentElement;
      const currentSize = anchor
        ? parseFloat(window.getComputedStyle(anchor).fontSize)
        : 14;
      let idx = FONT_STEPS.findIndex(
        (s) => Math.abs(s - currentSize) < 0.5 || s > currentSize
      );
      if (idx === -1) idx = FONT_STEPS.length - 1;
      const next =
        direction === 1
          ? FONT_STEPS[Math.min(FONT_STEPS.length - 1, idx + 1)]
          : FONT_STEPS[Math.max(0, idx - 1)];
      const span = document.createElement("span");
      span.style.fontSize = `${next}px`;
      try {
        const contents = range.extractContents();
        span.appendChild(contents);
        range.insertNode(span);
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        sel.removeAllRanges();
        sel.addRange(newRange);
      } catch {
        return;
      }
      flush();
    },
    [flush]
  );

  const insertHtml = useCallback(
    (html: string) => {
      editorRef.current?.focus();
      document.execCommand("insertHTML", false, html);
      flush();
    },
    [flush]
  );

  if (!file || !folder) {
    return (
      <div className="p-8 fade-in">
        <button
          onClick={() =>
            dispatch({
              type: "SET_VIEW",
              payload: { view: "dashboard", folderId: null, fileId: null },
            })
          }
          className="text-sm text-[var(--muted)] flex items-center gap-1"
        >
          <ChevronLeftIcon size={14} /> Back
        </button>
        <p className="mt-4 text-[var(--muted)]">Note not found.</p>
      </div>
    );
  }

  const wordCount = (file.content ?? "")
    .replace(/<[^>]+>/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  return (
    <div className="flex flex-col h-full fade-in">
      <div className="px-8 pt-6">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() =>
              dispatch({
                type: "SET_VIEW",
                payload: { view: "folder", fileId: null },
              })
            }
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-[var(--surface-2)] text-sm transition"
          >
            <ChevronLeftIcon size={14} /> Files
          </button>
          <div className="flex-1" />
          <button
            onClick={() =>
              dispatch({ type: "TOGGLE_FILE_DONE", payload: { id: file.id } })
            }
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm transition ${
              file.isCompleted
                ? "border-[var(--success)]/40 text-[var(--success)] bg-[var(--success)]/10"
                : "border-[var(--border)] hover:bg-[var(--surface-2)]"
            }`}
          >
            <CheckIcon size={14} />
            {file.isCompleted ? "Completed" : "Mark done"}
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete note "${file.title}"?`))
                dispatch({ type: "DELETE_FILE", payload: { id: file.id } });
            }}
            className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--danger)] transition"
            aria-label="Delete note"
            title="Delete"
          >
            <TrashIcon size={14} />
          </button>
        </div>

        <FormatToolbar
          exec={exec}
          insertHtml={insertHtml}
          adjustFont={adjustFont}
          wordCount={wordCount}
        />

        <div
          className="h-0.5 w-full rounded-full mt-3"
          style={{ background: folder.color, opacity: 0.7 }}
        />
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={flush}
        onBlur={flush}
        spellCheck={false}
        data-placeholder="Start writing..."
        className="rich-editor text-sm leading-7 flex-1 px-8 pt-6 pb-12 outline-none overflow-y-auto"
      />

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[var(--muted)] opacity-60 pointer-events-none">
        <ArrowDownIcon size={18} />
      </div>
    </div>
  );
}

/* ---------------------------- Toolbar ---------------------------- */

function FormatToolbar({
  exec,
  insertHtml,
  adjustFont,
  wordCount,
}: {
  exec: (cmd: string, value?: string) => void;
  insertHtml: (html: string) => void;
  adjustFont: (dir: 1 | -1) => void;
  wordCount: number;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap text-sm">
      <span className="text-[10px] tracking-[0.18em] uppercase text-[var(--muted)] mr-1">
        Format
      </span>

      <TbGroup>
        <TbButton title="Bold" onClick={() => exec("bold")}>
          <span className="font-bold">B</span>
        </TbButton>
        <TbButton title="Italic" onClick={() => exec("italic")}>
          <span className="italic font-serif">I</span>
        </TbButton>
        <TbButton
          title="Strikethrough"
          onClick={() => exec("strikeThrough")}
        >
          <span className="line-through">S</span>
        </TbButton>
      </TbGroup>

      <TbGroup>
        <TbButton title="Decrease font size" onClick={() => adjustFont(-1)}>
          <span className="text-[10px] font-semibold leading-none">
            A<span className="text-[8px]">−</span>
          </span>
        </TbButton>
        <TbButton title="Increase font size" onClick={() => adjustFont(1)}>
          <span className="text-[12px] font-semibold leading-none">
            A<span className="text-[8px]">+</span>
          </span>
        </TbButton>
      </TbGroup>

      <TbGroup>
        <TbButton
          title="Heading 1"
          onClick={() => exec("formatBlock", "<h1>")}
        >
          <span className="font-bold text-[11px]">H1</span>
        </TbButton>
        <TbButton
          title="Heading 2"
          onClick={() => exec("formatBlock", "<h2>")}
        >
          <span className="font-semibold text-[11px]">H2</span>
        </TbButton>
        <TbButton
          title="Heading 3"
          onClick={() => exec("formatBlock", "<h3>")}
        >
          <span className="font-medium text-[11px]">H3</span>
        </TbButton>
      </TbGroup>

      <TbGroup>
        <TbButton title="Align left" onClick={() => exec("justifyLeft")}>
          <AlignGlyph kind="left" />
        </TbButton>
        <TbButton
          title="Align center"
          onClick={() => exec("justifyCenter")}
        >
          <AlignGlyph kind="center" />
        </TbButton>
        <TbButton title="Align right" onClick={() => exec("justifyRight")}>
          <AlignGlyph kind="right" />
        </TbButton>
      </TbGroup>

      <TbGroup>
        <TbButton
          title="Inline code"
          onClick={() => insertHtml("<code></code>")}
        >
          <span className="font-mono">{"</>"}</span>
        </TbButton>
        <TbButton
          title="Code block"
          onClick={() => insertHtml("<pre><code></code></pre><p></p>")}
        >
          <span className="font-mono">{">_"}</span>
        </TbButton>
      </TbGroup>

      <TbGroup>
        <TbButton
          title="Checklist"
          onClick={() =>
            insertHtml(
              '<ul class="task-list"><li class="task-item"><input type="checkbox" disabled> </li></ul>'
            )
          }
        >
          <ListGlyph kind="check" />
        </TbButton>
        <TbButton
          title="Bullet list"
          onClick={() => exec("insertUnorderedList")}
        >
          <ListGlyph kind="bullet" />
        </TbButton>
        <TbButton
          title="Radio list"
          onClick={() =>
            insertHtml(
              '<ul class="radio-list"><li class="radio-item"><input type="radio" disabled> </li></ul>'
            )
          }
        >
          <ListGlyph kind="radio" />
        </TbButton>
        <TbButton
          title="Numbered list"
          onClick={() => exec("insertOrderedList")}
        >
          <ListGlyph kind="number" />
        </TbButton>
      </TbGroup>

      <TbGroup>
        <TbButton
          title="Line divider"
          onClick={() => insertHtml("<hr><p></p>")}
        >
          <DividerGlyph kind="line" />
        </TbButton>
        <TbButton
          title="Dots divider"
          onClick={() =>
            insertHtml(
              '<p class="divider-dots" style="text-align:center;letter-spacing:.6em;color:var(--muted)">· · · · · · · · ·</p><p></p>'
            )
          }
        >
          <DividerGlyph kind="dots" />
        </TbButton>
        <TbButton
          title="Line block divider"
          onClick={() =>
            insertHtml(
              '<p class="divider-block" style="text-align:center;letter-spacing:.4em;color:var(--muted)">— — — — — — — —</p><p></p>'
            )
          }
        >
          <DividerGlyph kind="block" />
        </TbButton>
      </TbGroup>

      <span className="ml-auto text-xs text-[var(--muted)] tabular-nums pr-1">
        {wordCount} {wordCount === 1 ? "word" : "words"}
      </span>
    </div>
  );
}

function TbGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-[var(--border)] p-0.5 gap-0.5">
      {children}
    </div>
  );
}

function TbButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="min-w-7 h-7 px-2 rounded-md text-xs grid place-items-center text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] transition"
    >
      {children}
    </button>
  );
}

function AlignGlyph({ kind }: { kind: "left" | "center" | "right" }) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      <path d="M3 6h18" />
      {kind === "left" && <path d="M3 12h12M3 18h16" />}
      {kind === "center" && <path d="M6 12h12M5 18h14" />}
      {kind === "right" && <path d="M9 12h12M5 18h16" />}
    </svg>
  );
}

function ListGlyph({
  kind,
}: {
  kind: "check" | "bullet" | "radio" | "number";
}) {
  if (kind === "check") {
    return (
      <svg
        width={14}
        height={14}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M8 12l3 3 5-6" />
      </svg>
    );
  }
  if (kind === "radio") {
    return (
      <svg
        width={14}
        height={14}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3" fill="currentColor" />
      </svg>
    );
  }
  if (kind === "number") {
    return (
      <svg
        width={14}
        height={14}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      >
        <text x="2" y="11" fontSize="9" fill="currentColor" stroke="none">
          1.
        </text>
        <text x="2" y="20" fontSize="9" fill="currentColor" stroke="none">
          2.
        </text>
        <path d="M10 7h12M10 17h12" />
      </svg>
    );
  }
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      <circle cx="5" cy="7" r="1.2" fill="currentColor" />
      <circle cx="5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="5" cy="17" r="1.2" fill="currentColor" />
      <path d="M10 7h12M10 12h12M10 17h12" />
    </svg>
  );
}

function DividerGlyph({ kind }: { kind: "line" | "dots" | "block" }) {
  if (kind === "dots") {
    return (
      <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
        <circle cx="5" cy="12" r="1.2" />
        <circle cx="9" cy="12" r="1.2" />
        <circle cx="13" cy="12" r="1.2" />
        <circle cx="17" cy="12" r="1.2" />
      </svg>
    );
  }
  if (kind === "block") {
    return (
      <svg
        width={14}
        height={14}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      >
        <path d="M4 12h3M9 12h3M14 12h3M19 12h2" />
      </svg>
    );
  }
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      <path d="M4 12h16" />
    </svg>
  );
}
