"use client";

import * as React from "react";

type SelectContextType = {
  open: boolean;
  setOpen: (o: boolean) => void;
  value?: string;
  onValueChange?: (v: string) => void;
  placeholder?: React.ReactNode;
};

const SelectCtx = React.createContext<SelectContextType | null>(null);

export function Select({
  children,
  value,
  onValueChange,
  placeholder,
}: {
  children: React.ReactNode;
  value?: string;
  onValueChange?: (v: string) => void;
  placeholder?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  const ctx: SelectContextType = {
    open,
    setOpen,
    value,
    onValueChange,
    placeholder,
  };

  return <SelectCtx.Provider value={ctx}>{children}</SelectCtx.Provider>;
}

export function SelectTrigger({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const ctx = React.useContext<SelectContextType | null>(SelectCtx);
  if (!ctx) throw new Error("SelectTrigger must be used within <Select>");

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => ctx.setOpen(!ctx.open)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          ctx.setOpen(!ctx.open);
        }
      }}
      className={`h-10 w-full rounded-md border border-border bg-input px-3 text-sm flex items-center justify-between cursor-pointer ${className}`}
      {...props}
    >
      <SelectValue />
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        className="opacity-70"
        aria-hidden
      >
        <path d="M7 10l5 5 5-5z" />
      </svg>
    </div>
  );
}

export function SelectValue({
  placeholder,
}: {
  placeholder?: React.ReactNode;
}) {
  const ctx = React.useContext<SelectContextType | null>(SelectCtx);
  if (!ctx) throw new Error("SelectValue must be used within <Select>");

  const content =
    ctx.value != null && ctx.value !== ""
      ? ctx.value
      : placeholder ?? ctx.placeholder ?? "Select…";

  const isPlaceholder = ctx.value == null || ctx.value === "";

  return (
    <span className={isPlaceholder ? "text-muted-foreground" : ""}>
      {content}
    </span>
  );
}

export function SelectContent({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext<SelectContextType | null>(SelectCtx);
  if (!ctx) throw new Error("SelectContent must be used within <Select>");

  if (!ctx.open) return null;

  return (
    <div
      className={`mt-2 rounded-md border border-border bg-card p-1 shadow-md ${className}`}
    >
      {children}
    </div>
  );
}

export function SelectItem({
  value,
  children,
  className = "",
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = React.useContext<SelectContextType | null>(SelectCtx);
  if (!ctx) throw new Error("SelectItem must be used within <Select>");

  const selected = ctx.value === value;

  return (
    <div
      onClick={() => {
        ctx.onValueChange?.(value);
        ctx.setOpen(false);
      }}
      className={`cursor-pointer rounded px-2 py-1 text-sm hover:bg-muted ${
        selected ? "bg-muted" : ""
      } ${className}`}
      role="option"
      aria-selected={selected}
    >
      {children}
    </div>
  );
}
