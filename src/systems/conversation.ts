import Phaser from 'phaser';
import { Events } from '../events';

// The Game and Ending scenes never draw text: they ask the UI scene to show something and
// wait for its answer. Every wait has a timeout, so a missing answer can never lock the game.

/**
 * Calls `done` once, when `event` next arrives on the global bus (and `accept` agrees with
 * its arguments) or after `timeout` milliseconds of this scene's own clock, whichever is
 * first. The scene's clock stops while the scene is paused, so a pause never eats the wait.
 * Returns a function that cancels the wait.
 */
export function awaitAnswer(
    scene: Phaser.Scene,
    event: string,
    timeout: number,
    done: () => void,
    accept: (...args: unknown[]) => boolean = () => true,
) {
    const bus = scene.game.events;
    let finished = false;

    const cancel = () => {
        if (finished) {
            return;
        }
        finished = true;
        bus.off(event, onEvent);
        timer.remove();
        scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cancel);
    };
    const finish = () => {
        if (!finished) {
            cancel();
            done();
        }
    };
    const onEvent = (...args: unknown[]) => {
        if (accept(...args)) {
            finish();
        }
    };

    const timer = scene.time.delayedCall(timeout, finish);
    bus.on(event, onEvent);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cancel);
    return cancel;
}

/** Show caption lines and wait for the UI to say they have all been read */
export function showDialog(scene: Phaser.Scene, lines: string[], timeout: number, done: () => void) {
    const cancel = awaitAnswer(scene, Events.DIALOG_DONE, timeout, done);
    scene.game.events.emit(Events.DIALOG, lines);
    return cancel;
}

/** Show a full-screen card and wait for the UI to say it was dismissed */
export function showScreen(scene: Phaser.Scene, name: string, timeout: number, done: () => void) {
    const cancel = awaitAnswer(scene, Events.SCREEN_DONE, timeout, done, (answered) => answered === name);
    scene.game.events.emit(Events.SHOW_SCREEN, name);
    return cancel;
}
