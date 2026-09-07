/**
 * System prompts, kept out of the logic that uses them so they can be read,
 * diffed, and argued about on their own.
 *
 * STRUCTURE ONLY — the strings are outlines of what each prompt must establish.
 */

export const MOMENTUM_NARRATOR = `
TODO. Must establish:
  - The ranking is already decided; the model explains it, it does not reorder it.
  - Cite the factors it was given. No claims about news or fundamentals it wasn't handed.
  - Say plainly when a name's momentum is thin or driven by a single session.
  - Two or three sentences per name. This is read in a list.
`;

export const PORTFOLIO_REVIEWER = `
TODO. Must establish:
  - It is looking at one user's real positions, with cost basis.
  - Describe what changed and why it matters; do not tell the user to buy or sell.
  - Flag concentration and correlation the user may not have noticed.
  - No performance projections.
`;
