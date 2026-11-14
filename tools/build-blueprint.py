"""Build B06 as-built draw.io sources/exports from actual SQL and reconciled flows."""
from __future__ import annotations

import hashlib
import html
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import textwrap
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
SOURCES = DOCS / "diagrams" / "sources"
EXPORTS = DOCS / "diagrams" / "exports"
ZIP = Path(os.environ.get("REFIND_BASELINE_ZIP", r"C:\Users\LENOVO\Downloads\ReFind_Version 0.1.0.zip"))
DOT = os.environ.get("REFIND_DOT", r"C:\Program Files\Graphviz\bin\dot.exe")
SQL_SHA = "8b2fe2c560b524c4e8710280c1a7222551f0e52ee047f0201e7993b09f0ae289"
STATUS = "As-built / B06"
spec = importlib.util.spec_from_file_location("blueprint_diagrams", Path(__file__).with_name("blueprint-diagrams.py"))
DEFS = importlib.util.module_from_spec(spec)
spec.loader.exec_module(DEFS)


def dump_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def schema_from_zip():
    actual_schema = ROOT / 'database' / 'schema.sql'
    actual_sql = actual_schema.read_bytes() if actual_schema.is_file() else None
    raw = b''
    if actual_sql is None:
        with zipfile.ZipFile(ZIP) as archive:
            raw = archive.read("ReFind_Version 0.1.0/Database (mysql xampp)/refind_db_0_1_0.sql")
        if hashlib.sha256(raw).hexdigest() != SQL_SHA:
            raise ValueError("Baseline SQL fingerprint changed; inspect it before rebuilding.")
    sql = (actual_sql or raw).decode("utf-8")
    tables = {}
    for name, block in re.findall(r"CREATE TABLE(?: IF NOT EXISTS)? `([^`]+)` \((.*?)\n\) ENGINE", sql, re.S):
        columns, primary, uniques, foreign, checks = [], [], [], [], []
        for line in block.splitlines():
            line = line.strip().rstrip(",")
            match = re.match(r"`([^`]+)` (.+)", line)
            if match:
                column, definition = match.groups()
                columns.append({"name": column, "definition": definition, "nullable": "NOT NULL" not in definition})
            elif line.startswith("PRIMARY KEY"):
                primary = re.findall(r"`([^`]+)`", line)
            elif line.startswith("UNIQUE KEY"):
                names = re.findall(r"`([^`]+)`", line)
                uniques.append({"name": names[0], "columns": names[1:]})
            elif "FOREIGN KEY" in line:
                match = re.match(r"CONSTRAINT `([^`]+)` FOREIGN KEY \(([^)]+)\) REFERENCES `([^`]+)` \(([^)]+)\)(.*)", line)
                fk_name, child_columns, parent, parent_columns, actions = match.groups()
                foreign.append({"name": fk_name, "columns": re.findall(r"`([^`]+)`", child_columns), "parent": parent,
                                "parent_columns": re.findall(r"`([^`]+)`", parent_columns), "actions": actions.strip() or "RESTRICT (default)"})
            elif " CHECK " in line:
                checks.append(line)
        tables[name] = {"columns": columns, "primary": primary, "uniques": uniques, "foreign_keys": foreign, "checks": checks}
    for child, table in tables.items():
        cols = {c["name"]: c for c in table["columns"]}
        for fk in table["foreign_keys"]:
            fk["child"] = child
            unique = set(table["primary"]) == set(fk["columns"]) or any(set(u["columns"]) == set(fk["columns"]) for u in table["uniques"])
            fk["cardinality"] = "1:0..1" if unique else "1:M"
            fk["parent_per_child"] = "0..1" if any(cols[c]["nullable"] for c in fk["columns"]) else "1"
            fk["children_per_parent"] = "0..1" if unique else "0..M"
    visual_index = int("item_photo_embeddings" in tables)
    assert len(tables) == 14 + visual_index
    assert sum(len(t["foreign_keys"]) for t in tables.values()) == 25 + visual_index
    assert sum(len(t["uniques"]) for t in tables.values()) == 13
    assert sum(len(t["checks"]) for t in tables.values()) == 9 + visual_index
    return {"status": STATUS if actual_sql else "Target / To-be — proposal based on verified baseline SQL", "baseline_sql_sha256": SQL_SHA,
            "schema_implemented": bool(actual_sql), "actual_sql_sha256": hashlib.sha256(actual_sql).hexdigest() if actual_sql else None,
            "tables": tables, "views": ["v_items_overview", "v_pending_claims"],
            "target_deltas": [{"table": "handovers", "column": "handover_status", "baseline": ["PENDING", "SCHEDULED", "COMPLETED", "CANCELLED"],
                               "target": ["PENDING", "SCHEDULED", "COMPLETED"], "reason": "D05: cancellation of schedule returns to PENDING, ownership retained"}]}


def dictionary(schema):
    lines = ["# Data dictionary — " + ("As-built B06 / SQL 0.2.0" if schema["schema_implemented"] else "Target / To-be"), "",
             "Schema SQL 0.2.0 actual; status implementasi workflow dirinci di WORKFLOW_CONTRACT.md." if schema["schema_implemented"] else "Proposal berbasis SQL baseline yang diverifikasi; database 0.2.0 belum dibuat.", "",
             "**14 tables · 2 views · 25 FK · 14 PK · 13 UNIQUE · 9 CHECK.**", "",
             "Diagram menampilkan PK/FK dan fields relevan; dictionary ini memuat seluruh columns dan constraints.", "",
             "## Perbedaan terhadap baseline", "", "`handovers.handover_status`: baseline PENDING/SCHEDULED/COMPLETED/CANCELLED; schema 0.2.0 PENDING/SCHEDULED/COMPLETED. Batal jadwal → PENDING (D05), bukan membatalkan ownership. Operasi handover dan private audit dirinci di WORKFLOW_CONTRACT.md.", "",
             "## Cardinality", "", "Parent dapat memiliki nol children. `1:M` tidak mewajibkan minimal satu child. FK nullable berarti parent-per-child 0..1. `claims → handovers` 1:0..1 karena UNIQUE claim_id. Lost ↔ Found M:N melalui dua FK 1:M pada item_matches; one confirmed owner/pair juga diperiksa aplikasi.", ""]
    for name, table in schema["tables"].items():
        fk_cols = {c for f in table["foreign_keys"] for c in f["columns"]}
        lines += [f"## `{name}`", "", "| Column | PK/FK | Nullable | Actual SQL definition |", "|---|---|---|---|"]
        for col in table["columns"]:
            flags = [flag for flag, condition in [("PK", col["name"] in table["primary"]), ("FK", col["name"] in fk_cols)] if condition]
            definition = col["definition"].replace("|", "\\|")
            lines.append(f"| `{col['name']}` | {' / '.join(flags) or '—'} | {'Yes' if col['nullable'] else 'No'} | `{definition}` |")
        lines += ["", "- PK: " + ", ".join(f"`{c}`" for c in table["primary"]) + "."]
        for unique in table["uniques"]:
            lines.append(f"- UNIQUE `{unique['name']}`: ({', '.join(unique['columns'])}).")
        for fk in table["foreign_keys"]:
            lines.append(f"- FK `{fk['name']}`: ({', '.join(fk['columns'])}) → `{fk['parent']}` ({', '.join(fk['parent_columns'])}); {fk['actions']}; {fk['cardinality']}; parent/child {fk['parent_per_child']}, children/parent {fk['children_per_parent']}.")
        lines += ["- " + c for c in table["checks"]] + [""]
    lines += ["## Views", "", "- `v_items_overview`: public item projection; private clue/evidence/email/NIM excluded.",
              "- `v_pending_claims`: BM review projection; exposed only through authorized staff API.", "",
              "## Relationship index — 25 FK", "", "| FK | Parent → Child | Cardinality | Parent per child | Children per parent |", "|---|---|---|---|---|"]
    for table in schema["tables"].values():
        for fk in table["foreign_keys"]:
            lines.append(f"| `{fk['name']}` | `{fk['parent']}` → `{fk['child']}` | **{fk['cardinality']}** | {fk['parent_per_child']} | {fk['children_per_parent']} |")
    (DOCS / "DATA_DICTIONARY.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def graph_node_fields(name, table, stub=False):
    selected = set(table["primary"])
    selected.update(c for fk in table["foreign_keys"] for c in fk["columns"])
    if not stub:
        selected.update(DEFS.EXTRA_FIELDS.get(name, []))
    return [c for c in table["columns"] if c["name"] in selected]


def table_label(name, table, stub=False):
    fk_cols = {c for f in table["foreign_keys"] for c in f["columns"]}
    rows = [f'<TR><TD BGCOLOR="#17266d" COLSPAN="2"><FONT COLOR="white"><B>{name}{" [REF]" if stub else ""}</B></FONT></TD></TR>']
    for col in graph_node_fields(name, table, stub):
        flags = [flag for flag, condition in [("PK", col["name"] in table["primary"]), ("FK", col["name"] in fk_cols),
                 ("UQ", any(u["columns"] == [col["name"]] for u in table["uniques"]))] if condition]
        nullable = "?" if col["nullable"] else "!"
        col_type = re.split(r"\s+(?:NOT|DEFAULT|AUTO|ON)\b", col["definition"])[0]
        if col_type.startswith("enum("):
            col_type = "enum"
        rows.append(f'<TR><TD PORT="{col["name"]}" ALIGN="LEFT">{html.escape("/".join(flags) + " " + col["name"] + " " + nullable)}</TD><TD ALIGN="LEFT">{html.escape(col_type)}</TD></TR>')
    if table["uniques"] and not stub:
        for unique in table["uniques"]:
            if len(unique["columns"]) > 1:
                rows.append(f'<TR><TD COLSPAN="2" ALIGN="LEFT"><FONT POINT-SIZE="9">UQ ({html.escape(", ".join(unique["columns"]))})</FONT></TD></TR>')
    return '<<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="6" BGCOLOR="#f8fafc">' + "".join(rows) + "</TABLE>>"


def drawio_document(pages):
    root = ET.Element("mxfile", {"host": "app.diagrams.net", "agent": "ReFind B06 as-built draw.io generator", "version": "24.7.17"})
    for page in pages:
        diagram = ET.SubElement(root, "diagram", {"id": page["id"], "name": page["title"]})
        model = ET.SubElement(diagram, "mxGraphModel", {"dx": "1400", "dy": "900", "grid": "1", "gridSize": "10", "guides": "1", "tooltips": "1", "connect": "1", "arrows": "1", "fold": "1", "page": "1", "pageScale": "1", "pageWidth": str(math.ceil(page["width"])), "pageHeight": str(math.ceil(page["height"]))})
        cells = ET.SubElement(model, "root")
        ET.SubElement(cells, "mxCell", {"id": "0"})
        ET.SubElement(cells, "mxCell", {"id": "1", "parent": "0"})
        for cell in page["cells"]:
            element = ET.SubElement(cells, "mxCell", cell["attrs"])
            geometry = ET.SubElement(element, "mxGeometry", cell["geometry"])
            if cell.get("points"):
                arr = ET.SubElement(geometry, "Array", {"as": "points"})
                for x, y in cell["points"]:
                    ET.SubElement(arr, "mxPoint", {"x": str(round(x, 2)), "y": str(round(y, 2))})
    return ET.tostring(root, encoding="unicode", xml_declaration=False) + "\n"


def vertex(key, label, x, y, w, h, style, kind=None, lane=None):
    attrs = {"id": key, "value": label, "style": style, "vertex": "1", "parent": "1"}
    if kind:
        attrs["data-kind"] = kind
    if lane:
        attrs["data-lane"] = lane
    return {"attrs": attrs, "geometry": {"x": str(round(x, 2)), "y": str(round(y, 2)), "width": str(round(w, 2)), "height": str(round(h, 2)), "as": "geometry"}}


def graph_artifact(key, title, dot, node_values, relations=None):
    (SOURCES / f"{key}.dot").write_text(dot, encoding="utf-8")
    result = subprocess.run([DOT, "-Tjson"], input=dot, text=True, encoding="utf-8", capture_output=True, check=True)
    layout = json.loads(result.stdout)
    svg = subprocess.run([DOT, "-Tsvg"], input=dot, text=True, encoding="utf-8", capture_output=True, check=True).stdout
    (EXPORTS / f"{key}.svg").write_text(svg, encoding="utf-8")
    left, bottom, right, top = map(float, layout["bb"].split(","))
    factor = 4 / 3
    cells = []
    cells.append(vertex("title", html.escape(title + " · " + STATUS), 20, 6, (right - left) * factor - 40, 30, "text;html=1;fontSize=20;fontStyle=1;align=center;"))
    graph_nodes = {obj["_gvid"]: obj for obj in layout.get("objects", []) if obj.get("name") in node_values and "pos" in obj}
    for obj in graph_nodes.values():
        x, y = map(float, obj["pos"].split(","))
        w, h = float(obj["width"]) * 72 * factor, float(obj["height"]) * 72 * factor
        value, node_type = node_values[obj["name"]]
        style = "rounded=0;whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacing=8;fontSize=14;strokeColor=#17266d;fillColor=#f8fafc;"
        if node_type == "page":
            style = "rounded=1;whiteSpace=wrap;html=1;fontSize=15;strokeColor=#17266d;fillColor=#eef1fb;"
        elif node_type == "feature":
            style = "rounded=0;whiteSpace=wrap;html=1;fontSize=14;strokeColor=#16899b;fillColor=#edfafd;"
        cells.append(vertex(obj["name"], value, (x - left) * factor - w / 2, (top - y) * factor - h / 2, w, h, style, node_type))
    for i, obj in enumerate(layout.get("edges", [])):
        tail, head = graph_nodes.get(obj["tail"]), graph_nodes.get(obj["head"])
        if not tail or not head:
            continue
        label = obj.get("label", "")
        style = "edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;fontSize=13;endArrow=block;strokeColor=#64748b;labelBackgroundColor=#ffffff;"
        if obj.get("style") == "dashed":
            style += "dashed=1;"
        fk_name = obj.get("id")
        if relations and fk_name in relations:
            fk = relations[fk_name]
            style += "startArrow=" + ("ERzeroToOne" if fk["parent_per_child"] == "0..1" else "ERmandOne") + ";"
            style += "endArrow=" + ("ERzeroToOne" if fk["children_per_parent"] == "0..1" else "ERzeroToMany") + ";"
        coords = []
        for part in obj.get("pos", "").split():
            values = part.split(",")
            if values[0] in ("e", "s"):
                continue
            if len(values) == 2:
                px, py = map(float, values)
                coords.append(((px - left) * factor, (top - py) * factor))
        cells.append({"attrs": {"id": f"edge-{i}", "value": html.escape(label).replace("\n", "<br>"), "style": style,
                                 "edge": "1", "parent": "1", "source": tail["name"], "target": head["name"], "data-fk": fk_name or "", "data-note": obj.get("tooltip", "")},
                      "geometry": {"relative": "1", "as": "geometry"}, "points": coords[1:-1]})
    page = {"id": key, "title": title, "width": (right - left) * factor, "height": (top - bottom) * factor, "cells": cells}
    (SOURCES / f"{key}.drawio").write_text(drawio_document([page]), encoding="utf-8")
    return {"id": key, "title": title, "sheets": [key], "kind": "graph", "nodes": list(node_values), "foreign_keys": list(relations or {})}


def build_sitemap():
    title = "SITEMAP · Page → Feature / role-specific routes"
    dot = ['digraph Sitemap {', 'graph [rankdir=LR, splines=polyline, ranksep=0.8, nodesep=0.28, bgcolor="white", pad=0.4, fontname="Arial", fontsize=15, labelloc=t, label="SITEMAP · As-built / B06\nPage → Feature; dashed = cross-navigation; shared routes have role-specific contexts"];',
           'node [shape=box, fontname="Arial", fontsize=11, margin="0.14,0.10"];', 'edge [fontname="Arial", fontsize=9, color="#64748b", arrowsize=0.7];']
    values = {}
    for key, kind, label, route, note in DEFS.SITEMAP_NODES:
        lines = [("[Page] " if kind == "page" else "(Feature) ") + label]
        if route:
            lines.append(route)
        lines.append(note)
        text = "\n".join(lines)
        fill = "#eef1fb" if kind == "page" else "#edfafd"
        dot.append(f'{key} [label={json.dumps(text, ensure_ascii=False)}, style="filled,{"rounded" if kind == "page" else "solid"}", fillcolor="{fill}", color="{ "#17266d" if kind == "page" else "#16899b" }"];')
        values[key] = (html.escape(text).replace("\n", "<br>"), kind)
    for source, target, label in DEFS.SITEMAP_EDGES:
        cross = label.startswith("cross:")
        visible_label = "" if cross else label
        dot.append(f'{source} -> {target} [label={json.dumps(visible_label, ensure_ascii=False)}, tooltip={json.dumps(label, ensure_ascii=False)}, style={"dashed" if cross else "solid"}, constraint={"false" if cross else "true"}];')
    dot.append("}")
    return graph_artifact("SITEMAP", title, "\n".join(dot), values)


def build_erd(schema, key, title, full_tables, fks):
    needed = set(full_tables)
    for fk in fks:
        needed.update((fk["parent"], fk["child"]))
    dot = ['digraph ERD {', f'graph [rankdir=LR, splines=polyline, ranksep=1.1, nodesep=0.45, bgcolor="white", pad=0.4, fontname="Arial", fontsize=15, labelloc=t, label={json.dumps(title + " · As-built / B06\n14 actual tables; ! NOT NULL / ? nullable; REF = other sheet; full fields/constraints in dictionary", ensure_ascii=False)}];',
           'node [shape=plain, fontname="Arial", fontsize=10];', 'edge [fontname="Arial", fontsize=9, color="#64748b", arrowsize=0.65];']
    values = {}
    for name in sorted(needed):
        table = schema["tables"][name]
        stub = name not in full_tables
        dot.append(f'{name} [label={table_label(name, table, stub)}];')
        flags = []
        fk_cols = {c for f in table["foreign_keys"] for c in f["columns"]}
        for col in graph_node_fields(name, table, stub):
            prefix = "/".join(flag for flag, yes in [("PK", col["name"] in table["primary"]), ("FK", col["name"] in fk_cols),
                               ("UQ", any(u["columns"] == [col["name"]] for u in table["uniques"]))] if yes)
            field_type = re.split(r"\s+(?:NOT|DEFAULT|AUTO|ON)\b", col["definition"])[0]
            if field_type.startswith("enum("):
                field_type = "enum"
            flags.append(html.escape(f"{prefix} {col['name']} {'?' if col['nullable'] else '!'} · {field_type}"))
        for u in table["uniques"]:
            if len(u["columns"]) > 1 and not stub:
                flags.append(html.escape("UQ (" + ", ".join(u["columns"]) + ")"))
        values[name] = (f"<b>{name}{' [REF]' if stub else ''}</b><hr>" + "<br>".join(flags), "entity")
    relations = {}
    for fk in fks:
        relations[fk["name"]] = fk
        label = fk["cardinality"] + " · " + ", ".join(fk["columns"]) + "\nparent/child " + fk["parent_per_child"] + "; children/parent " + fk["children_per_parent"]
        tail = "odottee" if fk["parent_per_child"] == "0..1" else "teetee"
        head = "odottee" if fk["children_per_parent"] == "0..1" else "odotcrow"
        dot.append(f'{fk["parent"]} -> {fk["child"]} [id="{fk["name"]}", label={json.dumps(label, ensure_ascii=False)}, dir=both, arrowtail={tail}, arrowhead={head}];')
    dot.append("}")
    return graph_artifact(key, title, "\n".join(dot), values, relations)


def flow_box(n):
    x = {"student": 410, "bm": 990, "shared": 700}[n["lane"]]
    y = 205 + n["row"] * 126
    kind = n["kind"]
    w, h = (310, 52) if kind in ("start", "end") else ((350, 100) if kind == "decision" else ((50, 50) if kind in ("merge", "connector") else (450, 78)))
    return x - w / 2, y - h / 2, w, h


def text_lines(label, width):
    return textwrap.wrap(label, width=width, break_long_words=False, break_on_hyphens=False) or [""]


def flow_points(source, target, index, side=None):
    sx, sy, sw, sh = flow_box(source)
    tx, ty, tw, th = flow_box(target)
    scx, tcx = sx + sw / 2, tx + tw / 2
    if side or abs(target["row"] - source["row"]) > 1 or target["row"] <= source["row"]:
        side = side or ("left" if target["lane"] == "student" else "right")
        left = side == "left"
        track = 35 + (index % 4) * 18 if left else 1365 - (index % 4) * 18
        start = (sx if left else sx + sw, sy + sh / 2)
        end = (tx if left else tx + tw, ty + th / 2)
        return [start, (track, start[1]), (track, end[1]), end], 0 if left else 1, .5, 0 if left else 1, .5
    start, end = (scx, sy + sh), (tcx, ty)
    if abs(scx - tcx) < 1:
        return [start, end], .5, 1, .5, 0
    middle = (start[1] + end[1]) / 2
    return [start, (scx, middle), (tcx, middle), end], .5, 1, .5, 0


def label_geometry(points, cx, cy):
    """Position draw.io edge labels at the same logical location as SVG exports."""
    lengths = [math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(points, points[1:])]
    total, before, best = sum(lengths), 0.0, None
    for a, b, length in zip(points, points[1:], lengths):
        if not length:
            continue
        dx, dy = b[0] - a[0], b[1] - a[1]
        t = max(0.0, min(1.0, ((cx - a[0]) * dx + (cy - a[1]) * dy) / length ** 2))
        px, py = a[0] + t * dx, a[1] + t * dy
        distance = math.hypot(cx - px, cy - py)
        if best is None or distance < best[0]:
            best = (distance, before + t * length, (cx - px) * dy / length - (cy - py) * dx / length)
        before += length
    return {"relative": "1", "as": "geometry", "x": str(round(2 * best[1] / total - 1, 4)), "y": str(round(best[2], 2))}


def flow_svg(sheet_data, title):
    width = 1400
    height = 300 + max(n["row"] for n in sheet_data["nodes"]) * 126
    nodes = {n["id"]: n for n in sheet_data["nodes"]}
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
             '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#475569"/></marker></defs>',
             '<rect width="100%" height="100%" fill="white"/>',
             f'<text x="700" y="34" text-anchor="middle" font-family="Arial" font-size="24" font-weight="700" fill="#17266d">{html.escape(title)}</text>',
             f'<text x="700" y="62" text-anchor="middle" font-family="Arial" font-size="17" fill="#64748b">{STATUS} · {html.escape(sheet_data["title"])}</text>']
    cells = [vertex("title", html.escape(title) + "<br>" + html.escape(STATUS + " · " + sheet_data["title"]), 120, 12, 1160, 68, "text;html=1;fontSize=22;fontStyle=1;align=center;")]
    for x, lane in ((120, "Student"), (700, "Building Management")):
        parts += [f'<rect x="{x}" y="96" width="580" height="{height - 170}" fill="{ "#f8fbfd" if x == 120 else "#f6f7fc" }" stroke="#cbd5e1"/>',
                  f'<rect x="{x}" y="96" width="580" height="50" fill="#17266d"/>',
                  f'<text x="{x + 290}" y="128" text-anchor="middle" font-family="Arial" font-size="20" font-weight="700" fill="white">{lane}</text>']
        cells.append(vertex("lane-" + lane.replace(" ", "-"), lane, x, 96, 580, height - 170, "swimlane;html=1;startSize=50;horizontal=1;fillColor=#f8fafc;swimlaneFillColor=#f8fafc;fontSize=20;strokeColor=#cbd5e1;", "lane"))
    occupied_labels = []
    node_rects = [flow_box(n) for n in sheet_data["nodes"]]
    for i, e in enumerate(sheet_data["edges"]):
        points, ex, ey, ix, iy = flow_points(nodes[e["source"]], nodes[e["target"]], i, e.get("side"))
        # Small perpendicular offsets keep separately labelled trunks distinguishable.
        d = "M " + " L ".join(f"{x:.1f},{y:.1f}" for x, y in points)
        parts.append(f'<path d="{d}" fill="none" stroke="#475569" stroke-width="1.6" marker-end="url(#arrow)"/>')
        geometry = {"relative": "1", "as": "geometry"}
        if e["label"]:
            if len(points) == 4 and points[1][0] == points[2][0] and abs(points[1][0] - points[0][0]) > 150:
                lx = (points[0][0] + points[1][0]) / 2
                ly = points[0][1] + (65 if points[-1][1] > points[0][1] else -65)
            elif len(points) == 4:
                lx = (points[1][0] + points[2][0]) / 2
                ly = points[1][1] - 8
            else:
                lx = (points[0][0] + points[-1][0]) / 2 + 20
                ly = (points[0][1] + points[-1][1]) / 2
            label_width = len(e["label"]) * 7.7 + 10
            long_route = len(points) == 4 and points[1][0] == points[2][0] and abs(points[1][0] - points[0][0]) > 150
            if long_route:
                track = points[1][0]
                lx = track + label_width / 2 + 7 if track < width / 2 else track - label_width / 2 - 7
            lx = max(label_width / 2 + 10, min(width - label_width / 2 - 10, lx))
            candidates = [(lx, ly)]
            if long_route:
                direction = 1 if points[-1][1] > points[0][1] else -1
                candidates += [(lx, points[0][1] + direction * (65 + step * 126)) for step in range(1, int(abs(points[-1][1] - points[0][1]) // 126))]
            # The labels occupy the otherwise empty gap between adjacent rows.
            candidates += [(lx, ly + shift) for shift in (5, -5, 12, -12)]
            def overlaps(cx, baseline):
                rect = (cx - label_width / 2, baseline - 14, label_width, 20)
                x, y, w, h = rect
                return any(x < bx + bw + 2 and x + w > bx - 2 and y < by + bh + 2 and y + h > by - 2
                           for bx, by, bw, bh in node_rects + occupied_labels)
            lx, ly = next(((cx, cy) for cx, cy in candidates if not overlaps(cx, cy)), (lx, ly))
            occupied_labels.append((lx - label_width / 2, ly - 14, label_width, 20))
            geometry = label_geometry(points, lx, ly - 4)
            parts += [f'<rect x="{lx - label_width / 2:.1f}" y="{ly - 14:.1f}" width="{label_width:.1f}" height="20" fill="white" opacity=".97"/>',
                      f'<text x="{lx:.1f}" y="{ly:.1f}" text-anchor="middle" font-family="Arial" font-size="14" fill="#334155">{html.escape(e["label"])}</text>']
        style = f"edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;fontSize=14;endArrow=block;strokeColor=#475569;labelBackgroundColor=#ffffff;exitX={ex};exitY={ey};entryX={ix};entryY={iy};exitPerimeter=1;entryPerimeter=1;"
        cells.append({"attrs": {"id": f"edge-{i}", "value": html.escape(e["label"]), "edge": "1", "parent": "1", "source": e["source"], "target": e["target"], "style": style},
                      "geometry": geometry, "points": points[1:-1]})
    for n in sheet_data["nodes"]:
        x, y, w, h = flow_box(n)
        kind = n["kind"]
        fill = "#edfafd" if n["lane"] == "student" else ("#eef1fb" if n["lane"] == "bm" else "#ffffff")
        stroke = "#16899b" if n["lane"] == "student" else "#17266d"
        attrs = f'fill="{fill}" stroke="{stroke}" stroke-width="1.8"'
        if kind in ("start", "end", "connector", "merge"):
            parts.append(f'<ellipse cx="{x + w / 2}" cy="{y + h / 2}" rx="{w / 2}" ry="{h / 2}" {attrs}/>')
            shape = "ellipse;"
        elif kind == "decision":
            parts.append(f'<polygon points="{x + w / 2},{y} {x + w},{y + h / 2} {x + w / 2},{y + h} {x},{y + h / 2}" {attrs}/>')
            shape = "rhombus;"
        elif kind == "input":
            parts.append(f'<polygon points="{x + 22},{y} {x + w},{y} {x + w - 22},{y + h} {x},{y + h}" {attrs}/>')
            shape = "shape=parallelogram;perimeter=parallelogramPerimeter;fixedSize=1;"
        else:
            parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" {attrs}/>')
            shape = "rounded=0;"
        lines = text_lines(n["label"], 27 if kind == "decision" else (38 if kind == "end" else 49))
        center_y = y + h / 2 - (len(lines) - 1) * 9 + 5
        for j, line in enumerate(lines):
            parts.append(f'<text x="{x + w / 2}" y="{center_y + j * 18}" text-anchor="middle" font-family="Arial" font-size="15" fill="#1e293b">{html.escape(line)}</text>')
        style = shape + f"whiteSpace=wrap;html=1;fontSize=15;fillColor={fill};strokeColor={stroke};align=center;verticalAlign=middle;"
        cells.append(vertex(n["id"], html.escape(n["label"]), x, y, w, h, style, kind, n["lane"]))
    note_lines = text_lines(sheet_data["note"], 160)
    for i, line in enumerate(note_lines):
        parts.append(f'<text x="120" y="{height - 47 + i * 18}" font-family="Arial" font-size="14" fill="#475569">{html.escape(line)}</text>')
    parts.append("</svg>")
    cells.append(vertex("note", html.escape(sheet_data["note"]), 120, height - 65, 1160, 58, "text;html=1;fontSize=14;align=left;verticalAlign=middle;"))
    return "\n".join(parts) + "\n", {"id": sheet_data["id"], "title": sheet_data["title"], "width": width, "height": height, "cells": cells}


def build_flows():
    artifacts = []
    for flow in DEFS.FLOWS:
        pages = []
        sheet_ids = []
        for s in flow["sheets"]:
            svg, page = flow_svg(s, flow["title"])
            (EXPORTS / f"{s['id']}.svg").write_text(svg, encoding="utf-8")
            pages.append(page)
            sheet_ids.append(s["id"])
        (SOURCES / f"{flow['id']}.drawio").write_text(drawio_document(pages), encoding="utf-8")
        artifacts.append({"id": flow["id"], "title": flow["title"], "kind": "flow", "sheets": sheet_ids, "connectors": flow["connectors"]})
    return artifacts


def main():
    for path in (SOURCES, EXPORTS, DOCS / "verification", DOCS / "wireframes" / "exports"):
        path.mkdir(parents=True, exist_ok=True)
    schema = schema_from_zip()
    dump_json(DOCS / "schema-contract.json", schema)
    # Keep the historical B06 diagram inventory separate from the live schema contract.
    schema = {**schema, "tables": {name: table for name, table in schema["tables"].items()
                                  if name != "item_photo_embeddings"}}
    dictionary(schema)
    fks = [fk for table in schema["tables"].values() for fk in table["foreign_keys"]]
    core_fks = [fk for fk in fks if fk["parent"] in DEFS.ERD_CORE and fk["child"] in DEFS.ERD_CORE]
    ref_fks = [fk for fk in fks if fk not in core_fks]
    artifacts = [build_sitemap(),
                 build_erd(schema, "ERD01-operational", "ERD01 · Operational relations", DEFS.ERD_CORE, core_fks),
                 build_erd(schema, "ERD02-reference", "ERD02 · Reference / location relations", DEFS.ERD_REFERENCE, ref_fks)]
    artifacts += build_flows()
    dump_json(DOCS / "diagrams" / "manifest.json", {"status": STATUS, "editable_format": "draw.io / diagrams.net", "artifacts": artifacts})
    dump_json(DOCS / "diagrams" / "flow-model.json", {"lanes": DEFS.LANES, "flows": DEFS.FLOWS})
    print(f"Built {len(artifacts)} editable diagrams / {sum(len(a['sheets']) for a in artifacts)} sheets; 14 tables / 25 FKs. No database access.")


def assemble_pdfs():
    import pymupdf as fitz
    manifest = json.loads((DOCS / "diagrams" / "manifest.json").read_text(encoding="utf-8"))
    collection = fitz.open()
    for artifact in manifest["artifacts"]:
        grouped = fitz.open()
        for key in artifact["sheets"]:
            with fitz.open(EXPORTS / f"{key}.pdf") as doc:
                grouped.insert_pdf(doc)
                collection.insert_pdf(doc)
        if len(artifact["sheets"]) > 1:
            grouped.save(EXPORTS / f"{artifact['id']}.pdf")
            grouped.save(EXPORTS / f"{artifact['id'].split('-')[0]}.pdf")
        grouped.close()
    collection.save(EXPORTS / "BLUEPRINT_DIAGRAMS.pdf")
    collection.save(EXPORTS / "AS_BUILT_DIAGRAMS.pdf")
    count = len(collection)
    collection.close()
    print(f"Assembled BLUEPRINT_DIAGRAMS.pdf: {count} sheets. No database access.")


if __name__ == "__main__":
    assemble_pdfs() if "--assemble" in sys.argv else main()
