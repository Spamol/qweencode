/**
 * Xonix Web Game - Основная структура
 * Шаг 1: Базовая структура, Canvas и игровой цикл
 */

// ============================================
// КОНСТАНТЫ И НАСТРОЙКИ
// ============================================

const CONFIG = {
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 600,
    GRID_SIZE: 4, // Размер ячейки сетки в пикселях
    TARGET_CAPTURE_PERCENT: 80, // Цель захвата для победы
};

// Вычисляемые константы
const GRID_WIDTH = Math.floor(CONFIG.CANVAS_WIDTH / CONFIG.GRID_SIZE);
const GRID_HEIGHT = Math.floor(CONFIG.CANVAS_HEIGHT / CONFIG.GRID_SIZE);

// ============================================
// ТИПЫ (TypeScript-like документация)
// ============================================

/**
 * Состояния игры
 */
enum GameState {
    MENU = 'MENU',
    PLAYING = 'PLAYING',
    PAUSED = 'PAUSED',
    GAME_OVER = 'GAME_OVER',
    VICTORY = 'VICTORY'
}

/**
 * Типы ячеек поля
 */
enum CellType {
    EMPTY = 0,      // Игровая зона (белая)
    CAPTURED = 1,   // Захваченная территория (серая/черная)
    TRAIL = 2       // Текущая линия игрока (временная)
}

/**
 * Направления движения
 */
enum Direction {
    UP = 'UP',
    DOWN = 'DOWN',
    LEFT = 'LEFT',
    RIGHT = 'RIGHT',
    NONE = 'NONE'
}

// ============================================
// КЛАССЫ
// ============================================

/**
 * Главный игровой движок
 */
class GameEngine {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private state: GameState = GameState.MENU;
    private lastTime: number = 0;
    
    constructor() {
        this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;
        
        // Установка размеров canvas
        this.canvas.width = CONFIG.CANVAS_WIDTH;
        this.canvas.height = CONFIG.CANVAS_HEIGHT;
        
        // Привязка контекста
        this.gameLoop = this.gameLoop.bind(this);
        
        // Запуск игрового цикла
        requestAnimationFrame(this.gameLoop);
    }
    
    /**
     * Основной игровой цикл
     */
    private gameLoop(timestamp: number): void {
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;
        
        if (this.state === GameState.PLAYING) {
            this.update(deltaTime);
            this.render();
        } else if (this.state === GameState.MENU || 
                   this.state === GameState.GAME_OVER || 
                   this.state === GameState.VICTORY) {
            // Рендерим только один раз при смене состояния
            this.render();
        }
        
        requestAnimationFrame(this.gameLoop);
    }
    
    /**
     * Обновление логики игры
     */
    private update(deltaTime: number): void {
        // Здесь будет логика обновления игровых объектов
        // Пока пусто для Шага 1
    }
    
    /**
     * Отрисовка текущего состояния
     */
    private render(): void {
        // Очистка canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
        
        // Временная отрисовка для демонстрации работы цикла
        this.ctx.fillStyle = '#00ff00';
        this.ctx.font = '24px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('XONIX - Step 1', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2);
        this.ctx.fillText(`State: ${this.state}`, CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 + 40);
    }
    
    /**
     * Переключение состояния игры
     */
    public setState(newState: GameState): void {
        this.state = newState;
        this.updateUI();
    }
    
    /**
     * Получение текущего состояния
     */
    public getState(): GameState {
        return this.state;
    }
    
    /**
     * Обновление UI элементов
     */
    private updateUI(): void {
        // Скрыть все экраны
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        // Показать нужный экран
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
    
    /**
     * Получение canvas контекста
     */
    public getCtx(): CanvasRenderingContext2D {
        return this.ctx;
    }
    
    /**
     * Получение canvas
     */
    public getCanvas(): HTMLCanvasElement {
        return this.canvas;
    }
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================

let game: GameEngine;

/**
 * Инициализация игры после загрузки DOM
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('Xonix Game initialized');
    console.log(`Grid size: ${GRID_WIDTH}x${GRID_HEIGHT}`);
    console.log(`Cell size: ${CONFIG.GRID_SIZE}px`);
    
    // Создание игрового движка
    game = new GameEngine();
    
    // Обработчики кнопок меню
    const startBtn = document.getElementById('start-btn');
    startBtn?.addEventListener('click', () => {
        const difficulty = (document.getElementById('difficulty') as HTMLSelectElement).value;
        console.log(`Starting game with difficulty: ${difficulty}`);
        game.setState(GameState.PLAYING);
    });
    
    const restartBtn = document.getElementById('restart-btn');
    restartBtn?.addEventListener('click', () => {
        console.log('Restarting game...');
        game.setState(GameState.PLAYING);
    });
    
    const nextLevelBtn = document.getElementById('next-level-btn');
    nextLevelBtn?.addEventListener('click', () => {
        console.log('Next level...');
        game.setState(GameState.PLAYING);
    });
    
    // Обработчик паузы
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'Escape') {
            if (game.getState() === GameState.PLAYING) {
                game.setState(GameState.PAUSED);
                const pauseOverlay = document.getElementById('pause-overlay');
                pauseOverlay?.classList.remove('hidden');
            } else if (game.getState() === GameState.PAUSED) {
                game.setState(GameState.PLAYING);
                const pauseOverlay = document.getElementById('pause-overlay');
                pauseOverlay?.classList.add('hidden');
            }
        }
    });
});

// Экспорт для использования в других модулях
export { GameEngine, GameState, CellType, Direction, CONFIG, GRID_WIDTH, GRID_HEIGHT };
