export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-ink/20 px-6 py-12 text-center">
      <h3 className="font-heading text-lg">{title}</h3>
      {description ? <p className="max-w-md text-sm text-ink/60">{description}</p> : null}
      {action}
    </div>
  );
}
