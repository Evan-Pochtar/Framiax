export type Point = { x: number; y: number };
export type Stroke = {
  id: string;
  type: 'stroke';
  timestamp: number;
  points: Point[]; // normalized 0..1
  color: string;
  width: number;
  author?: string;
};
export type TextNote = {
  id: string;
  type: 'text';
  timestamp: number;
  x: number; // normalized
  y: number; // normalized
  text: string;
  color: string;
  author?: string;
};
export type Annotation = Stroke | TextNote;
