import type { LevelDef } from '../../types';

// The boss, "The Final Page". One room, one wave: The Prism.
// The Prism is 32x32 and cannot use tiles next to a solid, so the floor is kept open:
// four crates near the corners give cover from its volleys without boxing it in.
export const boss: LevelDef = {
    name: 'The Final Page',
    style: 'finalPage',
    radiations: ['radio', 'infrared', 'ultraviolet', 'gamma'],
    introText: [
        'It arrives howling. It flashes red, then blue.',
        'Every colour at once. Every monster in one.',
        'This is the last page, Light Handler. Turn it.',
    ],
    rooms: [
        {
            layout: [
                '####################',
                '#..................#',
                '#...o..........o...#',
                '#..................#',
                '#........,,........#',
                '#........,,........#',
                '#..................#',
                '#...o.....P....o...#',
                '#..................#',
                '####################',
            ],
            waves: [{ spawns: [{ monster: 'prism', count: 1 }] }],
        },
    ],
};
