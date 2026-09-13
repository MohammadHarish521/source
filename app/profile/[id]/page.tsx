import { asUser, collections } from "@/lib/db";
import { connectome } from "@/lib/connectome/provider";
import Link from "next/link";
import { formatNumber, shortId } from "@/lib/utils";

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { users, claims } = await collections();
  const raw = (await users.findOne({ _id: id })) ?? (await users.findOne({ handle: id }));
  const user = asUser(raw);
  if (!user) return <main className="px-5 py-16">No public profile yet.</main>;
  const neuron = user.neuron_id ? await connectome.getNeuron(String(user.neuron_id)) : null;
  const claimed = await claims.find({ user_id: user.id }).toArray();
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <p className="label">PUBLIC PROFILE</p>
      <h1 className="mt-3 text-5xl">{String(user.handle)}</h1>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="STREAK" value={String(user.streak)} />
        <Stat label="BEST SIX" value={String(user.best_six_degrees ?? "—")} />
        <Stat label="FOUND" value={formatNumber(Number(user.neurons_discovered))} />
        <Stat label="TRAVERSED" value={formatNumber(Number(user.connections_explored))} />
      </div>
      {user.favorite_region ? (
        <Link href={`/region/${String(user.favorite_region)}`} className="mt-6 inline-block label text-[var(--accent)]">
          FAVORITE REGION · {String(user.favorite_region)}
        </Link>
      ) : null}
      {neuron ? (
        <Link href={`/neuron/${neuron.rootId}`} className="panel mt-8 block p-5">
          <p className="label">THEIR NEURON</p>
          <p className="mt-2 text-2xl">{neuron.cellType ?? shortId(neuron.rootId)}</p>
          <p className="font-mono text-xs text-[var(--muted)]">{neuron.rootId}</p>
        </Link>
      ) : null}
      <h2 className="mt-10 text-2xl">Claimed slots</h2>
      <ul className="mt-4">
        {claimed.map((c) => (
          <li key={String(c.root_id)} className="border-b border-[var(--line)] py-2">
            <Link href={`/neuron/${String(c.root_id)}`}>
              #{String(c.claim_number)} · {shortId(String(c.root_id))}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-3">
      <p className="label">{label}</p>
      <p className="mt-2 font-mono text-xl text-[var(--accent)]">{value}</p>
    </div>
  );
}
