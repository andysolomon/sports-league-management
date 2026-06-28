import React from 'react';
import { Icon, IconName } from './icons';

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ');

/* ============================================================ Button */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
}
export function Button({ variant = 'secondary', size = 'md', icon, className, children, ...rest }: ButtonProps) {
  return (
    <button
      className={cx('sl-btn', `sl-btn--${variant}`, size !== 'md' && `sl-btn--${size}`, className)}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'lg' ? 16 : 14} strokeWidth={2.2} />}
      {children}
    </button>
  );
}

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
}
export function IconButton({ icon, className, ...rest }: IconButtonProps) {
  return (
    <button className={cx('sl-iconbtn', className)} {...rest}>
      <Icon name={icon} size={17} />
    </button>
  );
}

/* ============================================================ Badge */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'outline' | 'neutral' | 'solid' | 'success' | 'danger';
  dot?: boolean;
  icon?: IconName;
}
export function Badge({ variant = 'neutral', dot, icon, className, children, ...rest }: BadgeProps) {
  return (
    <span className={cx('sl-badge', `sl-badge--${variant}`, className)} {...rest}>
      {dot && <span className="sl-badge__dot" />}
      {icon && <Icon name={icon} size={12} strokeWidth={2.6} />}
      {children}
    </span>
  );
}

/* ============================================================ Inputs */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  inputSize?: 'sm' | 'md' | 'lg';
}
export function Input({ inputSize = 'md', className, ...rest }: InputProps) {
  return <input className={cx('sl-input', inputSize !== 'md' && `sl-input--${inputSize}`, className)} {...rest} />;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}
export function Select({ className, children, ...rest }: SelectProps) {
  return (
    <span className="sl-select-wrap">
      <select className={cx('sl-select', className)} {...rest}>{children}</select>
      <span className="sl-select-wrap__chevron"><Icon name="chevron-down" size={15} strokeWidth={2} /></span>
    </span>
  );
}

export interface SearchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  shortcut?: string;
}
export function Search({ shortcut = '⌘K', placeholder = 'Search…', className, ...rest }: SearchProps) {
  return (
    <label className={cx('sl-search', className)}>
      <Icon name="search" size={14} strokeWidth={2} />
      <input placeholder={placeholder} {...rest} />
      {shortcut && <span className="sl-kbd">{shortcut}</span>}
    </label>
  );
}

export interface SwitchProps {
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
}
export function Switch({ checked, onChange, disabled, ...aria }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={cx('sl-switch', checked && 'is-on')}
      onClick={() => onChange?.(!checked)}
      {...aria}
    >
      <span className="sl-switch__knob" />
    </button>
  );
}

export interface CheckboxProps {
  checked: boolean;
  onChange?: (next: boolean) => void;
  label?: React.ReactNode;
}
export function Checkbox({ checked, onChange, label }: CheckboxProps) {
  return (
    <label className={cx('sl-control', !checked && 'sl-control--muted')} onClick={() => onChange?.(!checked)}>
      <span className={cx('sl-check', checked && 'is-on')}>
        <Icon name="check" size={12} strokeWidth={3} />
      </span>
      {label}
    </label>
  );
}

export interface RadioProps {
  checked: boolean;
  onChange?: () => void;
  label?: React.ReactNode;
}
export function Radio({ checked, onChange, label }: RadioProps) {
  return (
    <label className={cx('sl-control', !checked && 'sl-control--muted')} onClick={onChange}>
      <span className={cx('sl-radio', checked && 'is-on')} />
      {label}
    </label>
  );
}

/* ============================================================ Surfaces */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}
export function Card({ className, ...rest }: CardProps) {
  return <div className={cx('sl-card', className)} {...rest} />;
}

export interface StatProps {
  value: React.ReactNode;
  label: React.ReactNode;
  accent?: boolean;
}
export function Stat({ value, label, accent }: StatProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span className="sl-stat__value" style={accent ? { color: 'var(--accent)' } : undefined}>{value}</span>
      <span className="sl-stat__label">{label}</span>
    </div>
  );
}

export interface NavItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: IconName;
  active?: boolean;
}
export function NavItem({ icon, active, className, children, ...rest }: NavItemProps) {
  return (
    <button className={cx('sl-nav', active && 'is-active', className)} {...rest}>
      {icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  );
}

/* ============================================================ Tabs / segmented */
export interface TabsProps {
  tabs: string[];
  value: string;
  onChange?: (tab: string) => void;
}
export function Tabs({ tabs, value, onChange }: TabsProps) {
  return (
    <div className="sl-tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t} role="tab" aria-selected={t === value} className={cx('sl-tab', t === value && 'is-active')} onClick={() => onChange?.(t)}>
          {t}
        </button>
      ))}
    </div>
  );
}

export interface SegmentedProps {
  options: string[];
  value: string;
  onChange?: (option: string) => void;
}
export function Segmented({ options, value, onChange }: SegmentedProps) {
  return (
    <div className="sl-segmented" role="tablist">
      {options.map((o) => (
        <button key={o} role="tab" aria-selected={o === value} className={cx('sl-segmented__item', o === value && 'is-active')} onClick={() => onChange?.(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

/* ============================================================ Banner */
export interface BannerProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'success' | 'danger';
}
export function Banner({ variant = 'success', className, children, ...rest }: BannerProps) {
  return (
    <div className={cx('sl-banner', `sl-banner--${variant}`, className)} {...rest}>
      <span className="sl-banner__icon">
        <Icon name={variant === 'success' ? 'check-circle' : 'alert'} size={17} strokeWidth={2.1} />
      </span>
      <span>{children}</span>
    </div>
  );
}

/* ============================================================ Avatar */
export interface AvatarProps {
  initials?: string;
  src?: string;
  alt?: string;
  size?: number;
}
export function Avatar({ initials, src, alt = '', size = 32 }: AvatarProps) {
  return (
    <span className="sl-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}>
      {src ? <img src={src} alt={alt} /> : initials}
    </span>
  );
}

/* ============================================================ Table */
export interface Column<T> {
  key: keyof T & string;
  header: string;
}
export interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  actions?: (row: T) => React.ReactNode;
}
export function Table<T>({ columns, rows, rowKey, actions }: TableProps<T>) {
  return (
    <table className="sl-table">
      <thead>
        <tr>
          {columns.map((c) => <th key={c.key}>{c.header}</th>)}
          {actions && <th style={{ textAlign: 'right' }}>Actions</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)}>
            {columns.map((c) => <td key={c.key}>{String(row[c.key])}</td>)}
            {actions && <td style={{ textAlign: 'right' }}>{actions(row)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ============================================================ Breadcrumb / PageHeader */
export interface BreadcrumbProps {
  items: string[];
}
export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: 8, font: '500 13px/1 inherit', color: 'var(--text-muted)' }}>
      {items.map((item, i) => (
        <React.Fragment key={item}>
          {i > 0 && <Icon name="chevron-right" size={13} strokeWidth={2} />}
          <span style={i === items.length - 1 ? { color: 'var(--text)' } : undefined}>{item}</span>
        </React.Fragment>
      ))}
    </nav>
  );
}

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
      <div>
        <h1 style={{ margin: 0, font: '700 25px/1 inherit', letterSpacing: '-0.7px', color: 'var(--text)' }}>{title}</h1>
        {description && <p style={{ margin: '8px 0 0', font: '400 14px/1.5 inherit', color: 'var(--text-muted)', maxWidth: 600 }}>{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export { Icon } from './icons';
export type { IconName } from './icons';
