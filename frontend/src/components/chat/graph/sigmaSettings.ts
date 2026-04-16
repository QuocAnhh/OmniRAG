import { NodeBorderProgram } from '@sigma/node-border';
import { createEdgeCurveProgram } from '@sigma/edge-curve';

export const SIGMA_SETTINGS = {
  allowInvalidContainer: true,
  defaultNodeType: 'border',
  defaultEdgeType: 'curvedNoArrow',
  renderEdgeLabels: false,
  enableEdgeEvents: true,
  edgeProgramClasses: {
    curvedNoArrow: createEdgeCurveProgram(),
  },
  nodeProgramClasses: {
    border: NodeBorderProgram,
  },
  labelRenderedSizeThreshold: 8,
  labelGridCellSize: 60,
  labelSize: 12,
  labelColor: { color: '#141413' },
  edgeLabelSize: 8,
  defaultDrawNodeHover: (
    ctx: CanvasRenderingContext2D,
    data: Record<string, any>,
    settings: Record<string, any>,
  ) => {
    const x = data.x as number;
    const y = data.y as number;
    const size = (data.size as number) || 6;
    const label = data.label as string | undefined;
    const color = (data.color as string) || '#6366f1';
    const fs = (settings.labelSize as number) || 12;

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, size + 5, 0, Math.PI * 2);
    ctx.fillStyle = color + '33';
    ctx.fill();
    ctx.restore();

    if (label) {
      ctx.save();
      ctx.font = `600 ${fs}px sans-serif`;
      const tw = ctx.measureText(label).width;
      const pad = 6;
      const px = x + size + 8;
      const py = y + fs * 0.35;
      const rx = px - pad;
      const ry = py - fs;
      const rw = tw + pad * 2;
      const rh = fs + pad;
      const r = 4;
      ctx.fillStyle = 'rgba(20,20,19,0.90)';
      ctx.beginPath();
      ctx.moveTo(rx + r, ry);
      ctx.lineTo(rx + rw - r, ry);
      ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + r);
      ctx.lineTo(rx + rw, ry + rh - r);
      ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - r, ry + rh);
      ctx.lineTo(rx + r, ry + rh);
      ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - r);
      ctx.lineTo(rx, ry + r);
      ctx.quadraticCurveTo(rx, ry, rx + r, ry);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f1f5f9';
      ctx.fillText(label, px, py);
      ctx.restore();
    }
  },
};
