// World units. The Game scene's camera shows this 320x180 world at ZOOM on a 1280x720 canvas.
export const WORLD_WIDTH = 320;
export const WORLD_HEIGHT = 180;
export const ZOOM = 4;

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
