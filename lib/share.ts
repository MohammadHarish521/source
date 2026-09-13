export function playShareText(input: {
  number: number;
  moves: number;
  status: "CONNECTED" | "FAILED";
}) {
  const dots = Array.from({ length: 6 }, (_, i) => (i < input.moves ? "●" : "○")).join(" ");
  return [`FLY #${String(input.number).padStart(3, "0")}`, `${input.moves} / 6`, dots, input.status].join("\n");
}

export function findShareText(input: {
  rootId: string;
  archetype?: string | null;
  cellType?: string | null;
  partners?: number | null;
}) {
  const lines = ["YOUR NEURON", `#${input.rootId}`];
  if (input.archetype) lines.push(input.archetype);
  if (input.cellType) lines.push(input.cellType);
  if (input.partners != null) lines.push(`${input.partners.toLocaleString()} partners`);
  lines.push("Every neuron is real.");
  return lines.join("\n");
}

export function neuronShareText(input: {
  rootId: string;
  cellType?: string | null;
  archetype?: string | null;
}) {
  return [
    input.cellType ?? "Unnamed cell",
    `#${input.rootId}`,
    input.archetype ?? "",
    "A real neuron in FLY.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function pathShareText(hops: number, from: string, to: string) {
  return `HOW ARE THESE NEURONS CONNECTED?\n${from}\n↓\n${to}\n${hops} HOPS`;
}

export async function shareOrCopy(text: string) {
  void fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: "share_click" }),
  });
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title: "FLY", text });
      return "shared" as const;
    }
  } catch {
    /* user cancelled or unsupported */
  }
  await navigator.clipboard.writeText(text);
  return "copied" as const;
}
