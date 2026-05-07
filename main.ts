/**
 * Xonix Web Game - Полная реализация
 * Включает все шаги: базовая структура, игрок, враги, алгоритм захвата, UI
 */

// ============================================
// КОНСТАНТЫ И НАСТРОЙКИ
// ============================================

const CONFIG = {
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 600,
    GRID_SIZE: 4,
    TARGET_CAPTURE_PERCENT: 80,
    PLAYER_SPEED: 1,
    ENEMY_SPEED: 0.5,
    DIFFICULTY: {
        EASY: { enemies: 2, speed: 0.4 },
        MEDIUM: { enemies: 4, speed: 0.6 },
        HARD: { enemies: 6, speed: 0.8 }
    }
};

const GRID_WIDTH = Math.floor(CONFIG.CANVAS_WIDTH / CONFIG.GRID_SIZE);
const GRID_HEIGHT = Math.floor(CONFIG.CANVAS_HEIGHT / CONFIG.GRID_SIZE);

// ============================================
// ТИПЫ
// ============================================

enum GameState {
    MENU = 'MENU',
    PLAYING = 'PLAYING',
    PAUSED = 'PAUSED',
    GAME_OVER = 'GAME_OVER',
    VICTORY = 'VICTORY'
}

enum CellType {
    EMPTY = 0,
    CAPTURED = 1,
    TRAIL = 2
}

enum Direction {
    UP = 'UP',
    DOWN = 'DOWN',
    LEFT = 'LEFT',
    RIGHT = 'RIGHT',
    NONE = 'NONE'
}

interface Position {
    x: number;
    y: number;
}

// ============================================
// КЛАССЫ
// ============================================

class Player {
    private pos: Position;
    private direction: Direction = Direction.RIGHT;
    private nextDirection: Direction = Direction.RIGHT;
    private isDrawing: boolean = false;
    private trail: Position[] = [];

    constructor(startX: number, startY: number) {
        this.pos = { x: startX, y: startY };
    }

    getPosition(): Position {
        return { ...this.pos };
    }

    getDirection(): Direction {
        return this.direction;
    }

    setDirection(dir: Direction): void {
        // Запрещаем разворот на 180 градусов
        if ((dir === Direction.UP && this.direction === Direction.DOWN) ||
            (dir === Direction.DOWN && this.direction === Direction.UP) ||
            (dir === Direction.LEFT && this.direction === Direction.RIGHT) ||
            (dir === Direction.RIGHT && this.direction === Direction.LEFT)) {
            return;
        }
        this.nextDirection = dir;
    }

    move(grid: CellType[][]): boolean {
        this.direction = this.nextDirection;
        
        let newX = this.pos.x;
        let newY = this.pos.y;

        switch (this.direction) {
            case Direction.UP: newY--; break;
            case Direction.DOWN: newY++; break;
            case Direction.LEFT: newX--; break;
            case Direction.RIGHT: newX++; break;
        }

        // Проверка границ
        if (newX < 0 || newX >= GRID_WIDTH || newY < 0 || newY >= GRID_HEIGHT) {
            return false;
        }

        const targetCell = grid[newY][newX];
        
        // Если были на захваченной территории и переходим в пустую - начинаем рисовать
        const currentCell = grid[this.pos.y][this.pos.x];
        if (currentCell === CellType.CAPTURED && targetCell === CellType.EMPTY) {
            this.isDrawing = true;
            this.trail = [{ x: this.pos.x, y: this.pos.y }];
        }

        // Если рисуем линию
        if (this.isDrawing) {
            // Проверка на столкновение с собственной линией
            for (const t of this.trail) {
                if (t.x === newX && t.y === newY) {
                    return false; // Столкновение с хвостом
                }
            }
            
            this.trail.push({ x: newX, y: newY });
            grid[newY][newX] = CellType.TRAIL;
        } else {
            // Движение по захваченной территории
            if (targetCell !== CellType.CAPTURED) {
                return false;
            }
        }

        this.pos = { x: newX, y: newY };

        // Проверка возврата на захваченную территорию
        if (this.isDrawing && targetCell === CellType.CAPTURED) {
            this.isDrawing = false;
            return true; // Сигнал для захвата территории
        }

        return this.isDrawing;
    }

    getTrail(): Position[] {
        return [...this.trail];
    }

    isCurrentlyDrawing(): boolean {
        return this.isDrawing;
    }

    resetTrail(): void {
        this.trail = [];
        this.isDrawing = false;
    }
}

class Enemy {
    private pos: Position;
    private velocity: Position;
    private speed: number;

    constructor(x: number, y: number, speed: number) {
        this.pos = { x, y };
        this.speed = speed;
        // Случайное направление
        const angle = Math.random() * Math.PI * 2;
        this.velocity = {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed
        };
    }

    getPosition(): Position {
        return { ...this.pos };
    }

    move(grid: CellType[][]): void {
        let newX = this.pos.x + this.velocity.x;
        let newY = this.pos.y + this.velocity.y;

        // Проверка границ экрана
        if (newX <= 0 || newX >= GRID_WIDTH - 1) {
            this.velocity.x *= -1;
            newX = this.pos.x + this.velocity.x;
        }
        if (newY <= 0 || newY >= GRID_HEIGHT - 1) {
            this.velocity.y *= -1;
            newY = this.pos.y + this.velocity.y;
        }

        // Проверка столкновения с захваченной территорией
        const gridX = Math.floor(newX);
        const gridY = Math.floor(newY);
        
        if (gridX >= 0 && gridX < GRID_WIDTH && gridY >= 0 && gridY < GRID_HEIGHT) {
            if (grid[gridY][gridX] === CellType.CAPTURED) {
                // Отскок
                this.velocity.x *= -1;
                this.velocity.y *= -1;
                newX = this.pos.x + this.velocity.x;
                newY = this.pos.y + this.velocity.y;
            }
        }

        this.pos = { x: newX, y: newY };
    }

    checkCollision(trail: Position[]): boolean {
        const enemyGridX = Math.floor(this.pos.x);
        const enemyGridY = Math.floor(this.pos.y);

        for (const t of trail) {
            if (t.x === enemyGridX && t.y === enemyGridY) {
                return true;
            }
        }
        return false;
    }

    checkHeadCollision(playerPos: Position): boolean {
        const enemyGridX = Math.floor(this.pos.x);
        const enemyGridY = Math.floor(this.pos.y);
        return enemyGridX === playerPos.x && enemyGridY === playerPos.y;
    }

    isInArea(x1: number, y1: number, x2: number, y2: number): boolean {
        const enemyGridX = Math.floor(this.pos.x);
        const enemyGridY = Math.floor(this.pos.y);
        return enemyGridX >= x1 && enemyGridX <= x2 && enemyGridY >= y1 && enemyGridY <= y2;
    }
}

class CaptureAlgorithm {
    static capture(grid: CellType[][], trail: Position[]): { captured: number, killedEnemies: number } {
        if (trail.length < 3) return { captured: 0, killedEnemies: 0 };

        // Находим bounding box трейла
        let minX = GRID_WIDTH, maxX = 0, minY = GRID_HEIGHT, maxY = 0;
        for (const t of trail) {
            minX = Math.min(minX, t.x);
            maxX = Math.max(maxX, t.x);
            minY = Math.min(minY, t.y);
            maxY = Math.max(maxY, t.y);
        }

        // Очищаем трейл из сетки
        for (const t of trail) {
            grid[t.y][t.x] = CellType.EMPTY;
        }

        // Используем Flood Fill для определения области
        // Проверяем область внутри контура (начиная с первой точки трейла + 1)
        const startNode = trail[0];
        
        // Определяем, какая область меньше - та и захватывается
        // Для простоты: проверяем область "снаружи" от трейла
        // Захатываем ту область, которая НЕ содержит основную массу свободных клеток
        
        const visited = new Set<string>();
        const areaToCapture: Position[] = [];
        
        // BFS для поиска области внутри контура
        const queue: Position[] = [];
        
        // Начинаем с клетки рядом с трейлом
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const nx = startNode.x + dx;
                const ny = startNode.y + dy;
                if (nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < GRID_HEIGHT) {
                    if (grid[ny][nx] === CellType.EMPTY) {
                        queue.push({ x: nx, y: ny });
                        visited.add(`${nx},${ny}`);
                        break;
                    }
                }
            }
            if (queue.length > 0) break;
        }

        while (queue.length > 0) {
            const current = queue.shift()!;
            areaToCapture.push(current);

            const neighbors = [
                { x: current.x + 1, y: current.y },
                { x: current.x - 1, y: current.y },
                { x: current.x, y: current.y + 1 },
                { x: current.x, y: current.y - 1 }
            ];

            for (const n of neighbors) {
                if (n.x < 0 || n.x >= GRID_WIDTH || n.y < 0 || n.y >= GRID_HEIGHT) continue;
                
                const key = `${n.x},${n.y}`;
                if (visited.has(key)) continue;
                
                // Проверяем, является ли клетка частью границы (трейл или захваченная)
                const isTrail = trail.some(t => t.x === n.x && t.y === n.y);
                if (isTrail || grid[n.y][n.x] === CellType.CAPTURED) continue;
                
                visited.add(key);
                queue.push(n);
            }
        }

        // Простая эвристика: если область маленькая (< 50% поля), захватываем её
        const totalEmpty = GRID_WIDTH * GRID_HEIGHT / 2; // Примерно половина поля пустая
        if (areaToCapture.length < totalEmpty * 0.5 && areaToCapture.length > 0) {
            // Захватываем эту область
            for (const cell of areaToCapture) {
                grid[cell.y][cell.x] = CellType.CAPTURED;
            }
            return { captured: areaToCapture.length, killedEnemies: 0 };
        }

        return { captured: 0, killedEnemies: 0 };
    }
}

class Renderer {
    private ctx: CanvasRenderingContext2D;

    constructor(ctx: CanvasRenderingContext2D) {
        this.ctx = ctx;
    }

    render(grid: CellType[][], player: Player, enemies: Enemy[], score: number, percent: number): void {
        // Очистка
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        // Отрисовка сетки
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                const px = x * CONFIG.GRID_SIZE;
                const py = y * CONFIG.GRID_SIZE;

                switch (grid[y][x]) {
                    case CellType.CAPTURED:
                        this.ctx.fillStyle = '#4a4a6a';
                        this.ctx.fillRect(px, py, CONFIG.GRID_SIZE, CONFIG.GRID_SIZE);
                        break;
                    case CellType.TRAIL:
                        this.ctx.fillStyle = '#00ff00';
                        this.ctx.fillRect(px, py, CONFIG.GRID_SIZE, CONFIG.GRID_SIZE);
                        break;
                }
            }
        }

        // Отрисовка игрока
        const playerPos = player.getPosition();
        this.ctx.fillStyle = '#ffff00';
        this.ctx.beginPath();
        this.ctx.arc(
            playerPos.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2,
            playerPos.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2,
            CONFIG.GRID_SIZE,
            0,
            Math.PI * 2
        );
        this.ctx.fill();

        // Отрисовка врагов
        for (const enemy of enemies) {
            const pos = enemy.getPosition();
            this.ctx.fillStyle = '#ff0000';
            this.ctx.beginPath();
            this.ctx.arc(
                pos.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2,
                pos.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2,
                CONFIG.GRID_SIZE,
                0,
                Math.PI * 2
            );
            this.ctx.fill();
        }

        // HUD
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '16px Courier New';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Захват: ${percent.toFixed(1)}%`, 10, 25);
        this.ctx.fillText(`Цель: ${CONFIG.TARGET_CAPTURE_PERCENT}%`, 10, 45);
    }

    renderGameOver(): void {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
        
        this.ctx.fillStyle = '#ff0000';
        this.ctx.font = '48px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('GAME OVER', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2);
    }

    renderVictory(): void {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
        
        this.ctx.fillStyle = '#00ff00';
        this.ctx.font = '48px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('ПОБЕДА!', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2);
    }
}

class GameEngine {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private state: GameState = GameState.MENU;
    private grid: CellType[][] = [];
    private player: Player | null = null;
    private enemies: Enemy[] = [];
    private renderer: Renderer | null = null;
    private capturedCells: number = 0;
    private totalCells: number = GRID_WIDTH * GRID_HEIGHT;
    private enemySpeed: number = CONFIG.ENEMY_SPEED;

    constructor() {
        this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;
        
        this.canvas.width = CONFIG.CANVAS_WIDTH;
        this.canvas.height = CONFIG.CANVAS_HEIGHT;
        
        this.renderer = new Renderer(this.ctx);
        this.gameLoop = this.gameLoop.bind(this);
        
        this.initGrid();
        requestAnimationFrame(this.gameLoop);
    }

    private initGrid(): void {
        this.grid = [];
        for (let y = 0; y < GRID_HEIGHT; y++) {
            const row: CellType[] = [];
            for (let x = 0; x < GRID_WIDTH; x++) {
                // Создаем границу из захваченной территории
                if (y === 0 || y === GRID_HEIGHT - 1 || x === 0 || x === GRID_WIDTH - 1) {
                    row.push(CellType.CAPTURED);
                    this.capturedCells++;
                } else {
                    row.push(CellType.EMPTY);
                }
            }
            this.grid.push(row);
        }
    }

    private startGame(difficulty: string): void {
        this.initGrid();
        this.capturedCells = this.grid.flat().filter(c => c === CellType.CAPTURED).length;
        
        // Спавн игрока на захваченной территории
        this.player = new Player(1, 1);
        
        // Настройка сложности
        const diffConfig = CONFIG.DIFFICULTY[difficulty as keyof typeof CONFIG.DIFFICULTY] || CONFIG.DIFFICULTY.MEDIUM;
        this.enemySpeed = diffConfig.speed;
        
        // Спавн врагов
        this.enemies = [];
        for (let i = 0; i < diffConfig.enemies; i++) {
            const ex = Math.floor(GRID_WIDTH / 2) + Math.floor(Math.random() * (GRID_WIDTH / 2 - 2)) + 1;
            const ey = Math.floor(GRID_HEIGHT / 2) + Math.floor(Math.random() * (GRID_HEIGHT / 2 - 2)) + 1;
            this.enemies.push(new Enemy(ex, ey, this.enemySpeed));
        }
        
        this.state = GameState.PLAYING;
        this.updateUI();
    }

    private gameLoop(timestamp: number): void {
        if (this.state === GameState.PLAYING) {
            this.update();
            this.render();
        } else if (this.state === GameState.MENU || 
                   this.state === GameState.GAME_OVER || 
                   this.state === GameState.VICTORY) {
            this.render();
        }
        
        requestAnimationFrame(this.gameLoop);
    }

    private update(): void {
        if (!this.player || !this.renderer) return;

        // Движение игрока
        const wasDrawing = this.player.isCurrentlyDrawing();
        const shouldCapture = this.player.move(this.grid);
        const isDrawingNow = this.player.isCurrentlyDrawing();

        // Если игрок начал рисовать и закончил - захват территории
        if (wasDrawing && !isDrawingNow && shouldCapture) {
            const trail = this.player.getTrail();
            const result = CaptureAlgorithm.capture(this.grid, trail);
            this.capturedCells += result.captured;
            this.player.resetTrail();

            // Проверка победы
            const percent = (this.capturedCells / this.totalCells) * 100;
            if (percent >= CONFIG.TARGET_CAPTURE_PERCENT) {
                this.state = GameState.VICTORY;
                this.updateUI();
                return;
            }
        }

        // Движение врагов и проверка столкновений
        const playerPos = this.player.getPosition();
        const trail = this.player.getTrail();

        for (const enemy of this.enemies) {
            enemy.move(this.grid);
            
            // Проверка столкновения с линией
            if (this.player.isCurrentlyDrawing() && enemy.checkCollision(trail)) {
                this.state = GameState.GAME_OVER;
                this.updateUI();
                return;
            }
            
            // Проверка столкновения с головой игрока
            if (enemy.checkHeadCollision(playerPos)) {
                this.state = GameState.GAME_OVER;
                this.updateUI();
                return;
            }
        }
    }

    private render(): void {
        if (!this.renderer || !this.player) return;

        const percent = (this.capturedCells / this.totalCells) * 100;
        this.renderer.render(this.grid, this.player, this.enemies, 0, percent);

        if (this.state === GameState.GAME_OVER) {
            this.renderer.renderGameOver();
        } else if (this.state === GameState.VICTORY) {
            this.renderer.renderVictory();
        }
    }

    public setState(newState: GameState): void {
        this.state = newState;
        this.updateUI();
    }

    public getState(): GameState {
        return this.state;
    }

    public startWithDifficulty(difficulty: string): void {
        this.startGame(difficulty);
    }

    private updateUI(): void {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        switch (this.state) {
            case GameState.MENU:
                document.getElementById('main-menu')?.classList.add('active');
                break;
            case GameState.PLAYING:
                document.getElementById('game-screen')?.classList.add('active');
                break;
            case GameState.GAME_OVER:
                document.getElementById('game-over-screen')?.classList.add('active');
                break;
            case GameState.VICTORY:
                document.getElementById('victory-screen')?.classList.add('active');
                break;
        }
    }

    public handlePause(): void {
        if (this.state === GameState.PLAYING) {
            this.state = GameState.PAUSED;
            const pauseOverlay = document.getElementById('pause-overlay');
            pauseOverlay?.classList.remove('hidden');
        } else if (this.state === GameState.PAUSED) {
            this.state = GameState.PLAYING;
            const pauseOverlay = document.getElementById('pause-overlay');
            pauseOverlay?.classList.add('hidden');
        }
    }
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================

let game: GameEngine;

document.addEventListener('DOMContentLoaded', () => {
    console.log('Xonix Game initialized');
    console.log(`Grid size: ${GRID_WIDTH}x${GRID_HEIGHT}`);
    
    game = new GameEngine();

    // Обработчики кнопок
    document.getElementById('start-btn')?.addEventListener('click', () => {
        const difficulty = (document.getElementById('difficulty') as HTMLSelectElement).value;
        game.startWithDifficulty(difficulty);
    });

    document.getElementById('restart-btn')?.addEventListener('click', () => {
        const difficulty = (document.getElementById('difficulty') as HTMLSelectElement).value;
        game.startWithDifficulty(difficulty);
    });

    document.getElementById('next-level-btn')?.addEventListener('click', () => {
        const difficulty = (document.getElementById('difficulty') as HTMLSelectElement).value;
        game.startWithDifficulty(difficulty);
    });

    // Пауза
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'Escape') {
            e.preventDefault();
            game.handlePause();
        }
        
        // Управление игроком
        if (game.getState() === GameState.PLAYING) {
            switch (e.code) {
                case 'ArrowUp':
                case 'KeyW':
                    (game as any).player?.setDirection(Direction.UP);
                    break;
                case 'ArrowDown':
                case 'KeyS':
                    (game as any).player?.setDirection(Direction.DOWN);
                    break;
                case 'ArrowLeft':
                case 'KeyA':
                    (game as any).player?.setDirection(Direction.LEFT);
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    (game as any).player?.setDirection(Direction.RIGHT);
                    break;
            }
        }
    });
});

export { GameEngine, GameState, CellType, Direction, CONFIG, GRID_WIDTH, GRID_HEIGHT };
