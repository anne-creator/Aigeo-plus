"use client";

import type { ComponentProps } from "react";

/** 提交前弹确认框的按钮（删除用） */
export function ConfirmButton({ message, className, children, ...rest }: ComponentProps<"button"> & { message: string }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
