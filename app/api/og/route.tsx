import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const kind = q.get("kind") ?? "site";
  const title =
    kind === "play"
      ? `FLY #${q.get("n") ?? "—"}`
      : kind === "find"
        ? "YOUR NEURON"
        : kind === "neuron"
          ? (q.get("type") ?? "NEURON")
          : "THE INTERNET’S FLY BRAIN";
  const line2 =
    kind === "play"
      ? `${q.get("moves") ?? "—"} / 6  ${q.get("status") ?? ""}`
      : kind === "find"
        ? (q.get("arch") ?? q.get("id") ?? "")
        : kind === "neuron"
          ? (q.get("arch") ?? q.get("id") ?? "")
          : "Every neuron is real.";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f7f8f4",
          color: "#20271e",
          padding: 64,
          fontFamily: "ui-monospace, monospace",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, letterSpacing: 6 }}>
          <span>FLY</span>
          <span style={{ color: "#397519" }}>{kind.toUpperCase()}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 72, lineHeight: 0.9 }}>{title}</div>
          <div style={{ marginTop: 24, fontSize: 32, color: "#626b5e" }}>{line2}</div>
        </div>
        <div style={{ color: "#397519", fontSize: 20, letterSpacing: 4 }}>THE INTERNET’S FLY BRAIN</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
