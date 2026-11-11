"""Freeze pilot evaluation manifests from a reviewed corpus and its QA import receipt."""
import argparse
import hashlib
import json
from pathlib import Path


def freeze(corpus_path, receipt_path):
    corpus = json.loads(corpus_path.read_text(encoding='utf-8'))
    receipt = json.loads(receipt_path.read_text(encoding='utf-8'))
    if not receipt.get('complete') or receipt['dataset'] != corpus['dataset']:
        raise ValueError('Import the reviewed corpus into QA first')
    if receipt['corpus_sha256'] != hashlib.sha256(corpus_path.read_bytes()).hexdigest():
        raise ValueError('Imported corpus has changed')
    objects = {}
    all_hashes = set()
    for asset in corpus['assets']:
        if asset['sha256'] in all_hashes:
            raise ValueError('Repeated photograph across splits')
        all_hashes.add(asset['sha256'])
        image = corpus_path.parent / asset['image']
        if image.is_symlink() or image.parent != corpus_path.parent or hashlib.sha256(image.read_bytes()).hexdigest() != asset['sha256']:
            raise ValueError('Changed or redirected source image')
        object_id = asset['object_id']
        split = asset['split']
        if object_id in objects and objects[object_id] != split:
            raise ValueError('A physical object crosses dataset splits')
        objects[object_id] = split
    for split in ('validation', 'held_out'):
        references = [a for a in corpus['assets'] if a['split'] == split and a['role'] in ('reference', 'gallery')]
        by_object = {a['object_id']: receipt['items'][a['id']]['report_id'] for a in references}
        locations = {a['location_id'] for a in references}
        if len(locations) != 1:
            raise ValueError('A pilot gallery needs one isolated campus-area filter')
        gallery = [{'report_id': receipt['items'][a['id']]['report_id'],
                    'photo_id': receipt['items'][a['id']]['photo_id'], 'sha256': a['sha256']} for a in references]
        queries = []
        for asset in corpus['assets']:
            if asset['split'] != split or asset['role'] not in ('positive', 'lookalike', 'irrelevant'):
                continue
            group = {'positive': 'same_object', 'lookalike': 'lookalike', 'irrelevant': 'irrelevant'}[asset['role']]
            expected = [] if group == 'irrelevant' else [by_object[asset.get('expected_object_id', asset['object_id'])]]
            if group == 'same_object' and not asset.get('identity_evidence'):
                raise ValueError('Positive queries require source-supported physical identity')
            if group == 'lookalike' and asset['object_id'] == asset['expected_object_id']:
                raise ValueError('A look-alike must be a different physical object')
            queries.append({'group': group, 'expected_ids': expected, 'image': asset['image'], 'sha256': asset['sha256']})
        manifest = {'dataset': corpus['dataset'], 'split': split, 'filters': {'location_id': next(iter(locations))},
                    'gallery': gallery, 'queries': queries,
                    'limitations': corpus.get('limitations', [])}
        groups = {name: sum(q['group'] == name for q in queries) for name in ('same_object', 'lookalike', 'irrelevant')}
        if groups['same_object'] < 4 or groups['lookalike'] < 4 or groups['irrelevant'] < 10:
            raise ValueError('Pilot needs 4 positives, 4 look-alikes and 10 irrelevant queries per split')
        output = corpus_path.parent / (split + '.json')
        content = json.dumps(manifest, indent=2) + '\n'
        if output.exists() and output.read_text(encoding='utf-8') != content:
            raise ValueError('An evaluation manifest is already frozen; preserve it')
        if not output.exists():
            output.write_text(content, encoding='utf-8')
        print(split + ': ' + str(len(gallery)) + ' gallery reports; ' + str(groups))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('corpus', type=Path)
    parser.add_argument('qa_receipt', type=Path)
    args = parser.parse_args()
    freeze(args.corpus.resolve(), args.qa_receipt.resolve())
