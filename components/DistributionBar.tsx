type DistributionBarProps = {
  label: string;
  count: number;
  share: number;
};

export function DistributionBar({ label, count, share }: DistributionBarProps) {
  const percent = Math.round(share * 100);

  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 truncate text-sm text-foreground" title={label}>
        {label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-sm bg-muted">
        <div
          className="h-full rounded-sm bg-primary"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="w-16 shrink-0 text-right text-sm text-muted-foreground">
        {count} &middot; {percent}%
      </span>
    </div>
  );
}
