export type Point = { x: number; y: number };

export type Stroke = {
  id: string;
  type: "stroke";
  timestamp: number;
  duration: number;
  points: Point[];
  color: string;
  width: number;
};

export type TextNote = {
  id: string;
  type: "text";
  timestamp: number;
  duration: number;
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize?: number;
};

export type Annotation = Stroke | TextNote;

export type ExportPayload = {
  createdAt: string;
  videoUrl: string | null;
  annotations: Annotation[];
};
