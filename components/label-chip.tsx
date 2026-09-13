export function LabelChip({
  kind,
  children,
}: {
  kind: "DATA" | "DERIVED METRIC" | "INTERNET ARCHETYPE" | "GRAPH SIMULATION" | "USER";
  children?: React.ReactNode;
}) {
  const color =
    kind === "DATA"
      ? "border-[var(--accent)] text-[var(--accent)]"
      : kind === "INTERNET ARCHETYPE"
        ? "border-[var(--accent-2)] text-[var(--accent-2)]"
        : kind === "GRAPH SIMULATION"
          ? "border-[var(--danger)] text-[var(--danger)]"
          : "border-[var(--muted)] text-[var(--muted)]";
  return (
    <span className={`label inline-flex items-center gap-2 border px-2 py-1 ${color}`}>
      {kind}
      {children}
    </span>
  );
}
