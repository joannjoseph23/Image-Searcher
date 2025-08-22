"use client";
export function Checkbox({
  id,
  checked,
  onCheckedChange,
}: {
  id?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <input
      id={id}
      type="checkbox"
      className="h-4 w-4 rounded border-border accent-[oklch(0.45_0.15_160)]"
      checked={!!checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  );
}