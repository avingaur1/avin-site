"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2 } from "lucide-react";

/* ---------------------------------------------------------------- fields */

export const inputCls =
  "w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-[16px] leading-snug text-fg placeholder:text-muted/70 outline-none transition-colors focus:border-accent";

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-fg">
        {label}
      </label>
      {children}
      {hint && <p className="text-[12.5px] leading-snug text-muted">{hint}</p>}
    </div>
  );
}

export function TextInput({
  label,
  hint,
  value,
  onChange,
  placeholder,
  type = "text",
  onBlur,
  autoFocus,
  inputMode,
}: {
  label: string;
  hint?: ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  onBlur?: () => void;
  autoFocus?: boolean;
  inputMode?: "url" | "email" | "text";
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <input
        id={id}
        type={type}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        autoFocus={autoFocus}
        inputMode={inputMode}
        autoCapitalize={type === "url" || inputMode === "url" ? "off" : undefined}
        className={inputCls}
      />
    </Field>
  );
}

export function TextArea({
  label,
  hint,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  hint?: ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  // Grow with the text so nothing hides behind a scrollbar.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <textarea
        id={id}
        ref={ref}
        rows={rows}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} resize-none`}
      />
    </Field>
  );
}

/** Adds https:// when a web address is typed without it. Leaves mailto: and site paths alone. */
export function tidyUrl(v: string) {
  const t = (v || "").trim();
  if (!t) return "";
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(t)) return t;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return `mailto:${t}`;
  return `https://${t}`;
}

/* --------------------------------------------------------------- buttons */

type BtnKind = "primary" | "accent" | "secondary" | "ghost" | "danger";
const btn: Record<BtnKind, string> = {
  primary: "bg-fg text-bg hover:opacity-90",
  accent: "bg-accent text-bg hover:opacity-90",
  secondary: "border border-line bg-bg text-fg hover:border-fg/40",
  ghost: "text-muted hover:text-fg",
  danger: "text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300",
};

export function Button({
  kind = "secondary",
  children,
  onClick,
  disabled,
  busy,
  type = "button",
  className = "",
  small,
  title,
}: {
  kind?: BtnKind;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
  type?: "button" | "submit";
  className?: string;
  small?: boolean;
  title?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      title={title}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
        small ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-[14px]"
      } ${btn[kind]} ${className}`}
    >
      {busy && <Loader2 size={15} className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- dialog */

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-[520px]" : "max-w-[420px]"} rounded-2xl border border-line bg-bg p-0 text-fg shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px]`}
    >
      {open && (
        <div className="p-5 sm:p-6">
          <h2 className="text-[18px] font-semibold tracking-tight">{title}</h2>
          {children && <div className="mt-3 text-[15px] text-muted">{children}</div>}
          {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

/* --------------------------------------------------------- sortable list */

export function useDragSensors() {
  return useSensors(
    // A small move starts a drag with a mouse; on touch, press and hold briefly so the page still scrolls.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

export function SortableList<T extends { __id: string }>({
  items,
  onReorder,
  render,
  grid,
  className = "",
}: {
  items: T[];
  onReorder: (from: number, to: number) => void;
  render: (item: T, index: number, handle: ReactNode) => ReactNode;
  grid?: boolean;
  className?: string;
}) {
  const sensors = useDragSensors();
  const onEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = items.findIndex((i) => i.__id === e.active.id);
    const to = items.findIndex((i) => i.__id === e.over!.id);
    if (from >= 0 && to >= 0) onReorder(from, to);
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onEnd}>
      <SortableContext
        items={items.map((i) => i.__id)}
        strategy={grid ? rectSortingStrategy : verticalListSortingStrategy}
      >
        <ul className={className}>
          {items.map((item, i) => (
            <SortableItem key={item.__id} id={item.__id}>
              {(handle) => render(item, i, handle)}
            </SortableItem>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableItem({ id, children }: { id: string; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, setActivatorNodeRef } =
    useSortable({ id });
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label="Drag to reorder"
      title="Drag to reorder"
      className="inline-flex h-9 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted hover:text-fg active:cursor-grabbing"
    >
      <GripVertical size={17} strokeWidth={1.75} aria-hidden />
    </button>
  );
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`relative ${isDragging ? "z-20 opacity-90 shadow-xl" : ""}`}
    >
      {children(handle)}
    </li>
  );
}

export { arrayMove };

/* ------------------------------------------------------------------ misc */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-bg ${className}`}>{children}</div>;
}

export function SectionTitle({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-[22px] font-semibold tracking-[-0.015em]">{title}</h2>
        {sub && <p className="mt-1 text-[14px] text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function useStable<T>(v: T) {
  const [s] = useState(v);
  return s;
}
