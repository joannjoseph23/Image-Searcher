"use client";
import * as React from "react";
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-10 w-full rounded-md border border-border bg-input px-3 text-sm outline-none focus:ring-2 ${props.className || ""}`}
    />
  );
}
