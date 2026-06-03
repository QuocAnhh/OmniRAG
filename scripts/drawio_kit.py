"""
drawio_kit.py — Helper library for generating .drawio XML files programmatically.

Style conventions inherited from the 5 existing drawio files in docs/omnirag_drawio_batch_01_FIXED/:
  - Online/query lanes:    fillColor=#fbfdff strokeColor=#6c8ebf  (light blue)
  - Backend/service boxes: fillColor=#d5e8d4 strokeColor=#82b366  (green)
  - Offline/index lanes:   fillColor=#fcfcfc strokeColor=#999999  (gray)
  - DB cylinders:          fillColor=#f5f5f5 strokeColor=#999999  shape=cylinder3d
  - External boxes:        fillColor=#ffffff strokeColor=#6c8ebf
  - Arrows:                strokeWidth=1.5 strokeColor=#333333 endArrow=block
  - Dashed arrows:         dashed=1 dashPattern=6 4
  - Font: Arial 12 (body), Arial 18 bold (titles)
  - Rounded boxes:         rounded=1
  - Dashed containers:     dashed=1 dashPattern=8 4

Usage:
    from drawio_kit import DrawioFile, Box, Arrow, Lane, Cylinder, Title, Note, COLORS

    d = DrawioFile("My Diagram", page_width=1400, page_height=900)
    d.add(Title("My Title", x=40, y=25, w=1320))
    d.add(Lane("Online", x=60, y=90, w=1280, h=110))
    d.add(Box("Query", x=100, y=130, w=170, h=45))
    d.save("output.drawio")
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
import uuid

# ── Colour Palette ──────────────────────────────────────────────────────────────
COLORS = {
    "online_lane_bg":    "#fbfdff",
    "online_lane_fg":    "#6c8ebf",
    "online_box_bg":     "#dae8fc",
    "online_box_fg":     "#6c8ebf",
    "backend_lane_bg":   "#fbfdff",
    "backend_lane_fg":   "#82b366",
    "backend_box_bg":    "#d5e8d4",
    "backend_box_fg":    "#82b366",
    "offline_lane_bg":   "#fcfcfc",
    "offline_lane_fg":   "#999999",
    "offline_box_bg":    "#f5f5f5",
    "offline_box_fg":    "#999999",
    "external_bg":       "#ffffff",
    "external_fg":       "#6c8ebf",
    "warning_bg":        "#fff2cc",
    "warning_fg":        "#d6b656",
    "error_bg":          "#f8cecc",
    "error_fg":          "#b85450",
    "highlight_bg":      "#e1d5e7",
    "highlight_fg":      "#9673a6",
    "arrow":             "#333333",
    "title":             "#222222",
    "note":              "#444444",
}


@dataclass
class Cell:
    """A single mxCell element in the drawio graph."""
    id: str
    parent: str = "1"
    style: str = ""
    value: str = ""
    vertex: bool = True
    geometry: tuple[int, int, int, int] = (0, 0, 0, 0)  # x, y, w, h
    source: Optional[str] = None
    target: Optional[str] = None
    edge: bool = False
    points: Optional[list[tuple[int, int]]] = None

    def to_xml(self) -> str:
        """Serialize this cell to mxCell XML.

        Generates valid XML with all attributes inside the opening <mxCell> tag
        on a single line (matching draw.io's native format), followed by an
        optional <mxGeometry> child element.
        """
        # ── Build the opening tag with ALL attributes on ONE line ──────────
        tag_attrs = [f'id="{self.id}"']

        # value goes first (draw.io convention)
        if self.value:
            tag_attrs.append(f'value="{_escape_xml(self.value)}"')

        # style is the long one — keep it second
        if self.style:
            tag_attrs.append(f'style="{_escape_xml(self.style)}"')

        if self.edge:
            tag_attrs.append('edge="1"')
            if self.source:
                tag_attrs.append(f'source="{self.source}"')
            if self.target:
                tag_attrs.append(f'target="{self.target}"')
        elif self.vertex:
            tag_attrs.append('vertex="1"')

        if self.parent:
            tag_attrs.append(f'parent="{self.parent}"')

        opening = f'<mxCell {" ".join(tag_attrs)}>'

        # ── Build the child geometry element ───────────────────────────────
        geo_xml = ""
        if self.vertex:
            x, y, w, h = self.geometry
            geo_xml = f'\n  <mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/>'
        elif self.edge and self.points:
            pts = "\n    ".join(f'<mxPoint x="{px}" y="{py}"/>' for px, py in self.points)
            geo_xml = (
                f'\n  <mxGeometry relative="1" as="geometry">'
                f'\n    <Array as="points">'
                f'\n    {pts}'
                f'\n    </Array>'
                f'\n  </mxGeometry>'
            )
        elif self.edge and self.source and self.target:
            geo_xml = '\n  <mxGeometry relative="1" as="geometry"/>'

        return f"{opening}{geo_xml}\n</mxCell>"


def _escape_xml(s: str) -> str:
    """Escape special XML characters."""
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;").replace("\n", "&#xa;")


def _uid() -> str:
    """Short unique ID for drawio cells."""
    return "c" + uuid.uuid4().hex[:6]


# ── Pre-built Style Constructors ────────────────────────────────────────────────

def style_title() -> str:
    return "text;html=1;strokeColor=none;fillColor=none;fontSize=18;fontFamily=Arial;align=center;verticalAlign=middle;fontColor=#222222;whiteSpace=wrap;fontStyle=1"


def style_lane(bg: str, fg: str) -> str:
    return f"rounded=1;whiteSpace=wrap;html=1;fillColor={bg};strokeColor={fg};fontSize=12;fontFamily=Arial;align=left;verticalAlign=top;spacing=8;spacingLeft=8;spacingRight=8;fontStyle=1;dashed=1;dashPattern=8 4;verticalAlign=top;spacingTop=8"


def style_box(bg: str, fg: str, align: str = "center") -> str:
    return f"rounded=1;whiteSpace=wrap;html=1;fillColor={bg};strokeColor={fg};fontSize=11;fontFamily=Arial;align={align};verticalAlign=middle;spacing=8;spacingLeft=8;spacingRight=8"


def style_cylinder(bg: str = "#f5f5f5", fg: str = "#999999") -> str:
    return f"shape=cylinder3d;whiteSpace=wrap;boundedLbl=1;backgroundOutline=1;size=15;html=1;fillColor={bg};strokeColor={fg};fontSize=11;fontFamily=Arial;align=center;verticalAlign=middle;spacing=8"


def style_arrow(solid: bool = True) -> str:
    if solid:
        return "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=1.5;strokeColor=#333333;endArrow=block;endFill=1;startArrow=none;startFill=0;fontSize=11;fontFamily=Arial;labelBackgroundColor=#ffffff"
    return "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=1.5;strokeColor=#333333;endArrow=block;endFill=1;startArrow=none;startFill=0;fontSize=11;fontFamily=Arial;labelBackgroundColor=#ffffff;dashed=1;dashPattern=6 4"


def style_note() -> str:
    return "text;html=1;strokeColor=none;fillColor=none;fontSize=11;fontFamily=Arial;align=left;verticalAlign=middle;fontColor=#444444;whiteSpace=wrap"


def style_decision_box() -> str:
    """Diamond/rhombus style for decision nodes."""
    return f"rhombus;whiteSpace=wrap;html=1;fillColor={COLORS['warning_bg']};strokeColor={COLORS['warning_fg']};fontSize=11;fontFamily=Arial;align=center;verticalAlign=middle"


# ── Convenience Builders ────────────────────────────────────────────────────────

def Title(text: str, x: int, y: int, w: int = 1320) -> Cell:
    return Cell(id=_uid(), style=style_title(), value=text, geometry=(x, y, w, 35))


def Lane(label: str, x: int, y: int, w: int, h: int, variant: str = "online") -> Cell:
    if variant == "online" or variant == "query":
        bg, fg = COLORS["online_lane_bg"], COLORS["online_lane_fg"]
    elif variant == "backend" or variant == "service":
        bg, fg = COLORS["backend_lane_bg"], COLORS["backend_lane_fg"]
    else:  # offline / index
        bg, fg = COLORS["offline_lane_bg"], COLORS["offline_lane_fg"]
    return Cell(id=_uid(), style=style_lane(bg, fg), value=label, geometry=(x, y, w, h))


def Box(text: str, x: int, y: int, w: int = 170, h: int = 45, variant: str = "online", multiline: bool = False) -> Cell:
    if variant == "online":
        bg, fg = COLORS["online_box_bg"], COLORS["online_box_fg"]
    elif variant == "backend":
        bg, fg = COLORS["backend_box_bg"], COLORS["backend_box_fg"]
    elif variant == "warning":
        bg, fg = COLORS["warning_bg"], COLORS["warning_fg"]
    elif variant == "error":
        bg, fg = COLORS["error_bg"], COLORS["error_fg"]
    elif variant == "highlight":
        bg, fg = COLORS["highlight_bg"], COLORS["highlight_fg"]
    elif variant == "external":
        bg, fg = COLORS["external_bg"], COLORS["external_fg"]
    else:
        bg, fg = COLORS["offline_box_bg"], COLORS["offline_box_fg"]

    # Auto-compute height from line count (each \n = one new line, ~17px per line + padding)
    line_count = text.count("\n") + 1
    min_h = line_count * 17 + 16  # 17px per text line + 16px total vertical padding
    h = max(h, min_h) if multiline else h

    return Cell(id=_uid(), style=style_box(bg, fg), value=text, geometry=(x, y, w, h))


def Cylinder(text: str, x: int, y: int, w: int = 170, h: int = 75) -> Cell:
    return Cell(id=_uid(), style=style_cylinder(), value=text, geometry=(x, y, w, h))


def Decision(text: str, x: int, y: int, w: int = 140, h: int = 80) -> Cell:
    return Cell(id=_uid(), style=style_decision_box(), value=text, geometry=(x, y, w, h))


def Note(text: str, x: int, y: int, w: int = 500, h: int = 30) -> Cell:
    return Cell(id=_uid(), style=style_note(), value=text, geometry=(x, y, w, h))


def Arrow(src: Cell, tgt: Cell, label: str = "", dashed: bool = False) -> Cell:
    return Cell(
        id=_uid(),
        style=style_arrow(solid=not dashed),
        value=label,
        source=src.id,
        target=tgt.id,
        edge=True,
        vertex=False,
    )


def ArrowWithPoints(src: Cell, tgt: Cell, points: list[tuple[int, int]], label: str = "", dashed: bool = False) -> Cell:
    """Arrow that routes through specific waypoints."""
    return Cell(
        id=_uid(),
        style=style_arrow(solid=not dashed),
        value=label,
        source=src.id,
        target=tgt.id,
        edge=True,
        vertex=False,
        points=points,
    )


# ── File Builder ────────────────────────────────────────────────────────────────

class DrawioFile:
    """Builds a complete .drawio file from Cell objects."""

    def __init__(self, diagram_name: str, page_width: int = 1400, page_height: int = 900):
        self.name = diagram_name
        self.page_width = page_width
        self.page_height = page_height
        self.cells: list[Cell] = []

    def add(self, cell: Cell) -> Cell:
        self.cells.append(cell)
        return cell

    def save(self, filepath: str):
        cells_xml = []
        for c in self.cells:
            cells_xml.append(c.to_xml())

        xml = f"""<mxfile host="app.diagrams.net" modified="2026-05-31T00:00:00.000Z" agent="OmniRAG/drawio_kit" version="24.7.17" type="device">
  <diagram name="{self.name}" id="diag-{_uid()}">
    <mxGraphModel dx="1422" dy="794" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="{self.page_width}" pageHeight="{self.page_height}" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        {''.join(cells_xml)}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>"""

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(xml)
        print(f"  ✅ {filepath}")


# ── Layout Helpers ──────────────────────────────────────────────────────────────

def h_flow(x_start: int, y: int, w: int, gap: int, count: int) -> list[tuple[int, int]]:
    """Returns (x, y) positions for `count` boxes in a horizontal flow."""
    return [(x_start + i * (w + gap), y) for i in range(count)]


def h_center(child_w: int, parent_w: int, parent_x: int) -> int:
    """Center a child in a parent container."""
    return parent_x + (parent_w - child_w) // 2
