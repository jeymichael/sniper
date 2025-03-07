// Add Config class at the top of the file
class Config {
    static get CELL_SIZE() { return 30; }
    static get BULLET_SPACING() { return 25; }
    static get MAX_BULLETS() { return 100; }
    static get CANVAS_WIDTH() { return 300; }
    static get CANVAS_HEIGHT() { return 300; }
    static get ROWS() { return Math.floor(this.CANVAS_HEIGHT / this.CELL_SIZE); }
    static get COLS() { return Math.floor(this.CANVAS_WIDTH / this.CELL_SIZE); }
    // Add other static config values as needed
}

const canvas = document.getElementById('mazeCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size
canvas.width = Config.CANVAS_WIDTH;
canvas.height = Config.CANVAS_HEIGHT;
let animationId;
// Add to global variables at the top
let rotationState = {
    clockwise: false,
    counterClockwise: false
};

// Cell class to represent each position in the maze
class Cell {
    constructor(row, col) {
        this.row = row;
        this.col = col;
        this.walls = {
            top: true,
            right: true,
            bottom: true,
            left: true
        };
        this.visited = false;
    }

    draw() {
        const x = this.col * Config.CELL_SIZE;
        const y = this.row * Config.CELL_SIZE;

        ctx.strokeStyle = '#000';
        ctx.beginPath();

        // Draw walls
        if (this.walls.top) {
            ctx.moveTo(x, y);
            ctx.lineTo(x + Config.CELL_SIZE, y);
        }
        if (this.walls.right) {
            ctx.moveTo(x + Config.CELL_SIZE, y);
            ctx.lineTo(x + Config.CELL_SIZE, y + Config.CELL_SIZE);
        }
        if (this.walls.bottom) {
            ctx.moveTo(x + Config.CELL_SIZE, y + Config.CELL_SIZE);
            ctx.lineTo(x, y + Config.CELL_SIZE);
        }
        if (this.walls.left) {
            ctx.moveTo(x, y + Config.CELL_SIZE);
            ctx.lineTo(x, y);
        }

        ctx.stroke();

        // Color visited cells
        if (this.visited) {
            ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
            ctx.fillRect(x, y, Config.CELL_SIZE, Config.CELL_SIZE);
        }
    }
}

// Modify the Settings class
class Settings {
    constructor() {
        // Bullet settings
        this.bulletRadius = 3;
        this.bulletSpeed = 2;
        this.bulletLifetime = 10000; // 10 seconds in milliseconds
        this.bulletFadeSteps = 4;   // Number of color steps before disappearing
        this.bulletSpacing = Config.BULLET_SPACING;    // Move BULLET_SPACING here
        this.maxBullets = Config.MAX_BULLETS;      // Move MAX_BULLETS here

        // Player settings
        this.playerRadius = 5;
        this.playerSpeed = 5;
        this.rotationSpeed = Math.PI/32;

        // Game state
        this.hasExited = false;
    }

    static getInstance() {
        if (!Settings.instance) {
            Settings.instance = new Settings();
        }
        return Settings.instance;
    }
}

// Add after the Cell class
class Bullet {
    constructor(startX, startY, direction) {
        this.x = startX;
        this.y = startY;
        
        const settings = Settings.getInstance();
        this.radius = settings.bulletRadius;
        this.speed = settings.bulletSpeed;
        
        this.direction = direction;
        this.dx = Math.cos(this.direction) * this.speed;
        this.dy = Math.sin(this.direction) * this.speed;

        // Add lifetime tracking
        this.birthTime = Date.now();
        this.settings = Settings.getInstance();
        this.opacity = 1.0;
    }

    draw() {
        const age = Date.now() - this.birthTime;
        const lifePercent = age / this.settings.bulletLifetime;
        
        // Calculate fading
        this.opacity = 1.0 - (lifePercent * this.settings.bulletFadeSteps/4);
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 0, 0, ${Math.max(0, this.opacity)})`;
        ctx.fill();
        ctx.closePath();
    }

    // Update checkCollision to use maze instance
    checkCollision() {
        const col = Math.floor(this.x / maze.cellSize);
        const row = Math.floor(this.y / maze.cellSize);

        // Use maze's isInBounds method
        if (!maze.isInBounds(row, col)) {
            return;
        }

        // Use maze's grid to get cell
        const cell = maze.grid[row][col];
        const relativeX = this.x % maze.cellSize;
        const relativeY = this.y % maze.cellSize;

        // Check collision with walls using maze.cellSize
        if (cell.walls.top && relativeY <= this.radius) {
            this.dy = Math.abs(this.dy); // Bounce down
        }
        if (cell.walls.bottom && relativeY >= maze.cellSize - this.radius) {
            this.dy = -Math.abs(this.dy); // Bounce up
        }
        if (cell.walls.left && relativeX <= this.radius) {
            this.dx = Math.abs(this.dx); // Bounce right
        }
        if (cell.walls.right && relativeX >= maze.cellSize - this.radius) {
            this.dx = -Math.abs(this.dx); // Bounce left
        }
    }

    update() {
        this.checkCollision();
        this.x += this.dx;
        this.y += this.dy;
    }

    // Add method to check if bullet should be removed
    isDead() {
        return Date.now() - this.birthTime > this.settings.bulletLifetime;
    }
}

// Modify the Player class
class Player {
    constructor() {
        // Start at the center of entrance cell (bottom-right)
        this.x = maze.canvas.width - maze.cellSize/2;
        this.y = maze.canvas.height - maze.cellSize/2;
        
        // Get settings from singleton
        const settings = Settings.getInstance();
        this.radius = settings.playerRadius;
        this.moveSpeed = settings.playerSpeed;
        this.color = '#00ff00';
        this.arrowLength = this.radius * 1.5; // Length of direction indicator
        this.direction = -3*Math.PI/4; // Initial direction (-45 degrees)
        this.hasExited = false;
        this.isRemoved = false;
    }

    draw() {
        // Don't draw if player is removed
        if (this.isRemoved) {
            return;
        }

        // Draw player circle
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();

        // Draw direction arrow using player's direction
        this.drawDirectionArrow(this.direction);
    }

    drawDirectionArrow(direction) {
        const startX = this.x;
        const startY = this.y;
        const endX = startX + Math.cos(direction) * this.arrowLength;
        const endY = startY + Math.sin(direction) * this.arrowLength;

        // Draw arrow line
        ctx.beginPath();
        ctx.strokeStyle = '#004400';
        ctx.lineWidth = 2;
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);

        ctx.stroke();
        ctx.lineWidth = 1;
    }

    // Check if a move would result in wall collision
    canMove(newX, newY) {
        // If player has started exiting, skip collision checks
        if (this.hasExited) {
            return true;
        }

        // Check if player is at exit (top-left)
        if (this.y <= maze.cellSize && this.x <= maze.cellSize) {
            this.hasExited = true;
            Settings.getInstance().hasExited = true;
            this.playExitSound();
            return true;
        }

        // Calculate the bounds of the player's circle
        const bounds = {
            left: newX - this.radius,
            right: newX + this.radius,
            top: newY - this.radius,
            bottom: newY + this.radius
        };

        // Get cells that the player's circle intersects with
        const cells = {
            topLeft: {
                col: Math.floor(bounds.left / maze.cellSize),
                row: Math.floor(bounds.top / maze.cellSize)
            },
            topRight: {
                col: Math.floor(bounds.right / maze.cellSize),
                row: Math.floor(bounds.top / maze.cellSize)
            },
            bottomLeft: {
                col: Math.floor(bounds.left / maze.cellSize),
                row: Math.floor(bounds.bottom / maze.cellSize)
            },
            bottomRight: {
                col: Math.floor(bounds.right / maze.cellSize),
                row: Math.floor(bounds.bottom / maze.cellSize)
            }
        };

        // Check if any part of the player would be outside the maze
        if (bounds.left < 0 || bounds.right > maze.canvas.width ||
            bounds.top < 0 || bounds.bottom > maze.canvas.height) {
            return false;
        }

        // Check each cell the player's circle intersects with
        for (const cell of Object.values(cells)) {
            // Skip if cell coordinates are outside the grid
            if (!maze.isInBounds(cell.row, cell.col)) {
                continue;
            }

            const currentCell = maze.grid[cell.row][cell.col];
            const relativeX = newX - (cell.col * maze.cellSize);
            const relativeY = newY - (cell.row * maze.cellSize);

            // Check collision with walls
            if (currentCell.walls.top && 
                Math.abs(relativeY - 0) <= this.radius) {
                return false;
            }
            if (currentCell.walls.bottom && 
                Math.abs(relativeY - maze.cellSize) <= this.radius) {
                return false;
            }
            if (currentCell.walls.left && 
                Math.abs(relativeX - 0) <= this.radius) {
                return false;
            }
            if (currentCell.walls.right && 
                Math.abs(relativeX - maze.cellSize) <= this.radius) {
                return false;
            }
        }

        return true;
    }

    move(dx, dy) {
        const newX = this.x + dx * this.moveSpeed;
        const newY = this.y + dy * this.moveSpeed;

        if (this.canMove(newX, newY)) {
            this.x = newX;
            this.y = newY;
        }
    }

    // Add rotation methods
    rotateClockwise() {
        this.direction += Settings.getInstance().rotationSpeed;
    }

    rotateCounterClockwise() {
        this.direction -= Settings.getInstance().rotationSpeed;
    }

    playExitSound() {
        const audio = new Audio();
        audio.src = 'data:audio/wav;base64,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qJrx4KOQjahZxWbcZgztj2c49nKmkId44S71j0c8eV9yDK6uPRzx5X18eDvjvQ6yKo9ZSS6l//8elePK/Lf//IInrOF/FvDoADYAGBMGb7FtErm5MXMlmPAJQVgWta7Zx2go+8xJ0UiCb8LHHdftWyLJE0QIAIsI+UbXu67dZMjmgDGCGl1H+vpF4NSDckSIkk7Vd+sxEhBQMRU8j/12UIRhzSaUdQ+rQU5kGeFxm+hb1oh6pWWmv3uvmReDl0UnvtapVaIzo1jZbf/pD6ElLqSX+rUmOQNpJFa/r+sa4e/pBlAABoAAAAA3CUgShLdGIxsY7AUABPRrgCABdDuQ5GC7DqPQCgbbJUAoRSUj+NIEig0YfyWUho1VBBBA//uQZB4ABZx5zfMakeAAAAmwAAAAF5F3P0w9GtAAACfAAAAAwLhMDmAYWMgVEG1U0FIGCBgXBXAtfMH10000EEEEEECUBYln03TTTdNBDZopopYvrTTdNa325mImNg3TTPV9q3pmY0xoO6bv3r00y+IDGid/9aaaZTGMuj9mpu9Mpio1dXrr5HERTZSmqU36A3CumzN/9Robv/Xx4v9ijkSRSNLQhAWumap82WRSBUqXStV/YcS+XVLnSS+WLDroqArFkMEsAS+eWmrUzrO0oEmE40RlMZ5+ODIkAyKAGUwZ3mVKmcamcJnMW26MRPgUw6j+LkhyHGVGYjSUUKNpuJUQoOIAyDvEyG8S5yfK6dhZc0Tx1KI/gviKL6qvvFs1+bWtaz58uUNnryq6kt5RzOCkPWlVqVX2a/EEBUdU1KrXLf40GoiiFXK///qpoiDXrOgqDR38JB0bw7SoL+ZB9o1RCkQjQ2CBYZKd/+VJxZRRZlqSkKiws0WFxUyCwsKiMy7hUVFhIaCrNQsKkTIsLivwKKigsj8XYlwt/WKi2N4d//uQRCSAAjURNIHpMZBGYiaQPSYyAAABLAAAAAAAACWAAAAApUF/Mg+0aohSIRobBAsMlO//Kk4soosy1JSFRYWaLC4qZBYWFRGZdwqKiwkNBVmoWFSJkWFxX4FFRQWR+LsS4W/rFRb/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////VEFHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAU291bmRib3kuZGUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMjAwNGh0dHA6Ly93d3cuc291bmRib3kuZGUAAAAAAAAAACU=';
        
        // Remove player after sound plays
        audio.onended = () => {
            this.removePlayer();
        };
        audio.play();
    }

    removePlayer() {
        // Set player position far outside the maze
        this.x = -1000;
        this.y = -1000;
        
        // Stop drawing the player
        this.isRemoved = true;
    }
}

// Initialize first bullet
function initializeFirstBullet() {
    bullets = [];
    const firstBullet = new Bullet(player.x, player.y, player.direction);
    bullets.push(firstBullet);
}

// Check if new bullet should be created
function checkBulletCreation() {
    const settings = Settings.getInstance();
    if (bullets.length < Config.MAX_BULLETS) {
        const lastBullet = bullets[bullets.length - 1];
        if ((canvas.height - lastBullet.y) >= Config.BULLET_SPACING) {
            const newBullet = new Bullet(player.x, player.y, player.direction);
            bullets.push(newBullet);
        }
    }
}
// Modify the checkBulletExit function to also remove dead bullets
function checkBulletExit() {
    bullets = bullets.filter(bullet => 
        bullet.y >= 0 && !bullet.isDead()
    );
}

// Modify the adjustSpeed function
function adjustSpeed(newSpeed) {
    // Convert string to number and clamp between limits
    newSpeed = Math.max(0.5, Math.min(5, Number(newSpeed)));
    
    // Update settings
    Settings.getInstance().bulletSpeed = newSpeed;
    
    // Update all bullets' speed while maintaining their directions
    bullets.forEach(bullet => {
        bullet.speed = newSpeed;
        const angle = Math.atan2(bullet.dy, bullet.dx);
        bullet.dx = Math.cos(angle) * newSpeed;
        bullet.dy = Math.sin(angle) * newSpeed;
    });
    
    // Update display
    document.getElementById('speedValue').textContent = newSpeed.toFixed(1);
}

// Modify the adjustRadius function
function adjustRadius(newRadius) {
    // Convert string to number and clamp between limits
    newRadius = Math.max(2, Math.min(8, Number(newRadius)));
    
    // Update settings
    Settings.getInstance().bulletRadius = newRadius;
    
    // Update all bullets' radius
    bullets.forEach(bullet => {
        bullet.radius = newRadius;
    });
    
    document.getElementById('radiusValue').textContent = newRadius.toFixed(0);
}

// Modify event listener setup to check for test environment
if (typeof document !== 'undefined') {
    document.addEventListener('keypress', (e) => {
        if (e.key === 'r' || e.key === 'R') {
            initializeFirstBullet();
        }
    });

    document.addEventListener('keydown', (e) => {
        switch(e.key) {
            case 'ArrowUp':
                player.move(0, -1);
                break;
            case 'ArrowDown':
                player.move(0, 1);
                break;
            case 'ArrowLeft':
                player.move(-1, 0);
                break;
            case 'ArrowRight':
                player.move(1, 0);
                break;
            case ' ': // Spacebar
                fireBullet();
                break;
            case 'Shift':
                // Start rotation based on which Shift key
                if (e.location === KeyboardEvent.DOM_KEY_LOCATION_LEFT) {
                    rotationState.counterClockwise = true;
                } else if (e.location === KeyboardEvent.DOM_KEY_LOCATION_RIGHT) {
                    rotationState.clockwise = true;
                }
                break;
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === 'Shift') {
            if (e.location === KeyboardEvent.DOM_KEY_LOCATION_LEFT) {
                rotationState.counterClockwise = false;
            } else if (e.location === KeyboardEvent.DOM_KEY_LOCATION_RIGHT) {
                rotationState.clockwise = false;
            }
        }
    });
}

bullets = []; // Needed here! 

// Add this to check for bullet exits in the animation loop
setInterval(checkBulletExit, 100);

// Modify the fireBullet function to always use player's current direction
function fireBullet() {
    if (bullets.length < Config.MAX_BULLETS) {
        const newBullet = new Bullet(player.x, player.y, player.direction);
        bullets.push(newBullet);
    }
}

class Maze {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.cellSize = Config.CELL_SIZE;
        this.rows = Config.ROWS;     // Use Config class
        this.cols = Config.COLS;     // Use Config class
        this.grid = [];
        
        this.setupGrid();
        this.generateMaze();
        this.createEntranceAndExit();
    }

    setupGrid() {
        for (let row = 0; row < this.rows; row++) {
            this.grid[row] = [];
            for (let col = 0; col < this.cols; col++) {
                this.grid[row][col] = new Cell(row, col);
            }
        }
    }

    generateMaze(row = 0, col = 0) {
        const current = this.grid[row][col];
        current.visited = true;

        const directions = [
            ['top', -1, 0],
            ['right', 0, 1],
            ['bottom', 1, 0],
            ['left', 0, -1]
        ];

        directions.sort(() => Math.random() - 0.5);

        for (const [wall, rowOffset, colOffset] of directions) {
            const newRow = row + rowOffset;
            const newCol = col + colOffset;

            if (this.isInBounds(newRow, newCol)) {
                const neighbor = this.grid[newRow][newCol];
                if (!neighbor.visited) {
                    current.walls[wall] = false;
                    neighbor.walls[this.getOppositeWall(wall)] = false;
                    this.generateMaze(newRow, newCol);
                }
            }
        }
    }

    isInBounds(row, col) {
        return row >= 0 && row < this.rows && col >= 0 && col < this.cols;
    }

    getOppositeWall(wall) {
        const opposites = {
            'top': 'bottom',
            'right': 'left',
            'bottom': 'top',
            'left': 'right'
        };
        return opposites[wall];
    }

    createEntranceAndExit() {
        // Create entrance at bottom-right
        this.grid[this.rows-1][this.cols-1].walls.bottom = false;
        
        // Create exit at top-left
        this.grid[0][0].walls.top = false;
    }

    draw() {
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const cell = this.grid[row][col];
                const x = col * this.cellSize;
                const y = row * this.cellSize;

                this.ctx.strokeStyle = '#000';
                this.ctx.beginPath();

                if (cell.walls.top) {
                    this.ctx.moveTo(x, y);
                    this.ctx.lineTo(x + this.cellSize, y);
                }
                if (cell.walls.right) {
                    this.ctx.moveTo(x + this.cellSize, y);
                    this.ctx.lineTo(x + this.cellSize, y + this.cellSize);
                }
                if (cell.walls.bottom) {
                    this.ctx.moveTo(x + this.cellSize, y + this.cellSize);
                    this.ctx.lineTo(x, y + this.cellSize);
                }
                if (cell.walls.left) {
                    this.ctx.moveTo(x, y + this.cellSize);
                    this.ctx.lineTo(x, y);
                }

                this.ctx.stroke();

                if (cell.visited) {
                    this.ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
                    this.ctx.fillRect(x, y, this.cellSize, this.cellSize);
                }
            }
        }
    }
}

// Create maze instance
const maze = new Maze(canvas);

// Update drawMaze function
function drawMaze() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (rotationState.clockwise) {
        player.rotateClockwise();
    }
    if (rotationState.counterClockwise) {
        player.rotateCounterClockwise();
    }
    
    maze.draw();
    player.draw();
    
    bullets.forEach(bullet => {
        bullet.draw();
        bullet.update();
    });
    
    animationId = requestAnimationFrame(drawMaze);
}

// Initialize game objects
player = new Player();
bullets.length = 0;
drawMaze();

// Update exports
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Player,
        Cell,
        Bullet,
        Settings,
        Maze
    };
}

// Update canvas size using Config
if (typeof document !== 'undefined') {
    canvas.width = Config.CANVAS_WIDTH;
    canvas.height = Config.CANVAS_HEIGHT;
} 
