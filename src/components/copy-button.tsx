"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy prompt" }: { text: string; label?: string }) {
  const [message, setMessage] = useState(label);

  return (
    <button
      type="button"
      className="btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setMessage("Copied");
          window.setTimeout(() => setMessage(label), 2000);
        } catch {
          setMessage("Select the prompt and copy it");
        }
      }}
    >
      {message}
    </button>
  );
}
