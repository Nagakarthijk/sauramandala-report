import { cx } from '@/lib/utils';

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cx('rounded-lg border border-ink/10 bg-white shadow-sm', className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink/10 px-4 py-3">
      <div>
        <h2 className="font-heading text-lg">{title}</h2>
        {subtitle ? <p className="text-sm text-ink/60">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cx('p-4', className)}>{children}</div>;
}
