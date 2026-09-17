/* Content pools for Sort It! (see SortItScene.js for the round logic).
 * Kept separate because these are just data - emoji glyphs and a colour
 * list - not behaviour, mirroring puzzles.js / memoryThemes.js. */

/* Wordless category exemplars for the "sort by kind" round: emoji glyphs,
 * not image files - the same technique FeedMonsterScene's fruit tray and the
 * hub's own icons already use, so no new asset pipeline is needed. */
export const FRUITS = ['🍎', '🍌', '🍇', '🍓', '🍊', '🍉'];
export const ANIMALS = ['🐶', '🐱', '🐰', '🐵', '🐸', '🦁'];

/* Cosmetic hues for the size-sorting balls - the sorting rule is the ball's
 * physical size, not its colour, so any palette works here without risking
 * a colour shortcut. */
export const BALL_COLORS = ['#38bdf8', '#f97316', '#a855f7', '#22c55e', '#f43f5e', '#eab308'];
