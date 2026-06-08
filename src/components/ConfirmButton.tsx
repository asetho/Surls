"use client";

import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  message: string;
};

export function ConfirmButton({ message, onClick, ...props }: Props) {
  return (
    <button
      {...props}
      onClick={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    />
  );
}
