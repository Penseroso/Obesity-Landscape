type DistributionBarProps = {
  label: string;
  count: number;
  share: number;
};

export function DistributionBar({ label, count, share }: DistributionBarProps) {
  const percent = Math.round(share * 100);

  return (
    <div className="flex items-center gap-3">
      <span
        className="w-28 shrink-0 truncate text-sm text-foreground"
        title={label}
      >
        {label}
      </span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="w-20 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
        {count} &middot; {percent}%
      </span>
    </div>
  );
}
