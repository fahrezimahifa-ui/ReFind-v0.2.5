"""B06 semantic/export/source cross-checks, separate from actual application tests."""
from __future__ import annotations

from collections import Counter, defaultdict, deque
import hashlib
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET
from urllib.parse import urlsplit

import pymupdf as fitz
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
DIAGRAMS = DOCS / "diagrams"
EXPORTS = DIAGRAMS / "exports"
RESULTS = {"scope": "B06 as-built documentation checks; runtime E2E evidence is reported separately", "checks": [], "application_tests": "Separate auth/account/Student/BM/fresh-install suites", "failures": []}


def check(name, condition, detail=None):
    RESULTS["checks"].append({"name": name, "passed": bool(condition), "detail": detail})
    if not condition:
        RESULTS["failures"].append(name)
    print(("PASS " if condition else "FAIL ") + name)


def reachable(start, graph):
    seen, todo = set(), deque([start])
    while todo:
        current = todo.popleft()
        if current not in seen:
            seen.add(current)
            todo.extend(graph[current])
    return seen


def verify_flows():
    model = json.loads((DIAGRAMS / "flow-model.json").read_text(encoding="utf-8"))
    check("exactly two actor names", model["lanes"] == ["Student", "Building Management"])
    check("FC01–FC06 plus user/app flow supplied", [f["id"].split("-")[0] for f in model["flows"]] == [f"FC{i:02d}" for i in range(1, 7)]+['UF01','AF01'])
    for flow in model["flows"]:
        graph, reverse, all_nodes, starts, ends = defaultdict(list), defaultdict(list), {}, [], []
        decisions_valid, edges_valid, pair_valid = True, True, True
        for sheet in flow["sheets"]:
            nodes = {n["id"]: n for n in sheet["nodes"]}
            outgoing = defaultdict(list)
            for n in sheet["nodes"]:
                key = sheet["id"] + ":" + n["id"]
                all_nodes[key] = n
                if n["kind"] == "start": starts.append(key)
                if n["kind"] == "end": ends.append(key)
            for edge in sheet["edges"]:
                valid = edge["source"] in nodes and edge["target"] in nodes
                edges_valid &= valid
                if not valid: continue
                source, target = sheet["id"] + ":" + edge["source"], sheet["id"] + ":" + edge["target"]
                graph[source].append(target)
                reverse[target].append(source)
                outgoing[edge["source"]].append(edge)
            for node in sheet["nodes"]:
                if node["kind"] == "decision":
                    branches = outgoing[node["id"]]
                    labels = [e["label"].strip() for e in branches]
                    decisions_valid &= len(branches) >= 2 and all(labels) and len(set(labels)) == len(labels)
        connectors = {key for key, n in all_nodes.items() if n["kind"] == "connector"}
        paired = set()
        for source, target, label in flow["connectors"]:
            valid = source in connectors and target in connectors and source != target
            valid &= all_nodes.get(source, {}).get("label") == label and all_nodes.get(target, {}).get("label") == label
            pair_valid &= valid
            paired.update((source, target))
            graph[source].append(target)
            reverse[target].append(source)
        pair_valid &= paired == connectors
        seen = reachable(starts[0], graph) if len(starts) == 1 else set()
        can_end = set()
        for end in ends:
            can_end.update(reachable(end, reverse))
        prefix = flow["id"].split("-")[0]
        implementation=flow['implementation']
        actual='\n'.join((ROOT/file).read_text(encoding='utf-8') for file in implementation['files'])
        check(prefix + " implementation files/functions exist", all(re.search(r'function\s+'+re.escape(name)+r'\s*\(',actual) for name in implementation['functions']))
        check(prefix + " exactly one Start across sheets", len(starts) == 1)
        check(prefix + " defined edges and paired connectors", edges_valid and pair_valid)
        check(prefix + " labelled decisions", decisions_valid)
        check(prefix + " all nodes reachable; no dead-end process", set(all_nodes) <= seen and set(all_nodes) <= can_end, {"nodes": len(all_nodes), "ends": len(ends)})
        xml = ET.parse(DIAGRAMS / "sources" / (flow["id"] + ".drawio"))
        xml_starts = xml.findall(".//mxCell[@data-kind='start']")
        check(prefix + " editable XML matches Start/sheet/actor counts", len(xml_starts) == 1 and len(xml.findall("diagram")) == len(flow["sheets"]) and all(len(d.findall(".//mxCell[@data-kind='lane']")) == 2 for d in xml.findall("diagram")))


def verify_schema():
    schema = json.loads((DOCS / "schema-contract.json").read_text(encoding="utf-8"))
    # This verifier checks the historical B06 diagrams. The live schema has its own exact checks.
    tables = {name: table for name, table in schema["tables"].items() if name != "item_photo_embeddings"}
    fks = [fk for table in tables.values() for fk in table["foreign_keys"]]
    check("actual schema counts/fingerprint", len(tables) == 14 and len(schema["views"]) == 2 and len(fks) == 25 and schema['actual_sql_sha256']==hashlib.sha256((ROOT/'database'/'schema.sql').read_bytes()).hexdigest())
    check("unique/CHECK baseline counts", sum(len(t["uniques"]) for t in tables.values()) == 13 and sum(len(t["checks"]) for t in tables.values()) == 9)
    correct = True
    for fk in fks:
        child, parent = tables[fk["child"]], tables[fk["parent"]]
        names = {c["name"] for c in child["columns"]}
        parents = {c["name"] for c in parent["columns"]}
        unique = any(set(u["columns"]) == set(fk["columns"]) for u in child["uniques"])
        nullable = any(c["nullable"] for c in child["columns"] if c["name"] in fk["columns"])
        correct &= set(fk["columns"]) <= names and set(fk["parent_columns"]) <= parents
        correct &= fk["cardinality"] == ("1:0..1" if unique else "1:M")
        correct &= fk["parent_per_child"] == ("0..1" if nullable else "1")
    check("cardinality consistent with unique/nullability/columns", correct)
    check("optional one-to-one is actual handover UNIQUE", [f["name"] for f in fks if f["cardinality"] == "1:0..1"] == ["fk_handover_claim"])
    check("no fictitious user_profiles entity", "user_profiles" not in tables)
    check("handover target delta records D05", schema["target_deltas"][0]["target"] == ["PENDING", "SCHEDULED", "COMPLETED"])
    all_xml_fks, declared = [], set()
    for key in ("ERD01-operational", "ERD02-reference"):
        xml = ET.parse(DIAGRAMS / "sources" / (key + ".drawio"))
        for cell in xml.findall(".//mxCell[@data-kind='entity']"):
            if "[REF]" not in cell.get("value", ""):
                declared.add(cell.get("id"))
        all_xml_fks.extend(cell.get("data-fk") for cell in xml.findall(".//mxCell[@edge='1']") if cell.get("data-fk"))
    check("ERD covers all fourteen real entities", declared == set(tables), {"declared": sorted(declared)})
    check("ERD includes each of 25 FKs exactly once", Counter(all_xml_fks) == Counter(f["name"] for f in fks))
    dictionary = (DOCS / "DATA_DICTIONARY.md").read_text(encoding="utf-8")
    check("dictionary covers every column/FK", all("`" + c["name"] + "`" in dictionary for t in tables.values() for c in t["columns"]) and all(f["name"] in dictionary for f in fks))


def verify_sitemap_and_docs():
    xml = ET.parse(DIAGRAMS / "sources" / "SITEMAP.drawio")
    landing = xml.find(".//mxCell[@id='landing']")
    check("sitemap root is Home / Landing Page", landing is not None and "Home / Landing Page" in landing.get("value", "") and "ReFind" not in landing.get("value", ""))
    pages = xml.findall(".//mxCell[@data-kind='page']")
    features = xml.findall(".//mxCell[@data-kind='feature']")
    routes = set()
    for page in pages:
        routes.update(re.findall(r"[a-z-]+\.html", html.unescape(page.get("value", ""))))
    expected = {"index.html", "login.html", "browse.html", "item.html", "report.html", "claim.html", "my-reports.html", "admin.html", "history.html", "notifications.html", "profile.html", "settings.html"}
    actual_routes=set(re.findall(r"'([a-z-]+\.html)'\s*=>",(ROOT/'app'/'routes.php').read_text(encoding='utf-8')))
    check("sitemap page/feature distinction and 12 actual routes", bool(pages) and bool(features) and routes == expected == actual_routes, {"routes": sorted(routes)})
    all_nodes=' '.join(cell.get('value','') for cell in xml.findall('.//mxCell'))
    check("sitemap records all three real BM tab routes", all('admin.html?tab='+tab in all_nodes for tab in ('reports','claims','handover')))
    text = (DOCS / "B01_BLUEPRINT.md").read_text(encoding="utf-8")
    check("R01–R12 traceability exists", all(re.search(rf"\| R{i:02d} \|", text) for i in range(1, 13)))
    plan = (DOCS / "ACCEPTANCE_TESTS.md").read_text(encoding="utf-8")
    check("acceptance plan references executed workflow and release coverage", "Status B02" in plan and "verification/b05/workflow-results.json" in plan and "RL01" in plan)
    bad_links = []
    for file in [ROOT / "README.md"] + list(DOCS.glob("*.md")):
        for target in re.findall(r"\]\(([^)]+)\)", file.read_text(encoding="utf-8")):
            if "://" in target or target.startswith("#"): continue
            if not (file.parent / target.split("#")[0]).exists(): bad_links.append(str(file.relative_to(ROOT)) + ": " + target)
    # Report is authored after this first pass; it is checked by the final verifier rerun.
    check("documentation local links resolve", not bad_links, bad_links)
    class Links(HTMLParser):
        def __init__(self):
            super().__init__()
            self.targets = []
        def handle_starttag(self, tag, attrs):
            self.targets.extend(value for key, value in attrs if key in ("href", "src") and value)
    html_missing = []
    for file in (DOCS / "index.html", DOCS / "wireframes" / "index.html"):
        parser = Links()
        parser.feed(file.read_text(encoding="utf-8"))
        for target in parser.targets:
            if target.startswith("#") or "://" in target:
                continue
            destination=(file.parent/urlsplit(target).path).resolve()
            virtual_route=destination.parent==ROOT and destination.name in actual_routes
            if not destination.exists() and not virtual_route:
                html_missing.append(str(file.relative_to(ROOT)) + ": " + target)
    check("HTML overview/wireframe links and media resolve", not html_missing, html_missing)
    graph_styles = []
    for key in ("SITEMAP", "ERD01-operational", "ERD02-reference"):
        source = ET.parse(DIAGRAMS / "sources" / (key + ".drawio"))
        graph_styles.extend(cell.get("style", "") for cell in source.findall(".//mxCell[@vertex='1']") if cell.get("data-kind"))
    check("editable graph nodes have real HTML/shape styles", bool(graph_styles) and all("html=1" in style and "fillColor=" in style for style in graph_styles))


def verify_exports():
    manifest = json.loads((DIAGRAMS / "manifest.json").read_text(encoding="utf-8"))
    expected_sheets = [s for a in manifest["artifacts"] for s in a["sheets"]]
    pdf_ok, png_ok, targets, xml_ok = True, True, True, True
    for artifact in manifest["artifacts"]:
        try:
            ET.parse(DIAGRAMS / "sources" / (artifact["id"] + ".drawio"))
        except ET.ParseError:
            xml_ok = False
        for key in artifact["sheets"]:
            svg = EXPORTS / (key + ".svg")
            svg_root = ET.parse(svg).getroot()
            text = " ".join(svg_root.itertext())
            targets &= "As-built / B06" in text and 'Target / To-be' not in text
            with Image.open(EXPORTS / (key + ".png")) as image:
                png_ok &= image.width > 300 and image.height > 200
                extrema = image.convert("L").getextrema()
                png_ok &= extrema[0] < 180 and extrema[1] > 200
            with fitz.open(EXPORTS / (key + ".pdf")) as pdf:
                pdf_ok &= len(pdf) == 1 and bool(pdf[0].get_text().strip())
    with fitz.open(EXPORTS / "BLUEPRINT_DIAGRAMS.pdf") as pdf:
        check("combined diagram PDF sheet count", len(pdf) == len(expected_sheets), {"pages": len(pdf)})
    for prefix, pages in (("FC04", 2), ("FC05", 2)):
        with fitz.open(EXPORTS / (prefix + ".pdf")) as pdf:
            check(prefix + " connector sheets bundled", len(pdf) == pages)
    check("editable draw.io XML/SVG and as-built labelling", xml_ok and targets and manifest['status']=='As-built / B06')
    check("PNG exports are readable nonblank images", png_ok)
    check("single-sheet PDFs are nonblank and one page", pdf_ok)
    wf_export = DOCS / "wireframes" / "exports"
    with fitz.open(wf_export / "WIREFRAMES.pdf") as pdf:
        check("wireframes PDF contains exactly eight boards", len(pdf) == 8, {"pages": len(pdf)})
    render = json.loads((DOCS / "verification" / "render-results.json").read_text(encoding="utf-8"))
    check("wireframe render has no external requests or browser errors", not render["browserErrors"] and not render["networkRequests"])
    check("diagram text remains within SVG export canvas", all(not d["clippedTexts"] for d in render["diagrams"]))
    check("wireframe frames fit; no horizontal clipping; bottom reachable", all(f["withinBoard"] and not f["horizontalOverflow"] and f["lastElementReachable"] for b in render["wireframes"] for f in b["frames"]))
    check("eight wireframe PNG exports exist", all((wf_export / f"WF{i:02d}.png").exists() for i in range(1, 9)))
    wireframe_source=ET.parse(DOCS/'wireframes'/'sources'/'WIREFRAMES.drawio')
    check("eight editable draw.io wireframe boards", len(wireframe_source.findall('diagram'))==8 and all(len(d.findall(".//mxCell[@data-kind='wireframe-component']"))>20 for d in wireframe_source.findall('diagram')))
    check("wireframe draw.io sources are individual editable components", all((DOCS/'wireframes'/'sources'/f'WF{i:02d}.drawio').is_file() for i in range(1,9)))
    with fitz.open(EXPORTS/'AS_BUILT_DIAGRAMS.pdf') as pdf:
        check("final as-built PDF covers all sheets", len(pdf)==len(expected_sheets))


def contact_sheet():
    files = sorted(EXPORTS.glob("*.png")) + sorted((DOCS / "wireframes" / "exports").glob("WF*.png"))
    columns, tile_w, tile_h = 4, 390, 300
    canvas = Image.new("RGB", (columns * tile_w, ((len(files) + columns - 1) // columns) * tile_h), "#eef1f6")
    draw = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype(r"C:\Windows\Fonts\arial.ttf", 16)
    except OSError:
        font = ImageFont.load_default()
    for i, file in enumerate(files):
        x, y = (i % columns) * tile_w, (i // columns) * tile_h
        draw.text((x + 10, y + 6), file.stem, font=font, fill="#17266d")
        with Image.open(file) as image:
            image.thumbnail((tile_w - 20, tile_h - 35))
            canvas.paste(image.convert("RGB"), (x + (tile_w - image.width) // 2, y + 30))
    canvas.save(DOCS / "verification" / "contact-sheet.png")


def main():
    verify_flows()
    verify_schema()
    verify_sitemap_and_docs()
    verify_exports()
    contact_sheet()
    RESULTS["passed"] = not RESULTS["failures"]
    RESULTS["check_count"] = len(RESULTS["checks"])
    RESULTS["files_sha256"] = {str(p.relative_to(ROOT)).replace("\\", "/"): hashlib.sha256(p.read_bytes()).hexdigest()
                                for p in sorted(DIAGRAMS.rglob("*")) if p.is_file()}
    output=DOCS/'verification'/'b06';output.mkdir(exist_ok=True)
    (output / "artifact-results.json").write_text(json.dumps(RESULTS, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"B06 as-built verification: {len(RESULTS['checks'])} checks, {len(RESULTS['failures'])} failures. Runtime suites are separate.")
    sys.exit(0 if RESULTS["passed"] else 1)


if __name__ == "__main__":
    main()
