/** `noir` is the old name of `retro` and plays the same track */
export type MusicId = 'title' | 'goldenAge' | 'cyberpunk' | 'retro' | 'noir' | 'manga' | 'boss' | 'ending';

export type SfxId =
    // v1 ray sounds, kept so old callers still make a noise
    | 'radio'
    | 'ultraviolet'
    | 'gamma'
    | 'blue'
    | 'greenRelease'
    | 'white'
    | 'uv'
    | 'dash'
    | 'dashReady'
    | 'wheel'
    | 'wheelLocked'
    | 'mode'
    | 'hitWeak'
    | 'hitNormal'
    | 'hitResist'
    | 'monsterDie'
    | 'playerHurt'
    | 'playerDie'
    | 'roomClear'
    | 'itemGet'
    | 'upgrade'
    | 'chestOpen'
    | 'secret'
    | 'switch'
    | 'denied'
    | 'heart'
    | 'checkpoint'
    | 'surge'
    | 'ice'
    | 'acid'
    | 'bossPhase'
    | 'bossTelegraph'
    | 'eraSwap'
    | 'uiSelect';

export type LoopId = 'infrared' | 'gammaCharge' | 'red' | 'greenCharge';
