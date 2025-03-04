// Mock the canvas and context
const mockCtx = {
    beginPath: jest.fn(),
    arc: jest.fn(),
    fillStyle: '',
    fill: jest.fn(),
    closePath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(),
    strokeStyle: '',
    lineWidth: 1,
    clearRect: jest.fn(),
    fillRect: jest.fn(),
};

const mockCanvas = {
    getContext: () => mockCtx,
    width: 300,
    height: 300
};

global.document = {
    getElementById: () => mockCanvas,
    addEventListener: jest.fn(),
};

// Add Audio mock
global.Audio = class {
    constructor() {
        this.src = '';
        this.onended = null;
    }
    play() {
        // Schedule onended callback to simulate audio playback
        if (this.onended) {
            Promise.resolve().then(() => this.onended());
        }
    }
};

// Add window mock for requestAnimationFrame
global.window = {
    requestAnimationFrame: jest.fn()
};
global.requestAnimationFrame = window.requestAnimationFrame;

// Import the classes (you'll need to export them from maze.js)
const { Player, Cell, Bullet, Settings } = require('./maze.js');

describe('Player Class', () => {
    let player;
    
    beforeEach(() => {
        // Reset Settings singleton
        Settings.instance = null;
        player = new Player();
    });

    test('initializes with correct default values', () => {
        expect(player.x).toBe(285); // canvas.width - cellSize/2
        expect(player.y).toBe(285); // canvas.height - cellSize/2
        expect(player.radius).toBe(5);
        expect(player.moveSpeed).toBe(5);
        expect(player.color).toBe('#00ff00');
        expect(player.direction).toBe(-3 * Math.PI / 4);
        expect(player.hasExited).toBe(false);
        expect(player.isRemoved).toBe(false);
    });

    test('canMove returns false when hitting maze boundaries', () => {
        expect(player.canMove(-10, 150)).toBe(false);
        expect(player.canMove(310, 150)).toBe(false);
        expect(player.canMove(150, -10)).toBe(false);
        expect(player.canMove(150, 310)).toBe(false);
    });

    test('detects exit condition', () => {
        player.x = 15;
        player.y = 15;
        expect(player.canMove(15, 15)).toBe(true);
        expect(player.hasExited).toBe(true);
        expect(Settings.getInstance().hasExited).toBe(true);
    });

    test('rotation methods work correctly', () => {
        const initialDirection = player.direction;
        player.rotateClockwise();
        expect(player.direction).toBe(initialDirection + Math.PI/32);
        player.rotateCounterClockwise();
        expect(player.direction).toBe(initialDirection);
    });

    test('removePlayer sets correct removal state', () => {
        player.removePlayer();
        expect(player.isRemoved).toBe(true);
        expect(player.x).toBe(-1000);
        expect(player.y).toBe(-1000);
    });

    test('playExitSound triggers removal after sound ends', async () => {
        player.playExitSound();
        expect(player.isRemoved).toBe(false); // Should not be removed immediately
        
        // Wait for all promises to resolve
        await Promise.resolve();
        
        expect(player.isRemoved).toBe(true); // Now should be removed
        expect(player.x).toBe(-1000);
        expect(player.y).toBe(-1000);
    });
});

describe('Cell Class', () => {
    let cell;

    beforeEach(() => {
        cell = new Cell(1, 1);
    });

    test('initializes with all walls', () => {
        expect(cell.walls).toEqual({
            top: true,
            right: true,
            bottom: true,
            left: true
        });
    });

    test('initializes with correct position', () => {
        expect(cell.row).toBe(1);
        expect(cell.col).toBe(1);
        expect(cell.visited).toBe(false);
    });

    test('draw method calls correct canvas methods', () => {
        cell.draw();
        expect(mockCtx.beginPath).toHaveBeenCalled();
        expect(mockCtx.stroke).toHaveBeenCalled();
    });

    test('draws visited cell with fill', () => {
        cell.visited = true;
        cell.draw();
        expect(mockCtx.fillStyle).toBe('rgba(0, 255, 0, 0.1)');
        expect(mockCtx.fillRect).toHaveBeenCalled();
    });
});

describe('Bullet Class', () => {
    let bullet;

    beforeEach(() => {
        Settings.instance = null;
        bullet = new Bullet(150, 150, -Math.PI/2);
    });

    test('initializes with correct values', () => {
        expect(bullet.x).toBe(150);
        expect(bullet.y).toBe(150);
        expect(bullet.radius).toBe(3);
        expect(bullet.speed).toBe(2);
        expect(bullet.direction).toBe(-Math.PI/2);
    });

    test('updates position correctly', () => {
        const initialX = bullet.x;
        const initialY = bullet.y;
        bullet.update();
        expect(bullet.x).toBe(initialX + bullet.dx);
        expect(bullet.y).toBe(initialY + bullet.dy);
    });

    test('bullet fades over time', () => {
        const initialOpacity = bullet.opacity;
        // Mock time passing
        jest.spyOn(Date, 'now').mockImplementation(() => bullet.birthTime + 5000);
        bullet.draw();
        expect(bullet.opacity).toBeLessThan(initialOpacity);
    });

    test('isDead returns true after lifetime', () => {
        expect(bullet.isDead()).toBe(false);
        // Mock time passing beyond lifetime
        jest.spyOn(Date, 'now').mockImplementation(() => bullet.birthTime + 11000);
        expect(bullet.isDead()).toBe(true);
    });
});

// Add test setup and teardown
beforeAll(() => {
    jest.useFakeTimers();
});

afterAll(() => {
    jest.useRealTimers();
});

beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    document.addEventListener.mockClear();
    window.requestAnimationFrame.mockClear();
}); 