const canvas = document.getElementById('mazeCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size
canvas.width = 200;
canvas.height = 200;

// Maze configuration
const cellSize = 20;
const rows = Math.floor(canvas.height / cellSize);
const cols = Math.floor(canvas.width / cellSize);
const grid = [];

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
        const x = this.col * cellSize;
        const y = this.row * cellSize;

        ctx.strokeStyle = '#000';
        ctx.beginPath();

        // Draw walls
        if (this.walls.top) {
            ctx.moveTo(x, y);
            ctx.lineTo(x + cellSize, y);
        }
        if (this.walls.right) {
            ctx.moveTo(x + cellSize, y);
            ctx.lineTo(x + cellSize, y + cellSize);
        }
        if (this.walls.bottom) {
            ctx.moveTo(x + cellSize, y + cellSize);
            ctx.lineTo(x, y + cellSize);
        }
        if (this.walls.left) {
            ctx.moveTo(x, y + cellSize);
            ctx.lineTo(x, y);
        }

        ctx.stroke();

        // Color visited cells
        if (this.visited) {
            ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
            ctx.fillRect(x, y, cellSize, cellSize);
        }
    }
}

// Modify the Settings class
class Settings {
    constructor() {
        this.bulletRadius = 3;
        this.bulletSpeed = 2;
        this.playerRadius = 5;  // Add player radius
        this.playerSpeed = 5;   // Add player speed
        this.bulletLifetime = 10000; // 10 seconds in milliseconds
        this.bulletFadeSteps = 4;   // Number of color steps before disappearing
        this.rotationSpeed = Math.PI/32; // Amount to rotate per key press (about 5.625 degrees)
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

    // Check collision with walls
    checkCollision() {
        // Get current cell position
        const col = Math.floor(this.x / cellSize);
        const row = Math.floor(this.y / cellSize);

        // Check if bullet is within maze bounds
        if (row < 0 || row >= rows || col < 0 || col >= cols) {
            return;
        }

        const cell = grid[row][col];
        const relativeX = this.x % cellSize;
        const relativeY = this.y % cellSize;

        // Check collision with walls
        if (cell.walls.top && relativeY <= this.radius) {
            this.dy = Math.abs(this.dy); // Bounce down
        }
        if (cell.walls.bottom && relativeY >= cellSize - this.radius) {
            this.dy = -Math.abs(this.dy); // Bounce up
        }
        if (cell.walls.left && relativeX <= this.radius) {
            this.dx = Math.abs(this.dx); // Bounce right
        }
        if (cell.walls.right && relativeX >= cellSize - this.radius) {
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

// Add after other global variables at the top
let bullets = [];
const BULLET_SPACING = 25;
const MAX_BULLETS = 100;
let animationId;

// Add to global variables at the top
let rotationState = {
    clockwise: false,
    counterClockwise: false
};

// Modify the Player class
class Player {
    constructor() {
        // Start at the center of entrance cell (bottom-right)
        this.x = canvas.width - cellSize/2;
        this.y = canvas.height - cellSize/2;
        
        // Get settings from singleton
        const settings = Settings.getInstance();
        this.radius = settings.playerRadius;
        this.moveSpeed = settings.playerSpeed;
        this.color = '#00ff00';
        this.arrowLength = this.radius * 1.5; // Length of direction indicator
        this.direction = -3*Math.PI/4; // Initial direction (-45 degrees)
    }

    draw() {
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
                col: Math.floor(bounds.left / cellSize),
                row: Math.floor(bounds.top / cellSize)
            },
            topRight: {
                col: Math.floor(bounds.right / cellSize),
                row: Math.floor(bounds.top / cellSize)
            },
            bottomLeft: {
                col: Math.floor(bounds.left / cellSize),
                row: Math.floor(bounds.bottom / cellSize)
            },
            bottomRight: {
                col: Math.floor(bounds.right / cellSize),
                row: Math.floor(bounds.bottom / cellSize)
            }
        };

        // Check if any part of the player would be outside the maze
        if (bounds.left < 0 || bounds.right > canvas.width ||
            bounds.top < 0 || bounds.bottom > canvas.height) {
            return false;
        }

        // Check each cell the player's circle intersects with
        for (const cell of Object.values(cells)) {
            // Skip if cell coordinates are outside the grid
            if (cell.row < 0 || cell.row >= rows || cell.col < 0 || cell.col >= cols) {
                continue;
            }

            const currentCell = grid[cell.row][cell.col];
            const relativeX = newX - (cell.col * cellSize);
            const relativeY = newY - (cell.row * cellSize);

            // Check collision with walls
            if (currentCell.walls.top && 
                Math.abs(relativeY - 0) <= this.radius) {
                return false;
            }
            if (currentCell.walls.bottom && 
                Math.abs(relativeY - cellSize) <= this.radius) {
                return false;
            }
            if (currentCell.walls.left && 
                Math.abs(relativeX - 0) <= this.radius) {
                return false;
            }
            if (currentCell.walls.right && 
                Math.abs(relativeX - cellSize) <= this.radius) {
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
}

// Add to global variables
let player = new Player();

// Initialize grid
function setupGrid() {
    for (let row = 0; row < rows; row++) {
        grid[row] = [];
        for (let col = 0; col < cols; col++) {
            grid[row][col] = new Cell(row, col);
        }
    }
}

// Generate maze using recursive backtracking
function generateMaze(row = 0, col = 0) {
    const current = grid[row][col];
    current.visited = true;

    const directions = [
        ['top', -1, 0],
        ['right', 0, 1],
        ['bottom', 1, 0],
        ['left', 0, -1]
    ];

    // Shuffle directions for randomness
    directions.sort(() => Math.random() - 0.5);

    for (const [wall, rowOffset, colOffset] of directions) {
        const newRow = row + rowOffset;
        const newCol = col + colOffset;

        if (newRow >= 0 && newRow < rows && newCol >= 0 && newCol < cols) {
            const neighbor = grid[newRow][newCol];
            if (!neighbor.visited) {
                // Remove walls between current cell and neighbor
                current.walls[wall] = false;
                neighbor.walls[getOppositeWall(wall)] = false;
                generateMaze(newRow, newCol);
            }
        }
    }
}

function getOppositeWall(wall) {
    const opposites = {
        'top': 'bottom',
        'right': 'left',
        'bottom': 'top',
        'left': 'right'
    };
    return opposites[wall];
}

// Modify the createEntranceAndExit function
function createEntranceAndExit() {
    // Create entrance at bottom-right
    grid[rows-1][cols-1].walls.bottom = false;
    
    // Create exit at top-left
    grid[0][0].walls.top = false;
}

// Initialize first bullet
function initializeFirstBullet() {
    bullets = [];
    const firstBullet = new Bullet(player.x, player.y, player.direction);
    bullets.push(firstBullet);
}

// Check if new bullet should be created
function checkBulletCreation() {
    if (bullets.length < MAX_BULLETS) {
        const lastBullet = bullets[bullets.length - 1];
        if ((canvas.height - lastBullet.y) >= BULLET_SPACING) {
            const newBullet = new Bullet(player.x, player.y, player.direction);
            bullets.push(newBullet);
        }
    }
}

// Modify the drawMaze function to include rotation updates
function drawMaze() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Update player rotation if shift is held
    if (rotationState.clockwise) {
        player.rotateClockwise();
    }
    if (rotationState.counterClockwise) {
        player.rotateCounterClockwise();
    }
    
    // Draw maze
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            grid[row][col].draw();
        }
    }
    
    // Draw player
    player.draw();
    
    // Draw and update all bullets
    bullets.forEach(bullet => {
        bullet.draw();
        bullet.update();
    });
    
    // Continue animation
    animationId = requestAnimationFrame(drawMaze);
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

// Modify the keypress event listener
document.addEventListener('keypress', (e) => {
    if (e.key === 'r' || e.key === 'R') {
        initializeFirstBullet();
    }
});

// Modify the keydown event listener to include spacebar and handle Shift keys
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

// Add keyup event listener to stop rotation
document.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') {
        if (e.location === KeyboardEvent.DOM_KEY_LOCATION_LEFT) {
            rotationState.counterClockwise = false;
        } else if (e.location === KeyboardEvent.DOM_KEY_LOCATION_RIGHT) {
            rotationState.clockwise = false;
        }
    }
});

// Replace the initialization lines with:
setupGrid();
generateMaze();
createEntranceAndExit();
player = new Player(); // Initialize player
bullets = [];
drawMaze();

// Add this to check for bullet exits in the animation loop
setInterval(checkBulletExit, 100);

// Modify the fireBullet function to always use player's current direction
function fireBullet() {
    if (bullets.length < MAX_BULLETS) {
        // Always use player's current direction for new bullets
        const newBullet = new Bullet(player.x, player.y, player.direction);
        bullets.push(newBullet);
    }
} 