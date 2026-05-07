/**
 * Xonix Web Game - Чистая реализация
 */

const CONFIG = {
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 600,
    GRID_SIZE: 5,
    TARGET_CAPTURE_PERCENT: 80,
    DIFFICULTY: {
        EASY: { enemies: 2, speed: 0.25 },
        MEDIUM: { enemies: 4, speed: 0.4 },
        HARD: { enemies: 6, speed: 0.6 }
    }
};

const GRID_W = Math.floor(CONFIG.CANVAS_WIDTH / CONFIG.GRID_SIZE);
const GRID_H = Math.floor(CONFIG.CANVAS_HEIGHT / CONFIG.GRID_SIZE);

enum GameState { MENU, PLAYING, PAUSED, GAME_OVER, VICTORY }
enum Cell { EMPTY = 0, SAFE = 1, TRAIL = 2 }
enum Dir { UP, DOWN, LEFT, RIGHT }

interface Point { x: number; y: number; }

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let state: GameState = GameState.MENU;
let grid: Uint8Array;
let player: { x: number; y: number; dir: Dir; trail: Point[]; isDrawing: boolean };
let enemies: Array<{ x: number; y: number; vx: number; vy: number }>;
let capturedPercent: number = 0;
let difficultySetting = CONFIG.DIFFICULTY.EASY;
let nextDir: Dir | null = null;

function initGrid(): void {
    grid = new Uint8Array(GRID_W * GRID_H);
    for (let x = 0; x < GRID_W; x++) {
        grid[x] = Cell.SAFE;
        grid[(GRID_H - 1) * GRID_W + x] = Cell.SAFE;
    }
    for (let y = 0; y < GRID_H; y++) {
        grid[y * GRID_W] = Cell.SAFE;
        grid[y * GRID_W + (GRID_W - 1)] = Cell.SAFE;
    }
}

function getCell(x: number, y: number): Cell {
    if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return Cell.SAFE;
    return grid[y * GRID_W + x];
}

function setCell(x: number, y: number, val: Cell): void {
    if (x >= 0 && x < GRID_W && y >= 0 && y < GRID_H) {
        grid[y * GRID_W + x] = val;
    }
}

function initGame(): void {
    initGrid();
    player = { x: 1, y: 1, dir: Dir.RIGHT, trail: [], isDrawing: false };
    nextDir = null;
    enemies = [];
    const cx = Math.floor(GRID_W / 2);
    const cy = Math.floor(GRID_H / 2);
    const r = Math.max(5, Math.min(GRID_W, GRID_H) / 4);
    
    for (let i = 0; i < difficultySetting.enemies; i++) {
        const a = (i / difficultySetting.enemies) * Math.PI * 2;
        const a2 = Math.random() * Math.PI * 2;
        enemies.push({
            x: Math.floor(cx + Math.cos(a) * r),
            y: Math.floor(cy + Math.sin(a) * r),
            vx: Math.cos(a2) * difficultySetting.speed,
            vy: Math.sin(a2) * difficultySetting.speed
        });
    }
    capturedPercent = calculateCapturePercent();
    state = GameState.PLAYING;
}

function finalizeCapture(): void {
    if (player.trail.length === 0) return;
    
    for (const p of player.trail) setCell(p.x, p.y, Cell.EMPTY);
    
    const visited = new Uint8Array(GRID_W * GRID_H);
    const queue: Point[] = [];
    
    for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
            if (getCell(x, y) === Cell.SAFE) {
                const idx = y * GRID_W + x;
                if (!visited[idx]) {
                    visited[idx] = 1;
                    queue.push({ x, y });
                }
            }
        }
    }
    
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    while (queue.length > 0) {
        const cur = queue.shift()!;
        for (const d of dirs) {
            const nx = cur.x + d[0], ny = cur.y + d[1];
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H) {
                const idx = ny * GRID_W + nx;
                if (!visited[idx] && getCell(nx, ny) !== Cell.SAFE) {
                    visited[idx] = 1;
                    queue.push({ x: nx, y: ny });
                }
            }
        }
    }
    
    let capturedCount = 0;
    for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
            const idx = y * GRID_W + x;
            if (getCell(x, y) === Cell.EMPTY && !visited[idx]) {
                setCell(x, y, Cell.SAFE);
                capturedCount++;
            }
        }
    }
    
    for (const p of player.trail) setCell(p.x, p.y, Cell.SAFE);
    player.trail = [];
    player.isDrawing = false;
    
    if (capturedCount > 0) {
        capturedPercent = calculateCapturePercent();
        if (capturedPercent >= CONFIG.TARGET_CAPTURE_PERCENT) state = GameState.VICTORY;
    }
}

function calculateCapturePercent(): number {
    let count = 0;
    for (let i = 0; i < grid.length; i++) if (grid[i] === Cell.SAFE) count++;
    return Math.floor((count / grid.length) * 100);
}

function updatePlayer(): void {
    if (nextDir !== null) {
        const opp: Record<Dir, Dir> = { [Dir.UP]: Dir.DOWN, [Dir.DOWN]: Dir.UP, [Dir.LEFT]: Dir.RIGHT, [Dir.RIGHT]: Dir.LEFT };
        if (!player.isDrawing || nextDir !== opp[player.dir]) player.dir = nextDir;
        nextDir = null;
    }
    
    let nx = player.x, ny = player.y;
    if (player.dir === Dir.UP) ny--;
    else if (player.dir === Dir.DOWN) ny++;
    else if (player.dir === Dir.LEFT) nx--;
    else if (player.dir === Dir.RIGHT) nx++;
    
    if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) { state = GameState.GAME_OVER; return; }
    
    const newCell = getCell(nx, ny);
    
    if (player.isDrawing) {
        if (newCell === Cell.SAFE) { finalizeCapture(); }
        else if (newCell === Cell.EMPTY) {
            player.trail.push({ x: player.x, y: player.y });
            setCell(player.x, player.y, Cell.TRAIL);
        }
        if (newCell === Cell.TRAIL) { state = GameState.GAME_OVER; return; }
    } else {
        if (newCell === Cell.EMPTY) { player.isDrawing = true; player.trail = []; }
    }
    
    player.x = nx; player.y = ny;
}

function updateEnemies(): void {
    for (const e of enemies) {
        let bounced = false;
        const cx = Math.floor(e.x + e.vx), cy = Math.floor(e.y + e.vy);
        
        if (cx < 0 || cx >= GRID_W || getCell(cx, Math.floor(e.y)) !== Cell.EMPTY) { e.vx = -e.vx; bounced = true; }
        if (cy < 0 || cy >= GRID_H || getCell(Math.floor(e.x), cy) !== Cell.EMPTY) { e.vy = -e.vy; bounced = true; }
        
        if (bounced) {
            const a = Math.random() * Math.PI * 2;
            e.vx = Math.cos(a) * difficultySetting.speed;
            e.vy = Math.sin(a) * difficultySetting.speed;
        }
        
        e.x += e.vx; e.y += e.vy;
        e.x = Math.max(0.5, Math.min(GRID_W - 1.5, e.x));
        e.y = Math.max(0.5, Math.min(GRID_H - 1.5, e.y));
        
        const ex = Math.floor(e.x), ey = Math.floor(e.y);
        if (getCell(ex, ey) === Cell.TRAIL || (ex === player.x && ey === player.y)) {
            state = GameState.GAME_OVER; return;
        }
    }
}

function draw(): void {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    
    for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
            const c = getCell(x, y);
            if (c === Cell.SAFE) {
                ctx.fillStyle = '#444';
                ctx.fillRect(x * CONFIG.GRID_SIZE, y * CONFIG.GRID_SIZE, CONFIG.GRID_SIZE, CONFIG.GRID_SIZE);
            } else if (c === Cell.TRAIL) {
                ctx.fillStyle = '#ff0';
                ctx.fillRect(x * CONFIG.GRID_SIZE, y * CONFIG.GRID_SIZE, CONFIG.GRID_SIZE, CONFIG.GRID_SIZE);
            }
        }
    }
    
    ctx.fillStyle = '#0f0';
    ctx.fillRect(player.x * CONFIG.GRID_SIZE, player.y * CONFIG.GRID_SIZE, CONFIG.GRID_SIZE, CONFIG.GRID_SIZE);
    
    ctx.fillStyle = '#f00';
    for (const e of enemies) {
        ctx.beginPath();
        ctx.arc(e.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE/2, e.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE/2, CONFIG.GRID_SIZE, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.fillStyle = '#fff';
    ctx.font = '16px monospace';
    ctx.fillText(`Захвачено: ${capturedPercent}%`, 10, 20);
    ctx.fillText(`Цель: ${CONFIG.TARGET_CAPTURE_PERCENT}%`, 10, 40);
}

function handleKey(e: KeyboardEvent): void {
    if (state === GameState.MENU || state === GameState.GAME_OVER || state === GameState.VICTORY) return;
    
    if (e.code === 'Space' || e.code === 'Escape') {
        state = state === GameState.PLAYING ? GameState.PAUSED : GameState.PLAYING;
        return;
    }
    
    if (state !== GameState.PLAYING) return;
    
    switch (e.code) {
        case 'ArrowUp': case 'KeyW': nextDir = Dir.UP; break;
        case 'ArrowDown': case 'KeyS': nextDir = Dir.DOWN; break;
        case 'ArrowLeft': case 'KeyA': nextDir = Dir.LEFT; break;
        case 'ArrowRight': case 'KeyD': nextDir = Dir.RIGHT; break;
    }
}

function gameLoop(): void {
    if (state === GameState.PLAYING) { updatePlayer(); updateEnemies(); }
    if (state !== GameState.MENU) draw();
    requestAnimationFrame(gameLoop);
}

function showScreen(id: string): void {
    document.querySelectorAll('.screen').forEach(el => (el as HTMLElement).style.display = 'none');
    const s = document.getElementById(id);
    if (s) s.style.display = 'flex';
}

function setupUI(): void {
    document.getElementById('btn-easy')?.addEventListener('click', () => { difficultySetting = CONFIG.DIFFICULTY.EASY; initGame(); showScreen('game-screen'); });
    document.getElementById('btn-medium')?.addEventListener('click', () => { difficultySetting = CONFIG.DIFFICULTY.MEDIUM; initGame(); showScreen('game-screen'); });
    document.getElementById('btn-hard')?.addEventListener('click', () => { difficultySetting = CONFIG.DIFFICULTY.HARD; initGame(); showScreen('game-screen'); });
    document.getElementById('btn-restart-gameover')?.addEventListener('click', () => { initGame(); showScreen('game-screen'); });
    document.getElementById('btn-restart-victory')?.addEventListener('click', () => { initGame(); showScreen('game-screen'); });
}

window.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    ctx = canvas.getContext('2d')!;
    canvas.width = CONFIG.CANVAS_WIDTH;
    canvas.height = CONFIG.CANVAS_HEIGHT;
    setupUI();
    window.addEventListener('keydown', handleKey);
    showScreen('menu-screen');
    gameLoop();
});
