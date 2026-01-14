/**
 * Grid - The single source of truth for the drawing
 * 
 * All drawings are reduced to this grid. No smoothing, no approximation.
 */

import { Cell, GridCoord } from './types';

export class Grid {
    private cells: Cell[][];
    public readonly rows: number;
    public readonly cols: number;

    constructor(rows: number, cols: number) {
        this.rows = rows;
        this.cols = cols;
        this.cells = this.createEmptyGrid();
    }

    private createEmptyGrid(): Cell[][] {
        const grid: Cell[][] = [];
        for (let r = 0; r < this.rows; r++) {
            grid[r] = [];
            for (let c = 0; c < this.cols; c++) {
                grid[r][c] = { char: null, strokeId: -1, timestamp: 0 };
            }
        }
        return grid;
    }

    /** Get cell at position */
    getCell(row: number, col: number): Cell | null {
        if (!this.isValidCoord(row, col)) return null;
        return this.cells[row][col];
    }

    /** Set cell at position - respects temporal ordering */
    setCell(row: number, col: number, char: string | null, strokeId: number): boolean {
        if (!this.isValidCoord(row, col)) return false;

        const cell = this.cells[row][col];
        const now = Date.now();

        // Erase always wins, otherwise most recent stroke wins
        if (char === null || strokeId >= cell.strokeId) {
            this.cells[row][col] = { char, strokeId, timestamp: now };
            return true;
        }
        return false;
    }

    /** Check if coordinate is within bounds */
    isValidCoord(row: number, col: number): boolean {
        return row >= 0 && row < this.rows && col >= 0 && col < this.cols;
    }

    /** Get all occupied cells */
    getOccupiedCells(): Array<{ row: number; col: number; char: string }> {
        const occupied: Array<{ row: number; col: number; char: string }> = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = this.cells[r][c];
                if (cell.char !== null) {
                    occupied.push({ row: r, col: c, char: cell.char });
                }
            }
        }
        return occupied;
    }

    /** Get cells grouped by character */
    getCellsByChar(): Map<string, GridCoord[]> {
        const byChar = new Map<string, GridCoord[]>();
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = this.cells[r][c];
                if (cell.char !== null) {
                    if (!byChar.has(cell.char)) {
                        byChar.set(cell.char, []);
                    }
                    byChar.get(cell.char)!.push({ row: r, col: c });
                }
            }
        }
        return byChar;
    }

    /** Count occupied cells */
    getOccupiedCount(): number {
        let count = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.cells[r][c].char !== null) count++;
            }
        }
        return count;
    }

    /** Clear all cells */
    clear(): void {
        this.cells = this.createEmptyGrid();
    }

    /** Convert to string representation (for verification) */
    toString(): string {
        const lines: string[] = [];
        for (let r = 0; r < this.rows; r++) {
            let line = '';
            for (let c = 0; c < this.cols; c++) {
                line += this.cells[r][c].char ?? ' ';
            }
            lines.push(line);
        }
        return lines.join('\n');
    }

    /** Create a snapshot for undo/redo */
    snapshot(): Cell[][] {
        return this.cells.map(row => row.map(cell => ({ ...cell })));
    }

    /** Restore from snapshot */
    restore(snapshot: Cell[][]): void {
        this.cells = snapshot.map(row => row.map(cell => ({ ...cell })));
    }
}
