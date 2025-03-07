// Add Config class at the top of the file
class Config {
    static get CELL_SIZE() { return 30; }
    static get BULLET_SPACING() { return 25; }
    static get MAX_BULLETS() { return 100; }
    static get CANVAS_WIDTH() { return 300; }
    static get CANVAS_HEIGHT() { return 300; }
    static get ROWS() { return Math.floor(this.CANVAS_HEIGHT / this.CELL_SIZE); }
    static get COLS() { return Math.floor(this.CANVAS_WIDTH / this.CELL_SIZE); }
    
    // Add bug-related constants
    static get BUG_SPAWN_TIME() { return 5000; }  // 5 seconds in milliseconds
    static get BUG_RADIUS() { return 3; }
    static get BUG_SPEED() { return 1; }
    static get POINTS_PER_BUG() { return 10; }
    static get BUG_KILL_SOUND() {
        if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') {
            // Return mock sound object for test environment
            return {
                play: function() {
                    // Do nothing in test environment
                }
            };
        }
        
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        return {
            play: function() {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.type = 'sine';
                oscillator.frequency.value = 800;
                gainNode.gain.value = 0.1;
                
                oscillator.start();
                setTimeout(() => oscillator.stop(), 100);
            }
        };
    }

    static get EXIT_SOUND() {
        if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') {
            // Return mock sound object for test environment
            return {
                play: function() {
                    // Do nothing in test environment
                }
            };
        }

        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        return {
            play: function() {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.type = 'sine';
                oscillator.frequency.value = 440;
                gainNode.gain.value = 0.2;
                
                oscillator.start();
                oscillator.frequency.linearRampToValueAtTime(
                    880,
                    audioContext.currentTime + 0.5
                );
                setTimeout(() => oscillator.stop(), 500);
            }
        };
    }
}

const canvas = document.getElementById('mazeCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size
canvas.width = Config.CANVAS_WIDTH;
canvas.height = Config.CANVAS_HEIGHT;
let animationId;


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
    constructor(startX, startY, direction, maze) {
        this.x = startX;
        this.y = startY;
        this.maze = maze;
        
        const settings = Settings.getInstance();
        this.radius = settings.bulletRadius;
        this.speed = settings.bulletSpeed;
        
        this.direction = direction;
        this.dx = Math.cos(this.direction) * this.speed;
        this.dy = Math.sin(this.direction) * this.speed;

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

    checkCollision() {
        const col = Math.floor(this.x / this.maze.cellSize);
        const row = Math.floor(this.y / this.maze.cellSize);

        if (!this.maze.isInBounds(row, col)) {
            return;
        }

        const cell = this.maze.grid[row][col];
        const relativeX = this.x % this.maze.cellSize;
        const relativeY = this.y % this.maze.cellSize;

        if (cell.walls.top && relativeY <= this.radius) {
            this.dy = Math.abs(this.dy);
        }
        if (cell.walls.bottom && relativeY >= this.maze.cellSize - this.radius) {
            this.dy = -Math.abs(this.dy);
        }
        if (cell.walls.left && relativeX <= this.radius) {
            this.dx = Math.abs(this.dx);
        }
        if (cell.walls.right && relativeX >= this.maze.cellSize - this.radius) {
            this.dx = -Math.abs(this.dx);
        }
    }

    update() {
        this.checkCollision();
        this.x += this.dx;
        this.y += this.dy;
    }

    isDead() {
        return Date.now() - this.birthTime > this.settings.bulletLifetime;
    }
}

// Modify the Player class
class Player {
    constructor(maze) {
        this.maze = maze;
        
        // Start at the center of entrance cell (bottom-right)
        this.x = this.maze.canvas.width - this.maze.cellSize/2;
        this.y = this.maze.canvas.height - this.maze.cellSize/2;
        
        // Get settings from singleton
        const settings = Settings.getInstance();
        this.radius = settings.playerRadius;
        this.moveSpeed = settings.playerSpeed;
        this.color = '#00ff00';
        this.arrowLength = this.radius * 1.5;
        this.direction = -3*Math.PI/4;
        this.hasExited = false;
        this.isRemoved = false;
        this.exitSound = Config.EXIT_SOUND;
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
        if (this.hasExited) {
            return true;
        }

        // Check if player is at exit (top-left)
        if (this.y <= this.maze.cellSize && this.x <= this.maze.cellSize) {
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
                col: Math.floor(bounds.left / this.maze.cellSize),
                row: Math.floor(bounds.top / this.maze.cellSize)
            },
            topRight: {
                col: Math.floor(bounds.right / this.maze.cellSize),
                row: Math.floor(bounds.top / this.maze.cellSize)
            },
            bottomLeft: {
                col: Math.floor(bounds.left / this.maze.cellSize),
                row: Math.floor(bounds.bottom / this.maze.cellSize)
            },
            bottomRight: {
                col: Math.floor(bounds.right / this.maze.cellSize),
                row: Math.floor(bounds.bottom / this.maze.cellSize)
            }
        };

        // Check if any part of the player would be outside the maze
        if (bounds.left < 0 || bounds.right > this.maze.canvas.width ||
            bounds.top < 0 || bounds.bottom > this.maze.canvas.height) {
            return false;
        }

        // Check each cell the player's circle intersects with
        for (const cell of Object.values(cells)) {
            if (!this.maze.isInBounds(cell.row, cell.col)) {
                continue;
            }

            const currentCell = this.maze.grid[cell.row][cell.col];
            const relativeX = newX - (cell.col * this.maze.cellSize);
            const relativeY = newY - (cell.row * this.maze.cellSize);

            if (currentCell.walls.top && 
                Math.abs(relativeY - 0) <= this.radius) {
                return false;
            }
            if (currentCell.walls.bottom && 
                Math.abs(relativeY - this.maze.cellSize) <= this.radius) {
                return false;
            }
            if (currentCell.walls.left && 
                Math.abs(relativeX - 0) <= this.radius) {
                return false;
            }
            if (currentCell.walls.right && 
                Math.abs(relativeX - this.maze.cellSize) <= this.radius) {
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
        try {
            this.exitSound.play();
            // Remove player after sound starts
            this.isRemoved = true;
        } catch (e) {
            console.log('Exit sound play failed:', e);
            this.isRemoved = true;
        }
    }
}

// Modify the adjustSpeed function
function adjustSpeed(newSpeed) {
    gameBoard.adjustSpeed(newSpeed);
}

// Modify the adjustRadius function
function adjustRadius(newRadius) {
    gameBoard.adjustRadius(newRadius);
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


class Bug {
    constructor(x, y, maze) {
        this.x = x;
        this.y = y;
        this.maze = maze;
        this.radius = Config.BUG_RADIUS;  // Use Config
        this.speed = Config.BUG_SPEED;    // Use Config
        this.direction = Math.random() * Math.PI * 2;
        this.dx = Math.cos(this.direction) * this.speed;
        this.dy = Math.sin(this.direction) * this.speed;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'purple';
        ctx.fill();
        ctx.closePath();
    }

    update() {
        // Check wall collision and update direction
        const col = Math.floor(this.x / this.maze.cellSize);
        const row = Math.floor(this.y / this.maze.cellSize);

        if (this.maze.isInBounds(row, col)) {
            const cell = this.maze.grid[row][col];
            const relativeX = this.x % this.maze.cellSize;
            const relativeY = this.y % this.maze.cellSize;

            if (cell.walls.top && relativeY <= this.radius) {
                this.dy = Math.abs(this.dy);
                this.direction = Math.random() * Math.PI; // New random direction
            }
            if (cell.walls.bottom && relativeY >= this.maze.cellSize - this.radius) {
                this.dy = -Math.abs(this.dy);
                this.direction = Math.random() * Math.PI;
            }
            if (cell.walls.left && relativeX <= this.radius) {
                this.dx = Math.abs(this.dx);
                this.direction = Math.random() * Math.PI;
            }
            if (cell.walls.right && relativeX >= this.maze.cellSize - this.radius) {
                this.dx = -Math.abs(this.dx);
                this.direction = Math.random() * Math.PI;
            }
        }

        // Update position
        this.x += this.dx;
        this.y += this.dy;
    }
}

class BugNest {
    constructor(maze) {
        this.maze = maze;
        this.bugs = [];
        this.lastSpawnTime = Date.now();
        
        // Find random position (not at entrance)
        do {
            const row = Math.floor(Math.random() * maze.rows);
            const col = Math.floor(Math.random() * maze.cols);
            if (row !== maze.rows - 1 || col !== maze.cols - 1) {
                this.x = col * maze.cellSize + maze.cellSize / 2;
                this.y = row * maze.cellSize + maze.cellSize / 2;
                break;
            }
        } while (true);
    }

    draw(ctx) {
        // Draw nest
        ctx.beginPath();
        ctx.arc(this.x, this.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = 'brown';
        ctx.fill();
        ctx.closePath();

        // Draw bugs
        this.bugs.forEach(bug => bug.draw(ctx));
    }

    update() {
        // Use Config.BUG_SPAWN_TIME
        const currentTime = Date.now();
        if (currentTime - this.lastSpawnTime >= Config.BUG_SPAWN_TIME) {
            this.bugs.push(new Bug(this.x, this.y, this.maze));
            this.lastSpawnTime = currentTime;
        }

        this.bugs.forEach(bug => bug.update());
    }
} 

class GameBoard {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.maze = new Maze(canvas);
        this.player = new Player(this.maze);
        this.bullets = [];
        this.bugNest = new BugNest(this.maze);  // Add bugNest
        this.rotationState = {
            clockwise: false,
            counterClockwise: false
        };
        this.score = 0;
        this.bugKillSound = Config.BUG_KILL_SOUND;
    }

    fireBullet() {
        if (this.bullets.length < Config.MAX_BULLETS) {
            const newBullet = new Bullet(
                this.player.x, 
                this.player.y, 
                this.player.direction,
                this.maze
            );
            this.bullets.push(newBullet);
        }
    }

    initializeFirstBullet() {
        this.bullets = [];
        const firstBullet = new Bullet(
            this.player.x, 
            this.player.y, 
            this.player.direction,
            this.maze
        );
        this.bullets.push(firstBullet);
    }

    checkBulletCreation() {
        if (this.bullets.length < Config.MAX_BULLETS) {
            const lastBullet = this.bullets[this.bullets.length - 1];
            if ((this.canvas.height - lastBullet.y) >= Config.BULLET_SPACING) {
                const newBullet = new Bullet(
                    this.player.x, 
                    this.player.y, 
                    this.player.direction,
                    this.maze
                );
                this.bullets.push(newBullet);
            }
        }
    }

    checkBulletExit() {
        this.bullets = this.bullets.filter(bullet => 
            bullet.y >= 0 && !bullet.isDead()
        );
    }

    playBugKillSound() {
        try {
            this.bugKillSound.play();
        } catch (e) {
            console.log('Sound play failed:', e);
        }
    }

    checkBulletBugCollisions() {
        for (let bullet of this.bullets) {
            const initialBugCount = this.bugNest.bugs.length;
            
            this.bugNest.bugs = this.bugNest.bugs.filter(bug => {
                const dx = bullet.x - bug.x;
                const dy = bullet.y - bug.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                return distance > (bullet.radius + bug.radius);
            });

            // Play sound and add points for each bug killed
            const bugsKilled = initialBugCount - this.bugNest.bugs.length;
            if (bugsKilled > 0) {
                this.playBugKillSound();
                this.score += bugsKilled * Config.POINTS_PER_BUG;
            }
        }
    }

    update() {
        if (this.rotationState.clockwise) {
            this.player.rotateClockwise();
        }
        if (this.rotationState.counterClockwise) {
            this.player.rotateCounterClockwise();
        }

        this.bullets.forEach(bullet => {
            bullet.update();
        });

        this.bugNest.update();
        this.checkBulletExit();
        this.checkBulletBugCollisions();  // Add collision check
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.maze.draw();
        this.bugNest.draw(this.ctx);
        this.player.draw();
        
        this.bullets.forEach(bullet => {
            bullet.draw();
        });

        // Draw score only if not in test environment
        if (typeof document !== 'undefined') {
            this.ctx.fillStyle = 'black';
            this.ctx.font = '16px Arial';
            this.ctx.fillText(`Score: ${this.score}`, 10, 20);
        }
    }

    adjustSpeed(newSpeed) {
        newSpeed = Math.max(0.5, Math.min(5, Number(newSpeed)));
        Settings.getInstance().bulletSpeed = newSpeed;
        
        this.bullets.forEach(bullet => {
            bullet.speed = newSpeed;
            const angle = Math.atan2(bullet.dy, bullet.dx);
            bullet.dx = Math.cos(angle) * newSpeed;
            bullet.dy = Math.sin(angle) * newSpeed;
        });
        
        if (typeof document !== 'undefined') {
            document.getElementById('speedValue').textContent = newSpeed.toFixed(1);
        }
    }

    adjustRadius(newRadius) {
        newRadius = Math.max(2, Math.min(8, Number(newRadius)));
        Settings.getInstance().bulletRadius = newRadius;
        
        this.bullets.forEach(bullet => {
            bullet.radius = newRadius;
        });
        
        if (typeof document !== 'undefined') {
            document.getElementById('radiusValue').textContent = newRadius.toFixed(0);
        }
    }
}

// Update initialization code
const gameBoard = new GameBoard(canvas);

// Update drawMaze function to use GameBoard
function drawMaze() {
    gameBoard.update();
    gameBoard.draw();
    animationId = requestAnimationFrame(drawMaze);
}

// Update event listeners to use GameBoard
if (typeof document !== 'undefined') {
    document.addEventListener('keypress', (e) => {
        if (e.key === 'r' || e.key === 'R') {
            gameBoard.initializeFirstBullet();
        }
    });

    document.addEventListener('keydown', (e) => {
        switch(e.key) {
            case 'ArrowUp':
                gameBoard.player.move(0, -1);
                break;
            case 'ArrowDown':
                gameBoard.player.move(0, 1);
                break;
            case 'ArrowLeft':
                gameBoard.player.move(-1, 0);
                break;
            case 'ArrowRight':
                gameBoard.player.move(1, 0);
                break;
            case ' ': // Spacebar
                gameBoard.fireBullet();
                break;
            case 'Shift':
                if (e.location === KeyboardEvent.DOM_KEY_LOCATION_LEFT) {
                    gameBoard.rotationState.counterClockwise = true;
                } else if (e.location === KeyboardEvent.DOM_KEY_LOCATION_RIGHT) {
                    gameBoard.rotationState.clockwise = true;
                }
                break;
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === 'Shift') {
            if (e.location === KeyboardEvent.DOM_KEY_LOCATION_LEFT) {
                gameBoard.rotationState.counterClockwise = false;
            } else if (e.location === KeyboardEvent.DOM_KEY_LOCATION_RIGHT) {
                gameBoard.rotationState.clockwise = false;
            }
        }
    });
}

// Start the game
drawMaze(); 
