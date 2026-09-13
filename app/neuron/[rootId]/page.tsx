import { NeuronExperience } from "@/components/neuron-experience";

export default async function NeuronPage({ params }: { params: Promise<{ rootId: string }> }) {
  const { rootId } = await params;
  return <NeuronExperience rootId={rootId} />;
}
