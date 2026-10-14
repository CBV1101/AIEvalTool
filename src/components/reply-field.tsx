"use client";

import { useState } from "react";
import { countWords } from "@/lib/eval/text";

export function ReplyField({
  id,
  name,
  label,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      <textarea
        className="textarea"
        id={id}
        name={name}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={8}
      />
      <span className="field-hint">{countWords(value)} words</span>
    </label>
  );
}
