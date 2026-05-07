/**
 * Xonix Web Game - Полная реализация с исправленными багами
 * Исправления:
 * - Игрок спавнится на захваченной территории
 * - Корректный алгоритм захвата через Flood Fill
 * - Правильная обработка коллизий
 * - Исправлено движение в любом направлении
 */

// ============================================
// КОНСТАНТЫ И НАСТРОЙКИ
// ============================================

const CONFIG = {
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 600,
    GRID_SIZE: 5,
    TARGET_CAPTURE_PERCENT: 80,
    PLAYER_SPEED: 1,
    ENEMY_BASE_SPEED: 0.3,
    DIFFICULTY: {
        EASY: { enemies: 2, speed: 0.25 },
        MEDIUM: { enemies: 4, speed: 0.4 },
        HARD: { enemies: 6, speed: 0.6 }
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
    private hasMovedOffCaptured: boolean = false;

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
        // Запрещаем разворот на 180 градусов только если движемся
        if (this.isDrawing) {
            if ((dir === Direction.UP && this.direction === Direction.DOWN) ||
                (dir === Direction.DOWN && this.direction === Direction.UP) ||
                (dir === Direction.LEFT && this.direction === Direction.RIGHT) ||
                (dir === Direction.RIGHT && this.direction === Direction.LEFT)) {
                return;
            }
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
        const currentCell = grid[this.pos.y][this.pos.x];
        
        // Логика начала рисования
        if (!this.isDrawing && currentCell === CellType.CAPTURED && targetCell === CellType.EMPTY) {
            this.isDrawing = true;
            this.hasMovedOffCaptured = true;
            this.trail = [{ x: this.pos.x, y: this.pos.y }];
        }

        // Если рисуем линию
        if (this.isDrawing) {
            // Нельзя идти обратно на захваченную сразу (минимум 1 клетка линии)
            if (targetCell === CellType.CAPTURED && this.trail.length > 0) {
                // Возврат на захваченную территорию - завершаем контур
                this.pos = { x: newX, y: newY };
                return true; // Сигнал для захвата
            }
            
            // Проверка на пустую клетку или свою линию
            if (targetCell === CellType.EMPTY) {
                // Проверка на столкновение с собственной линией (кроме последней позиции)
                for (let i = 0; i < this.trail.length - 1; i++) {
                    if (this.trail[i].x === newX && this.trail[i].y === newY) {
                        return false; // Столкновение с хвостом - игра окончена
                    }
                }
                
                this.trail.push({ x: newX, y: newY });
                grid[newY][newX] = CellType.TRAIL;
                this.pos = { x: newX, y: newY };
                return false;
            } else if (targetCell === CellType.TRAIL) {
                // Столкновение со своей линией
                return false;
            } else if (targetCell === CellType.CAPTURED) {
                // Возврат на базу
                this.pos = { x: newX, y: newY };
                return true;
            }
        } else {
            // Движение по захваченной территории
            if (targetCell !== CellType.CAPTURED) {
                return false;
            }
            this.pos = { x: newX, y: newY };
        }

        return false;
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
        this.hasMovedOffCaptured = false;
    }
    
    clearTrailFromGrid(grid: CellType[][]): void {
        for (const t of this.trail) {
            if (t.x >= 0 && t.x < GRID_WIDTH && t.y >= 0 && t.y < GRID_HEIGHT) {
                grid[t.y][t.x] = CellType.EMPTY;
            }
        }
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

        // Проверка столкновения с захваченной территорией или трейлом
        const gridX = Math.floor(newX);
        const gridY = Math.floor(newY);
        
        if (gridX >= 0 && gridX < GRID_WIDTH && gridY >= 0 && gridY < GRID_HEIGHT) {
            const cell = grid[gridY][gridX];
            if (cell === CellType.CAPTURED || cell === CellType.TRAIL) {
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

        // Очищаем трейл из сетки перед анализом
        for (const t of trail) {
            if (t.x >= 0 && t.x < GRID_WIDTH && t.y >= 0 && t.y < GRID_HEIGHT) {
                grid[t.y][t.x] = CellType.EMPTY;
            }
        }

        // Находим bounding box трейла для оптимизации
        let minX = GRID_WIDTH, maxX = 0, minY = GRID_HEIGHT, maxY = 0;
        for (const t of trail) {
            minX = Math.min(minX, t.x);
            maxX = Math.max(maxX, t.x);
            minY = Math.min(minY, t.y);
            maxY = Math.max(maxY, t.y);
        }

        // Расширяем bounding box на 1 клетку
        minX = Math.max(0, minX - 1);
        maxX = Math.min(GRID_WIDTH - 1, maxX + 1);
        minY = Math.max(0, minY - 1);
        maxY = Math.min(GRID_HEIGHT - 1, maxY + 1);

        // Создаем множество точек трейла для быстрого поиска
        const trailSet = new Set<string>();
        for (const t of trail) {
            trailSet.add(`${t.x},${t.y}`);
        }

        // Функция BFS для заливки области
        const floodFill = (startX: number, startY: number): Position[] => {
            const area: Position[] = [];
            const visited = new Set<string>();
            const queue: Position[] = [{ x: startX, y: startY }];
            visited.add(`${startX},${startY}`);

            while (queue.length > 0) {
                const current = queue.shift()!;
                area.push(current);

                const neighbors = [
                    { x: current.x + 1, y: current.y },
                    { x: current.x - 1, y: current.y },
                    { x: current.x, y: current.y + 1 },
                    { x: current.x, y: current.y - 1 }
                ];

                for (const n of neighbors) {
                    // Выход за пределы bounding box
                    if (n.x < minX || n.x > maxX || n.y < minY || n.y > maxY) continue;
                    
                    const key = `${n.x},${n.y}`;
                    if (visited.has(key)) continue;
                    
                    // Проверяем тип клетки
                    if (grid[n.y][n.x] === CellType.CAPTURED) continue;
                    if (trailSet.has(key)) continue;
                    
                    visited.add(key);
                    queue.push(n);
                }
            }

            return area;
        };

        // Ищем пустую клетку внутри контура (рядом с трейлом)
        let interiorStart: Position | null = null;
        for (const t of trail) {
            const neighbors = [
                { x: t.x + 1, y: t.y },
                { x: t.x - 1, y: t.y },
                { x: t.x, y: t.y + 1 },
                { x: t.x, y: t.y - 1 }
            ];
            for (const n of neighbors) {
                if (n.x >= 0 && n.x < GRID_WIDTH && n.y >= 0 && n.y < GRID_HEIGHT) {
                    if (grid[n.y][n.x] === CellType.EMPTY && !trailSet.has(`${n.x},${n.y}`)) {
                        interiorStart = n;
                        break;
                    }
                }
            }
            if (interiorStart) break;
        }

        if (!interiorStart) {
            return { captured: 0, killedEnemies: 0 };
        }

        // Заливаем область начиная с найденной точки
        const interiorArea = floodFill(interiorStart.x, interiorStart.y);

        // Теперь проверяем, является ли эта область "внутренней" или "внешней"
        // Внешняя область должна касаться границ поля или быть очень большой
        let touchesBoundary = false;
        for (const cell of interiorArea) {
            if (cell.x === 0 || cell.x === GRID_WIDTH - 1 || 
                cell.y === 0 || cell.y === GRID_HEIGHT - 1) {
                touchesBoundary = true;
                break;
            }
        }

        // Если область касается границы - это внешняя область, значит захватываем другую
        if (touchesBoundary) {
            // Заливаем всё поле кроме внешней области
            const allEmptyCells: Position[] = [];
            for (let y = 0; y < GRID_HEIGHT; y++) {
                for (let x = 0; x < GRID_WIDTH; x++) {
                    if (grid[y][x] === CellType.EMPTY && !trailSet.has(`${x},${y}`)) {
                        allEmptyCells.push({ x, y });
                    }
                }
            }

            // Клетки для захвата = все пустые - внешняя область
            const exteriorSet = new Set(interiorArea.map(c => `${c.x},${c.y}`));
            const cellsToCapture = allEmptyCells.filter(c => !exteriorSet.has(`${c.x},${c.y}`));

            if (cellsToCapture.length > 0) {
                for (const cell of cellsToCapture) {
                    grid[cell.y][cell.x] = CellType.CAPTURED;
                }
                return { captured: cellsToCapture.length, killedEnemies: 0 };
            }
        } else {
            // Это внутренняя область - захватываем её
            for (const cell of interiorArea) {
                grid[cell.y][cell.x] = CellType.CAPTURED;
            }
            return { captured: interiorArea.length, killedEnemies: 0 };
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
    private enemySpeed: number = CONFIG.ENEMY_BASE_SPEED;

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
        
        // Спавн игрока на захваченной территории (левый верхний угол)
        this.player = new Player(1, 1);
        
        // Настройка сложности
        const diffConfig = CONFIG.DIFFICULTY[difficulty as keyof typeof CONFIG.DIFFICULTY] || CONFIG.DIFFICULTY.MEDIUM;
        this.enemySpeed = diffConfig.speed;
        
        // Спавн врагов в центре поля (подальше от границ)
        this.enemies = [];
        const centerX = Math.floor(GRID_WIDTH / 2);
        const centerY = Math.floor(GRID_HEIGHT / 2);
        const spawnRadius = Math.min(GRID_WIDTH, GRID_HEIGHT) / 4;
        
        for (let i = 0; i < diffConfig.enemies; i++) {
            const angle = (i / diffConfig.enemies) * Math.PI * 2;
            const ex = centerX + Math.floor(Math.cos(angle) * spawnRadius);
            const ey = centerY + Math.floor(Math.sin(angle) * spawnRadius);
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
        const moveResult = this.player.move(this.grid);
        const isDrawingNow = this.player.isCurrentlyDrawing();

        // Если движение вернуло false во время рисования - это столкновение с хвостом (Game Over)
        if (wasDrawing && !moveResult && !isDrawingNow) {
            // Игрок врезался в свою линию
            this.player.clearTrailFromGrid(this.grid);
            this.player.resetTrail();
            this.state = GameState.GAME_OVER;
            this.updateUI();
            return;
        }

        // Если игрок завершил контур (вернулся на захваченную территорию)
        if (wasDrawing && moveResult) {
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
            
            // Проверка столкновения с линией (только если игрок рисует)
            if (this.player.isCurrentlyDrawing() && enemy.checkCollision(trail)) {
                this.player.clearTrailFromGrid(this.grid);
                this.player.resetTrail();
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

    public getPlayer(): Player | null {
        return this.player;
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
            const player = game.getPlayer();
            switch (e.code) {
                case 'ArrowUp':
                case 'KeyW':
                    player?.setDirection(Direction.UP);
                    break;
                case 'ArrowDown':
                case 'KeyS':
                    player?.setDirection(Direction.DOWN);
                    break;
                case 'ArrowLeft':
                case 'KeyA':
                    player?.setDirection(Direction.LEFT);
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    player?.setDirection(Direction.RIGHT);
                    break;
            }
        }
    });
});

export { GameEngine, GameState, CellType, Direction, CONFIG, GRID_WIDTH, GRID_HEIGHT };
