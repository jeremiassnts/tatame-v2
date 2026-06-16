export const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0 },
} as const;

export const fadeDown = {
  hidden: { opacity: 0, y: -32 },
  visible: { opacity: 1, y: 0 },
} as const;

export const fadeLeft = {
  hidden: { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0 },
} as const;

export const fadeRight = {
  hidden: { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0 },
} as const;

export const transition = { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] } as const;
