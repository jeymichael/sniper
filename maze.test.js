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
const { Player, Cell, Bullet, Settings, Maze } = require('./maze.js');

describe('Player Class', () => {
    let player;
    let maze;
    
    beforeEach(() => {
        // Reset Settings singleton
        Settings.instance = null;
        maze = new Maze(mockCanvas);
        player = new Player(maze);
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
    let maze;

    beforeEach(() => {
        Settings.instance = null;
        maze = new Maze(mockCanvas);
        bullet = new Bullet(150, 150, -Math.PI/2, maze);
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

describe('Maze Class', () => {
    let maze;
    
    beforeEach(() => {
        maze = new Maze(mockCanvas);
    });

    test('initializes with correct dimensions', () => {
        expect(maze.cellSize).toBe(30);
        expect(maze.rows).toBe(10); // 300/30
        expect(maze.cols).toBe(10); // 300/30
        expect(maze.grid.length).toBe(10);
        expect(maze.grid[0].length).toBe(10);
    });

    test('setupGrid creates grid with correct cells', () => {
        // Create a new maze but don't generate the maze yet
        const testMaze = new Maze(mockCanvas);
        
        // Clear the grid and run setupGrid manually
        testMaze.grid = [];
        testMaze.setupGrid();

        // Now check if all cells are properly initialized
        for (let row = 0; row < testMaze.rows; row++) {
            for (let col = 0; col < testMaze.cols; col++) {
                const cell = testMaze.grid[row][col];
                expect(cell).toBeInstanceOf(Cell);
                expect(cell.row).toBe(row);
                expect(cell.col).toBe(col);
                expect(cell.walls).toEqual({
                    top: true,
                    right: true,
                    bottom: true,
                    left: true
                });
                expect(cell.visited).toBe(false);
            }
        }
    });

    test('generateMaze creates valid maze paths', () => {
        // After maze generation, check if:
        // 1. All cells are visited
        // 2. There are no isolated cells (each cell connects to at least one other)
        let visitedCount = 0;
        let connectedCellsCount = 0;

        for (let row = 0; row < maze.rows; row++) {
            for (let col = 0; col < maze.cols; col++) {
                const cell = maze.grid[row][col];
                if (cell.visited) visitedCount++;

                // Count how many connections this cell has
                const connections = Object.values(cell.walls).filter(wall => !wall).length;
                if (connections > 0) connectedCellsCount++;
            }
        }

        expect(visitedCount).toBe(maze.rows * maze.cols); // All cells visited
        expect(connectedCellsCount).toBe(maze.rows * maze.cols); // All cells connected
    });

    test('createEntranceAndExit sets correct openings', () => {
        // Check entrance (bottom-right)
        const entrance = maze.grid[maze.rows-1][maze.cols-1];
        expect(entrance.walls.bottom).toBe(false);

        // Check exit (top-left)
        const exit = maze.grid[0][0];
        expect(exit.walls.top).toBe(false);
    });

    test('isInBounds correctly validates positions', () => {
        // Test valid positions
        expect(maze.isInBounds(0, 0)).toBe(true);
        expect(maze.isInBounds(maze.rows-1, maze.cols-1)).toBe(true);
        expect(maze.isInBounds(5, 5)).toBe(true);

        // Test invalid positions
        expect(maze.isInBounds(-1, 5)).toBe(false);
        expect(maze.isInBounds(5, -1)).toBe(false);
        expect(maze.isInBounds(maze.rows, 5)).toBe(false);
        expect(maze.isInBounds(5, maze.cols)).toBe(false);
    });

    test('getOppositeWall returns correct opposites', () => {
        expect(maze.getOppositeWall('top')).toBe('bottom');
        expect(maze.getOppositeWall('right')).toBe('left');
        expect(maze.getOppositeWall('bottom')).toBe('top');
        expect(maze.getOppositeWall('left')).toBe('right');
    });

    test('draw method calls correct canvas methods', () => {
        maze.draw();

        // Verify that the correct drawing methods were called
        expect(mockCtx.beginPath).toHaveBeenCalled();
        expect(mockCtx.moveTo).toHaveBeenCalled();
        expect(mockCtx.lineTo).toHaveBeenCalled();
        expect(mockCtx.stroke).toHaveBeenCalled();
        expect(mockCtx.fillRect).toHaveBeenCalled();

        // Verify stroke style was set
        expect(mockCtx.strokeStyle).toBe('#000');
    });

    test('maze is fully connected from entrance to exit', () => {
        // Helper function to find path using DFS
        function hasPath(row, col, visited = new Set()) {
            if (row === 0 && col === 0) return true; // Reached exit
            
            const key = `${row},${col}`;
            if (visited.has(key)) return false;
            visited.add(key);

            const cell = maze.grid[row][col];
            
            // Try all possible directions
            if (!cell.walls.top && row > 0) {
                if (hasPath(row-1, col, visited)) return true;
            }
            if (!cell.walls.right && col < maze.cols-1) {
                if (hasPath(row, col+1, visited)) return true;
            }
            if (!cell.walls.bottom && row < maze.rows-1) {
                if (hasPath(row+1, col, visited)) return true;
            }
            if (!cell.walls.left && col > 0) {
                if (hasPath(row, col-1, visited)) return true;
            }

            return false;
        }

        // Start from entrance (bottom-right)
        const hasValidPath = hasPath(maze.rows-1, maze.cols-1);
        expect(hasValidPath).toBe(true);
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