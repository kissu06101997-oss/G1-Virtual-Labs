"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";

interface FluidSelectProps {
  name: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
}

export function FluidSelect({ name, label, value, options, onChange, disabled = false, required, invalid, describedBy }: FluidSelectProps) {
  const id = useId();
  const listId = `${id}-options`;
  const field = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ prefix: "", time: 0 });
  const [active, setActive] = useState<number | null>(null);
  const selected = Math.max(0, options.findIndex(option => option.value === value));
  const open = active !== null;

  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !field.current?.contains(event.target)) setActive(null);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  useEffect(() => {
    const panel = list.current;
    const option = active === null ? null : panel?.children[active] as HTMLElement | undefined;
    if (!panel || !option) return;
    if (option.offsetTop < panel.scrollTop) panel.scrollTop = option.offsetTop;
    const bottom = option.offsetTop + option.offsetHeight;
    if (bottom > panel.scrollTop + panel.clientHeight) panel.scrollTop = bottom - panel.clientHeight;
  }, [active]);

  function select(index: number) {
    if (options[index].value !== value) onChange(options[index].value);
    setActive(null);
  }

  function handleKey(event: KeyboardEvent<HTMLButtonElement>) {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActive(active === null ? selected : Math.max(0, Math.min(options.length - 1, active + step)));
        return;
      }
      case "Home":
      case "End":
        event.preventDefault();
        setActive(event.key === "Home" ? 0 : options.length - 1);
        return;
      case "Escape":
        if (open) {
          event.preventDefault();
          event.stopPropagation();
          setActive(null);
        }
        return;
      case "Enter":
      case " ":
        if (active !== null) {
          event.preventDefault();
          select(active);
        }
        return;
    }

    if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey || event.nativeEvent.isComposing) return;
    const key = event.key.toLocaleLowerCase();
    const time = Date.now();
    const previous = typed.current;
    const prefix = time - previous.time < 700 && previous.prefix !== key ? previous.prefix + key : key;
    typed.current = { prefix, time };
    const start = active ?? selected;
    for (let offset = Number(prefix.length === 1); offset <= options.length; offset++) {
      const index = (start + offset) % options.length;
      if (options[index].label.toLocaleLowerCase().startsWith(prefix)) {
        event.preventDefault();
        setActive(index);
        break;
      }
    }
  }

  return (
    <div className="g1-discovery-select" ref={field}>
      <label id={`${id}-label`} htmlFor={id}>{label}</label>
      <div className="g1-discovery-choice">
        <button type="button" role="combobox" id={id} className="g1-discovery-trigger"
          aria-labelledby={`${id}-label`} aria-expanded={open} aria-controls={listId}
          aria-required={required} aria-invalid={invalid || undefined} aria-describedby={describedBy}
          aria-activedescendant={active === null ? undefined : `${listId}-${active}`} disabled={disabled}
          onClick={() => setActive(open ? null : selected)} onKeyDown={handleKey} onBlur={() => setActive(null)}>
          <span>{options[selected].label}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        <ul role="listbox" id={listId} aria-labelledby={`${id}-label`} className="g1-discovery-options" ref={list} hidden={!open}>
          {options.map((option, index) => (
            <li key={option.value} id={`${listId}-${index}`} role="option" aria-selected={index === selected}
              data-active={index === active ? "true" : undefined} onMouseDown={event => event.preventDefault()}
              onClick={() => select(index)}>
              <span>{option.label}</span>
              {index === selected && <Check size={16} aria-hidden="true" />}
            </li>
          ))}
        </ul>
      </div>
      <input type="hidden" name={name} value={value} disabled={disabled} />
    </div>
  );
}
