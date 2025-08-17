export const uid = (p = '') => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}${p}`;

export function clamp(v: number, a = 0, b = 1) {
  return Math.min(b, Math.max(a, v));
}

// simple polyline simplification (Ramer–Douglas–Peucker)
export function simplify(points: {x:number;y:number}[], epsilon = 0.002) {
  if (points.length < 3) return points;
  const dmaxIndex = (pts: any[])=>{
    let dmax = 0, idx = 0;
    const a = pts[0], b = pts[pts.length-1];
    for (let i = 1; i < pts.length-1; i++){
      const p = pts[i];
      const num = Math.abs((b.y-a.y)*p.x - (b.x-a.x)*p.y + b.x*a.y - b.y*a.x);
      const den = Math.hypot(b.y-a.y, b.x-a.x) || 1;
      const d = num / den;
      if (d > dmax) { dmax = d; idx = i; }
    }
    return {dmax, idx};
  };
  function rec(pts: any[]): any[] {
    if (pts.length < 3) return pts;
    const {dmax, idx} = dmaxIndex(pts);
    if (dmax > epsilon) {
      const left = rec(pts.slice(0, idx+1));
      const right = rec(pts.slice(idx));
      return left.slice(0, -1).concat(right);
    } else return [pts[0], pts[pts.length-1]];
  }
  return rec(points);
}
