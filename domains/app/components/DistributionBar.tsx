type DistributionBarProps = {
  label: string;
  count: number;
  share: number;
};

export function DistributionBar({ label, count, share }: DistributionBarProps) {
  const percent = Math.round(share * 100);

  return (
    <div className="grid grid-cols-[minmax(7rem,11rem)_minmax(0,1fr)_auto] items-center gap-3">
      <span
        className="line-clamp-2 text-sm font-medium leading-tight text-foreground"
        title={label}
      >
        {label}
      </span>
      <div className="h-3 overflow-hidden rounded-sm border border-border bg-muted">
        <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-right text-sm font-semibold tabular-nums text-primary">
        {count}
        <span className="ml-1 font-normal text-muted-foreground">{percent}%</span>
      </span>
    </div>
  );
}
