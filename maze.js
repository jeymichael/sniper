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

// Add after the Cell class
class Bullet {
    constructor() {
        // Start at the middle of the entrance (top of first cell)
        this.x = cellSize / 2;
        this.y = 0;
        this.radius = 4;
        
        // Possible angles: 30, 45, or 60 degrees (converted to radians)
        const possibleAngles = [Math.PI/6, Math.PI/4, Math.PI/3]; // 30°, 45°, 60°
        const randomAngle = possibleAngles[Math.floor(Math.random() * possibleAngles.length)];
        
        // Randomly choose left or right direction
        this.direction = Math.random() < 0.5 ? randomAngle : (Math.PI - randomAngle);
        
        this.speed = 2;
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
let bullet = new Bullet();
let animationId;

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

// Create entrance and exit
function createEntranceAndExit() {
    // Create entrance at top-left
    grid[0][0].walls.top = false;
    
    // Create exit at bottom-right
    grid[rows-1][cols-1].walls.bottom = false;
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
    
    // Draw and update bullet
    bullet.draw();
    bullet.update();
    
    // Continue animation
    animationId = requestAnimationFrame(drawMaze);
}

// Initialize and generate the maze
setupGrid();
generateMaze();
createEntranceAndExit();
drawMaze();

// Add reset functionality when bullet exits maze
function checkBulletExit() {
    if (bullet.y > canvas.height) {
        // Reset bullet if it exits through bottom
        bullet = new Bullet();
    }
}

// Add event listener for resetting the bullet
document.addEventListener('keypress', (e) => {
    if (e.key === 'r' || e.key === 'R') {
        bullet = new Bullet();
    }
}); 