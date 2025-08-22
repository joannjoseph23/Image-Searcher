"use client";
import * as React from "react";

type Variant = "default" | "outline" | "ghost" | "secondary";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:pointer-events-none";
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4",
  lg: "h-12 px-6 text-lg",
};
const variants: Record<Variant, string> = {
  default: "bg-primary text-primary-foreground hover:opacity-90",
  outline: "border border-border bg-card hover:bg-muted",
  ghost: "hover:bg-muted",
  secondary: "bg-secondary text-secondary-foreground hover:bg-muted",
};

export function Button({
  className = "",
  variant = "default",
  size = "md",
  asChild,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
}) {
  const cls = `${base} ${sizes[size]} ${variants[variant]} ${className}`;
  if (asChild) {
    // allow <Button asChild><a/></Button> like shadcn
    return React.cloneElement((props as any).children, {
      className: `${cls} ${(props as any).children.props?.className || ""}`,
    });
  }
  return <button className={cls} {...props} />;
}
