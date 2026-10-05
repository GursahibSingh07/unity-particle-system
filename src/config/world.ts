// World units. The Game scene's camera shows this 320x180 world at ZOOM on a 1280x720 canvas.
export const WORLD_WIDTH = 320;
export const WORLD_HEIGHT = 180;
export const ZOOM = 4;

/**
 * v2 art is drawn at twice the detail: 2 texture pixels per world unit (a tile is 32x32 pixels,
 * a character 32x48), so the screen shows a 640x360 picture while every distance and speed in
 * the game stays in the same 320x180 world units. Sprites are shown at ART_SCALE to fit.
 * (It was 1 while the old 16px art was in use.)
 */
export const ART_SCALE = 0.5;
/** Texture pixels per world unit */
export const TEXELS = 1 / ART_SCALE;

export const TILE = 16;
export const ROOM_COLS = 20;
export const ROOM_ROWS = 10;

/** Height of the strip above the room that the HUD is drawn over */
export const HUD_HEIGHT = WORLD_HEIGHT - ROOM_ROWS * TILE;

/** Where the room sits in the world */
export const ROOM = {
    x: 0,
    y: HUD_HEIGHT,
    width: ROOM_COLS * TILE,
    height: ROOM_ROWS * TILE,
};
