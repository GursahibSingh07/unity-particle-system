import Phaser from 'phaser';

const PLAYER_RADIUS = 20;
const PLAYER_SPEED = 260;

type MoveKeys = Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;

export class Game extends Phaser.Scene {
    private player!: Phaser.GameObjects.Container;
    private machine!: Phaser.GameObjects.Rectangle;
    private keys!: MoveKeys;

    constructor() {
        super('Game');
    }

    create() {
        const { width, height } = this.scale;

        // Placeholder art: a circle for the player and a bar for the EMW Machine
        this.machine = this.add.rectangle(0, 0, 38, 8, 0xffffff).setOrigin(0, 0.5);
        const body = this.add.circle(0, 0, PLAYER_RADIUS, 0xffd23f);

        this.player = this.add.container(width / 2, height / 2, [this.machine, body]);
        this.player.setSize(PLAYER_RADIUS * 2, PLAYER_RADIUS * 2);

        this.physics.add.existing(this.player);
        this.playerBody.setCircle(PLAYER_RADIUS);
        this.playerBody.setCollideWorldBounds(true);

        this.keys = this.input.keyboard!.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D,
        }) as MoveKeys;

        this.add.text(16, 16, 'WASD to move  |  Mouse to aim', {
            fontFamily: 'monospace',
            fontSize: '18px',
            color: '#ffffff',
        });
    }

    update() {
        const { up, down, left, right } = this.keys;

        const direction = new Phaser.Math.Vector2(
            Number(right.isDown) - Number(left.isDown),
            Number(down.isDown) - Number(up.isDown),
        );
        direction.normalize().scale(PLAYER_SPEED);
        this.playerBody.setVelocity(direction.x, direction.y);

        const pointer = this.input.activePointer;
        this.machine.rotation = Phaser.Math.Angle.Between(
            this.player.x,
            this.player.y,
            pointer.worldX,
            pointer.worldY,
        );
    }

    private get playerBody() {
        return this.player.body as Phaser.Physics.Arcade.Body;
    }
}
