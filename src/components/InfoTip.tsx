import { useId, useState, type ReactNode } from 'react';

/** Keyboard- and hover-accessible definition popover for KPIs (FR-04). */
export function InfoTip({ children, label = 'Definition' }: { children: ReactNode; label?: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onBlur={() => setOpen(false)}
        onKeyDown={e => e.key === 'Escape' && setOpen(false)}
        className="grid h-4 w-4 place-items-center rounded-full border border-slate-500/50 text-[9px] font-bold text-slate-400 hover:text-white"
      >
        i
      </button>
      {open && (
        <span role="tooltip" id={id} className="glass absolute top-5 right-0 z-50 w-64 rounded-md p-2.5 text-[11px] leading-relaxed font-normal text-slate-200 shadow-xl">
          {children}
        </span>
      )}
    </span>
  );
}
