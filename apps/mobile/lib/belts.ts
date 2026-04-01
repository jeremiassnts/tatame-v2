export type Belt = "white" | "blue" | "purple" | "brown" | "black";

export const BELT_LABELS_SHORT: Record<Belt, string> = {
  white: "Branca",
  blue: "Azul",
  purple: "Roxa",
  brown: "Marrom",
  black: "Preta",
};

export const BELT_COLORS: Record<Belt, string> = {
  white: "#E5E7EB",
  blue: "#3B82F6",
  purple: "#8B5CF6",
  brown: "#92400E",
  black: "#111827",
};

export function getBeltColor(belt: Belt | null | undefined): string {
  if (!belt) return "#525252";
  return BELT_COLORS[belt] ?? "#525252";
}

