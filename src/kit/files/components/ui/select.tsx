import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Styled NATIVE select — use it exactly like <select>, with <option>
 * children. Native pickers are the most reliable and accessible on phones,
 * which is where community tools live.
 *
 *   <Select value={v} onChange={e => setV(e.target.value)}>
 *     <option value="tools">Tools</option>
 *   </Select>
 *
 * It also accepts the shadcn/Radix shape many models reach for
 * (`onValueChange`, SelectTrigger, SelectValue, SelectContent, SelectItem)
 * and renders it as the same native select: the trigger's placeholder
 * becomes a first disabled option, items become options. Small open models
 * wrote that shape in about one build in ten on the bench (Nov 2026), and
 * each one used to cost a fix pass; now it simply works.
 */
type SelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  children?: React.ReactNode;
  onValueChange?: (value: string) => void;
};

export function Select({ className, children, onValueChange, onChange, ...props }: SelectProps) {
  const { options, placeholder } = flatten(children);
  const empty = props.value === undefined ? props.defaultValue === undefined : props.value === '';
  return (
    <div className={cn('relative w-full', className)}>
      <select
        className={cn(
          'h-11 w-full appearance-none rounded-[var(--radius)] border border-input bg-background px-3 pr-9 text-base',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
        onChange={e => {
          onChange?.(e);
          onValueChange?.(e.target.value);
        }}
        {...(placeholder && empty && props.value === undefined && props.defaultValue === undefined ? { defaultValue: '' } : {})}
        {...props}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

/* The shadcn-shaped parts. They render nothing on their own; Select reads them. */
export const SelectTrigger: React.FC<{ children?: React.ReactNode; className?: string }> = () => null;
export const SelectValue: React.FC<{ placeholder?: React.ReactNode }> = () => null;
export const SelectContent: React.FC<{ children?: React.ReactNode; className?: string }> = () => null;
export const SelectGroup: React.FC<{ children?: React.ReactNode }> = () => null;
export const SelectLabel: React.FC<{ children?: React.ReactNode }> = () => null;
export const SelectItem: React.FC<{ value: string; children?: React.ReactNode; disabled?: boolean }> = () => null;

function flatten(children: React.ReactNode): { options: React.ReactNode[]; placeholder: React.ReactNode | null } {
  const options: React.ReactNode[] = [];
  let placeholder: React.ReactNode | null = null;
  const walk = (node: React.ReactNode) => {
    React.Children.forEach(node, child => {
      if (!React.isValidElement(child)) return;
      const el = child as React.ReactElement<{ children?: React.ReactNode; value?: string; placeholder?: React.ReactNode; disabled?: boolean }>;
      if (el.type === SelectTrigger) {
        React.Children.forEach(el.props.children, c => {
          if (React.isValidElement(c) && c.type === SelectValue) {
            placeholder = (c.props as { placeholder?: React.ReactNode }).placeholder ?? null;
          }
        });
      } else if (el.type === SelectContent || el.type === SelectGroup) {
        walk(el.props.children);
      } else if (el.type === SelectLabel) {
        // a group label has no native equivalent inside a flat list; skip it
      } else if (el.type === SelectItem) {
        options.push(
          <option key={el.props.value} value={el.props.value} disabled={el.props.disabled}>
            {el.props.children}
          </option>,
        );
      } else {
        options.push(child);
      }
    });
  };
  walk(children);
  return { options, placeholder };
}
