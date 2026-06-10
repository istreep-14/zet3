import { useState } from 'react';
import { formatTimeDisplay, parseTimeInput } from '../domain/time';

interface TimeInputProps {
  value: string;
  placeholder?: string;
  context: 'in' | 'out' | 'close';
  inValue?: number;
  'aria-label': string;
  onChange: (value: string) => void;
}

export function TimeInput(props: TimeInputProps) {
  const [focused, setFocused] = useState(false);
  const parsed = parseTimeInput(props.value);
  const display = !focused && parsed.valid && !parsed.empty && parsed.value != null
    ? formatTimeDisplay(props.value, props.context, props.inValue)
    : props.value;

  return (
    <input
      aria-label={props['aria-label']}
      value={display}
      inputMode="decimal"
      placeholder={props.placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(event) => props.onChange(event.target.value)}
    />
  );
}
