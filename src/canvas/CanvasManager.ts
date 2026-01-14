/**
 * CanvasManager - Transforms, Symmetry, Fill Toggle, Layers, Undo/Redo, Custom Brushes
 */

import { Grid } from '../core/Grid';
import { FrameManager } from '../core/FrameManager';
import { GridSnapper } from './GridSnapper';
import { StrokeSampler } from './StrokeSampler';
import { ToolType, GridCoord, Cell } from '../core/types';

export type ExtendedToolType = ToolType | 'triangle' | 'diamond' | 'circle';

interface UndoState {
    layer: 'background' | 'foreground';
    frameIdx: number;
    snapshot: Cell[][];
}

export class CanvasManager {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    public frameManager: FrameManager;
    public backgroundGrid: Grid;
    public activeLayer: 'background' | 'foreground' = 'foreground';

    public snapper: GridSnapper;
    private sampler: StrokeSampler;

    private currentTool: ExtendedToolType = 'draw';
    private currentChar = '#';
    private strokeId = 0;
    private isDrawing = false;

    public isFilled = true;
    public symmetryX = false;
    public symmetryY = false;

    private startCoord: GridCoord | null = null;
    private previewCells: Set<string> = new Set();

    private undoStack: UndoState[] = [];
    private redoStack: UndoState[] = [];

    public onGridChange?: (grid: Grid) => void;
    public onCursorMove?: (row: number, col: number) => void;
    public onFrameUpdate?: (idx: number, total: number) => void;

    constructor(canvas: HTMLCanvasElement, rows: number, cols: number) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;

        this.frameManager = new FrameManager(rows, cols);
        this.backgroundGrid = new Grid(rows, cols);

        this.snapper = new GridSnapper(canvas.width, canvas.height, rows, cols);
        this.sampler = new StrokeSampler();

        this.frameManager.onFrameChange = (idx, total) => {
            this.render();
            if (this.activeLayer === 'foreground') this.onGridChange?.(this.getGrid());
            this.onFrameUpdate?.(idx, total);
        };

        this.setupEventListeners();
        this.render();
    }

    getGrid(): Grid {
        return this.activeLayer === 'background' ? this.backgroundGrid : this.frameManager.getCurrentGrid();
    }

    setActiveLayer(layer: 'background' | 'foreground'): void {
        this.activeLayer = layer;
        this.render();
        this.onGridChange?.(this.getGrid());
    }

    setBrushMode(mode: 'solid' | 'shading' | 'noise'): void {
        this.sampler.setBrushMode(mode);
    }

    setShadeChars(chars: string): void {
        this.sampler.setShadeChars(chars);
    }

    private setupEventListeners(): void {
        this.canvas.addEventListener('mousedown', this.handlePointerDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handlePointerMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handlePointerUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.handlePointerUp.bind(this));

        this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); this.startDrawing(this.getTouchCoords(e.touches[0]).x, this.getTouchCoords(e.touches[0]).y); });
        this.canvas.addEventListener('touchmove', (e) => { e.preventDefault(); this.continueDrawing(this.getTouchCoords(e.touches[0]).x, this.getTouchCoords(e.touches[0]).y); });
        this.canvas.addEventListener('touchend', () => this.endDrawing());
    }

    private handlePointerDown(e: MouseEvent): void { const { x, y } = this.getCanvasCoords(e); this.startDrawing(x, y); }
    private handlePointerMove(e: MouseEvent): void {
        const { x, y } = this.getCanvasCoords(e);
        const coord = this.snapper.snap(x, y);
        this.onCursorMove?.(coord.row, coord.col);
        if (this.isDrawing) this.continueDrawing(x, y);
    }
    private handlePointerUp(): void { this.endDrawing(); }

    private startDrawing(x: number, y: number): void {
        this.isDrawing = true;
        this.saveUndoState();
        const coord = this.snapper.snap(x, y);
        this.startCoord = coord;

        if (this.currentTool === 'draw' || this.currentTool === 'erase') {
            this.sampler.startStroke(this.currentTool === 'erase' ? null : this.currentChar);
            const sample = this.sampler.addPoint(coord.col, coord.row);
            const char = (sample ? sample.char : (this.currentTool === 'erase' ? null : this.currentChar));
            this.applyPointWithSymmetry(coord, char);
        }
        this.strokeId++;
        this.render();
    }

    private continueDrawing(x: number, y: number): void {
        if (!this.isDrawing || !this.startCoord) return;
        const coord = this.snapper.snap(x, y);

        if (this.currentTool === 'draw' || this.currentTool === 'erase') {
            const sample = this.sampler.addPoint(coord.col, coord.row);
            if (sample) {
                this.applyPointWithSymmetry(coord, sample.char);
            }
        } else {
            this.updateShapePreview(coord);
        }
        this.render();
    }

    private endDrawing(): void {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        if (this.currentTool !== 'draw' && this.currentTool !== 'erase') {
            this.applyPreviewToGrid();
        }
        this.previewCells.clear();
        this.startCoord = null;
        this.render();
        this.onGridChange?.(this.getGrid());
    }

    private applyPointWithSymmetry(coord: GridCoord, char: string | null): void {
        const grid = this.getGrid();
        const points = [coord];
        if (this.symmetryX) points.push({ row: coord.row, col: grid.cols - 1 - coord.col });
        if (this.symmetryY) points.push({ row: grid.rows - 1 - coord.row, col: coord.col });
        if (this.symmetryX && this.symmetryY) points.push({ row: grid.rows - 1 - coord.row, col: grid.cols - 1 - coord.col });

        for (const p of points) {
            grid.setCell(p.row, p.col, char, this.strokeId);
        }
        this.onGridChange?.(grid);
    }

    private updateShapePreview(endCoord: GridCoord): void {
        if (!this.startCoord) return;
        this.previewCells.clear();
        const grid = this.getGrid();

        let points: Array<{ x: number; y: number }> = [];
        const c0 = this.startCoord.col, r0 = this.startCoord.row;
        const c1 = endCoord.col, r1 = endCoord.row;

        switch (this.currentTool) {
            case 'line': points = StrokeSampler.getLinePoints(c0, r0, c1, r1); break;
            case 'rectangle': points = StrokeSampler.getRectPoints(c0, r0, c1, r1, this.isFilled); break;
            case 'triangle': points = StrokeSampler.getTrianglePoints(c0, r0, c1, r1, this.isFilled); break;
            case 'diamond': points = StrokeSampler.getDiamondPoints(c0, r0, c1, r1, this.isFilled); break;
            case 'circle': points = StrokeSampler.getCirclePoints(c0, r0, c1, r1, this.isFilled); break;
        }

        const symmetricPoints: Array<{ x: number; y: number }> = [];
        for (const p of points) {
            symmetricPoints.push(p);
            if (this.symmetryX) symmetricPoints.push({ x: grid.cols - 1 - p.x, y: p.y });
            if (this.symmetryY) symmetricPoints.push({ x: p.x, y: grid.rows - 1 - p.y });
            if (this.symmetryX && this.symmetryY) symmetricPoints.push({ x: grid.cols - 1 - p.x, y: grid.rows - 1 - p.y });
        }

        for (const p of symmetricPoints) {
            if (p.y >= 0 && p.y < grid.rows && p.x >= 0 && p.x < grid.cols) {
                this.previewCells.add(`${p.y},${p.x}`);
            }
        }
    }

    private applyPreviewToGrid(): void {
        const grid = this.getGrid();
        for (const key of this.previewCells) {
            const [row, col] = key.split(',').map(Number);
            grid.setCell(row, col, this.currentChar, this.strokeId);
        }
    }

    // --- TRANSFORMS ---
    rotateGrid(): void {
        this.saveUndoState();
        const grid = this.getGrid();
        const newGrid = new Grid(grid.rows, grid.cols);
        for (let r = 0; r < grid.rows; r++) {
            for (let c = 0; c < grid.cols; c++) {
                const cell = grid.getCell(r, c);
                const nr = c % grid.rows;
                const nc = (grid.rows - 1 - r) % grid.cols;
                if (cell && cell.char) newGrid.setCell(nr, nc, cell.char, cell.strokeId);
            }
        }
        grid.clear();
        for (let r = 0; r < grid.rows; r++) {
            for (let c = 0; c < grid.cols; c++) {
                const cell = newGrid.getCell(r, c);
                if (cell && cell.char) grid.setCell(r, c, cell.char, cell.strokeId);
            }
        }
        this.onGridChange?.(grid);
    }

    flipHorizontal(): void {
        this.saveUndoState();
        const grid = this.getGrid();
        const newGrid = new Grid(grid.rows, grid.cols);
        for (let r = 0; r < grid.rows; r++) {
            for (let c = 0; c < grid.cols; c++) {
                const cell = grid.getCell(r, c);
                if (cell && cell.char) newGrid.setCell(r, grid.cols - 1 - c, cell.char, cell.strokeId);
            }
        }
        grid.clear();
        for (let r = 0; r < grid.rows; r++) {
            for (let c = 0; c < grid.cols; c++) {
                const cell = newGrid.getCell(r, c);
                if (cell && cell.char) grid.setCell(r, c, cell.char, cell.strokeId);
            }
        }
        this.render();
        this.onGridChange?.(grid);
    }

    flipVertical(): void {
        this.saveUndoState();
        const grid = this.getGrid();
        const newGrid = new Grid(grid.rows, grid.cols);
        for (let r = 0; r < grid.rows; r++) {
            for (let c = 0; c < grid.cols; c++) {
                const cell = grid.getCell(r, c);
                if (cell && cell.char) newGrid.setCell(grid.rows - 1 - r, c, cell.char, cell.strokeId);
            }
        }
        grid.clear();
        for (let r = 0; r < grid.rows; r++) {
            for (let c = 0; c < grid.cols; c++) {
                const cell = newGrid.getCell(r, c);
                if (cell && cell.char) grid.setCell(r, c, cell.char, cell.strokeId);
            }
        }
        this.render();
        this.onGridChange?.(grid);
    }

    render(): void {
        const { width, height } = this.canvas;
        const cellSize = this.snapper.getCellSize();

        // 1. Clear
        this.ctx.fillStyle = '#0a0a14';
        this.ctx.fillRect(0, 0, width, height);

        // 2. Grid Lines
        this.ctx.strokeStyle = 'rgba(80, 80, 140, 0.4)';
        this.ctx.lineWidth = 1;
        const grid = this.getGrid();
        for (let c = 0; c <= grid.cols; c++) {
            const x = c * cellSize.width;
            this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, height); this.ctx.stroke();
        }
        for (let r = 0; r <= grid.rows; r++) {
            const y = r * cellSize.height;
            this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(width, y); this.ctx.stroke();
        }

        // 3. Symmetry Lines
        if (this.symmetryX) {
            this.ctx.strokeStyle = '#ffcc00'; this.ctx.lineWidth = 2;
            const x = (grid.cols * cellSize.width) / 2;
            this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, height); this.ctx.stroke();
        }
        if (this.symmetryY) {
            this.ctx.strokeStyle = '#ffcc00'; this.ctx.lineWidth = 2;
            const y = (grid.rows * cellSize.height) / 2;
            this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(width, y); this.ctx.stroke();
        }

        const fontSize = Math.min(cellSize.width, cellSize.height) * 0.7;
        this.ctx.font = `bold ${fontSize}px 'JetBrains Mono', monospace`;
        this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';

        // Helper: Draw Grid
        const drawGrid = (g: Grid, color: string, shadow: boolean) => {
            for (let r = 0; r < g.rows; r++) {
                for (let c = 0; c < g.cols; c++) {
                    const cell = g.getCell(r, c);
                    if (cell && cell.char !== null) {
                        const bounds = this.snapper.getCellBounds(r, c);
                        const cx = bounds.x + bounds.w / 2;
                        const cy = bounds.y + bounds.h / 2;
                        if (shadow) {
                            this.ctx.shadowColor = color; this.ctx.shadowBlur = 8;
                        }
                        this.ctx.fillStyle = color;
                        this.ctx.fillText(cell.char, cx, cy);
                        this.ctx.shadowBlur = 0;
                    }
                }
            }
        };

        // 4. Draw Background
        const bgStyle = this.activeLayer === 'background' ? '#00bbff' : 'rgba(0, 187, 255, 0.4)';
        drawGrid(this.backgroundGrid, bgStyle, this.activeLayer === 'background');

        // 5. Draw Foreground
        const fgStyle = this.activeLayer === 'foreground' ? '#00ff88' : 'rgba(0, 255, 136, 0.5)';
        drawGrid(this.frameManager.getCurrentGrid(), fgStyle, this.activeLayer === 'foreground');

        // 6. Preview
        this.ctx.fillStyle = '#aa66ff';
        this.ctx.shadowColor = '#aa66ff'; this.ctx.shadowBlur = 6;
        for (const key of this.previewCells) {
            const [row, col] = key.split(',').map(Number);
            const bounds = this.snapper.getCellBounds(row, col);
            this.ctx.fillText(this.currentChar, bounds.x + bounds.w / 2, bounds.y + bounds.h / 2);
        }
        this.ctx.shadowBlur = 0;
    }

    setTool(tool: ExtendedToolType): void { this.currentTool = tool; }
    setChar(char: string): void { this.currentChar = char || '#'; }
    clear(): void { this.saveUndoState(); this.getGrid().clear(); this.render(); this.onGridChange?.(this.getGrid()); }

    resize(rows: number, cols: number, canvasWidth: number, canvasHeight: number): void {
        this.canvas.width = canvasWidth;
        this.canvas.height = canvasHeight;
        this.frameManager.resize(rows, cols);

        const newBg = new Grid(rows, cols);
        for (let r = 0; r < Math.min(rows, this.backgroundGrid.rows); r++) {
            for (let c = 0; c < Math.min(cols, this.backgroundGrid.cols); c++) {
                const cell = this.backgroundGrid.getCell(r, c);
                if (cell && cell.char) newBg.setCell(r, c, cell.char, cell.strokeId);
            }
        }
        this.backgroundGrid = newBg;

        this.snapper.updateDimensions(canvasWidth, canvasHeight, rows, cols);
        this.render();
        this.onGridChange?.(this.getGrid());
    }

    private saveUndoState(): void {
        const layer = this.activeLayer;
        const frameIdx = this.frameManager.getCurrentIndex();
        const snapshot = this.getGrid().snapshot();

        this.undoStack.push({ layer, frameIdx, snapshot });
        if (this.undoStack.length > 50) this.undoStack.shift();
        this.redoStack = [];
    }

    undo(): void {
        if (this.undoStack.length === 0) return;

        const state = this.undoStack.pop()!;

        let targetGrid: Grid;
        if (state.layer === 'background') targetGrid = this.backgroundGrid;
        else targetGrid = this.frameManager.getFrame(state.frameIdx);

        this.redoStack.push({
            layer: state.layer,
            frameIdx: state.frameIdx,
            snapshot: targetGrid.snapshot()
        });

        if (this.activeLayer !== state.layer) this.setActiveLayer(state.layer);
        if (state.layer === 'foreground' && this.frameManager.getCurrentIndex() !== state.frameIdx) {
            this.frameManager.gotoFrame(state.frameIdx);
        }

        targetGrid.restore(state.snapshot);
        this.render();
        this.onGridChange?.(this.getGrid());
    }

    redo(): void {
        if (this.redoStack.length === 0) return;

        const state = this.redoStack.pop()!;

        let targetGrid: Grid;
        if (state.layer === 'background') targetGrid = this.backgroundGrid;
        else targetGrid = this.frameManager.getFrame(state.frameIdx);

        this.undoStack.push({
            layer: state.layer,
            frameIdx: state.frameIdx,
            snapshot: targetGrid.snapshot()
        });

        if (this.activeLayer !== state.layer) this.setActiveLayer(state.layer);
        if (state.layer === 'foreground' && this.frameManager.getCurrentIndex() !== state.frameIdx) {
            this.frameManager.gotoFrame(state.frameIdx);
        }

        targetGrid.restore(state.snapshot);
        this.render();
        this.onGridChange?.(this.getGrid());
    }

    private getCanvasCoords(e: MouseEvent): { x: number; y: number } { const rect = this.canvas.getBoundingClientRect(); return { x: e.clientX - rect.left, y: e.clientY - rect.top }; }
    private getTouchCoords(touch: Touch): { x: number; y: number } { const rect = this.canvas.getBoundingClientRect(); return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }; }
}
