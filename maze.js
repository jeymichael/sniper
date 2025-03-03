const canvas = document.getElementById('mazeCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size
canvas.width = 400;
canvas.height = 400;

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

// Add this class after the Cell class and before the Bullet class
class Settings {
    constructor() {
        this.bulletRadius = 3;
        this.bulletSpeed = 2;
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
    constructor(useDirection = null) {
        // Start at the middle of the entrance (bottom of last cell)
        this.x = canvas.width - cellSize/2; // Right-most cell
        this.y = canvas.height;  // Bottom of maze
        
        // Get settings from singleton
        const settings = Settings.getInstance();
        this.radius = settings.bulletRadius;
        this.speed = settings.bulletSpeed;
        
        if (useDirection === null) {
            // Generate new direction only for the first bullet
            // Change angles to point upward (-30°, -45°, or -60° from vertical)
            const possibleAngles = [-5*Math.PI/6, -3*Math.PI/4, -2*Math.PI/3];
            const randomAngle = possibleAngles[Math.floor(Math.random() * possibleAngles.length)];
            this.direction = Math.random() < 0.5 ? randomAngle : (Math.PI - randomAngle);
        } else {
            this.direction = useDirection;
        }
        
        this.dx = Math.cos(this.direction) * this.speed;
        this.dy = Math.sin(this.direction) * this.speed;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'red';
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
}

// Add after other global variables at the top
let bullets = [];
const BULLET_SPACING = 25;
const MAX_BULLETS = 100;
let animationId;
let firstBulletDirection; // Store the direction of the first bullet

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
    const firstBullet = new Bullet();
    firstBulletDirection = firstBullet.direction;
    bullets.push(firstBullet);
}

// Check if new bullet should be created
function checkBulletCreation() {
    if (bullets.length < MAX_BULLETS) {
        const lastBullet = bullets[bullets.length - 1];
        if ((canvas.height - lastBullet.y) >= BULLET_SPACING) {
            const newBullet = new Bullet(firstBulletDirection);
            bullets.push(newBullet);
        }
    }
}

// Draw the entire maze
function drawMaze() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw maze
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            grid[row][col].draw();
        }
    }
    
    // Draw and update all bullets
    bullets.forEach(bullet => {
        bullet.draw();
        bullet.update();
    });
    
    // Continue animation
    animationId = requestAnimationFrame(drawMaze);
}

// Modify the checkBulletExit function to check for top exit instead of bottom
function checkBulletExit() {
    bullets.forEach((bullet, index) => {
        if (bullet.y < 0) {  // Check if bullet has gone above the top
            // Reset bullet if it exits through top
            const newBullet = new Bullet(firstBulletDirection);
            bullets[index] = newBullet;
        }
    });
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

// Replace the initialization lines with:
setupGrid();
generateMaze();
createEntranceAndExit();
bullets = []; // Start with empty array
drawMaze();

// Add this to check for bullet exits in the animation loop
setInterval(checkBulletExit, 100);

// Add new function to fire bullet
function fireBullet() {
    if (bullets.length < MAX_BULLETS) {
        if (bullets.length === 0) {
            // First bullet - create with new random direction
            const firstBullet = new Bullet();
            firstBulletDirection = firstBullet.direction;
            bullets.push(firstBullet);
        } else {
            // Following bullets - use same direction as first
            const newBullet = new Bullet(firstBulletDirection);
            bullets.push(newBullet);
        }
    }
} 