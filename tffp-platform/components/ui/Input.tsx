import { cx } from '@/lib/utils';
import { forwardRef } from 'react';
import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cx(
          'w-full rounded-md border border-ink/20 bg-white px-3 py-2 text-sm disabled:bg-ink/5 disabled:text-ink/40',
          'focus:outline-none focus:ring-2 focus:ring-forest/40 focus:border-forest',
          className
        )}
        {...props}
      />
    );
  }
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cx(
          'w-full rounded-md border border-ink/20 bg-white px-3 py-2 text-sm leading-relaxed disabled:bg-ink/5 disabled:text-ink/40',
          'focus:outline-none focus:ring-2 focus:ring-forest/40 focus:border-forest',
          className
        )}
        {...props}
      />
    );
  }
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cx(
          'w-full rounded-md border border-ink/20 bg-white px-3 py-2 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-forest/40 focus:border-forest',
          className
        )}
        {...props}
      />
    );
  }
);

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block space-y-1">
      <span className="block text-sm font-medium text-ink/80">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-ink/50">{hint}</span> : null}
    </label>
  );
}
