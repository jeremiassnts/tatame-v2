export type Belt =
  | "white"
  | "blue"
  | "purple"
  | "brown"
  | "black"
  | "grey_white"
  | "grey"
  | "grey_black"
  | "yellow_white"
  | "yellow"
  | "yellow_black"
  | "orange_white"
  | "orange"
  | "orange_black"
  | "green_white"
  | "green"
  | "green_black";

export const BELT_LABELS_SHORT: Record<Belt, string> = {
  white: "Branca",
  blue: "Azul",
  purple: "Roxa",
  brown: "Marrom",
  black: "Preta",
  grey_white: "Cinza c/ Branca",
  grey: "Cinza",
  grey_black: "Cinza c/ Preta",
  yellow_white: "Amarela c/ Branca",
  yellow: "Amarela",
  yellow_black: "Amarela c/ Preta",
  orange_white: "Laranja c/ Branca",
  orange: "Laranja",
  orange_black: "Laranja c/ Preta",
  green_white: "Verde c/ Branca",
  green: "Verde",
  green_black: "Verde c/ Preta",
};

export const BELT_COLORS: Record<Belt, string> = {
  white: "#E5E7EB",
  blue: "#3B82F6",
  purple: "#8B5CF6",
  brown: "#92400E",
  black: "#111827",
  grey_white: "#9CA3AF",
  grey: "#6B7280",
  grey_black: "#4B5563",
  yellow_white: "#FDE047",
  yellow: "#EAB308",
  yellow_black: "#CA8A04",
  orange_white: "#FDBA74",
  orange: "#F97316",
  orange_black: "#EA580C",
  green_white: "#86EFAC",
  green: "#22C55E",
  green_black: "#16A34A",
};

/** Adult belts only */
export const ADULT_BELTS: Belt[] = ["white", "blue", "purple", "brown", "black"];

/** Kids belts only */
export const KIDS_BELTS: Belt[] = [
  "white",
  "grey_white",
  "grey",
  "grey_black",
  "yellow_white",
  "yellow",
  "yellow_black",
  "orange_white",
  "orange",
  "orange_black",
  "green_white",
  "green",
  "green_black",
];

export function getBeltColor(belt: Belt | null | undefined): string {
  if (!belt) return "#525252";
  return BELT_COLORS[belt] ?? "#525252";
}

