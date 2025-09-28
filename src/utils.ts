export const uid = (p = "") =>
  `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function clamp(v: number, a = 0, b = 1) {
  return Math.min(b, Math.max(a, v));
}

export function simplify(points: { x: number; y: number }[], epsilon = 0.002) {
  if (points.length < 3) return points;
  const lineDist = (p: any, a: any, b: any) => {
    const num = Math.abs(
      (b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x,
    );
    const den = Math.hypot(b.y - a.y, b.x - a.x);
    return den ? num / den : 0;
  };
  const rdp = (pts: any[]): any[] => {
    let dmax = 0,
      idx = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = lineDist(pts[i], pts[0], pts[pts.length - 1]);
      if (d > dmax) {
        dmax = d;
        idx = i;
      }
    }
    if (dmax > epsilon) {
      const left = rdp(pts.slice(0, idx + 1));
      const right = rdp(pts.slice(idx));
      return left.slice(0, -1).concat(right);
    }
    return [pts[0], pts[pts.length - 1]];
  };
  return rdp(points);
}
