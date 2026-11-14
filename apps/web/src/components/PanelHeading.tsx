export function PanelHeading({
  id,
  title,
  hint,
}: {
  id: string;
  title: string;
  hint?: string | undefined;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h2
        id={id}
        className="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
      >
        {title}
      </h2>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}
