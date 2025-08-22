"use client";
import * as React from "react";

type Variant = "default" | "secondary" | "outline" | "destructive";

export function Badge({
  children,
  variant = "secondary",
  className = "",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  const base = "inline-flex items-center rounded-md px-2 py-1 text-xs";
  const styles: Record<Variant, string> = {
    default: "bg-primary text-primary-foreground",
    secondary: "bg-muted text-foreground",
    outline: "border border-border text-foreground",
    destructive: "bg-destructive text-destructive-foreground",
  };
  return (
    <span className={`${base} ${styles[variant]} ${className}`} {...props}>
      {children}
    </span>
  );
}
