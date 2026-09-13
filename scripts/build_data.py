"""Reproduce the FlyLab MCNS v1.0 research subset from Janelia's public release.

Requires Python 3, pyarrow and numpy. Run from the project root.
Use --cache-dir to reuse the two original Feather downloads.
This script does not infer activity, neurotransmitter sign or animal behavior.
"""
import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path
import urllib.request

import numpy as np
import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.feather as feather
import pyarrow.ipc as ipc

BASE = 'https://storage.googleapis.com/flyem-male-cns/v1.0/'
FILES = {
    'annotations': BASE + 'connectome-data/flat-connectome/body-annotations-male-cns-v1.0-minconf-0.5.feather',
    'weights': BASE + 'connectome-data/flat-connectome/connectome-weights-male-cns-v1.0-minconf-0.5.feather',
}
ROOT_TYPES = ['DNge104', 'DNp01', 'DNp09']

def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(4 * 1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache-dir', default='/tmp')
    args = parser.parse_args()
    cache = Path(args.cache_dir)
    cache.mkdir(parents=True, exist_ok=True)
    out = Path(__file__).resolve().parents[1] / 'dist' / 'data'
    out.mkdir(parents=True, exist_ok=True)
    paths = {k: cache / ('mcns-' + k + '.feather') for k in FILES}
    for k, path in paths.items():
        if not path.exists():
            urllib.request.urlretrieve(FILES[k], path)
    annotation_table = feather.read_table(paths['annotations'])
    annotations = {r['bodyId']: r for r in annotation_table.to_pylist()}
    eligible = {i for i, r in annotations.items() if r['status'] == 'Traced'}
    roots = {t: sorted(i for i, r in annotations.items() if r['type'] == t and i in eligible) for t in ROOT_TYPES}
    root_ids = sorted(set(sum(roots.values(), [])))
    root_set = pa.array(root_ids, type=pa.int64())
    reader = ipc.open_file(pa.memory_map(str(paths['weights']), 'r'))
    root_edges = []
    total_rows = 0
    print('Reading actual connection graph:', reader.num_record_batches, 'batches', flush=True)
    for i in range(reader.num_record_batches):
        b = reader.get_batch(i)
        total_rows += b.num_rows
        keep = pc.or_(pc.is_in(b.column('body_pre'), value_set=root_set), pc.is_in(b.column('body_post'), value_set=root_set))
        root_edges.extend(b.filter(keep).to_pylist())
    root_edges = [e for e in root_edges if e['body_pre'] in eligible and e['body_post'] in eligible and e['body_pre'] != e['body_post']]
    circuits = []
    all_ids = set()
    for typ, rs in roots.items():
        selected = set(rs)
        for root in rs:
            for direction, partner in [('body_pre', 'body_post'), ('body_post', 'body_pre')]:
                candidates = sorted((e for e in root_edges if e[direction] == root), key=lambda e: (-e['weight'], e[partner]))[:4]
                selected.update(e[partner] for e in candidates)
        circuits.append({'id': typ, 'name': typ, 'roots': rs, 'nodes': sorted(selected)})
        all_ids.update(selected)
    print('Selected', len(all_ids), 'real neurons across', len(circuits), 'circuits', flush=True)
    subset = pa.array(sorted(all_ids), type=pa.int64())
    edges = []
    for i in range(reader.num_record_batches):
        b = reader.get_batch(i)
        keep = pc.and_(pc.is_in(b.column('body_pre'), value_set=subset), pc.is_in(b.column('body_post'), value_set=subset))
        edges.extend(b.filter(keep).to_pylist())
    edges = [{'source': e['body_pre'], 'target': e['body_post'], 'weight': e['weight']} for e in edges]
    assert len({(e['source'], e['target']) for e in edges}) == len(edges), 'Unexpected duplicate body pair'
    assert all(isinstance(e['weight'], int) and e['weight'] > 0 for e in edges)
    skeleton_dir = cache / 'mcns-skeletons'
    skeleton_dir.mkdir(exist_ok=True)

    def skeleton(body):
        url = BASE + f'segmentation/skeletons-malecns/skeletons-swc/{body}.swc'
        path = skeleton_dir / f'{body}.swc'
        if not path.exists():
            with urllib.request.urlopen(url, timeout=60) as response:
                path.write_bytes(response.read())
        points = {}
        for line in path.read_text().splitlines():
            if not line or line.startswith('#'):
                continue
            fields = line.split()
            if len(fields) != 7:
                raise ValueError(f'Invalid SWC record for {body}')
            # Official SWC coordinates use 8 nm units. Convert to micrometres.
            points[int(fields[0])] = (tuple(float(x) * .008 for x in fields[2:5]), int(fields[6]))
        positions = []
        for pos, parent in points.values():
            if parent != -1:
                assert parent in points, f'Missing SWC parent for {body}'
                positions.extend(points[parent][0])
                positions.extend(pos)
        assert positions, f'Empty skeleton for {body}'
        data = np.array(positions, dtype='<f4')
        destination = out / f'{body}.bin'
        destination.write_bytes(data.tobytes())
        xyz = data.reshape(-1, 3)
        return body, {'url': url, 'sha256': sha(path), 'file': f'data/{body}.bin', 'pointCount': len(points), 'segments': len(positions) // 6,
                      'bounds': [xyz.min(axis=0).tolist(), xyz.max(axis=0).tolist()], 'bytes': destination.stat().st_size}

    skeletons = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        for body, info in pool.map(skeleton, sorted(all_ids)):
            skeletons[body] = info
            print('Skeleton', body, info['segments'], 'measured segments', flush=True)
    fields = ['type', 'instance', 'somaSide', 'superclass', 'class', 'subclass', 'status', 'statusLabel', 'flywireType', 'synonyms', 'somaNeuromere']
    neurons = []
    for body in sorted(all_ids):
        row = annotations[body]
        neurons.append({'id': body, **{k: row[k] for k in fields}, 'soma': [v * .008 for v in row['somaLocation']] if row['somaLocation'] else None, 'skeleton': skeletons[body]})
    for c in circuits:
        ids = set(c['nodes'])
        selected_edges = [e for e in edges if e['source'] in ids and e['target'] in ids]
        c['edgeCount'] = len(selected_edges)
        c['synapseCount'] = sum(e['weight'] for e in selected_edges)
    provenance = {'dataset': 'male-cns:v1.0', 'sourcePage': 'https://male-cns.janelia.org/download/',
                  'datasetUUID': '4b2087c0fbe046bfaf0d60bc970e3e5d',
                  'license': 'https://creativecommons.org/licenses/by/4.0/',
                  'attribution': 'FlyEM, HHMI Janelia; University of Cambridge; MRC Laboratory of Molecular Biology; Google Research.',
                  'citation': 'Sexual dimorphism in the complete connectome of the Drosophila male central nervous system. Cell (2026).',
                  'paper': 'https://www.cell.com/cell/fulltext/S0092-8674(26)00942-6',
                  'selection': 'For each bilateral root type, select the four strongest incoming and four strongest outgoing partners of each root among annotated bodies with status Traced; exclude self connections when ranking. Include every published directed connection among the selected bodies, including self connections if present. Ties break by partner body ID.',
                  'confidence': 'Original flat connectome release minconf 0.5; weights are synapse counts.',
                  'geometry': 'Published SWC skeleton centre lines; every parent segment retained. Coordinates multiplied by 0.008 to convert 8 nm units to micrometres. Binary files contain little endian float32 XYZ endpoint pairs.',
                  'limitations': 'This is a selected structural subgraph, not the entire brain. Synapse counts do not establish excitatory or inhibitory effects, electrical activity, causal behavior or dynamics. Skeletons are published reconstructions, not raw microscopy.',
                  'annotationRows': annotation_table.num_rows, 'tracedAnnotationRows': len(eligible), 'sourceConnectionRows': total_rows,
                  'files': {k: {'url': FILES[k], 'sha256': sha(path), 'bytes': path.stat().st_size} for k, path in paths.items()}}
    result = {'provenance': provenance, 'circuits': circuits, 'neurons': neurons, 'edges': edges}
    (out / 'connectome.json').write_text(json.dumps(result, separators=(',', ':')))
    (out / 'provenance.json').write_text(json.dumps(provenance, indent=2))
    print('DONE', len(neurons), 'neurons', len(edges), 'directed body pairs', sum(e['weight'] for e in edges), 'synapses', flush=True)

if __name__ == '__main__':
    main()
