export function regionHref(input: {
  region?: string | null;
  flow?: string | null;
  superClass?: string | null;
}) {
  const fromRegion: Record<string, string> = {
    optic_lobe: "optic-lobe",
    mushroom_body: "mushroom-body",
    central_complex: "central-complex",
    sensory: "sensory",
    motor: "motor",
  };
  if (input.region && fromRegion[input.region]) return `/region/${fromRegion[input.region]}`;
  if (input.flow === "afferent") return "/region/afferent";
  if (input.flow === "efferent") return "/region/efferent";
  if (input.flow === "intrinsic") return "/region/intrinsic";
  if (input.superClass === "central") return "/region/central-brain";
  return "/regions";
}
