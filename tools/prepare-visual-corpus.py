"""Fetch individually licensed Commons photos into a private, reviewable QA corpus.

Requires Pillow. No database access. Discovery never authorizes indexing; only
reviewed entries in the checked-in source catalog are prepared for import.
"""
import argparse
import hashlib
import html
import io
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

API = 'https://commons.wikimedia.org/w/api.php'
AGENT = 'ReFind-Academic-QA/1.0 (licensed educational image retrieval)'
ROOT = Path(__file__).resolve().parents[1]


def fetch(url, maximum=20_000_000):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != 'https' or parsed.hostname not in {
        'commons.wikimedia.org', 'upload.wikimedia.org', 'thumb.wikimedia.org'
    }:
        raise ValueError('Only HTTPS Wikimedia sources are supported')
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': AGENT}), timeout=15) as response:
                result = response.read(maximum + 1)
            if len(result) > maximum:
                raise ValueError('Photo exceeds the download limit')
            return result
        except urllib.error.HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 3:
                raise
            time.sleep(min(60, int(error.headers.get('Retry-After', 3 * (attempt + 1)))))
        except (TimeoutError, urllib.error.URLError):
            if attempt == 3:
                raise
            time.sleep(2 * (attempt + 1))


def api(**values):
    return json.loads(fetch(API + '?' + urllib.parse.urlencode({'action': 'query', 'format': 'json', **values})))


def plain(value):
    return html.unescape(re.sub('<[^>]+>', '', value)).strip()


def metadata(title, page=None):
    if page is None:
        pages = api(titles=title, prop='imageinfo', iiprop='url|extmetadata|sha1|size', iiurlwidth=1000)['query']['pages']
        page = next(iter(pages.values()))
    info = page['imageinfo'][0]
    meta = info['extmetadata']
    value = lambda key: plain(meta.get(key, {}).get('value', ''))
    license_name = value('LicenseShortName')
    license_url = meta.get('LicenseUrl', {}).get('value', '')
    if license_url.startswith('//'):
        license_url = 'https:' + license_url
    if license_url.startswith('http://creativecommons.org/'):
        license_url = 'https://' + license_url[len('http://'):]
    public_self = (license_name == 'Public domain' and value('Copyrighted') == 'False'
                   and 'PD-self' in value('Categories').split('|'))
    if public_self:
        license_url = 'https://commons.wikimedia.org/wiki/Template:PD-self'
    if not public_self and license_name != 'CC0' and not re.fullmatch(r'CC BY(?:-SA)? [1-4]\.[0-9](?: de)?', license_name):
        raise ValueError('Unsupported or ambiguous license: ' + license_name)
    if (not public_self and not license_url.startswith('https://creativecommons.org/')) or not value('Artist'):
        raise ValueError('Missing license link or author')
    return {'title': page['title'], 'page': info['descriptionurl'], 'original_url': info['url'],
            'download_url': info.get('thumburl', info['url']), 'commons_sha1': info['sha1'],
            'author': value('Artist'), 'license': license_name, 'license_url': license_url,
            'description': value('ImageDescription'), 'capture_date': value('DateTimeOriginal')}


def jpeg(data):
    with Image.open(io.BytesIO(data)) as source:
        if source.format not in ('JPEG', 'PNG', 'WEBP'):
            raise ValueError('Expected a raster photograph')
        image = ImageOps.exif_transpose(source).convert('RGB')
        image.thumbnail((1000, 1000))
        for quality in (88, 80, 70, 60):
            output = io.BytesIO()
            image.save(output, 'JPEG', quality=quality, optimize=True)
            if len(output.getvalue()) <= 250000:
                return output.getvalue()
    raise ValueError('Prepared photograph exceeds the upload limit')


def review_sheet(entries, directory):
    for start in range(0, len(entries), 30):
        subset = entries[start:start + 30]
        sheet = Image.new('RGB', (1000, 200 * ((len(subset) + 4) // 5)), 'white')
        draw = ImageDraw.Draw(sheet)
        for index, entry in enumerate(subset):
            x, y = (index % 5) * 200, (index // 5) * 200
            with Image.open(directory / entry['image']) as photo:
                photo.thumbnail((190, 155))
                sheet.paste(photo, (x, y))
            draw.text((x + 3, y + 158), entry['id'], fill='black')
            draw.text((x + 3, y + 173), entry['subject'][:26], fill='black')
        sheet.save(directory / f'contact-{start // 30 + 1:02}.jpg')


def prepare(catalog, directory):
    source = json.loads(catalog.read_text(encoding='utf-8'))
    if len({entry['id'] for entry in source['assets']}) != len(source['assets']):
        raise ValueError('Asset identifiers must be unique')
    directory.mkdir(parents=True, exist_ok=True)
    entries, hashes = [], set()
    receipt_path = directory / 'corpus.json'
    previous = json.loads(receipt_path.read_text(encoding='utf-8')) if receipt_path.exists() else {'assets': []}
    known = {entry['id']: entry for entry in previous['assets']}
    def prepare_one(entry):
        if not re.fullmatch(r'[a-z0-9-]{1,60}', entry['id']):
            raise ValueError('Invalid asset identifier')
        if entry.get('reviewed') is not True:
            raise ValueError('Every source requires explicit subject/privacy/license review')
        target = directory / (entry['id'] + '.jpg')
        old = known.get(entry['id'])
        if old and old['source']['title'] == entry['title'] and target.exists():
            prepared = target.read_bytes()
            if hashlib.sha256(prepared).hexdigest() != old['sha256']:
                raise ValueError('A frozen local image changed')
            provenance = old['source']
            if entry.get('commons_sha1') and entry['commons_sha1'] != provenance['commons_sha1']:
                raise ValueError('Source revision differs from the saved receipt')
        else:
            # A reviewed catalog may carry the metadata already fetched during
            # selection. Pin its revision and URLs; this avoids repeated API
            # metadata requests when preparing a larger set of public assets.
            provenance = entry.get('source_metadata') or metadata(entry['title'])
            if (provenance.get('title') != entry['title'] or
                    not provenance.get('author') or not provenance.get('license_url', '').startswith((
                        'https://creativecommons.org/', 'https://commons.wikimedia.org/wiki/Template:PD-self'))):
                raise ValueError('Invalid reviewed source metadata')
            if entry.get('commons_sha1') and entry['commons_sha1'] != provenance['commons_sha1']:
                raise ValueError('The selected source revision changed')
            prepared = jpeg(fetch(provenance['download_url']))
            target.write_bytes(prepared)
        digest = hashlib.sha256(prepared).hexdigest()
        if entry.get('prepared_sha256') and entry['prepared_sha256'] != digest:
            raise ValueError('Prepared photograph differs from the pinned dataset')
        return {**entry, 'image': target.name, 'sha256': digest, 'source': provenance,
                'preparation': 'EXIF orientation, resize <=1000px, metadata stripped, JPEG'}
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = {pool.submit(prepare_one, entry): entry['id'] for entry in source['assets']}
        completed = {}
        for future in as_completed(futures):
            result = future.result()
            if result['sha256'] in hashes:
                raise ValueError('Repeated prepared photograph: ' + result['id'])
            hashes.add(result['sha256'])
            completed[result['id']] = result
            entries = [completed[entry['id']] for entry in source['assets'] if entry['id'] in completed]
            receipt_path.write_text(json.dumps({'version': 1, 'dataset': source['dataset'],
                                               'limitations': source.get('limitations', []), 'assets': entries}, indent=2) + '\n', encoding='utf-8')
            print('Prepared ' + result['id'], flush=True)
    review_sheet(entries, directory)
    credits = '\n'.join(f"<li>{html.escape(e['id'])}: <a href='{html.escape(e['source']['page'], quote=True)}'>{html.escape(e['source']['title'])}</a> — {html.escape(e['source']['author'])}, <a href='{html.escape(e['source']['license_url'], quote=True)}'>{html.escape(e['source']['license'])}</a>. Resized and re-encoded.</li>" for e in entries)
    (directory / 'credits.html').write_text('<!doctype html><meta charset="utf-8"><title>ReFind QA photo credits</title><h1>QA photo credits</h1><ul>' + credits + '</ul>', encoding='utf-8')
    print(f'{len(entries)} distinct photos. Review contact sheets before importing.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('catalog', type=Path)
    parser.add_argument('directory', type=Path)
    args = parser.parse_args()
    prepare(args.catalog.resolve(), args.directory.resolve())
