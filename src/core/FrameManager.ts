/**
 * FrameManager - Handles Animation Frames
 */
import { Grid } from './Grid';

export class FrameManager {
    private frames: Grid[] = [];
    private currentFrameIndex: number = 0;
    private rows: number;
    private cols: number;

    public onFrameChange?: (index: number, total: number) => void;

    constructor(rows: number, cols: number) {
        this.rows = rows;
        this.cols = cols;
        // Start with 1 frame
        this.addFrame();
    }

    // Get current grid for editing
    getCurrentGrid(): Grid {
        return this.frames[this.currentFrameIndex];
    }

    getFrame(index: number): Grid {
        if (index < 0 || index >= this.frames.length) return this.frames[0];
        return this.frames[index];
    }

    getCurrentTitle(): string {
        return `Frame ${this.currentFrameIndex + 1} / ${this.frames.length}`;
    }

    getFrameCount(): number {
        return this.frames.length;
    }

    getCurrentIndex(): number {
        return this.currentFrameIndex;
    }

    // Navigation
    gotoFrame(index: number): void {
        if (index >= 0 && index < this.frames.length) {
            this.currentFrameIndex = index;
            this.notify();
        }
    }

    nextFrame(): void {
        if (this.currentFrameIndex < this.frames.length - 1) {
            this.currentFrameIndex++;
            this.notify();
        }
    }

    prevFrame(): void {
        if (this.currentFrameIndex > 0) {
            this.currentFrameIndex--;
            this.notify();
        }
    }

    // CRUD
    addFrame(copyPrevious: boolean = false): void {
        let newGrid: Grid;

        if (copyPrevious && this.frames.length > 0) {
            // Deep copy previous frame
            const prev = this.frames[this.frames.length - 1];
            newGrid = new Grid(this.rows, this.cols);
            // Copy cells
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    const cell = prev.getCell(r, c);
                    if (cell && cell.char) newGrid.setCell(r, c, cell.char, cell.strokeId);
                }
            }
        } else {
            newGrid = new Grid(this.rows, this.cols);
        }

        this.frames.push(newGrid);
        this.currentFrameIndex = this.frames.length - 1;
        this.notify();
    }

    deleteCurrentFrame(): void {
        if (this.frames.length <= 1) {
            // Don't delete last frame, just clear it
            this.frames[0].clear();
        } else {
            this.frames.splice(this.currentFrameIndex, 1);
            if (this.currentFrameIndex >= this.frames.length) {
                this.currentFrameIndex = this.frames.length - 1;
            }
        }
        this.notify();
    }

    // Resizing (propagates to all frames)
    resize(rows: number, cols: number): void {
        this.rows = rows;
        this.cols = cols;
        // Resize all grids
        this.frames = this.frames.map(oldGrid => {
            const newGrid = new Grid(rows, cols);
            for (let r = 0; r < Math.min(rows, oldGrid.rows); r++) {
                for (let c = 0; c < Math.min(cols, oldGrid.cols); c++) {
                    const cell = oldGrid.getCell(r, c);
                    if (cell && cell.char) newGrid.setCell(r, c, cell.char, cell.strokeId);
                }
            }
            return newGrid;
        });
        this.notify();
    }

    // Load from storage
    loadFrames(framesData: { r: number, c: number, char: string }[][], rows: number, cols: number): void {
        this.rows = rows;
        this.cols = cols;
        this.frames = [];

        for (const frameData of framesData) {
            const grid = new Grid(rows, cols);
            for (const cell of frameData) {
                grid.setCell(cell.r, cell.c, cell.char, 0);
            }
            this.frames.push(grid);
        }

        if (this.frames.length === 0) this.addFrame();
        this.currentFrameIndex = 0;
        this.notify();
    }

    getAllFrames(): Grid[] {
        return this.frames;
    }

    private notify(): void {
        this.onFrameChange?.(this.currentFrameIndex, this.frames.length);
    }
}
