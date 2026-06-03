#!/usr/bin/env python3
"""
Generate Word-ready OmniRAG diagrams as paired .drawio and .png files.

The generator is intentionally self-contained: draw.io XML and PNG previews are
rendered from the same diagram specs, so the Word assets and editable source
files stay in sync without requiring the draw.io desktop/CLI exporter.

Usage:
    python3 scripts/generate_omnirag_figures_v4.py --out docs/diagrams/word_ready
"""

from __future__ import annotations

import argparse
import html
import json
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable
from xml.etree import ElementTree as ET

from PIL import Image, ImageDraw, ImageFont


INK = "#222222"
MUTED = "#666666"
EDGE = "#333333"
BG = "#ffffff"

ROLE_STYLES = {
    "input": ("#f5f5f5", "#999999", MUTED),
    "user": ("#dae8fc", "#6c8ebf", "#336699"),
    "process": ("#dae8fc", "#6c8ebf", "#336699"),
    "service": ("#d5e8d4", "#82b366", "#38761d"),
    "search": ("#ffe6cc", "#d79b00", "#b36b00"),
    "decision": ("#fff2cc", "#d6b656", "#7f6000"),
    "warning": ("#fff2cc", "#d6b656", "#7f6000"),
    "error": ("#f8cecc", "#b85450", "#a61c1c"),
    "llm": ("#e1d5e7", "#9673a6", "#674ea7"),
    "storage": ("#f5f5f5", "#999999", "#444444"),
    "external": ("#ffffff", "#6c8ebf", "#336699"),
    "accent": ("#ffe6cc", "#d79b00", "#b36b00"),
    "optional": ("#ffffff", "#999999", MUTED),
    "lane": ("#fbfdff", "#999999", "#444444"),
}

EDGE_COLORS = {
    "default": EDGE,
    "blue": "#6c8ebf",
    "green": "#82b366",
    "orange": "#d79b00",
    "yellow": "#d6b656",
    "red": "#b85450",
    "purple": "#9673a6",
    "gray": "#999999",
}

FONT_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_FALLBACK = "/System/Library/Fonts/Helvetica.ttc"


@dataclass(frozen=True)
class Node:
    id: str
    text: str
    x: int
    y: int
    w: int
    h: int
    role: str = "process"
    shape: str = "round"
    font_size: int = 11
    bold: bool = True
    dashed: bool = False
    align: str = "center"


@dataclass(frozen=True)
class Edge:
    id: str
    source: str
    target: str
    label: str = ""
    color: str = EDGE
    points: tuple[tuple[int, int], ...] = ()
    dashed: bool = False
    end_arrow: bool = True
    manual: bool = False


@dataclass
class Diagram:
    fig_id: str
    slug: str
    title: str
    caption: str
    kind: str
    width: int = 1500
    height: int = 820
    nodes: list[Node] = field(default_factory=list)
    edges: list[Edge] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    source_notes: list[str] = field(default_factory=list)

    @property
    def basename(self) -> str:
        return f"fig_{self.fig_id.replace('.', '_').replace('b', '_b')}_{self.slug}"

    def node(self, *args, **kwargs) -> Node:
        n = Node(*args, **kwargs)
        self.nodes.append(n)
        return n

    def edge(self, source: str, target: str, label: str = "", color: str = "default",
             points: tuple[tuple[int, int], ...] = (), dashed: bool = False,
             end_arrow: bool = True, manual: bool = False) -> Edge:
        e = Edge(
            id=f"e_{len(self.edges) + 1}_{source}_{target}",
            source=source,
            target=target,
            label=label,
            color=EDGE_COLORS.get(color, color),
            points=points,
            dashed=dashed,
            end_arrow=end_arrow,
            manual=manual,
        )
        self.edges.append(e)
        return e


def font(size: int, bold: bool = False, scale: int = 1) -> ImageFont.FreeTypeFont:
    font_path = FONT_BOLD if bold else FONT_REG
    try:
        return ImageFont.truetype(font_path, size * scale)
    except OSError:
        return ImageFont.truetype(FONT_FALLBACK, size * scale)


def text_size(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont) -> tuple[int, int]:
    bbox = draw.textbbox((0, 0), text, font=fnt)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def wrap_line(draw: ImageDraw.ImageDraw, line: str, fnt: ImageFont.FreeTypeFont, max_w: int) -> list[str]:
    if text_size(draw, line, fnt)[0] <= max_w:
        return [line]
    words = line.split()
    if not words:
        return [line]
    out: list[str] = []
    current = words[0]
    for word in words[1:]:
        candidate = f"{current} {word}"
        if text_size(draw, candidate, fnt)[0] <= max_w:
            current = candidate
        else:
            out.append(current)
            current = word
    out.append(current)
    return out


def wrapped_lines(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont, max_w: int) -> list[str]:
    lines: list[str] = []
    for raw in text.split("\n"):
        lines.extend(wrap_line(draw, raw, fnt, max_w))
    return lines


def draw_text_in_box(
    draw: ImageDraw.ImageDraw,
    rect: tuple[int, int, int, int],
    text: str,
    color: str,
    size: int,
    bold: bool,
    scale: int,
    align: str = "center",
) -> None:
    x, y, w, h = rect
    fnt = font(size, bold, scale)
    pad = 12 * scale
    lines = wrapped_lines(draw, text, fnt, max(1, w - pad * 2))
    gap = 3 * scale
    heights = [text_size(draw, line, fnt)[1] for line in lines]
    total_h = sum(heights) + gap * max(0, len(lines) - 1)
    cy = y + max(0, (h - total_h) / 2)
    for line, lh in zip(lines, heights):
        lw, _ = text_size(draw, line, fnt)
        if align == "left":
            tx = x + pad
        else:
            tx = x + (w - lw) / 2
        draw.text((tx, cy), line, font=fnt, fill=color)
        cy += lh + gap


def draw_dashed_line(draw: ImageDraw.ImageDraw, pts: list[tuple[int, int]], color: str, width: int) -> None:
    for a, b in zip(pts, pts[1:]):
        ax, ay = a
        bx, by = b
        dx, dy = bx - ax, by - ay
        dist = math.hypot(dx, dy)
        if dist == 0:
            continue
        dash, gap = 10 * width, 6 * width
        ux, uy = dx / dist, dy / dist
        cur = 0.0
        while cur < dist:
            end = min(cur + dash, dist)
            p1 = (int(ax + ux * cur), int(ay + uy * cur))
            p2 = (int(ax + ux * end), int(ay + uy * end))
            draw.line((p1, p2), fill=color, width=width)
            cur += dash + gap


def arrow_head(draw: ImageDraw.ImageDraw, a: tuple[int, int], b: tuple[int, int], color: str, width: int) -> None:
    ax, ay = a
    bx, by = b
    angle = math.atan2(by - ay, bx - ax)
    length = max(8, 5 * width)
    spread = 0.55
    p1 = (bx - length * math.cos(angle - spread), by - length * math.sin(angle - spread))
    p2 = (bx - length * math.cos(angle + spread), by - length * math.sin(angle + spread))
    draw.polygon((b, p1, p2), fill=color)


def anchor_for(node: Node, point: tuple[int, int]) -> tuple[int, int]:
    cx = node.x + node.w / 2
    cy = node.y + node.h / 2
    dx = point[0] - cx
    dy = point[1] - cy
    if abs(dx) >= abs(dy):
        return (node.x + node.w, int(cy)) if dx >= 0 else (node.x, int(cy))
    return (int(cx), node.y + node.h) if dy >= 0 else (int(cx), node.y)


def route(source: Node, target: Node, points: tuple[tuple[int, int], ...]) -> list[tuple[int, int]]:
    if points:
        return [anchor_for(source, points[0]), *points, anchor_for(target, points[-1])]
    sc = (source.x + source.w / 2, source.y + source.h / 2)
    tc = (target.x + target.w / 2, target.y + target.h / 2)
    if abs(tc[0] - sc[0]) >= abs(tc[1] - sc[1]):
        start = (source.x + source.w, int(sc[1])) if tc[0] >= sc[0] else (source.x, int(sc[1]))
        end = (target.x, int(tc[1])) if tc[0] >= sc[0] else (target.x + target.w, int(tc[1]))
    else:
        start = (int(sc[0]), source.y + source.h) if tc[1] >= sc[1] else (int(sc[0]), source.y)
        end = (int(tc[0]), target.y) if tc[1] >= sc[1] else (int(tc[0]), target.y + target.h)
    return [start, end]


def edge_route(edge: Edge, source: Node, target: Node) -> list[tuple[int, int]]:
    if edge.manual and len(edge.points) >= 2:
        return list(edge.points)
    return route(source, target, edge.points)


def polyline_midpoint(pts: list[tuple[int, int]]) -> tuple[float, float]:
    if not pts:
        return (0.0, 0.0)
    if len(pts) == 1:
        return (float(pts[0][0]), float(pts[0][1]))
    lengths = [math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(pts, pts[1:])]
    total = sum(lengths)
    if total == 0:
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        return (sum(xs) / len(xs), sum(ys) / len(ys))
    half = total / 2
    walked = 0.0
    for (a, b), segment in zip(zip(pts, pts[1:]), lengths):
        if walked + segment >= half:
            t = (half - walked) / segment if segment else 0
            return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
        walked += segment
    return (float(pts[-1][0]), float(pts[-1][1]))


def node_colors(node: Node) -> tuple[str, str, str]:
    return ROLE_STYLES.get(node.role, ROLE_STYLES["process"])


def draw_node(draw: ImageDraw.ImageDraw, node: Node, scale: int) -> None:
    fill, stroke, text_color = node_colors(node)
    x1, y1 = node.x * scale, node.y * scale
    x2, y2 = (node.x + node.w) * scale, (node.y + node.h) * scale
    width = 2 * scale
    if node.shape == "lane":
        draw.rounded_rectangle((x1, y1, x2, y2), radius=8 * scale, fill=fill, outline=stroke, width=width)
        if node.dashed:
            draw_dashed_line(draw, [(x1, y1), (x2, y1), (x2, y2), (x1, y2), (x1, y1)], stroke, scale)
        draw_text_in_box(
            draw,
            (x1 + 4 * scale, y1 + 4 * scale, node.w * scale - 8 * scale, 28 * scale),
            node.text,
            text_color,
            node.font_size,
            node.bold,
            scale,
            "left",
        )
        return
    if node.shape == "text":
        draw_text_in_box(draw, (x1, y1, node.w * scale, node.h * scale), node.text, text_color, node.font_size, node.bold, scale, node.align)
        return
    if node.shape == "lifeline":
        cx = x1 + (node.w * scale) // 2
        draw_dashed_line(draw, [(cx, y1), (cx, y2)], stroke, scale)
        return
    if node.shape == "activation":
        draw.rounded_rectangle((x1, y1, x2, y2), radius=2 * scale, fill=fill, outline=stroke, width=max(1, scale))
        return
    if node.shape == "entity":
        header_h = min(38 * scale, max(28 * scale, node.h * scale // 4))
        draw.rounded_rectangle((x1, y1, x2, y2), radius=7 * scale, fill=fill, outline=stroke, width=width)
        draw.rectangle((x1, y1, x2, y1 + header_h), fill="#e1d5e7")
        draw.line((x1, y1 + header_h, x2, y1 + header_h), fill=stroke, width=width)
        lines = node.text.split("\n")
        title = lines[0] if lines else ""
        fields = "\n".join(lines[1:])
        draw_text_in_box(draw, (x1, y1, node.w * scale, header_h), title, INK, node.font_size + 1, True, scale)
        draw_text_in_box(
            draw,
            (x1 + 2 * scale, y1 + header_h + 4 * scale, node.w * scale - 4 * scale, node.h * scale - header_h - 6 * scale),
            fields,
            "#444444",
            node.font_size,
            False,
            scale,
            "left",
        )
        return
    if node.shape == "diamond":
        pts = [
            ((node.x + node.w / 2) * scale, node.y * scale),
            ((node.x + node.w) * scale, (node.y + node.h / 2) * scale),
            ((node.x + node.w / 2) * scale, (node.y + node.h) * scale),
            (node.x * scale, (node.y + node.h / 2) * scale),
        ]
        draw.polygon(pts, fill=fill, outline=stroke)
        draw.line([*pts, pts[0]], fill=stroke, width=width)
    elif node.shape == "cylinder":
        top_h = int(min(34 * scale, max(18 * scale, (node.h * scale) * 0.36)))
        body_top = y1 + top_h // 2
        body_bottom = y2 - top_h // 2
        draw.rectangle((x1, body_top, x2, body_bottom), fill=fill)
        draw.ellipse((x1, y1, x2, y1 + top_h), fill=fill, outline=stroke, width=width)
        draw.line((x1, body_top, x1, body_bottom), fill=stroke, width=width)
        draw.line((x2, body_top, x2, body_bottom), fill=stroke, width=width)
        draw.arc((x1, y2 - top_h, x2, y2), start=0, end=180, fill=stroke, width=width)
    elif node.shape == "ellipse":
        draw.ellipse((x1, y1, x2, y2), fill=fill, outline=stroke, width=width)
    elif node.shape == "actor":
        cx = x1 + node.w * scale / 2
        top = y1 + 10 * scale
        draw.ellipse((cx - 12 * scale, top, cx + 12 * scale, top + 24 * scale), outline=stroke, width=width)
        draw.line((cx, top + 24 * scale, cx, top + 58 * scale), fill=stroke, width=width)
        draw.line((cx - 24 * scale, top + 36 * scale, cx + 24 * scale, top + 36 * scale), fill=stroke, width=width)
        draw.line((cx, top + 58 * scale, cx - 22 * scale, top + 86 * scale), fill=stroke, width=width)
        draw.line((cx, top + 58 * scale, cx + 22 * scale, top + 86 * scale), fill=stroke, width=width)
        draw_text_in_box(draw, (x1, y1 + 94 * scale, node.w * scale, max(20 * scale, node.h * scale - 94 * scale)), node.text, text_color, node.font_size, node.bold, scale)
        return
    else:
        draw.rounded_rectangle((x1, y1, x2, y2), radius=9 * scale, fill=fill, outline=stroke, width=width)
        if node.dashed:
            draw_dashed_line(draw, [(x1, y1), (x2, y1), (x2, y2), (x1, y2), (x1, y1)], stroke, scale)
    draw_text_in_box(
        draw,
        (x1, y1, node.w * scale, node.h * scale),
        node.text,
        text_color,
        node.font_size,
        node.bold,
        scale,
        node.align,
    )


def render_png(diagram: Diagram, output: Path, scale: int = 2) -> None:
    image = Image.new("RGBA", (diagram.width * scale, diagram.height * scale), BG)
    draw = ImageDraw.Draw(image)
    title_font = font(18, True, scale)
    tw, th = text_size(draw, diagram.title, title_font)
    draw.text(((diagram.width * scale - tw) / 2, 22 * scale), diagram.title, font=title_font, fill=INK)

    nodes = {n.id: n for n in diagram.nodes}
    for node in diagram.nodes:
        if node.shape == "lane":
            draw_node(draw, node, scale)

    for edge in diagram.edges:
        src = nodes[edge.source]
        dst = nodes[edge.target]
        pts = [(x * scale, y * scale) for x, y in edge_route(edge, src, dst)]
        line_width = 2 * scale
        if edge.dashed:
            draw_dashed_line(draw, pts, edge.color, line_width)
        else:
            draw.line(pts, fill=edge.color, width=line_width, joint="curve")
        if edge.end_arrow and len(pts) >= 2:
            arrow_head(draw, pts[-2], pts[-1], edge.color, line_width)
        if edge.label:
            label_font = font(11, False, scale)
            mid = polyline_midpoint(pts)
            lw, lh = text_size(draw, edge.label, label_font)
            pad = 4 * scale
            lx = mid[0] - lw / 2
            ly = mid[1] - 20 * scale
            draw.rounded_rectangle(
                (lx - pad, ly - pad, lx + lw + pad, ly + lh + pad),
                radius=4 * scale,
                fill=BG,
                outline="#eeeeee",
                width=scale,
            )
            draw.text((lx, ly), edge.label, font=label_font, fill=INK)

    for node in diagram.nodes:
        if node.shape != "lane":
            draw_node(draw, node, scale)

    image.save(output, optimize=True)


def style_for_node(node: Node) -> str:
    fill, stroke, text_color = node_colors(node)
    if node.shape == "lane":
        style = (
            "rounded=1;whiteSpace=wrap;html=1;"
            f"fillColor={fill};strokeColor={stroke};"
            "fontSize=12;fontFamily=Arial;align=left;verticalAlign=top;"
            "spacing=8;spacingLeft=8;spacingTop=8;fontStyle=1;"
        )
    elif node.shape == "text":
        style = (
            "text;html=1;strokeColor=none;fillColor=none;whiteSpace=wrap;"
            f"fontSize={node.font_size};fontFamily=Arial;align={node.align};verticalAlign=middle;"
            f"fontColor={text_color};"
        )
    elif node.shape == "diamond":
        style = (
            "rhombus;whiteSpace=wrap;html=1;"
            f"fillColor={fill};strokeColor={stroke};"
            f"fontSize={node.font_size};fontFamily=Arial;align=center;verticalAlign=middle;"
            f"fontColor={text_color};"
        )
    elif node.shape == "cylinder":
        style = (
            "shape=cylinder;whiteSpace=wrap;boundedLbl=1;backgroundOutline=1;size=15;html=1;"
            f"fillColor={fill};strokeColor={stroke};"
            f"fontSize={node.font_size};fontFamily=Arial;align=center;verticalAlign=middle;"
            f"fontColor={text_color};"
        )
    elif node.shape == "ellipse":
        style = (
            "ellipse;whiteSpace=wrap;html=1;"
            f"fillColor={fill};strokeColor={stroke};"
            f"fontSize={node.font_size};fontFamily=Arial;align=center;verticalAlign=middle;"
            f"fontColor={text_color};spacing=8;spacingLeft=8;spacingRight=8;"
        )
    elif node.shape == "lifeline":
        style = f"line;html=1;strokeWidth=1;strokeColor={stroke};dashed=1;dashPattern=4 4;direction=south;"
    elif node.shape == "activation":
        style = f"rounded=0;whiteSpace=wrap;html=1;fillColor={fill};strokeColor={stroke};fontSize=1;fontFamily=Arial;"
    elif node.shape == "entity":
        style = (
            "swimlane;whiteSpace=wrap;html=1;startSize=32;horizontal=1;"
            f"fillColor={fill};strokeColor={stroke};"
            "swimlaneFillColor=#e1d5e7;"
            f"fontSize={node.font_size};fontFamily=Arial;align=left;verticalAlign=top;"
            f"fontColor={text_color};spacing=8;spacingLeft=8;spacingRight=8;"
        )
    elif node.shape == "actor":
        style = (
            "shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;"
            f"outlineConnect=0;strokeColor={stroke};fillColor={fill};"
            f"fontSize={node.font_size};fontFamily=Arial;fontColor={text_color};"
        )
    else:
        style = (
            "rounded=1;whiteSpace=wrap;html=1;"
            f"fillColor={fill};strokeColor={stroke};"
            f"fontSize={node.font_size};fontFamily=Arial;align={node.align};verticalAlign=middle;"
            f"fontColor={text_color};spacing=8;spacingLeft=8;spacingRight=8;"
        )
    if node.bold:
        style += "fontStyle=1;"
    if node.dashed or node.role == "optional":
        style += "dashed=1;dashPattern=8 4;"
    return style


def style_for_edge(edge: Edge) -> str:
    end_arrow = "block" if edge.end_arrow else "none"
    end_fill = "1" if edge.end_arrow else "0"
    style = (
        "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;"
        f"html=1;strokeWidth=1.5;endArrow={end_arrow};endFill={end_fill};startArrow=none;startFill=0;"
        f"strokeColor={edge.color};fontSize=11;fontFamily=Arial;fontColor={INK};labelBackgroundColor=#ffffff;"
    )
    if edge.dashed:
        style += "dashed=1;dashPattern=6 4;"
    return style


def add_geo(parent: ET.Element, **attrs: object) -> ET.Element:
    attrs = {k: str(v) for k, v in attrs.items()}
    attrs["as"] = "geometry"
    return ET.SubElement(parent, "mxGeometry", attrs)


def write_drawio(diagram: Diagram, output: Path) -> None:
    mxfile = ET.Element(
        "mxfile",
        {
            "host": "app.diagrams.net",
            "agent": "OmniRAG/generate_omnirag_figures_v4",
            "version": "24.7.17",
            "type": "device",
        },
    )
    diag = ET.SubElement(mxfile, "diagram", {"name": diagram.basename, "id": f"diag-{diagram.basename}"})
    model = ET.SubElement(
        diag,
        "mxGraphModel",
        {
            "dx": "1422",
            "dy": "794",
            "grid": "1",
            "gridSize": "10",
            "guides": "1",
            "tooltips": "1",
            "connect": "1",
            "arrows": "1",
            "fold": "1",
            "page": "1",
            "pageScale": "1",
            "pageWidth": str(diagram.width),
            "pageHeight": str(diagram.height),
            "math": "0",
            "shadow": "0",
        },
    )
    root = ET.SubElement(model, "root")
    ET.SubElement(root, "mxCell", {"id": "0"})
    ET.SubElement(root, "mxCell", {"id": "1", "parent": "0"})
    title = ET.SubElement(
        root,
        "mxCell",
        {
            "id": "title",
            "value": html.escape(diagram.title),
            "style": (
                "text;html=1;strokeColor=none;fillColor=none;fontSize=18;"
                "fontFamily=Arial;align=center;verticalAlign=middle;"
                "fontColor=#222222;whiteSpace=wrap;fontStyle=1"
            ),
            "vertex": "1",
            "parent": "1",
        },
    )
    add_geo(title, x=40, y=20, width=diagram.width - 80, height=35)

    def append_node(node: Node) -> None:
        cell = ET.SubElement(
            root,
            "mxCell",
            {
                "id": node.id,
                "value": html.escape(node.text),
                "style": style_for_node(node),
                "vertex": "1",
                "parent": "1",
            },
        )
        add_geo(cell, x=node.x, y=node.y, width=node.w, height=node.h)

    for node in diagram.nodes:
        if node.shape == "lane":
            append_node(node)

    for edge in diagram.edges:
        cell = ET.SubElement(
            root,
            "mxCell",
            {
                "id": edge.id,
                "value": html.escape(edge.label),
                "style": style_for_edge(edge),
                "edge": "1",
                "parent": "1",
            },
        )
        if not edge.manual:
            cell.set("source", edge.source)
            cell.set("target", edge.target)
        geo = add_geo(cell, relative=1)
        if edge.manual and len(edge.points) >= 2:
            sx, sy = edge.points[0]
            tx, ty = edge.points[-1]
            ET.SubElement(geo, "mxPoint", {"x": str(sx), "y": str(sy), "as": "sourcePoint"})
            ET.SubElement(geo, "mxPoint", {"x": str(tx), "y": str(ty), "as": "targetPoint"})
            if len(edge.points) > 2:
                arr = ET.SubElement(geo, "Array", {"as": "points"})
                for x, y in edge.points[1:-1]:
                    ET.SubElement(arr, "mxPoint", {"x": str(x), "y": str(y)})
        elif edge.points:
            arr = ET.SubElement(geo, "Array", {"as": "points"})
            for x, y in edge.points:
                ET.SubElement(arr, "mxPoint", {"x": str(x), "y": str(y)})

    for node in diagram.nodes:
        if node.shape != "lane":
            append_node(node)

    ET.indent(mxfile, space="  ")
    ET.ElementTree(mxfile).write(output, encoding="utf-8", xml_declaration=False)


def lane(d: Diagram, text: str, x: int, y: int, w: int, h: int, role: str = "lane") -> None:
    d.node(f"lane_{len([n for n in d.nodes if n.shape == 'lane']) + 1}", text, x, y, w, h, role=role, shape="lane", font_size=11, bold=True)


def add_flow(d: Diagram, items: list[tuple[str, str, str]], x: int, y: int, w: int, h: int, gap: int,
             color: str = "default") -> None:
    prev = ""
    for idx, (node_id, text, role) in enumerate(items):
        d.node(node_id, text, x + idx * (w + gap), y, w, h, role=role)
        if prev:
            d.edge(prev, node_id, color=color)
        prev = node_id


def add_table(d: Diagram, prefix: str, x: int, y: int, col_widths: list[int], row_h: int,
              rows: list[list[str]], header_role: str = "service", body_role: str = "input") -> None:
    for r, row in enumerate(rows):
        cx = x
        for c, text in enumerate(row):
            role = header_role if r == 0 else body_role
            d.node(f"{prefix}_{r}_{c}", text, cx, y + r * row_h, col_widths[c], row_h, role=role, font_size=10, bold=(r == 0))
            cx += col_widths[c]


def make_1_1() -> Diagram:
    d = Diagram("1.1", "iva_overview", "Figure 1.1 - IVA Problem Overview", "Custom data to RAG pipeline to omnichannel answers", "architecture", 1500, 720)
    lane(d, "Enterprise data sources", 60, 100, 360, 480)
    lane(d, "OmniRAG intelligence core", 500, 100, 520, 480)
    lane(d, "Response channels", 1100, 100, 340, 480)
    for i, (nid, text) in enumerate([
        ("docs", "PDF / DOCX\npolicies, handbook"),
        ("web", "Website / FAQ\nproduct docs"),
        ("chatlog", "CRM / chat history\ncustomer context"),
    ]):
        d.node(nid, text, 110, 170 + i * 120, 260, 72, "input")
    d.node("ingest", "Document ingestion\nOpenDataLoader fallback", 560, 150, 360, 70, "process")
    d.node("index", "Vector + full-text index\nQdrant collections", 560, 260, 360, 70, "storage", "cylinder")
    d.node("rag", "Hybrid RAG + CRAG\nrerank, classify, cite", 560, 370, 360, 78, "service")
    d.node("llm", "OpenRouter LLM\nanswer generation", 610, 490, 260, 70, "llm")
    for src in ("docs", "web", "chatlog"):
        d.edge(src, "ingest", color="blue")
    d.edge("ingest", "index", color="blue")
    d.edge("index", "rag", color="green")
    d.edge("rag", "llm", color="purple")
    for i, (nid, text) in enumerate([
        ("telegram", "Telegram Bot\nBot API webhook"),
        ("zalo", "Zalo Bot\nDirect / Hub"),
        ("webui", "Website widget\nChat UI"),
        ("api", "REST API\nexternal app"),
    ]):
        d.node(nid, text, 1140, 145 + i * 95, 240, 72, "external")
        d.edge("llm", nid, color="green")
    d.source_notes.append("Synthesized from DOCX Chapter 1, backend channel architecture, and Telegram integration docs.")
    return d


def make_1_2() -> Diagram:
    d = Diagram("1.2", "omnichannel_architecture", "Figure 1.2 - Omnichannel Architecture", "All channels converge into one OmniRAG backend", "architecture", 1540, 760)
    lane(d, "Inbound channels", 60, 110, 360, 520)
    lane(d, "Gateway and backend", 500, 110, 520, 520)
    lane(d, "Knowledge and state", 1100, 110, 360, 520)
    channels = [
        ("telegram", "Telegram Bot\napi.telegram.org webhook"),
        ("zalo_bot", "Zalo Bot Direct\nbot-api.zapps.me"),
        ("zalo_hub", "Zalo Hub\nfunc.vn centralized webhook"),
        ("fb", "Facebook Messenger\nworker service"),
        ("widget", "Web dashboard\nchat playground"),
        ("rest", "REST API\nAPI consumers"),
    ]
    for i, (nid, text) in enumerate(channels):
        d.node(nid, text, 105, 145 + i * 78, 270, 58, "external", font_size=10)
    d.node("gateway", "Go API Gateway\nrate limit, cache, proxy", 550, 190, 380, 72, "service")
    d.node("backend", "FastAPI Backend\nchat, bots, channels", 550, 315, 380, 72, "service")
    d.node("celery", "Celery Workers\nindexing, hub dispatch", 550, 440, 380, 72, "process")
    for src, _ in channels:
        d.edge(src, "gateway", color="blue")
    d.edge("gateway", "backend", color="green")
    d.edge("backend", "celery", label="async jobs", color="orange", dashed=True)
    stores = [
        ("pg", "PostgreSQL\nbots, users, documents"),
        ("qdrant", "Qdrant\nvectors + memories"),
        ("minio", "MinIO\nfiles, parsed assets"),
        ("redis", "Redis\ncache, broker"),
    ]
    for i, (nid, text) in enumerate(stores):
        d.node(nid, text, 1150, 160 + i * 105, 260, 70, "storage", "cylinder")
        d.edge("backend", nid, color="gray")
    d.edge("celery", "qdrant", color="orange")
    d.edge("celery", "minio", color="orange")
    return d


def make_1_3() -> Diagram:
    d = Diagram("1.3", "challenge_map", "Figure 1.3 - Technical Challenge Map", "Key IVA challenges and OmniRAG responses", "quadrant", 1520, 820)
    lane(d, "Problem space", 60, 110, 670, 580)
    lane(d, "OmniRAG design response", 790, 110, 670, 580)
    pairs = [
        ("stale", "LLM knowledge is stale\nand not business-specific", "rag", "RAG over private data\nwith source grounding"),
        ("messy", "Documents are messy:\nPDF, tables, scans, long text", "loader", "OpenDataLoader + chunk strategy\nby domain profile"),
        ("miss", "Naive retrieval misses\nkeyword or semantic matches", "hybrid", "Hybrid search:\nvector + BM25 + RRF + rerank"),
        ("halluc", "Model may fabricate\nwhen evidence is weak", "crag", "CRAG classifier\nrelevant / ambiguous / no_context"),
        ("channel", "Many channels need\none consistent answer core", "omni", "Omnichannel adapters\nreuse the same backend pipeline"),
    ]
    for i, (pid, ptxt, sid, stxt) in enumerate(pairs):
        y = 160 + i * 100
        d.node(pid, ptxt, 120, y, 520, 64, "warning", font_size=10)
        d.node(sid, stxt, 860, y, 520, 64, "service", font_size=10)
        d.edge(pid, sid, color="green")
    d.node("center", "OmniRAG thesis goal:\nreliable custom-data IVA for Vietnamese SMEs", 540, 715, 440, 64, "accent")
    return d


def make_1_5() -> Diagram:
    d = Diagram("1.5", "use_case_overview", "Figure 1.5 - Use Case Overview", "Actors and primary OmniRAG use cases", "use_case", 1540, 860)
    d.node("admin", "Admin", 75, 315, 110, 130, "user", "actor")
    d.node("enduser", "End User", 1345, 300, 120, 130, "user", "actor")
    d.node("api_consumer", "API Consumer", 1340, 545, 130, 130, "external", "actor")
    lane(d, "OmniRAG system boundary", 260, 105, 1020, 650)
    cases = [
        ("create_bot", "Create / configure bot", 330, 165),
        ("manage_docs", "Upload and manage documents", 330, 300),
        ("profile", "Select domain profile", 635, 230),
        ("channels", "Connect Telegram,\nZalo, Facebook", 330, 435),
        ("observe", "Monitor quality and usage", 330, 570),
        ("chat", "Ask questions", 845, 300),
        ("answer", "Receive grounded answer", 845, 435),
        ("memory", "Personalized memory", 845, 570),
    ]
    for nid, text, x, y in cases:
        d.node(nid, text, x, y, 240, 78, "process", "ellipse")
    admin_routes = {
        "create_bot": ((185, 380), (255, 380), (255, 204), (330, 204)),
        "manage_docs": ((185, 380), (255, 380), (255, 339), (330, 339)),
        "channels": ((185, 380), (255, 380), (255, 474), (330, 474)),
        "observe": ((185, 380), (255, 380), (255, 609), (330, 609)),
    }
    for tgt, pts in admin_routes.items():
        d.edge("admin", tgt, color="blue", points=pts, end_arrow=False, manual=True)
    d.edge("create_bot", "profile", label="<<include>>", color="orange", dashed=True)
    d.edge("manage_docs", "profile", label="<<include>>", color="orange", dashed=True)
    d.edge("enduser", "chat", color="green", points=((1345, 365), (1305, 365), (1305, 339), (1085, 339)), end_arrow=False, manual=True)
    d.edge("api_consumer", "chat", color="blue", points=((1340, 610), (1305, 610), (1305, 339), (1085, 339)), end_arrow=False, manual=True)
    d.edge("chat", "answer", label="<<include>>", color="green", dashed=True)
    d.edge("memory", "answer", label="<<extend>>", color="orange", dashed=True)
    return d


def make_2_1() -> Diagram:
    d = Diagram("2.1", "llm_comparison", "Figure 2.1 - LLM Comparison Matrix", "Static comparison table based on DOCX content", "matrix", 1560, 760)
    rows = [
        ["Model family", "Strength", "Typical use", "OmniRAG role"],
        ["GPT-4o / mini", "Vision, stable tool use", "general answer, image reasoning", "chat + image description"],
        ["GPT-5.x nano", "low latency, low cost", "internal classification", "CRAG / rewrite"],
        ["Claude / Gemini", "long context, reasoning", "fallback provider", "OpenRouter option"],
        ["Open embeddings", "cost-controlled vectors", "document retrieval", "Qdrant indexing"],
    ]
    add_table(d, "llm", 90, 130, [260, 340, 390, 350], 88, rows, "llm", "input")
    d.node("note", "No live refresh: values follow the thesis document, not current web data.", 360, 620, 820, 56, "warning", font_size=10, bold=False)
    return d


def make_2_2_1() -> Diagram:
    d = Diagram("2.2.1", "basic_rag_pipeline", "Figure 2.2.1 - Basic RAG Pipeline", "Canonical retrieve-augment-generate flow", "flowchart", 1640, 680)
    lane(d, "Offline indexing", 80, 110, 630, 260)
    lane(d, "Online answering", 800, 110, 650, 380)
    add_flow(d, [
        ("doc", "Documents", "input"),
        ("chunk", "Chunking", "process"),
        ("embed_doc", "Embedding", "process"),
        ("store", "Vector Store\nQdrant", "storage"),
    ], 120, 210, 130, 68, 30, "blue")
    d.nodes[-1] = Node("store", "Vector Store\nQdrant", 600, 210, 130, 68, "storage", "cylinder")
    add_flow(d, [
        ("query", "User Query", "user"),
        ("embed_query", "Query Embedding", "process"),
        ("retrieve", "Retrieve Top-K", "search"),
        ("prompt", "Prompt Assembly\nquery + context", "accent"),
        ("answer", "LLM Answer", "llm"),
    ], 840, 210, 125, 76, 22, "green")
    d.edge("store", "retrieve", label="nearest neighbors", color="gray")
    d.node("cite", "Grounded response\nwith citations", 1105, 390, 210, 70, "service")
    d.edge("answer", "cite", color="green")
    return d


def make_2_2_2() -> Diagram:
    d = Diagram("2.2.2", "rag_evolution", "Figure 2.2.2 - Naive RAG vs Advanced RAG vs Agentic RAG", "RAG evolution patterns", "comparison", 1600, 760)
    columns = [
        ("naive", "Naive RAG", "query -> vector search -> prompt -> answer", "Simple but brittle\nweak reranking\nno correction"),
        ("advanced", "Advanced RAG", "rewrite + hybrid search + rerank + CRAG", "OmniRAG default\nbetter recall\nlower hallucination"),
        ("agentic", "Agentic RAG", "planner -> tools -> retrieve -> reflect -> answer", "More autonomous\nhigher cost\nharder to control"),
    ]
    for i, (nid, title, flow, note) in enumerate(columns):
        x = 90 + i * 500
        lane(d, title, x, 115, 420, 500)
        d.node(f"{nid}_flow", flow, x + 45, 190, 330, 95, "process", font_size=11)
        d.node(f"{nid}_note", note, x + 45, 360, 330, 130, "input", font_size=10, bold=False)
        d.node(f"{nid}_fit", "Fit: " + ("baseline" if nid == "naive" else "production" if nid == "advanced" else "research/complex workflows"), x + 45, 535, 330, 50, "warning" if nid != "advanced" else "service", font_size=10)
    d.edge("naive_flow", "advanced_flow", color="orange")
    d.edge("advanced_flow", "agentic_flow", color="orange")
    return d


def make_2_3_1() -> Diagram:
    d = Diagram("2.3.1", "hybrid_search", "Figure 2.3.1 - Hybrid Search + Cross-Encoder Reranking", "Vector search, BM25, RRF and reranking", "flowchart", 1780, 610)
    d.node("query", "Original\nQuery", 60, 250, 170, 70, "input")
    d.node("embed", "Embed Query\ntext-embedding-3-small\n1536-dim vector", 300, 140, 230, 78, "process", font_size=10)
    d.node("vector", "Vector Search\nQdrant HNSW cosine\ntop_k * 2 candidates", 590, 140, 240, 78, "process", font_size=10)
    d.node("bm25", "Sparse BM25 Vector\nFastEmbed + IDF\nQdrant named vector", 300, 350, 230, 78, "search", font_size=10)
    d.node("fts", "Full-Text Results\nkeyword matches\ntop_k * 2 candidates", 590, 350, 240, 78, "search", font_size=10)
    d.node("rrf", "RRF Merge\nk = 60\nscore = sum 1/(k+rank)", 900, 240, 230, 96, "warning", font_size=10)
    d.node("rerank", "Cross-Encoder Rerank\nms-marco / bge-reranker\nsigmoid normalize", 1190, 240, 260, 96, "llm", font_size=10)
    d.node("final", "Final Top-K\nhybrid_score >= 0.15\nContext Assembly", 1520, 240, 210, 96, "service", font_size=10)
    d.node("filter", "Tenant filter: FieldCondition(bot_id) applies to both paths", 300, 470, 530, 65, "input", font_size=10, bold=False, dashed=True)
    d.node("formula", "Score rule: hybrid_score = sigmoid(cross_encoder); fallback = RRF score", 900, 450, 550, 85, "warning", font_size=10, bold=False)
    d.edge("query", "embed", "embed", "orange", ((260, 185),))
    d.edge("query", "bm25", "query text", "orange", ((260, 390),))
    d.edge("embed", "vector", color="blue")
    d.edge("bm25", "fts", color="orange")
    d.edge("vector", "rrf", "ranked list", "default", ((870, 179), (870, 288)))
    d.edge("fts", "rrf", "ranked list", "default", ((870, 389), (870, 288)))
    d.edge("rrf", "rerank", "candidates", "purple")
    d.edge("rerank", "final", "top_k", "green")
    return d


def make_2_3_2() -> Diagram:
    d = Diagram("2.3.2", "hyde_multi_query", "Figure 2.3.2 - HyDE + Multi-Query Fusion", "Optional/experimental retrieval expansion", "flowchart", 1620, 760)
    d.node("query", "User Query", 70, 320, 170, 70, "input")
    d.node("hyde", "HyDE\nhypothetical answer\nLLM generated", 340, 170, 240, 82, "llm")
    d.node("multi", "Multi-Query Rewrite\n3 semantic variants", 340, 430, 240, 82, "llm")
    d.node("embed_h", "Embed HyDE text", 690, 170, 210, 70, "process")
    d.node("embed_m", "Embed query variants", 690, 430, 210, 70, "process")
    d.node("search_h", "Vector search\nfor hypothetical doc", 1000, 170, 230, 72, "process")
    d.node("search_m", "Parallel searches\nfor query variants", 1000, 430, 230, 72, "process")
    d.node("fusion", "RRF Fusion\nmerge dedupe candidates", 1310, 290, 230, 90, "warning")
    d.node("note", "Current code keeps HyDE/Multi-Query as optional path; default pipeline uses original embedding + rewrite/CRAG.", 470, 610, 720, 60, "optional", font_size=10, bold=False)
    d.edge("query", "hyde", color="purple")
    d.edge("query", "multi", color="purple")
    d.edge("hyde", "embed_h", color="blue")
    d.edge("multi", "embed_m", color="blue")
    d.edge("embed_h", "search_h", color="blue")
    d.edge("embed_m", "search_m", color="blue")
    d.edge("search_h", "fusion", color="orange", points=((1260, 205), (1260, 335)))
    d.edge("search_m", "fusion", color="orange", points=((1260, 465), (1260, 335)))
    return d


def make_2_3_6() -> Diagram:
    d = Diagram("2.3.6", "crag_decision", "Figure 2.3.6 - CRAG Decision Flow", "Corrective RAG verdict and generation policy", "flowchart", 1780, 565)
    d.node("chunks", "Retrieved\nTop-3 Chunks", 60, 150, 210, 70, "process")
    d.node("query", "Rewritten\nSearch Query", 60, 280, 210, 70, "input")
    d.node("classifier", "CRAG Classifier\nINTERNAL_LLM_MODEL\ntemp=0, max_tokens=16", 360, 205, 260, 100, "search", font_size=10)
    d.node("fallback", "Fallback\nreturn 'relevant' if classifier fails", 360, 395, 260, 58, "warning", font_size=10, bold=False)
    d.node("relevant", "relevant\nchunks answer directly", 760, 105, 260, 70, "service")
    d.node("ambiguous", "ambiguous\npartial match only", 760, 245, 260, 70, "warning")
    d.node("no_context", "no_context\nKB lacks information", 760, 385, 260, 70, "error")
    d.node("normal", "Normal Pipeline\nanswer from context", 1130, 105, 270, 70, "service")
    d.node("caution", "Flag Uncertainty\nanswer with caution", 1130, 245, 270, 70, "warning")
    d.node("refuse", "Refuse to Fabricate\nstate KB has no info", 1130, 385, 270, 70, "error")
    d.node("llm", "LLM Generation\nOpenRouter\nfinal response", 1510, 225, 210, 110, "llm")
    d.edge("chunks", "classifier", color="blue")
    d.edge("query", "classifier")
    d.edge("classifier", "relevant", color="green", points=((690, 255), (690, 140)))
    d.edge("classifier", "ambiguous", color="orange")
    d.edge("classifier", "no_context", color="red", points=((690, 255), (690, 420)))
    d.edge("relevant", "normal", color="green")
    d.edge("ambiguous", "caution", color="orange")
    d.edge("no_context", "refuse", color="red")
    d.edge("normal", "llm", color="green")
    d.edge("caution", "llm", color="orange")
    d.edge("refuse", "llm", color="red")
    return d


def make_2_3_7() -> Diagram:
    d = Diagram("2.3.7", "colpali_multimodal", "Figure 2.3.7 - ColPali Multimodal Retrieval", "Vision-language retrieval compared with OCR text RAG", "comparison", 1660, 820)
    lane(d, "Traditional OCR text RAG", 70, 120, 700, 520)
    lane(d, "ColPali / vision-language RAG", 890, 120, 700, 520)
    add_flow(d, [
        ("pdf1", "PDF", "input"),
        ("ocr", "OCR / layout parse", "process"),
        ("text", "Text chunks", "process"),
        ("vec1", "Text vectors", "storage"),
    ], 110, 220, 130, 70, 35, "blue")
    d.node("issues", "Failure modes:\nOCR errors, lost tables,\nlayout discarded", 260, 430, 330, 105, "warning", font_size=10)
    add_flow(d, [
        ("pdf2", "PDF page\nas image", "input"),
        ("vlm", "Vision-language\nencoder", "llm"),
        ("patch", "Patch vectors\nmulti-vector grid", "process"),
        ("late", "Late interaction\nMaxSim scoring", "service"),
    ], 930, 220, 140, 80, 35, "purple")
    d.node("benefit", "Benefit:\nno OCR dependency,\npreserves visual layout,\nstrong on tables/charts", 1085, 430, 360, 105, "service", font_size=10)
    d.source_notes.append("Roadmap/theoretical figure from DOCX; not required for current default backend path.")
    return d


def make_2_4() -> Diagram:
    d = Diagram("2.4", "mem0_memory", "Figure 2.4 - Mem0 Persistent Memory Flow", "Memory read before answer and write after answer", "flowchart", 1540, 760)
    lane(d, "Read path - per chat request", 70, 120, 660, 430)
    lane(d, "Write path - async after answer", 830, 120, 640, 430)
    add_flow(d, [
        ("q", "User query", "user"),
        ("search", "Mem0 search\nuser_id + bot_id", "process"),
        ("facts", "Top-K memory facts", "storage"),
        ("inject", "Prompt memory block", "accent"),
    ], 110, 230, 130, 78, 35, "blue")
    add_flow(d, [
        ("turn", "Conversation turn\nuser + assistant", "input"),
        ("extract", "Fact extraction\nOpenRouter LLM", "llm"),
        ("memstore", "Qdrant collection\nomnirag_memories", "storage"),
    ], 890, 230, 170, 84, 45, "orange")
    d.node("grace", "Graceful degradation:\nif Mem0 is disabled or fails,\nchat continues without memory.", 500, 605, 540, 78, "warning", font_size=10)
    d.edge("inject", "turn", label="response completes", color="green", dashed=True, points=((700, 269), (800, 269)))
    return d


def make_2_5() -> Diagram:
    d = Diagram("2.5", "lightrag_architecture", "Figure 2.5 - LightRAG Architecture", "Knowledge graph indexing and KG-augmented query context", "architecture", 1580, 820)
    lane(d, "KG indexing stage", 70, 120, 690, 500)
    lane(d, "Query stage", 840, 120, 660, 500)
    add_flow(d, [
        ("fulltext", "Full document text\nsanitized, capped", "input"),
        ("insert", "LightRAG insert_text", "llm"),
        ("extractkg", "Entity / relation\nextraction", "process"),
        ("graph", "GraphML + vector stores", "storage"),
    ], 115, 230, 145, 84, 25, "purple")
    d.node("workspace", "Per-bot workspace\nrag_storage/lightrag_{bot_id}", 245, 455, 340, 72, "storage", font_size=10)
    d.edge("graph", "workspace", color="gray")
    add_flow(d, [
        ("kgquery", "User query", "user"),
        ("kgmode", "LightRAG query\nlocal/global/hybrid", "llm"),
        ("kgctx", "KG context only", "service"),
        ("ragctx", "Merged prompt\nchunks + KG", "accent"),
    ], 890, 230, 145, 84, 25, "purple")
    d.edge("workspace", "kgmode", label="if domain uses KG", color="orange", dashed=True, points=((630, 490), (800, 490), (970, 314)))
    return d


def make_2_7_1() -> Diagram:
    d = Diagram("2.7.1", "observability_stack", "Figure 2.7.1 - RAG Observability Stack", "Signals collected from gateway, backend and workers", "architecture", 1520, 740)
    lane(d, "Signal producers", 70, 130, 390, 430)
    lane(d, "Collection and storage", 560, 130, 390, 430)
    lane(d, "Operator views", 1050, 130, 390, 430)
    for i, (nid, text) in enumerate([
        ("gateway", "Go Gateway\nlatency, cache, rate limits"),
        ("backend", "FastAPI Backend\nchat, retrieval, Telegram webhook"),
        ("workers", "Celery / FB Worker\njobs, channel events"),
    ]):
        d.node(nid, text, 115, 190 + i * 105, 300, 72, "service", font_size=10)
    for i, (nid, text) in enumerate([
        ("metrics", "Metrics\nrequest and RAG KPIs"),
        ("logs", "Structured logs\nerrors and traces"),
        ("eval", "Evaluation results\nRAGAS / hit rate"),
    ]):
        d.node(nid, text, 605, 190 + i * 105, 300, 72, "storage", font_size=10)
    for i, (nid, text) in enumerate([
        ("dashboard", "Dashboard\nquality and throughput"),
        ("alerts", "Alerts\nfailures and regressions"),
        ("debug", "Debug panel\nchunks, scores, graph"),
    ]):
        d.node(nid, text, 1095, 190 + i * 105, 300, 72, "external", font_size=10)
    for src in ("gateway", "backend", "workers"):
        for tgt in ("metrics", "logs", "eval"):
            d.edge(src, tgt, color="gray", dashed=True)
    d.edge("metrics", "dashboard", color="green")
    d.edge("logs", "alerts", color="orange")
    d.edge("eval", "debug", color="blue")
    return d


def make_2_8() -> Diagram:
    return qdrant_schema("2.8", "qdrant_schema", "Figure 2.8 - Qdrant Collection Schema")


def qdrant_schema(fig_id: str, slug: str, title: str) -> Diagram:
    d = Diagram(fig_id, slug, title, "Qdrant vector and payload schema", "data_model", 1540, 760)
    lane(d, "Main document chunks collection", 70, 120, 650, 500)
    lane(d, "Memory collection", 820, 120, 620, 500)
    d.node("chunk", "point.id\nUUID / hash", 120, 200, 220, 60, "storage")
    d.node("vector", "vector\n1536-d embedding\ncosine distance", 120, 310, 220, 86, "process")
    d.node("payload", "payload\nbot_id, document_id,\nchunk_index, text,\nmetadata, source path", 405, 230, 250, 150, "input", font_size=10)
    d.edge("chunk", "vector", color="blue")
    d.edge("vector", "payload", color="gray")
    d.node("fts", "Sparse vector\nBM25 + IDF\nnamed vector bm25", 280, 460, 260, 84, "search", font_size=10)
    d.edge("payload", "fts", color="orange")
    d.node("memid", "memory point.id", 880, 205, 230, 60, "storage")
    d.node("memvec", "memory vector\nsemantic fact embedding", 880, 315, 230, 76, "process")
    d.node("mempayload", "payload\nuser_id, bot_id,\nsession_id, memory text,\ncreated_at", 1170, 240, 230, 130, "input", font_size=10)
    d.edge("memid", "memvec", color="blue")
    d.edge("memvec", "mempayload", color="gray")
    d.node("filter", "Common filter:\nbot_id isolates tenant/bot data\nfor retrieval and memory lookup", 610, 650, 340, 64, "warning", font_size=10)
    return d


def make_2_9() -> Diagram:
    return system_architecture("2.9", "system_architecture", "Figure 2.9 - OmniRAG System Architecture")


def system_architecture(fig_id: str, slug: str, title: str) -> Diagram:
    d = Diagram(fig_id, slug, title, "Runtime services and data dependencies", "architecture", 1660, 900)
    lane(d, "Clients and channels", 70, 110, 360, 640)
    lane(d, "Application layer", 520, 110, 520, 640)
    lane(d, "Data and AI layer", 1130, 110, 460, 640)
    clients = [
        ("admin", "Admin Dashboard\nReact frontend"),
        ("telegram", "Telegram Bot\nBot API webhook"),
        ("zalo", "Zalo Direct / Hub"),
        ("fb", "Facebook Messenger"),
        ("api", "External REST client"),
    ]
    for i, (nid, text) in enumerate(clients):
        d.node(nid, text, 115, 170 + i * 105, 270, 76, "external", font_size=10)
    d.node("gateway", "Go Gateway\nrate limit, cache, SSE proxy", 575, 175, 380, 82, "service", font_size=10)
    d.node("backend", "FastAPI Backend\nbots, chat, RAG, channels", 575, 315, 380, 82, "service", font_size=10)
    d.node("celery", "Celery Worker\nindexing, KG, channel jobs", 575, 455, 380, 82, "process", font_size=10)
    d.node("fbworker", "FB Channel Worker\ncookie session, inbound bridge", 575, 595, 380, 82, "process", font_size=10)
    for src, _ in clients:
        d.edge(src, "gateway", color="blue")
    d.edge("gateway", "backend", color="green")
    d.edge("backend", "celery", label="async", color="orange", dashed=True)
    d.edge("backend", "fbworker", label="worker API", color="blue")
    stores = [
        ("pg", "PostgreSQL\nmetadata"),
        ("mongo", "MongoDB\nchat history"),
        ("qdrant", "Qdrant\nvectors + memory"),
        ("minio", "MinIO\nfiles + parsed assets"),
        ("redis", "Redis\ncache + broker"),
        ("openrouter", "OpenRouter\nLLM + embeddings"),
    ]
    for i, (nid, text) in enumerate(stores):
        d.node(nid, text, 1185, 155 + i * 100, 320, 70, "storage" if nid != "openrouter" else "llm", "cylinder" if nid != "openrouter" else "round", font_size=10)
    backend_routes = {
        "pg": ((955, 356), (1090, 356), (1090, 190), (1185, 190)),
        "mongo": ((955, 356), (1090, 356), (1090, 290), (1185, 290)),
        "qdrant": ((955, 356), (1090, 356), (1090, 390), (1185, 390)),
        "minio": ((955, 356), (1090, 356), (1090, 490), (1185, 490)),
        "redis": ((955, 356), (1090, 356), (1090, 590), (1185, 590)),
        "openrouter": ((955, 356), (1090, 356), (1090, 690), (1185, 690)),
    }
    for nid, pts in backend_routes.items():
        d.edge("backend", nid, color="gray", points=pts, manual=True)
    d.edge("celery", "qdrant", color="orange", points=((955, 496), (1110, 496), (1110, 390), (1185, 390)), manual=True)
    d.edge("celery", "minio", color="orange", points=((955, 496), (1110, 496), (1110, 490), (1185, 490)), manual=True)
    d.edge("celery", "openrouter", color="purple", points=((955, 496), (1110, 496), (1110, 690), (1185, 690)), manual=True)
    return d


def make_2_12() -> Diagram:
    d = Diagram("2.12", "zalo_bot_flow", "Figure 2.12 - Zalo Bot Integration Flow", "Two sequence panels: connection setup and runtime webhook handling", "sequence", 1760, 1320)
    lane(d, "A. Connect-time setup", 50, 80, 1660, 430)
    setup = {
        "admin_s": add_sequence_actor(d, "admin_s", "Admin UI", 120, y=135, w=150, bottom=490, role="external"),
        "backend_s": add_sequence_actor(d, "backend_s", "FastAPI Channel API", 420, y=135, w=190, bottom=490, role="service"),
        "zalo_s": add_sequence_actor(d, "zalo_s", "Zalo Bot API", 760, y=135, w=165, bottom=490, role="external"),
        "pg_s": add_sequence_actor(d, "pg_s", "PostgreSQL\nbot.config", 1115, y=135, w=190, bottom=490, role="storage"),
    }
    add_activation(d, "act_backend_setup", setup["backend_s"], 240, 245)
    add_activation(d, "act_zalo_setup", setup["zalo_s"], 285, 140)
    add_activation(d, "act_pg_setup", setup["pg_s"], 445, 40)

    sequence_message(d, setup, "admin_s", "backend_s", 245, "POST /channels/zalo-bot/connect", "blue")
    sequence_message(d, setup, "backend_s", "zalo_s", 290, "getMe(bot_token)", "blue")
    sequence_message(d, setup, "zalo_s", "backend_s", 335, "bot info", "blue", dashed=True)
    sequence_message(d, setup, "backend_s", "zalo_s", 380, "setWebhook(webhook URL + secret)", "orange")
    sequence_message(d, setup, "zalo_s", "backend_s", 425, "webhook ok", "orange", dashed=True)
    sequence_message(d, setup, "backend_s", "pg_s", 465, "save bot.config.zalo_bot", "gray")
    sequence_message(d, setup, "backend_s", "admin_s", 500, "connected", "green", dashed=True)

    lane(d, "B. Runtime webhook", 50, 540, 1660, 700)
    runtime = {
        "user_r": add_sequence_actor(d, "user_r", "Zalo User", 85, y=600, w=145, bottom=1225, role="external"),
        "zalo_r": add_sequence_actor(d, "zalo_r", "Zalo Bot API", 280, y=600, w=155, bottom=1225, role="external"),
        "gateway_r": add_sequence_actor(d, "gateway_r", "Go Gateway", 490, y=600, w=150, bottom=1225, role="service"),
        "backend_r": add_sequence_actor(d, "backend_r", "FastAPI Channel API", 705, y=600, w=185, bottom=1225, role="service"),
        "pg_r": add_sequence_actor(d, "pg_r", "PostgreSQL\nbot.config", 945, y=600, w=170, bottom=1225, role="storage"),
        "service_r": add_sequence_actor(d, "service_r", "ZaloBotService", 1165, y=600, w=165, bottom=1225, role="process"),
        "rag_r": add_sequence_actor(d, "rag_r", "RAG + Memory", 1375, y=600, w=165, bottom=1225, role="service"),
        "ai_r": add_sequence_actor(d, "ai_r", "OpenRouter\nQdrant", 1570, y=600, w=130, bottom=1225, role="llm"),
    }
    add_activation(d, "act_zalo_runtime", runtime["zalo_r"], 690, 535)
    add_activation(d, "act_gateway", runtime["gateway_r"], 735, 50)
    add_activation(d, "act_backend_runtime", runtime["backend_r"], 775, 205)
    add_activation(d, "act_pg_runtime", runtime["pg_r"], 815, 60)
    add_activation(d, "act_service", runtime["service_r"], 935, 280)
    add_activation(d, "act_rag", runtime["rag_r"], 1055, 130)
    add_activation(d, "act_ai", runtime["ai_r"], 1095, 60)

    sequence_message(d, runtime, "user_r", "zalo_r", 695, "send message", "blue")
    sequence_message(d, runtime, "zalo_r", "gateway_r", 740, "POST webhook/{bot_id}\n+ x-bot-api-secret-token", "blue")
    sequence_message(d, runtime, "gateway_r", "backend_r", 780, "proxy to FastAPI route", "blue")
    sequence_message(d, runtime, "backend_r", "pg_r", 820, "load webhook_secret", "gray")
    sequence_message(d, runtime, "pg_r", "backend_r", 860, "expected secret", "gray", dashed=True)
    sequence_self_message(d, runtime, "backend_r", 900, "constant-time verify\nhmac.compare_digest", "orange")
    sequence_message(d, runtime, "backend_r", "service_r", 940, "asyncio.create_task(handle_webhook)", "green")
    sequence_message(d, runtime, "backend_r", "zalo_r", 980, "200 {status: received}", "gray", dashed=True)
    sequence_message(d, runtime, "service_r", "zalo_r", 1025, "sendChatAction typing", "orange", dashed=True)
    sequence_message(d, runtime, "service_r", "rag_r", 1065, "chat(bot_id, query,\nuser_id=zalo_chat_id)", "green")
    sequence_message(d, runtime, "rag_r", "ai_r", 1105, "embed + retrieve + generate", "purple")
    sequence_message(d, runtime, "ai_r", "rag_r", 1145, "context + answer", "purple", dashed=True)
    sequence_message(d, runtime, "rag_r", "service_r", 1185, "AI response", "green", dashed=True)
    sequence_message(d, runtime, "service_r", "zalo_r", 1215, "sendMessage(chat_id, response)", "orange")
    sequence_message(d, runtime, "zalo_r", "user_r", 1228, "reply to user", "green", dashed=True)
    d.node("note", "Code-truth note: current Zalo Direct path dispatches an asyncio background task in FastAPI; it is not shown as a separate Celery worker in this diagram.", 340, 1265, 1080, 38, "optional", font_size=9, bold=False)
    return d


def node_x(nid: str, actors: list[tuple[str, str, int]]) -> int:
    return next(x for aid, _, x in actors if aid == nid)


def add_sequence_actor(
    d: Diagram,
    nid: str,
    label: str,
    x: int,
    y: int = 110,
    w: int = 180,
    h: int = 56,
    bottom: int = 720,
    role: str = "service",
) -> int:
    d.node(nid, label, x, y, w, h, role, font_size=10)
    cx = x + w // 2
    d.node(f"{nid}_life", "", cx - 3, y + h + 24, 6, bottom - (y + h + 24), "input", "lifeline", font_size=1, bold=False)
    return cx


def add_activation(d: Diagram, nid: str, cx: int, y: int, h: int) -> None:
    d.node(nid, "", cx - 5, y, 10, h, "input", "activation", font_size=1, bold=False)


def sequence_message(
    d: Diagram,
    centers: dict[str, int],
    src: str,
    tgt: str,
    y: int,
    label: str,
    color: str = "default",
    dashed: bool = False,
) -> None:
    d.edge(src, tgt, label, color, ((centers[src], y), (centers[tgt], y)), dashed=dashed, manual=True)


def sequence_self_message(
    d: Diagram,
    centers: dict[str, int],
    actor: str,
    y: int,
    label: str,
    color: str = "default",
    dashed: bool = False,
) -> None:
    cx = centers[actor]
    d.edge(actor, actor, label, color, ((cx, y), (cx + 95, y), (cx + 95, y + 32), (cx, y + 32)), dashed=dashed, manual=True)


def make_2_13() -> Diagram:
    d = Diagram("2.13", "facebook_messenger_architecture", "Figure 2.13 - Facebook Messenger Integration Architecture", "Backend facade plus dedicated FB channel worker", "architecture", 1600, 800)
    lane(d, "Facebook side", 70, 120, 360, 500)
    lane(d, "Worker boundary", 520, 120, 430, 500)
    lane(d, "OmniRAG backend", 1040, 120, 420, 500)
    d.node("fbweb", "Facebook Web\nMessenger threads", 120, 220, 260, 76, "external")
    d.node("cookies", "Cookie session\nc_user, xs, fr,\ndatr, sb", 120, 380, 260, 90, "warning", font_size=10)
    d.node("worker", "fb-channel-worker\nFastAPI + bearer token", 575, 220, 320, 82, "process")
    d.node("inbound", "Inbound bridge\nHMAC signature", 575, 380, 320, 82, "service")
    d.node("api", "FacebookMessengerService\nconnect, send, react,\nthread context cache", 1095, 205, 310, 100, "service", font_size=10)
    d.node("chat", "OmniRAG Chat Pipeline\nRAG + memory + tools", 1095, 400, 310, 82, "service")
    d.edge("cookies", "worker", color="orange")
    d.edge("worker", "fbweb", label="send/react", color="blue")
    d.edge("fbweb", "inbound", label="new message", color="blue")
    d.edge("inbound", "api", label="signed callback", color="green")
    d.edge("api", "chat", color="green")
    d.edge("chat", "worker", label="reply", color="orange", points=((1030, 441), (970, 441), (970, 261)))
    return d


def make_3_1() -> Diagram:
    d = Diagram("3.1", "omnichannel_message_flow", "Figure 3.1 - Omnichannel Message Flow", "Telegram/Zalo direct and Zalo Hub share the same chat core", "sequence", 1620, 920)
    centers = {
        "user": add_sequence_actor(d, "user", "Channel User", 70, bottom=890, role="external"),
        "direct": add_sequence_actor(d, "direct", "Telegram / Zalo Direct API", 305, bottom=890, role="external"),
        "hub": add_sequence_actor(d, "hub", "func.vn Hub", 540, bottom=890, role="external"),
        "backend": add_sequence_actor(d, "backend", "Backend Channel API", 775, bottom=890, role="service"),
        "chat": add_sequence_actor(d, "chat", "Shared Chat Core", 1010, bottom=890, role="service"),
        "reply": add_sequence_actor(d, "reply", "Reply Adapter", 1245, bottom=890, role="accent"),
    }
    d.node("direct_label", "Direct bots", 80, 215, 145, 34, "warning", font_size=10, bold=False)
    d.node("hub_label", "Zalo Hub", 80, 575, 145, 34, "warning", font_size=10, bold=False)
    add_activation(d, "act_backend", centers["backend"], 315, 475)
    add_activation(d, "act_chat", centers["chat"], 375, 105)
    add_activation(d, "act_chat_hub", centers["chat"], 720, 105)
    sequence_message(d, centers, "user", "direct", 255, "message to bot", "blue")
    sequence_message(d, centers, "direct", "backend", 315, "/telegram|zalo/webhook/{bot_id}", "blue")
    sequence_message(d, centers, "backend", "chat", 375, "normalize + chat", "green")
    sequence_message(d, centers, "chat", "reply", 435, "answer payload", "green", dashed=True)
    sequence_message(d, centers, "reply", "direct", 495, "sendMessage / sendChatAction", "orange", dashed=True)
    sequence_message(d, centers, "direct", "user", 545, "bot reply", "green", dashed=True)
    sequence_message(d, centers, "user", "hub", 620, "message via OA", "blue")
    sequence_message(d, centers, "hub", "backend", 680, "/hub-webhook", "blue")
    sequence_message(d, centers, "backend", "chat", 740, "same chat core", "green")
    sequence_message(d, centers, "chat", "reply", 800, "answer payload", "green", dashed=True)
    sequence_message(d, centers, "reply", "hub", 840, "func.vn reply", "orange", dashed=True)
    sequence_message(d, centers, "hub", "user", 880, "OA reply", "green", dashed=True)
    return d


def make_3_1b() -> Diagram:
    d = Diagram("3.1b", "facebook_message_flow", "Figure 3.1b - Facebook Messenger Message Flow", "Facebook worker inbound/outbound message flow", "sequence", 1600, 760)
    centers = {
        "fb": add_sequence_actor(d, "fb", "Facebook Thread", 85, role="external"),
        "worker": add_sequence_actor(d, "worker", "FB Worker", 365, role="process"),
        "backend": add_sequence_actor(d, "backend", "Backend Inbound API", 645, role="service"),
        "chat": add_sequence_actor(d, "chat", "Chat Pipeline", 925, role="service"),
        "llm": add_sequence_actor(d, "llm", "OpenRouter / Tools", 1205, role="llm"),
    }
    add_activation(d, "act_worker", centers["worker"], 245, 390)
    add_activation(d, "act_backend", centers["backend"], 320, 230)
    add_activation(d, "act_chat", centers["chat"], 390, 150)
    sequence_message(d, centers, "fb", "worker", 250, "new message", "blue")
    sequence_message(d, centers, "worker", "backend", 320, "HMAC inbound callback", "blue")
    sequence_message(d, centers, "backend", "chat", 390, "bot_id + thread context", "green")
    sequence_message(d, centers, "chat", "llm", 460, "RAG prompt", "purple")
    sequence_message(d, centers, "llm", "chat", 530, "answer", "purple", dashed=True)
    sequence_message(d, centers, "backend", "worker", 600, "send/reply API", "orange", dashed=True)
    sequence_message(d, centers, "worker", "fb", 670, "outbound reply/react", "orange", dashed=True)
    d.node("ctx", "Thread context cache TTL 120s; optional image description and web-search trigger.", 470, 705, 650, 40, "warning", font_size=10, bold=False)
    return d


def build_3_2() -> Diagram:
    d = Diagram("3.2", "use_case_diagram", "Figure 3.2 - Use Case Diagram", "Detailed actor/use-case relation for OmniRAG", "use_case", 1600, 900)
    d.node("admin", "Admin", 65, 355, 110, 130, "user", "actor")
    d.node("enduser", "End User", 1430, 230, 120, 130, "user", "actor")
    d.node("zalo", "Zalo / Telegram\nUser", 1430, 430, 120, 130, "external", "actor")
    d.node("consumer", "API Consumer", 1425, 630, 130, 130, "external", "actor")
    lane(d, "OmniRAG", 230, 110, 1130, 680)
    cases = [
        ("auth", "Login / manage tenant", 315, 155),
        ("bot", "Create bot wizard", 315, 280),
        ("docs", "Upload documents", 315, 405),
        ("channel", "Connect Telegram,\nZalo, Facebook", 315, 530),
        ("eval", "View evaluation dashboard", 315, 655),
        ("domain", "Configure domain profile", 650, 340),
        ("kg", "Inspect knowledge graph", 650, 560),
        ("chat", "Ask question", 980, 340),
        ("answer", "Receive grounded answer", 980, 500),
    ]
    for nid, text, x, y in cases:
        d.node(nid, text, x, y, 240, 78, "process", "ellipse")
    admin_routes = {
        "auth": ((175, 420), (250, 420), (250, 194), (315, 194)),
        "bot": ((175, 420), (250, 420), (250, 319), (315, 319)),
        "docs": ((175, 420), (250, 420), (250, 444), (315, 444)),
        "channel": ((175, 420), (250, 420), (250, 569), (315, 569)),
        "eval": ((175, 420), (250, 420), (250, 694), (315, 694)),
        "kg": ((175, 420), (250, 420), (250, 599), (650, 599)),
    }
    for tgt, pts in admin_routes.items():
        d.edge("admin", tgt, color="blue", points=pts, end_arrow=False, manual=True)
    d.edge("enduser", "chat", color="green", points=((1430, 295), (1380, 295), (1380, 379), (1220, 379)), end_arrow=False, manual=True)
    d.edge("zalo", "chat", color="blue", points=((1430, 495), (1380, 495), (1380, 379), (1220, 379)), end_arrow=False, manual=True)
    d.edge("consumer", "chat", color="blue", points=((1425, 695), (1380, 695), (1380, 379), (1220, 379)), end_arrow=False, manual=True)
    d.edge("chat", "answer", label="<<include>>", color="green", dashed=True)
    d.edge("bot", "domain", label="<<include>>", color="orange", dashed=True)
    d.edge("docs", "domain", label="<<include>>", color="orange", dashed=True)
    return d


def make_3_3() -> Diagram:
    d = Diagram("3.3", "rag_sequence", "Figure 3.3 - RAG Sequence Diagram", "Online answer sequence in the backend", "sequence", 1660, 860)
    centers = {
        "client": add_sequence_actor(d, "client", "Client", 70, bottom=800, role="external"),
        "api": add_sequence_actor(d, "api", "FastAPI Chat API", 330, bottom=800, role="service"),
        "embed": add_sequence_actor(d, "embed", "Embedding Model", 590, bottom=800, role="process"),
        "qdrant": add_sequence_actor(d, "qdrant", "Qdrant", 850, bottom=800, role="storage"),
        "crag": add_sequence_actor(d, "crag", "CRAG Classifier", 1110, bottom=800, role="warning"),
        "llm": add_sequence_actor(d, "llm", "OpenRouter LLM", 1370, bottom=800, role="llm"),
    }
    add_activation(d, "act_api", centers["api"], 235, 520)
    add_activation(d, "act_embed", centers["embed"], 305, 45)
    add_activation(d, "act_qdrant", centers["qdrant"], 375, 45)
    add_activation(d, "act_crag", centers["crag"], 455, 45)
    add_activation(d, "act_llm", centers["llm"], 540, 95)
    sequence_message(d, centers, "client", "api", 240, "POST /chat/stream", "blue")
    sequence_message(d, centers, "api", "embed", 310, "embed original query", "blue")
    sequence_message(d, centers, "embed", "api", 350, "query vector", "blue", dashed=True)
    sequence_message(d, centers, "api", "qdrant", 390, "hybrid search", "orange")
    sequence_message(d, centers, "qdrant", "api", 430, "top-k chunks", "orange", dashed=True)
    sequence_message(d, centers, "api", "crag", 470, "classify evidence", "orange")
    sequence_message(d, centers, "crag", "api", 510, "verdict", "orange", dashed=True)
    sequence_message(d, centers, "api", "llm", 565, "prompt + context", "purple")
    sequence_message(d, centers, "llm", "api", 635, "stream tokens", "purple", dashed=True)
    sequence_message(d, centers, "api", "client", 710, "SSE response", "green", dashed=True)
    return d


def make_3_4() -> Diagram:
    d = Diagram("3.4", "document_processing_activity", "Figure 3.4 - Activity Diagram: Document Processing", "Two-stage document processing with async KG build", "flowchart", 1680, 900)
    lane(d, "Upload and vector indexing", 70, 120, 720, 650)
    lane(d, "Async knowledge graph stage", 900, 120, 680, 650)
    d.node("upload", "User uploads file\nstored in MinIO", 130, 200, 230, 72, "input")
    d.node("task", "Celery process_document_task\nstatus = processing", 470, 200, 250, 72, "process")
    d.node("load", "Load document once\nOpenDataLoader/docling fallback", 260, 340, 300, 80, "process")
    d.node("chunk", "Domain chunking\narticle / sentence / recursive", 260, 480, 300, 80, "process")
    d.node("index", "Embed + upsert chunks\nQdrant vector + FTS payload", 260, 620, 300, 80, "storage", "cylinder")
    d.edge("upload", "task", color="blue")
    d.edge("task", "load", color="blue")
    d.edge("load", "chunk", color="blue")
    d.edge("chunk", "index", color="green")
    d.node("complete", "Document status = completed\nmetadata available immediately", 590, 620, 240, 80, "service")
    d.edge("index", "complete", color="green")
    d.node("kgcheck", "KG enabled\nfor domain?", 975, 245, 150, 90, "decision", "diamond")
    d.node("enqueue", "Enqueue\nbuild_knowledge_graph_task", 1210, 250, 260, 80, "process")
    d.node("sanitize", "Sanitize full text\nremove null bytes, cap size", 1210, 390, 260, 80, "process")
    d.node("insert", "LightRAG insert_text\nentities + relations", 1210, 530, 260, 80, "llm")
    d.node("kgdone", "kg_status updated\nready / failed", 1210, 670, 260, 70, "storage")
    d.edge("complete", "kgcheck", color="orange", dashed=True, points=((860, 660), (950, 660), (950, 290)))
    d.edge("kgcheck", "enqueue", label="yes", color="green")
    d.edge("enqueue", "sanitize", color="green")
    d.edge("sanitize", "insert", color="purple")
    d.edge("insert", "kgdone", color="green")
    d.node("skip", "No KG\nskip stage 2", 955, 470, 180, 70, "optional", dashed=True)
    d.edge("kgcheck", "skip", label="no", color="gray", dashed=True)
    return d


def build_3_5() -> Diagram:
    d = Diagram("3.5", "zalo_integration_flow", "Figure 3.5 - Zalo Integration Flow", "Zalo connect, webhook verify and reply flow", "flowchart", 1900, 900)
    lane(d, "Connect-time setup", 70, 120, 650, 330)
    lane(d, "Runtime webhook + reply", 800, 120, 1030, 650)
    add_flow(d, [
        ("admin", "Admin submits\nbot token", "user"),
        ("verify", "Backend getMe\nverifies token", "service"),
        ("sethook", "Set webhook URL\n+ secret header", "external"),
    ], 120, 230, 170, 80, 50, "blue")
    d.node("secret", "Generate webhook_secret", 330, 335, 210, 58, "warning")
    d.node("cfg", "Store bot.config['zalo_bot']", 570, 335, 120, 82, "storage", "cylinder", font_size=9)
    d.edge("verify", "secret", color="orange")
    d.edge("secret", "sethook", color="orange")
    d.edge("sethook", "cfg", color="gray")
    d.node("user", "Zalo User", 845, 230, 140, 72, "external")
    d.node("zalo", "Zalo Bot API", 1045, 230, 150, 72, "external")
    d.node("gateway", "Go Gateway", 1260, 230, 150, 72, "service")
    d.node("backend", "FastAPI\nwebhook route", 1485, 230, 165, 72, "service")
    d.node("pg", "bot.config\nwebhook_secret", 1505, 355, 140, 86, "storage", "cylinder", font_size=9)
    d.node("ack", "Immediate 200 OK\nwebhook accepted", 1045, 380, 170, 64, "optional", font_size=10, bold=False)
    d.node("task", "Background handler\nhandle_webhook()", 1220, 520, 190, 78, "process")
    d.node("chat", "Chat pipeline\nRAG + memory", 1510, 520, 170, 78, "service")
    d.node("send", "Typing + sendMessage\nvia Zalo Bot API", 1070, 670, 230, 78, "accent")
    d.edge("user", "zalo", color="blue")
    d.edge("zalo", "gateway", label="webhook", color="blue")
    d.edge("gateway", "backend", color="blue")
    d.edge("backend", "pg", label="load secret", color="gray")
    d.edge("pg", "backend", label="expected secret", color="gray", dashed=True, points=((1505, 398), (1455, 398), (1455, 266), (1485, 266)), manual=True)
    d.edge("backend", "ack", label="after verify", color="gray", dashed=True, points=((1485, 266), (1380, 266), (1380, 412), (1215, 412)), manual=True)
    d.edge("backend", "task", label="asyncio.create_task", color="green", points=((1568, 302), (1568, 480), (1315, 480), (1315, 520)), manual=True)
    d.edge("task", "zalo", color="orange", dashed=True, points=((1220, 558), (1118, 558), (1118, 302)), manual=True)
    d.edge("task", "chat", label="chat()", color="green")
    d.edge("chat", "task", label="answer", color="green", dashed=True, points=((1510, 558), (1410, 558)), manual=True)
    d.edge("task", "send", label="reply payload", color="orange")
    d.edge("send", "zalo", color="orange", points=((1185, 670), (1185, 625), (1120, 625), (1120, 302)), manual=True)
    d.edge("zalo", "user", label="reply", color="green", dashed=True, points=((1120, 302), (1120, 765), (915, 765), (915, 302)), manual=True)
    return d


def make_3_5b() -> Diagram:
    d = Diagram("3.5b", "messenger_comparison_flow", "Figure 3.5b - Channel Integration Comparison", "Telegram, Zalo Direct, Zalo Hub and Facebook Messenger compared", "comparison", 1640, 820)
    rows = [
        ["Channel", "Inbound auth", "Backend entrypoint", "Outbound path", "Notes"],
        ["Telegram", "X-Telegram-Bot-Api-Secret-Token", "/channels/telegram/webhook/{bot_id}", "api.telegram.org sendMessage", "per-bot token in bot.config.telegram"],
        ["Zalo Direct", "x-bot-api-secret-token", "/webhook/{bot_id}", "bot-api.zapps.me", "per-bot webhook"],
        ["Zalo Hub", "x-hub-secret", "/hub-webhook", "func.vn API", "centralized account dispatch"],
        ["Facebook", "HMAC worker signature", "/facebook/inbound", "fb-channel-worker /send", "cookie session worker"],
    ]
    add_table(d, "cmp", 80, 140, [220, 330, 330, 330, 350], 92, rows, "service", "input")
    d.node("shared", "All four paths normalize into the same Chat Pipeline:\nchannel_user_id + bot_id + text -> RAG/memory/CRAG -> channel adapter reply", 360, 635, 920, 86, "accent")
    return d


def make_3_6() -> Diagram:
    d = Diagram("3.6", "two_stage_document_processing", "Figure 3.6 - Two-Stage Document Processing Flow", "Vector indexing first, KG construction second", "timeline", 1600, 740)
    lane(d, "Stage 1 - synchronous for user-visible document readiness", 80, 140, 650, 360)
    lane(d, "Stage 2 - asynchronous KG enrichment", 860, 140, 650, 360)
    add_flow(d, [
        ("s1_upload", "Upload", "input"),
        ("s1_parse", "Parse once", "process"),
        ("s1_chunk", "Chunk by domain", "process"),
        ("s1_index", "Vector + FTS index", "storage"),
        ("s1_ready", "Document completed", "service"),
    ], 120, 270, 105, 70, 20, "blue")
    add_flow(d, [
        ("s2_enqueue", "Queue KG task", "process"),
        ("s2_sanitize", "Sanitize full text", "process"),
        ("s2_extract", "Extract graph", "llm"),
        ("s2_store", "Store graph + vectors", "storage"),
    ], 905, 270, 135, 70, 25, "purple")
    d.edge("s1_ready", "s2_enqueue", label="if KG enabled", color="orange", dashed=True, points=((770, 305), (830, 305)))
    d.node("why", "Reasoning: users can chat as soon as vector index is ready; KG improves later queries without blocking upload.", 360, 570, 900, 70, "warning", font_size=10, bold=False)
    return d


def make_3_7() -> Diagram:
    return system_architecture("3.7", "system_architecture", "Figure 3.7 - System Architecture")


def make_3_8() -> Diagram:
    d = Diagram("3.8", "erd_postgresql", "Figure 3.8 - ERD PostgreSQL", "Core relational data model", "er", 1620, 900)
    def table(nid: str, title: str, fields: list[str], x: int, y: int, w: int = 270) -> None:
        d.node(nid, f"{title}\n" + "\n".join(fields), x, y, w, 52 + len(fields) * 24, "storage", "entity", font_size=10, align="left")

    def card(nid: str, text: str, x: int, y: int, w: int = 46) -> None:
        d.node(nid, text, x, y, w, 22, "storage", "text", font_size=9, bold=False)

    table("tenants", "tenants", ["# id", "name", "email UNIQUE", "plan", "settings JSONB"], 675, 125)
    table("users", "users", ["# id", "-> tenant_id", "email UNIQUE", "role", "is_active"], 210, 345)
    table("bots", "bots", ["# id", "-> tenant_id", "name", "config JSONB", "api_key UNIQUE"], 675, 345)
    table("folders", "folders", ["# id", "-> bot_id", "-> parent_id", "name"], 520, 620)
    table("documents", "documents", ["# id", "-> bot_id", "-> folder_id", "filename", "status", "tags JSONB", "doc_metadata JSONB"], 990, 600, 320)

    d.edge("tenants", "users", color="gray", end_arrow=False)
    card("tu_1", "1", 640, 228)
    card("tu_many", "0..*", 492, 405)
    d.edge("tenants", "bots", color="gray", end_arrow=False)
    card("tb_1", "1", 835, 304)
    card("tb_many", "0..*", 835, 322)
    d.edge("bots", "folders", color="gray", end_arrow=False)
    card("bf_1", "1", 785, 526)
    card("bf_many", "0..*", 646, 590)
    d.edge("bots", "documents", color="gray", end_arrow=False)
    card("bd_1", "1", 954, 424)
    card("bd_many", "0..*", 956, 672)
    d.edge("folders", "documents", color="gray", end_arrow=False)
    card("fd_opt", "0..1", 795, 678, 54)
    card("fd_many", "0..*", 930, 700)
    d.edge("folders", "folders", color="gray", points=((520, 690), (455, 690), (455, 745), (520, 745)), dashed=True, end_arrow=False, manual=True)
    card("ff_parent", "0..1 parent", 394, 676, 92)
    card("ff_child", "0..* children", 392, 748, 96)
    return d


def make_3_9() -> Diagram:
    return qdrant_schema("3.9", "qdrant_collection_schema", "Figure 3.9 - Qdrant Collection Schema")


def make_3_9b() -> Diagram:
    d = Diagram("3.9b", "observability_architecture", "Figure 3.9b - Observability Architecture", "Operational observability data flow", "architecture", 1540, 780)
    lane(d, "Instrumentation", 70, 120, 420, 500)
    lane(d, "Pipelines", 570, 120, 420, 500)
    lane(d, "Dashboards and review", 1070, 120, 360, 500)
    d.node("events", "Application events\nchat, upload, channel", 130, 210, 280, 72, "process")
    d.node("metrics", "RAG metrics\nlatency, top_k, CRAG verdict", 130, 340, 280, 72, "process")
    d.node("errors", "Errors\nprovider, parsing, webhook", 130, 470, 280, 72, "error")
    d.node("logstore", "Log/metric store", 640, 250, 270, 78, "storage", "cylinder")
    d.node("evalstore", "Evaluation store\nRAGAS, user feedback", 640, 430, 270, 78, "storage", "cylinder")
    d.node("dash", "Ops dashboard", 1125, 230, 250, 72, "external")
    d.node("quality", "Quality dashboard", 1125, 390, 250, 72, "external")
    for src in ("events", "metrics", "errors"):
        d.edge(src, "logstore", color="gray")
    d.edge("metrics", "evalstore", color="orange")
    d.edge("logstore", "dash", color="green")
    d.edge("evalstore", "quality", color="green")
    return d


def make_4_1() -> Diagram:
    d = Diagram("4.1", "docker_compose_stack", "Figure 4.1 - Docker Compose Stack", "Local deployment topology", "deployment", 1660, 900)
    lane(d, "Edge and app services", 70, 120, 520, 620)
    lane(d, "Workers", 680, 120, 360, 620)
    lane(d, "Stateful services", 1130, 120, 420, 620)
    services = [
        ("frontend", "frontend\nReact/Vite"),
        ("gateway", "gateway\nGo Gin proxy"),
        ("backend", "backend\nFastAPI"),
        ("opendata", "opendataloader-hybrid\nDoc parsing"),
    ]
    for i, (nid, text) in enumerate(services):
        d.node(nid, text, 130, 190 + i * 120, 340, 76, "service")
    d.node("celery", "celery_worker\ndocument tasks, KG", 735, 230, 250, 86, "process")
    d.node("fbworker", "fb-channel-worker\nMessenger bridge", 735, 440, 250, 86, "process")
    stores = [
        ("db", "db\nPostgreSQL"),
        ("mongo", "mongodb\nchat history"),
        ("redis", "redis\nbroker/cache"),
        ("minio", "minio\nobject storage"),
        ("qdrant", "qdrant\nvector DB"),
    ]
    for i, (nid, text) in enumerate(stores):
        d.node(nid, text, 1190, 160 + i * 105, 280, 70, "storage", "cylinder")
    d.edge("frontend", "gateway", color="blue")
    d.edge("gateway", "backend", color="green")
    d.edge("backend", "opendata", color="blue")
    d.edge("backend", "celery", color="orange", dashed=True)
    d.edge("backend", "fbworker", color="blue")
    for tgt in ("db", "mongo", "redis", "minio", "qdrant"):
        d.edge("backend", tgt, color="gray")
    d.edge("celery", "redis", color="orange")
    d.edge("celery", "qdrant", color="orange")
    d.edge("celery", "minio", color="orange")
    return d


def make_4_1b() -> Diagram:
    d = Diagram("4.1b", "observability_deployment", "Figure 4.1b - Observability Deployment", "Deployable observability components around OmniRAG", "deployment", 1540, 780)
    lane(d, "OmniRAG runtime", 70, 130, 430, 460)
    lane(d, "Telemetry stack", 590, 130, 420, 460)
    lane(d, "Review surface", 1100, 130, 360, 460)
    d.node("gateway", "Gateway", 150, 210, 260, 70, "service")
    d.node("backend", "Backend", 150, 335, 260, 70, "service")
    d.node("workers", "Workers", 150, 460, 260, 70, "process")
    d.node("prom", "Metrics collector", 660, 220, 270, 78, "storage", "cylinder")
    d.node("logs", "Log aggregation", 660, 385, 270, 78, "storage", "cylinder")
    d.node("grafana", "Grafana / dashboard", 1165, 255, 230, 78, "external")
    d.node("alerts", "Alert rules", 1165, 430, 230, 78, "warning")
    for src in ("gateway", "backend", "workers"):
        d.edge(src, "prom", color="gray", dashed=True)
        d.edge(src, "logs", color="gray", dashed=True)
    d.edge("prom", "grafana", color="green")
    d.edge("logs", "grafana", color="green")
    d.edge("prom", "alerts", color="orange")
    return d


def make_4_6() -> Diagram:
    d = Diagram("4.6", "persistent_memory_demo", "Figure 4.6 - Persistent Memory Demo", "Before/after memory-assisted conversation", "comparison", 1580, 760)
    lane(d, "First session - memory capture", 80, 130, 650, 450)
    lane(d, "Later session - memory recall", 850, 130, 650, 450)
    add_flow(d, [
        ("u1", "User says preference\n'I prefer concise answers'", "user"),
        ("a1", "Assistant answers normally", "llm"),
        ("m1", "Mem0 extracts fact", "process"),
        ("s1", "Store memory\nuser_id + bot_id", "storage"),
    ], 125, 255, 135, 86, 25, "orange")
    add_flow(d, [
        ("u2", "User asks new question", "user"),
        ("r2", "Search memory facts", "process"),
        ("p2", "Inject memory into prompt", "accent"),
        ("a2", "Personalized answer\nconcise style", "service"),
    ], 895, 255, 135, 86, 25, "green")
    d.edge("s1", "r2", label="future turn", color="gray", dashed=True, points=((755, 298), (820, 298)))
    d.node("note", "This is drawn as a comparison diagram, not a fabricated product screenshot.", 470, 640, 650, 56, "optional", font_size=10, bold=False)
    return d


def make_4_7() -> Diagram:
    d = Diagram("4.7", "rag_evaluation_dashboard", "Figure 4.7 - RAG Evaluation Dashboard", "Evaluation radar and score summary", "chart", 1640, 820)
    lane(d, "RAGAS metrics", 80, 130, 650, 540)
    lane(d, "Operational interpretation", 830, 130, 620, 540)
    center_x, center_y, radius = 405, 395, 190
    metrics = [
        ("faith", "Faithfulness", 0.88),
        ("rel", "Answer relevance", 0.84),
        ("ctx", "Context precision", 0.79),
        ("recall", "Context recall", 0.73),
        ("ground", "Grounding", 0.86),
    ]
    # Radar as draw.io nodes/edges plus PNG-visible labels.
    prev = ""
    first = ""
    for i, (nid, label, score) in enumerate(metrics):
        angle = -math.pi / 2 + i * 2 * math.pi / len(metrics)
        ax = int(center_x + math.cos(angle) * radius)
        ay = int(center_y + math.sin(angle) * radius)
        px = int(center_x + math.cos(angle) * radius * score)
        py = int(center_y + math.sin(angle) * radius * score)
        d.node(f"axis_{nid}", label, ax - 65, ay - 22, 130, 44, "input", font_size=9, bold=False)
        d.node(f"pt_{nid}", f"{score:.2f}", px - 24, py - 18, 48, 36, "service", font_size=9)
        d.edge(f"axis_{nid}", f"pt_{nid}", color="gray", dashed=True)
        if prev:
            d.edge(prev, f"pt_{nid}", color="green")
        else:
            first = f"pt_{nid}"
        prev = f"pt_{nid}"
    d.edge(prev, first, color="green")
    d.node("overall", "Overall quality\n0.82", center_x - 75, center_y - 38, 150, 76, "accent", font_size=14)
    rows = [
        ["Signal", "Decision"],
        ["Faithfulness high", "keep citation-first prompt"],
        ["Recall lower", "increase retrieval_k for hard domains"],
        ["Precision stable", "reranker threshold is acceptable"],
        ["Regression trigger", "alert if overall < 0.75"],
    ]
    add_table(d, "eval", 895, 220, [250, 430], 78, rows, "service", "input")
    return d


def all_diagrams() -> list[Diagram]:
    builders: list[Callable[[], Diagram]] = [
        make_1_1, make_1_2, make_1_3, make_1_5,
        make_2_1, make_2_2_1, make_2_2_2, make_2_3_1, make_2_3_2, make_2_3_6,
        make_2_3_7, make_2_4, make_2_5, make_2_7_1, make_2_8, make_2_9, make_2_12, make_2_13,
        make_3_1, make_3_1b, build_3_2, make_3_3, make_3_4, build_3_5, make_3_5b, make_3_6,
        make_3_7, make_3_8, make_3_9, make_3_9b, make_4_1, make_4_1b, make_4_6, make_4_7,
    ]
    return [builder() for builder in builders]


SKIPPED_FIGURES = [
    ("3.10", "dashboard_and_bot_wizard", "Figure 3.10 - Dashboard and Bot Wizard", "requires_screenshot"),
    ("3.11", "channel_configuration_ui", "Figure 3.11 - Channel Configuration UI", "requires_screenshot"),
    ("3.11b", "facebook_messenger_configuration_ui", "Figure 3.11b - Facebook Messenger Configuration UI", "requires_screenshot"),
    ("3.12", "knowledge_graph_visualization", "Figure 3.12 - Knowledge Graph Visualization", "requires_screenshot"),
    ("3.13", "chat_ui", "Figure 3.13 - Chat UI", "requires_screenshot"),
    ("4.2", "web_dashboard_demo", "Figure 4.2 - Web Dashboard Demo", "requires_screenshot"),
    ("4.3", "chat_playground_demo", "Figure 4.3 - Chat Playground Demo", "requires_screenshot"),
    ("4.4", "zalo_bot_direct_demo", "Figure 4.4 - Zalo Bot Direct Demo", "requires_screenshot"),
    ("4.5", "knowledge_graph_visualization_demo", "Figure 4.5 - Knowledge Graph Visualization Demo", "requires_screenshot"),
    ("4.6b", "facebook_messenger_bot_demo", "Figure 4.6b - Facebook Messenger Bot Demo", "requires_screenshot"),
]


def validate(diagram: Diagram) -> list[str]:
    errors: list[str] = []
    for n in diagram.nodes:
        if n.x < 0 or n.y < 0 or n.x + n.w > diagram.width or n.y + n.h > diagram.height:
            errors.append(f"{diagram.basename}: node {n.id} outside canvas")
    node_ids = {n.id for n in diagram.nodes}
    for e in diagram.edges:
        if e.source not in node_ids or e.target not in node_ids:
            errors.append(f"{diagram.basename}: edge {e.id} references missing node")
    return errors


def build_manifest(diagrams: list[Diagram], out_dir: Path) -> list[dict[str, object]]:
    entries: list[dict[str, object]] = []
    for d in diagrams:
        entry = {
            "figure_id": d.fig_id,
            "caption": d.title,
            "kind": d.kind,
            "status": "generated",
            "drawio": str((out_dir / f"{d.basename}.drawio").as_posix()),
            "png": str((out_dir / f"{d.basename}.png").as_posix()),
            "source_notes": d.source_notes,
        }
        excalidraw_path = out_dir / f"{d.basename}.excalidraw.json"
        if excalidraw_path.exists():
            entry["excalidraw"] = str(excalidraw_path.as_posix())
        entries.append(entry)
    for fig_id, slug, caption, reason in SKIPPED_FIGURES:
        entries.append(
            {
                "figure_id": fig_id,
                "caption": caption,
                "kind": "screenshot",
                "status": reason,
                "reason": "The DOCX describes this as a real UI/demo screenshot, so the generator does not fabricate it as a Draw.io diagram.",
                "drawio": None,
                "png": None,
                "slug": slug,
            }
        )
    def sort_key(entry: dict[str, object]) -> tuple[int, list[object]]:
        fid = str(entry["figure_id"])
        chapter = int(fid.split(".")[0])
        rest = fid.split(".")[1:]
        parts: list[object] = []
        for part in rest:
            if part.endswith("b"):
                parts.append(int(part[:-1]))
                parts.append(1)
            else:
                parts.append(int(part))
                parts.append(0)
        return chapter, parts
    return sorted(entries, key=sort_key)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="docs/diagrams/word_ready", help="Output directory for .drawio, .png and manifest.json")
    parser.add_argument("--scale", type=int, default=2, help="PNG render scale")
    parser.add_argument("--dry-run", action="store_true", help="Validate specs without writing files")
    parser.add_argument(
        "--only",
        default="",
        help="Comma-separated figure IDs or basenames to render. Manifest is still refreshed from all specs.",
    )
    args = parser.parse_args()

    out_dir = Path(args.out)
    diagrams = all_diagrams()
    selected_keys = {part.strip() for part in args.only.split(",") if part.strip()}
    if selected_keys:
        available = {d.fig_id for d in diagrams} | {d.basename for d in diagrams}
        missing = sorted(selected_keys - available)
        if missing:
            for key in missing:
                print(f"ERROR: unknown figure selector {key}")
            return 1
        render_diagrams = [d for d in diagrams if d.fig_id in selected_keys or d.basename in selected_keys]
    else:
        render_diagrams = diagrams

    errors: list[str] = []
    for diagram in diagrams:
        errors.extend(validate(diagram))
    if errors:
        for err in errors:
            print(f"ERROR: {err}")
        return 1
    if args.dry_run:
        selected = f", {len(render_diagrams)} selected for rendering" if selected_keys else ""
        print(f"OK: {len(diagrams)} drawable figures, {len(SKIPPED_FIGURES)} screenshot-only figures{selected}")
        return 0

    out_dir.mkdir(parents=True, exist_ok=True)
    for diagram in render_diagrams:
        write_drawio(diagram, out_dir / f"{diagram.basename}.drawio")
        render_png(diagram, out_dir / f"{diagram.basename}.png", scale=args.scale)

    manifest = build_manifest(diagrams, out_dir)
    with (out_dir / "manifest.json").open("w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print(f"Generated {len(render_diagrams)} drawable figures in {out_dir}")
    print(f"Manifest entries: {len(manifest)} total, {len(SKIPPED_FIGURES)} require screenshots")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
