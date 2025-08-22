"use client";
export function Progress({ value = 0, className = "" }: { value?: number; className?: string }) {
  return (
    <div className={`h-2 w-full rounded bg-muted ${className}`}>
      <div className="h-full rounded bg-primary" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
