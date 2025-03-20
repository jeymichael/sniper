// Import Config first since mockCanvas needs it
const { Config } = require('./maze.js');

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
    font: '',
    fillText: jest.fn(),
};

const mockCanvas = {
    getContext: () => mockCtx,
    width: Config.MAZE_WIDTH,
    height: Config.MAZE_HEIGHT + Config.SCORE_AREA_HEIGHT
};

// Setup global mocks first
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

// Import remaining classes after setting up the environment
const { Player, Cell, Bullet, Settings, Maze, GameBoard } = require('./maze.js');

// Log Config to verify it's imported correctly
console.log('Config class:', Config);
console.log('BUGNEST_CREATION_DELAY:', Config.BUGNEST_CREATION_DELAY);
console.log('BUGNEST_CREATION_INTERVAL:', Config.BUGNEST_CREATION_INTERVAL);

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
        expect(player.x).toBe(285); // Config.MAZE_WIDTH - cellSize/2
        expect(player.y).toBe(285); // Config.MAZE_HEIGHT - cellSize/2
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
        expect(player.canMove(150, 310 /*Config.MAZE_HEIGHT + 10*/)).toBe(false);
    });

    test('detects exit condition', () => {
        player.x = 15;
        player.y = 15;
        expect(player.canMove(15, 15)).toBe(true);
        expect(player.hasExited).toBe(true);
    });

    test('rotation methods work correctly', () => {
        const initialDirection = player.direction;
        player.rotateClockwise();
        expect(player.direction).toBe(initialDirection + Math.PI/32);
        player.rotateCounterClockwise();
        expect(player.direction).toBe(initialDirection);
    });

    test('die() sets correct death state', () => {
        player.die();
        expect(player.isDead).toBe(true);
        expect(player.color).toBe('red');
        
        // Fast-forward the timer to trigger removal
        jest.advanceTimersByTime(1000);
        expect(player.isRemoved).toBe(true);
    });

    test('playExitSound triggers removal', async () => {
        player.playExitSound();
        expect(player.isRemoved).toBe(true); // Should be removed immediately on exit
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

    test('handles corner wall collisions correctly', () => {
        // Setup a specific wall configuration:
        // Current cell (1,1) has no top and left walls
        // Top cell (0,1) has left wall
        // Left cell (1,0) has top wall
        const currentCell = maze.grid[1][1];
        currentCell.walls.top = false;
        currentCell.walls.left = false;

        const topCell = maze.grid[0][1];
        topCell.walls.left = true;

        const leftCell = maze.grid[1][0];
        leftCell.walls.top = true;

        // Position bullet near the top-left corner of cell (1,1)
        bullet.x = maze.cellSize + bullet.radius; // Just right of the left wall
        bullet.y = maze.cellSize + bullet.radius; // Just below the top wall
        
        // Set bullet direction towards the corner (-135 degrees or -3π/4 radians)
        bullet.direction = -3 * Math.PI / 4;
        bullet.dx = Math.cos(bullet.direction) * bullet.speed;
        bullet.dy = Math.sin(bullet.direction) * bullet.speed;

        // Update bullet position and check collision
        bullet.update();

        // The bullet should have bounced off the corner
        // Either dx or dy (or both) should have changed direction
        expect(bullet.dx !== Math.cos(-3 * Math.PI / 4) * bullet.speed || 
               bullet.dy !== Math.sin(-3 * Math.PI / 4) * bullet.speed).toBe(true);
    });

    test('isDead returns true after lifetime', () => {
        expect(bullet.isDead()).toBe(false);
        // Mock time passing beyond lifetime
        jest.spyOn(Date, 'now').mockImplementation(() => bullet.birthTime + 11000);
        expect(bullet.isDead()).toBe(true);
    });

    test('handles top-left corner wall collisions', () => {
        const maze = new Maze(mockCanvas);
        const bullet = new Bullet(Config.CELL_SIZE * 1.5, Config.CELL_SIZE * 1.5, Math.PI / 4, maze);
        
        // Set up a corner where adjacent cells have walls
        maze.grid[1][1].walls = { top: false, right: true, bottom: true, left: false };
        maze.grid[0][1].walls = { top: true, right: true, bottom: false, left: true };
        maze.grid[1][0].walls = { top: true, right: false, bottom: true, left: true };
        
        // Position bullet very close to top-left corner of cell (1,1)
        bullet.x = Config.CELL_SIZE * 1.01; // Much closer to left wall
        bullet.y = Config.CELL_SIZE * 1.01; // Much closer to top wall
        bullet.direction = -3*Math.PI/4; // pointing towards top-left corner
        bullet.dx = Math.cos(bullet.direction) * bullet.speed;
        bullet.dy = Math.sin(bullet.direction) * bullet.speed;
        
        const initialDirection = bullet.direction;
        bullet.checkCollision();
        
        // Compute expected direction after collision
        const expectedDirection = Math.atan2(bullet.dy, bullet.dx);
        
        // Verify the direction was updated correctly
        expect(bullet.direction).toBe(expectedDirection);
        expect(bullet.direction).not.toBe(initialDirection);
    });

    test('handles top-right corner wall collisions', () => {
        const maze = new Maze(mockCanvas);
        const bullet = new Bullet(Config.CELL_SIZE * 1.5, Config.CELL_SIZE * 1.5, -Math.PI / 4, maze);
        
        // Set up a corner where adjacent cells have walls
        maze.grid[1][1].walls = { top: false, right: false, bottom: true, left: true };
        maze.grid[0][1].walls = { top: true, right: true, bottom: false, left: true };
        maze.grid[1][2].walls = { top: true, right: true, bottom: true, left: false };
        
        // Position bullet very close to top-right corner of cell (1,1)
        bullet.x = Config.CELL_SIZE * 1.99; // Much closer to right wall
        bullet.y = Config.CELL_SIZE * 1.01; // Much closer to top wall
        bullet.direction = -Math.PI / 4; // -45 degrees, pointing towards top-right corner
        bullet.dx = Math.cos(bullet.direction) * bullet.speed;
        bullet.dy = Math.sin(bullet.direction) * bullet.speed;
        
        const initialDirection = bullet.direction;
        bullet.checkCollision();
        
        // Compute expected direction after collision
        const expectedDirection = Math.atan2(bullet.dy, bullet.dx);
        
        // Verify the direction was updated correctly
        expect(bullet.direction).toBe(expectedDirection);
        expect(bullet.direction).not.toBe(initialDirection);
    });

    test('handles bottom-left corner wall collisions', () => {
        const maze = new Maze(mockCanvas);
        const bullet = new Bullet(Config.CELL_SIZE * 1.5, Config.CELL_SIZE * 1.5, 3 * Math.PI / 4, maze);
        
        // Set up a corner where adjacent cells have walls
        maze.grid[1][1].walls = { top: true, right: true, bottom: false, left: false };
        maze.grid[2][1].walls = { top: false, right: true, bottom: true, left: true };
        maze.grid[1][0].walls = { top: true, right: false, bottom: true, left: true };
        
        // Position bullet very close to bottom-left corner of cell (1,1)
        bullet.x = Config.CELL_SIZE * 1.01; // Much closer to left wall
        bullet.y = Config.CELL_SIZE * 1.99; // Much closer to bottom wall
        bullet.direction = 3 * Math.PI / 4; // 135 degrees, pointing towards bottom-left corner
        bullet.dx = Math.cos(bullet.direction) * bullet.speed;
        bullet.dy = Math.sin(bullet.direction) * bullet.speed;
        
        const initialDirection = bullet.direction;
        bullet.checkCollision();
        
        // Compute expected direction after collision
        const expectedDirection = Math.atan2(bullet.dy, bullet.dx);
        
        // Verify the direction was updated correctly
        expect(bullet.direction).toBe(expectedDirection);
        expect(bullet.direction).not.toBe(initialDirection);
    });

    test('handles bottom-right corner wall collisions', () => {
        const maze = new Maze(mockCanvas);
        const bullet = new Bullet(Config.CELL_SIZE * 1.5, Config.CELL_SIZE * 1.5, -3 * Math.PI / 4, maze);
        
        // Set up a corner where adjacent cells have walls
        maze.grid[1][1].walls = { top: true, right: false, bottom: false, left: true };
        maze.grid[2][1].walls = { top: false, right: true, bottom: true, left: true };
        maze.grid[1][2].walls = { top: true, right: true, bottom: true, left: false };
        
        // Position bullet very close to bottom-right corner of cell (1,1)
        bullet.x = Config.CELL_SIZE * 1.99; // Much closer to right wall
        bullet.y = Config.CELL_SIZE * 1.99; // Much closer to bottom wall
        bullet.direction = -3 * Math.PI / 4; // -135 degrees, pointing towards bottom-right corner
        bullet.dx = Math.cos(bullet.direction) * bullet.speed;
        bullet.dy = Math.sin(bullet.direction) * bullet.speed;
        
        const initialDirection = bullet.direction;
        bullet.checkCollision();
        
        // Compute expected direction after collision
        const expectedDirection = Math.atan2(bullet.dy, bullet.dx);
        
        // Verify the direction was updated correctly
        expect(bullet.direction).toBe(expectedDirection);
        expect(bullet.direction).not.toBe(initialDirection);
    });
});

describe('Maze Class', () => {
    let maze;
    
    beforeEach(() => {
        maze = new Maze(mockCanvas);
    });

    test('initializes with correct dimensions', () => {
        expect(maze.cellSize).toBe(Config.CELL_SIZE);
        expect(maze.rows).toBe(Config.ROWS);
        expect(maze.cols).toBe(Config.COLS);
        expect(maze.width).toBe(Config.MAZE_WIDTH);
        expect(maze.height).toBe(Config.MAZE_HEIGHT);
        expect(maze.grid.length).toBe(Config.ROWS);
        expect(maze.grid[0].length).toBe(Config.COLS);
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

describe('Maze.findPath', () => {
    let maze;
    
    beforeEach(() => {
        maze = new Maze(mockCanvas);
    });

    test('finds path from entrance to exit', () => {
        const path = maze.findPath(maze.rows - 1, maze.cols - 1, 0, 0);
        expect(path).not.toBeNull();
        expect(path.length).toBeGreaterThan(0);
        expect(path[0]).toEqual({row: maze.rows - 1, col: maze.cols - 1}); // Start
        expect(path[path.length - 1]).toEqual({row: 0, col: 0}); // End
    });

    test('finds path between adjacent cells without walls', () => {
        // Remove wall between (1,1) and (1,2)
        maze.grid[1][1].walls.right = false;
        maze.grid[1][2].walls.left = false;

        const path = maze.findPath(1, 1, 1, 2);
        expect(path).not.toBeNull();
        expect(path).toEqual([
            {row: 1, col: 1},
            {row: 1, col: 2}
        ]);
    });

    test('returns null when no path exists', () => {
        // Create a cell surrounded by walls
        const row = 1, col = 1;
        maze.grid[row][col].walls = {top: true, right: true, bottom: true, left: true};
        maze.grid[row-1][col].walls.bottom = true;
        maze.grid[row][col+1].walls.left = true;
        maze.grid[row+1][col].walls.top = true;
        maze.grid[row][col-1].walls.right = true;

        const path = maze.findPath(row, col, row + 1, col);
        expect(path).toBeNull();
    });

    test('handles boundary conditions', () => {
        // Test path to out-of-bounds cell
        expect(maze.findPath(0, 0, -1, 0)).toBeNull();
        expect(maze.findPath(0, 0, 0, maze.cols)).toBeNull();
        expect(maze.findPath(0, 0, maze.rows, 0)).toBeNull();
        expect(maze.findPath(0, 0, 0, -1)).toBeNull();
        
        // Test path from out-of-bounds cell
        expect(maze.findPath(-1, 0, 0, 0)).toBeNull();
        expect(maze.findPath(0, maze.cols, 0, 0)).toBeNull();
        expect(maze.findPath(maze.rows, 0, 0, 0)).toBeNull();
        expect(maze.findPath(0, -1, 0, 0)).toBeNull();

        // Test path with both points out of bounds
        expect(maze.findPath(-1, -1, maze.rows, maze.cols)).toBeNull();
        expect(maze.findPath(maze.rows, maze.cols, -1, -1)).toBeNull();

        // Test edge cases (exactly at boundaries)
        expect(maze.findPath(0, 0, maze.rows - 1, maze.cols - 1)).not.toBeNull();
        expect(maze.findPath(maze.rows - 1, maze.cols - 1, 0, 0)).not.toBeNull();
    });

    test('path follows valid cell connections', () => {
        const path = maze.findPath(maze.rows - 1, maze.cols - 1, 0, 0);
        
        // Check that each consecutive pair of cells in the path is actually connected
        for (let i = 0; i < path.length - 1; i++) {
            const current = path[i];
            const next = path[i + 1];
            
            // Cells should be adjacent
            const rowDiff = Math.abs(current.row - next.row);
            const colDiff = Math.abs(current.col - next.col);
            expect(rowDiff + colDiff).toBe(1); // Only one coordinate should differ by 1
            
            // Check that there is no wall between cells
            if (next.row < current.row) {
                expect(maze.grid[current.row][current.col].walls.top).toBe(false);
                expect(maze.grid[next.row][next.col].walls.bottom).toBe(false);
            } else if (next.row > current.row) {
                expect(maze.grid[current.row][current.col].walls.bottom).toBe(false);
                expect(maze.grid[next.row][next.col].walls.top).toBe(false);
            } else if (next.col < current.col) {
                expect(maze.grid[current.row][current.col].walls.left).toBe(false);
                expect(maze.grid[next.row][next.col].walls.right).toBe(false);
            } else if (next.col > current.col) {
                expect(maze.grid[current.row][current.col].walls.right).toBe(false);
                expect(maze.grid[next.row][next.col].walls.left).toBe(false);
            }
        }
    });
});

describe('GameBoard Class', () => {
    let gameBoard;
    let currentTime;
    
    beforeEach(() => {
        Settings.instance = null;
        currentTime = 0;
        // Mock Date.now to return our controlled time
        jest.spyOn(Date, 'now').mockImplementation(() => currentTime);
        gameBoard = new GameBoard(mockCanvas);
        jest.clearAllTimers();
    });

    test('stops creating BugNests when player dies', () => {
        // Fast forward to first nest creation
        currentTime = Config.BUGNEST_CREATION_DELAY
        gameBoard.update();
        expect(gameBoard.bugNests.length).toBe(1);

        // Kill the player
        gameBoard.player.die();
        
        // Fast forward to when next nest would be created
        currentTime = Config.BUGNEST_CREATION_DELAY + Config.BUGNEST_CREATION_INTERVAL
        gameBoard.update();
        
        // Verify no new nests were created
        expect(gameBoard.bugNests.length).toBe(1);
    });

    test('stops creating BugNests when player exits', () => {
        // Fast forward to first nest creation
        currentTime = Config.BUGNEST_CREATION_DELAY
        gameBoard.update();
        expect(gameBoard.bugNests.length).toBe(1);

        // Make player exit
        gameBoard.player.hasExited = true;
        
        // Fast forward to when next nest would be created
        currentTime = Config.BUGNEST_CREATION_DELAY + Config.BUGNEST_CREATION_INTERVAL
        gameBoard.update();
        
        // Verify no new nests were created
        expect(gameBoard.bugNests.length).toBe(1);
    });

    test('stops creating BugNests when player is removed', () => {
        // Fast forward to first nest creation
        currentTime = Config.BUGNEST_CREATION_DELAY
        gameBoard.update();
        expect(gameBoard.bugNests.length).toBe(1);

        // Remove player
        gameBoard.player.isRemoved = true;
        
        // Fast forward to when next nest would be created
        currentTime = Config.BUGNEST_CREATION_DELAY + Config.BUGNEST_CREATION_INTERVAL
        gameBoard.update();
        
        // Verify no new nests were created
        expect(gameBoard.bugNests.length).toBe(1);
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