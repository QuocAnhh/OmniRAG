from __future__ import annotations

import html
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree as ET

from PIL import Image, ImageDraw, ImageFont


OUT_DIR = Path(__file__).resolve().parent

FONT_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

INK = "#222222"
EDGE = "#333333"
MUTED = "#666666"

GREY_FILL = "#f5f5f5"
GREY_STROKE = "#999999"
BLUE_FILL = "#dae8fc"
BLUE_STROKE = "#6c8ebf"
GREEN_FILL = "#d5e8d4"
GREEN_STROKE = "#82b366"
ORANGE_FILL = "#ffe6cc"
ORANGE_STROKE = "#d79b00"
YELLOW_FILL = "#fff2cc"
YELLOW_STROKE = "#d6b656"
RED_FILL = "#f8cecc"
RED_STROKE = "#b85450"
PURPLE_FILL = "#e1d5e7"
PURPLE_STROKE = "#9673a6"


@dataclass(frozen=True)
class Box:
    id: str
    text: str
    x: int
    y: int
    w: int
    h: int
    fill: str
    stroke: str
    font_color: str = INK
    font_size: int = 12
    bold: bool = False
    dashed: bool = False


@dataclass(frozen=True)
class EdgeSpec:
    id: str
    source: str
    target: str
    color: str = EDGE
    label: str = ""
    points: tuple[tuple[int, int], ...] = ()


@dataclass(frozen=True)
class Diagram:
    name: str
    title: str
    width: int
    height: int
    boxes: tuple[Box, ...]
    edges: tuple[EdgeSpec, ...]


def font(size: int, bold: bool = False, scale: int = 1) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size * scale)


def split_lines(text: str) -> list[str]:
    return text.split("\n")


def text_bbox(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=fnt)
    return box[2] - box[0], box[3] - box[1]


def draw_centered_text(
    draw: ImageDraw.ImageDraw,
    rect: tuple[int, int, int, int],
    text: str,
    color: str,
    size: int,
    bold: bool,
    scale: int,
) -> None:
    x, y, w, h = rect
    lines = split_lines(text)
    fnt = font(size, bold, scale)
    gap = 4 * scale
    heights = [text_bbox(draw, line, fnt)[1] for line in lines]
    total_h = sum(heights) + gap * (len(lines) - 1)
    cy = y + (h - total_h) / 2
    for line, lh in zip(lines, heights):
        lw, _ = text_bbox(draw, line, fnt)
        draw.text((x + (w - lw) / 2, cy), line, font=fnt, fill=color)
        cy += lh + gap


def rect_points(box: Box, side: str) -> tuple[int, int]:
    if side == "left":
        return box.x, box.y + box.h // 2
    if side == "right":
        return box.x + box.w, box.y + box.h // 2
    if side == "top":
        return box.x + box.w // 2, box.y
    if side == "bottom":
        return box.x + box.w // 2, box.y + box.h
    raise ValueError(side)


def route_between(source: Box, target: Box, points: tuple[tuple[int, int], ...]) -> list[tuple[int, int]]:
    if points:
        return [rect_points(source, "right"), *points, rect_points(target, "left")]
    if target.x >= source.x + source.w:
        return [rect_points(source, "right"), rect_points(target, "left")]
    if target.y >= source.y + source.h:
        return [rect_points(source, "bottom"), rect_points(target, "top")]
    return [rect_points(source, "top"), rect_points(target, "bottom")]


def arrow_head(draw: ImageDraw.ImageDraw, a: tuple[int, int], b: tuple[int, int], color: str, width: int) -> None:
    ax, ay = a
    bx, by = b
    angle = math.atan2(by - ay, bx - ax)
    length = 9 * width / 2
    spread = 0.55
    p1 = (bx - length * math.cos(angle - spread), by - length * math.sin(angle - spread))
    p2 = (bx - length * math.cos(angle + spread), by - length * math.sin(angle + spread))
    draw.polygon((b, p1, p2), fill=color)


def render_png(diagram: Diagram, filename: str, scale: int = 2) -> None:
    img = Image.new("RGBA", (diagram.width * scale, diagram.height * scale), "#ffffff")
    draw = ImageDraw.Draw(img)

    title_font = font(18, True, scale)
    title_w, title_h = text_bbox(draw, diagram.title, title_font)
    draw.text(((diagram.width * scale - title_w) / 2, 24 * scale), diagram.title, font=title_font, fill=INK)

    boxes = {b.id: b for b in diagram.boxes}

    for edge in diagram.edges:
        src = boxes[edge.source]
        dst = boxes[edge.target]
        pts = route_between(src, dst, edge.points)
        pts_s = [(x * scale, y * scale) for x, y in pts]
        draw.line(pts_s, fill=edge.color, width=2 * scale, joint="curve")
        arrow_head(draw, pts_s[-2], pts_s[-1], edge.color, 2 * scale)
        if edge.label:
            lx = sum(p[0] for p in pts_s) / len(pts_s)
            ly = sum(p[1] for p in pts_s) / len(pts_s) - 15 * scale
            label_font = font(10, False, scale)
            lw, lh = text_bbox(draw, edge.label, label_font)
            pad = 4 * scale
            draw.rounded_rectangle(
                (lx - lw / 2 - pad, ly - lh / 2 - pad, lx + lw / 2 + pad, ly + lh / 2 + pad),
                radius=3 * scale,
                fill="#ffffff",
            )
            draw.text((lx - lw / 2, ly - lh / 2), edge.label, font=label_font, fill=edge.color)

    for box in diagram.boxes:
        xy = (box.x * scale, box.y * scale, (box.x + box.w) * scale, (box.y + box.h) * scale)
        dash = (8 * scale, 5 * scale) if box.dashed else None
        draw.rounded_rectangle(xy, radius=10 * scale, fill=box.fill, outline=box.stroke, width=2 * scale)
        if box.dashed:
            # PIL has no rounded dashed outline; draw a light dashed straight border inside.
            x1, y1, x2, y2 = xy
            dash_len, gap = dash
            for x in range(x1, x2, dash_len + gap):
                draw.line((x, y1, min(x + dash_len, x2), y1), fill=box.stroke, width=scale)
                draw.line((x, y2, min(x + dash_len, x2), y2), fill=box.stroke, width=scale)
            for y in range(y1, y2, dash_len + gap):
                draw.line((x1, y, x1, min(y + dash_len, y2)), fill=box.stroke, width=scale)
                draw.line((x2, y, x2, min(y + dash_len, y2)), fill=box.stroke, width=scale)
        draw_centered_text(
            draw,
            (box.x * scale, box.y * scale, box.w * scale, box.h * scale),
            box.text,
            box.font_color,
            box.font_size,
            box.bold,
            scale,
        )

    img.save(OUT_DIR / filename, optimize=True)


def drawio_style(box: Box) -> str:
    style = (
        "rounded=1;whiteSpace=wrap;html=1;"
        f"fillColor={box.fill};strokeColor={box.stroke};"
        f"fontSize={box.font_size};fontFamily=Arial;"
        "align=center;verticalAlign=middle;"
        "spacing=8;spacingLeft=8;spacingRight=8;"
        f"fontColor={box.font_color};"
    )
    if box.bold:
        style += "fontStyle=1;"
    if box.dashed:
        style += "dashed=1;dashPattern=8 4;"
    return style


def edge_style(edge: EdgeSpec) -> str:
    return (
        "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;"
        "html=1;strokeWidth=1.5;endArrow=block;endFill=1;startArrow=none;startFill=0;"
        f"strokeColor={edge.color};fontSize=10;fontFamily=Arial;"
        "labelBackgroundColor=#ffffff;"
    )


def add_geometry(parent: ET.Element, **attrs: object) -> ET.Element:
    attrs = {k: str(v) for k, v in attrs.items()}
    attrs["as"] = "geometry"
    return ET.SubElement(parent, "mxGeometry", attrs)


def write_drawio(diagram: Diagram, filename: str) -> None:
    mxfile = ET.Element("mxfile", {"host": "app.diagrams.net", "agent": "OmniRAG/clean_diagram_generator"})
    diag = ET.SubElement(mxfile, "diagram", {"name": diagram.name, "id": f"diag-{diagram.name}"})
    model = ET.SubElement(
        diag,
        "mxGraphModel",
        {
            "dx": "1200",
            "dy": "800",
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

    title_cell = ET.SubElement(
        root,
        "mxCell",
        {
            "id": "title",
            "value": diagram.title,
            "style": (
                "text;html=1;strokeColor=none;fillColor=none;fontSize=18;"
                "fontFamily=Arial;align=center;verticalAlign=middle;"
                "fontColor=#222222;whiteSpace=wrap;fontStyle=1"
            ),
            "vertex": "1",
            "parent": "1",
        },
    )
    add_geometry(title_cell, x=40, y=20, width=diagram.width - 80, height=35)

    for edge in diagram.edges:
        cell = ET.SubElement(
            root,
            "mxCell",
            {
                "id": edge.id,
                "value": edge.label,
                "style": edge_style(edge),
                "edge": "1",
                "parent": "1",
                "source": edge.source,
                "target": edge.target,
            },
        )
        geom = add_geometry(cell, relative=1)
        if edge.points:
            arr = ET.SubElement(geom, "Array", {"as": "points"})
            for x, y in edge.points:
                ET.SubElement(arr, "mxPoint", {"x": str(x), "y": str(y)})

    for box in diagram.boxes:
        cell = ET.SubElement(
            root,
            "mxCell",
            {
                "id": box.id,
                "value": box.text,
                "style": drawio_style(box),
                "vertex": "1",
                "parent": "1",
            },
        )
        add_geometry(cell, x=box.x, y=box.y, width=box.w, height=box.h)

    ET.indent(mxfile, space="  ")
    tree = ET.ElementTree(mxfile)
    tree.write(OUT_DIR / filename, encoding="utf-8", xml_declaration=False)


def hybrid_search_diagram() -> Diagram:
    boxes = (
        Box("query", "Original\nQuery", 60, 250, 170, 70, GREY_FILL, GREY_STROKE, MUTED, 12, True),
        Box("embed", "Embed Query\ntext-embedding-3-small\n1536-dim vector", 300, 140, 230, 78, BLUE_FILL, BLUE_STROKE, "#336699", 11, True),
        Box("vector", "Vector Search\nQdrant HNSW cosine\ntop_k * 2 candidates", 590, 140, 240, 78, BLUE_FILL, BLUE_STROKE, "#336699", 11, True),
        Box("bm25", "Sparse BM25 Vector\nFastEmbed + IDF\nQdrant named vector", 300, 350, 230, 78, ORANGE_FILL, ORANGE_STROKE, "#b36b00", 11, True),
        Box("fts", "Full-Text Results\nkeyword matches\ntop_k * 2 candidates", 590, 350, 240, 78, ORANGE_FILL, ORANGE_STROKE, "#b36b00", 11, True),
        Box("rrf", "RRF Merge\nk = 60\nscore = sum 1/(k+rank)", 900, 240, 230, 96, YELLOW_FILL, ORANGE_STROKE, "#b36b00", 11, True),
        Box("rerank", "Cross-Encoder Rerank\nms-marco / bge-reranker\nsigmoid normalize", 1190, 240, 260, 96, PURPLE_FILL, PURPLE_STROKE, "#674ea7", 11, True),
        Box("final", "Final Top-K\nhybrid_score >= 0.15\nContext Assembly", 1520, 240, 210, 96, GREEN_FILL, GREEN_STROKE, "#38761d", 11, True),
        Box("filter", "Tenant filter\nFieldCondition(bot_id)\napplied to both search paths", 300, 470, 530, 65, GREY_FILL, GREY_STROKE, MUTED, 10, False, True),
        Box("formula", "Score rule\nhybrid_score = sigmoid(cross_encoder)\nfallback = RRF score if reranker unavailable", 900, 450, 550, 85, YELLOW_FILL, YELLOW_STROKE, "#7f6000", 10, False),
    )
    edges = (
        EdgeSpec("e_query_embed", "query", "embed", ORANGE_STROKE, "embed", ((260, 185),)),
        EdgeSpec("e_query_bm25", "query", "bm25", ORANGE_STROKE, "query text", ((260, 390),)),
        EdgeSpec("e_embed_vector", "embed", "vector", BLUE_STROKE),
        EdgeSpec("e_bm25_fts", "bm25", "fts", ORANGE_STROKE),
        EdgeSpec("e_vector_rrf", "vector", "rrf", EDGE, "ranked list", ((870, 179), (870, 288))),
        EdgeSpec("e_fts_rrf", "fts", "rrf", EDGE, "ranked list", ((870, 389), (870, 288))),
        EdgeSpec("e_rrf_rerank", "rrf", "rerank", PURPLE_STROKE, "candidates"),
        EdgeSpec("e_rerank_final", "rerank", "final", GREEN_STROKE, "top_k"),
    )
    return Diagram(
        name="fig_2_3_1_hybrid_search_clean",
        title="Figure 2.3.1 - Hybrid Search + Cross-Encoder Reranking",
        width=1780,
        height=590,
        boxes=boxes,
        edges=edges,
    )


def crag_diagram() -> Diagram:
    boxes = (
        Box("chunks", "Retrieved\nTop-3 Chunks", 60, 150, 210, 70, BLUE_FILL, BLUE_STROKE, "#336699", 12, True),
        Box("query", "Rewritten\nSearch Query", 60, 280, 210, 70, GREY_FILL, GREY_STROKE, MUTED, 12, True),
        Box("classifier", "CRAG Classifier\nINTERNAL_LLM_MODEL\ntemp=0, max_tokens=16", 360, 205, 260, 100, ORANGE_FILL, ORANGE_STROKE, "#b36b00", 11, True),
        Box("fallback", "Fallback\nreturn 'relevant' if classifier fails", 360, 395, 260, 58, YELLOW_FILL, ORANGE_STROKE, "#7f6000", 10),
        Box("relevant", "relevant\nchunks answer directly", 760, 105, 260, 70, GREEN_FILL, GREEN_STROKE, "#38761d", 12, True),
        Box("ambiguous", "ambiguous\npartial match only", 760, 245, 260, 70, YELLOW_FILL, YELLOW_STROKE, "#7f6000", 12, True),
        Box("no_context", "no_context\nKB lacks information", 760, 385, 260, 70, RED_FILL, RED_STROKE, "#a61c1c", 12, True),
        Box("normal", "Normal Pipeline\nanswer from context", 1130, 105, 270, 70, GREEN_FILL, GREEN_STROKE, "#38761d", 12, True),
        Box("caution", "Flag Uncertainty\nanswer with caution", 1130, 245, 270, 70, YELLOW_FILL, YELLOW_STROKE, "#7f6000", 12, True),
        Box("refuse", "Refuse to Fabricate\nstate KB has no info", 1130, 385, 270, 70, RED_FILL, RED_STROKE, "#a61c1c", 12, True),
        Box("llm", "LLM Generation\nOpenRouter\nfinal response", 1510, 225, 210, 110, PURPLE_FILL, PURPLE_STROKE, "#674ea7", 12, True),
    )
    edges = (
        EdgeSpec("e_chunks_classifier", "chunks", "classifier", BLUE_STROKE),
        EdgeSpec("e_query_classifier", "query", "classifier", EDGE),
        EdgeSpec("e_classifier_relevant", "classifier", "relevant", GREEN_STROKE, "", ((690, 255), (690, 140))),
        EdgeSpec("e_classifier_ambiguous", "classifier", "ambiguous", ORANGE_STROKE),
        EdgeSpec("e_classifier_no_context", "classifier", "no_context", RED_STROKE, "", ((690, 255), (690, 420))),
        EdgeSpec("e_relevant_normal", "relevant", "normal", GREEN_STROKE),
        EdgeSpec("e_ambiguous_caution", "ambiguous", "caution", ORANGE_STROKE),
        EdgeSpec("e_no_context_refuse", "no_context", "refuse", RED_STROKE),
        EdgeSpec("e_normal_llm", "normal", "llm", GREEN_STROKE),
        EdgeSpec("e_caution_llm", "caution", "llm", ORANGE_STROKE),
        EdgeSpec("e_refuse_llm", "refuse", "llm", RED_STROKE),
    )
    return Diagram(
        name="fig_2_3_6_crag_decision_clean",
        title="Figure 2.3.6 - CRAG (Corrective RAG) Decision Flow",
        width=1780,
        height=545,
        boxes=boxes,
        edges=edges,
    )


def main() -> None:
    for diagram in (hybrid_search_diagram(), crag_diagram()):
        write_drawio(diagram, f"{diagram.name}.drawio")
        render_png(diagram, f"{diagram.name}.png")


if __name__ == "__main__":
    main()
