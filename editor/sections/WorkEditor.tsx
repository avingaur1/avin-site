"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useEditor, newId } from "../state";
import { Button, Card, Field, SectionTitle, SortableList, TextArea, TextInput, arrayMove, inputCls, tidyUrl } from "../ui";
import { MONTHS, formatPeriod, parsePeriod, yearOptions, type MonthYear, type Period } from "../period";

export function WorkEditor() {
  const { data, update, confirm } = useEditor();
  const entries: any[] = data.work?.entries ?? [];
  const [open, setOpen] = useState<string | null>(null);

  const add = () => {
    const now = new Date();
    const id = newId();
    update((d) => {
      d.work ??= { heading: "Work", entries: [] };
      d.work.entries ??= [];
      d.work.entries.unshift({
        __id: id,
        title: "",
        role: "",
        period: formatPeriod({ start: { month: now.getMonth(), year: now.getFullYear() }, end: "present" }),
        description: "",
        href: "",
      });
    });
    setOpen(id);
  };

  const remove = async (i: number) => {
    const e = entries[i];
    const ok = await confirm({
      title: `Delete ${e.title || "this experience"}?`,
      body: "It will be removed from your site the next time you publish.",
      ok: "Delete",
      danger: true,
    });
    if (ok) update((d) => d.work.entries.splice(i, 1));
  };

  return (
    <div>
      <SectionTitle
        title="Work experience"
        sub="Shown newest first. Drag to change the order."
        action={
          <Button kind="primary" onClick={add}>
            <Plus size={16} aria-hidden /> Add
          </Button>
        }
      />

      {entries.length === 0 && (
        <Card className="p-8 text-center text-muted">No work experience yet. Add your first one.</Card>
      )}

      <SortableList
        items={entries}
        className="space-y-2.5"
        onReorder={(a, b) => update((d) => (d.work.entries = arrayMove(d.work.entries, a, b)))}
        render={(e, i, handle) => {
          const isOpen = open === e.__id;
          return (
            <Card className="overflow-hidden">
              <div className="flex items-center gap-1 py-2 pl-1.5 pr-2">
                {handle}
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : e.__id)}
                  aria-expanded={isOpen}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-md py-1.5 pr-1 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {e.title || <span className="text-muted">New experience</span>}
                    </span>
                    <span className="block truncate text-[13px] text-muted">
                      {[e.role, e.period].filter(Boolean).join(" · ") || "Add details"}
                    </span>
                  </span>
                  <ChevronDown
                    size={18}
                    aria-hidden
                    className={`shrink-0 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
              </div>

              {isOpen && (
                <div className="space-y-4 border-t border-line px-4 pb-4 pt-4 sm:px-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextInput
                      label="Company"
                      value={e.title}
                      autoFocus={!e.title}
                      placeholder="e.g. Kepler Cannon"
                      onChange={(v) => update((d) => (d.work.entries[i].title = v))}
                    />
                    <TextInput
                      label="Job title"
                      value={e.role ?? ""}
                      placeholder="e.g. Associate Consultant Intern"
                      onChange={(v) => update((d) => (d.work.entries[i].role = v))}
                    />
                  </div>

                  <PeriodPicker value={e.period ?? ""} onChange={(v) => update((d) => (d.work.entries[i].period = v))} />

                  <TextArea
                    label="Short description"
                    value={e.description ?? ""}
                    rows={2}
                    placeholder="One or two lines about what you worked on."
                    hint={<Count text={e.description ?? ""} />}
                    onChange={(v) => update((d) => (d.work.entries[i].description = v))}
                  />

                  <TextInput
                    label="Company website"
                    type="url"
                    inputMode="url"
                    value={e.href ?? ""}
                    placeholder="https://"
                    hint="Optional. Makes the row clickable on your site."
                    onChange={(v) => update((d) => (d.work.entries[i].href = v))}
                    onBlur={() => update((d) => (d.work.entries[i].href = tidyUrl(d.work.entries[i].href)))}
                  />

                  <div className="flex items-center justify-between pt-1">
                    <Button kind="danger" small onClick={() => remove(i)} className="-ml-3">
                      <Trash2 size={15} aria-hidden /> Delete
                    </Button>
                    <Button small onClick={() => setOpen(null)}>
                      Done
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        }}
      />
    </div>
  );
}

function Count({ text }: { text: string }) {
  const n = text.length;
  return <span className={n > 140 ? "text-amber-600 dark:text-amber-400" : ""}>{n} characters · about 100 reads best</span>;
}

/* --------------------------------------------------------- date picking */

function MonthYearSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: MonthYear;
  onChange: (v: MonthYear) => void;
}) {
  const years = yearOptions();
  if (!years.includes(value.year)) years.push(value.year);
  return (
    <Field label={label}>
      <div className="grid grid-cols-[1.4fr_1fr] gap-2">
        <select
          aria-label={`${label} month`}
          value={value.month}
          onChange={(e) => onChange({ ...value, month: Number(e.target.value) })}
          className={inputCls}
        >
          {MONTHS.map((m, i) => (
            <option key={m} value={i}>
              {m}
            </option>
          ))}
        </select>
        <select
          aria-label={`${label} year`}
          value={value.year}
          onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}
          className={inputCls}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
    </Field>
  );
}

function PeriodPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parsed = parsePeriod(value);
  const [freeText, setFreeText] = useState(!parsed && !!value.trim());
  const now = new Date();
  const fallback: Period = { start: { month: now.getMonth(), year: now.getFullYear() }, end: "present" };
  const p = parsed ?? fallback;

  if (freeText) {
    return (
      <div className="space-y-2">
        <TextInput label="Dates" value={value} onChange={onChange} hint="Shown exactly as typed." />
        <button
          type="button"
          className="text-[13px] text-accent"
          onClick={() => {
            setFreeText(false);
            onChange(formatPeriod(p));
          }}
        >
          Use date pickers instead
        </button>
      </div>
    );
  }

  const set = (next: Period) => onChange(formatPeriod(next));
  const present = p.end === "present";
  const endValue: MonthYear = p.end === "present" ? { month: now.getMonth(), year: now.getFullYear() } : p.end;

  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <MonthYearSelect label="Start" value={p.start} onChange={(start) => set({ ...p, start })} />
        {present ? (
          <Field label="End">
            <div className={`${inputCls} flex items-center text-muted`}>Present</div>
          </Field>
        ) : (
          <MonthYearSelect label="End" value={endValue} onChange={(end) => set({ ...p, end })} />
        )}
      </div>
      <label className="flex w-fit cursor-pointer items-center gap-2.5 text-[14px]">
        <input
          type="checkbox"
          checked={present}
          onChange={(e) => set({ ...p, end: e.target.checked ? "present" : endValue })}
          className="h-[18px] w-[18px] accent-[var(--accent)]"
        />
        I currently work here
      </label>
      <p className="text-[12.5px] text-muted">
        Shows as “{formatPeriod(p)}”.{" "}
        <button type="button" className="text-accent" onClick={() => setFreeText(true)}>
          Type it instead
        </button>
      </p>
    </div>
  );
}
