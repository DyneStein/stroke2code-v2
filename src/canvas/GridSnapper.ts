/**
 * GridSnapper - Converts pixel coordinates to grid cells
 * 
 * This is a PURE function. Same pixel → same cell. Always.
 */

import { GridCoord } from '../core/types';

export class GridSnapper {
    private cellWidth: number;
    private cellHeight: number;
    private gridRows: number;
    private gridCols: number;

    constructor(
        canvasWidth: number,
        canvasHeight: number,
        gridRows: number,
        gridCols: number
    ) {
        this.gridRows = gridRows;
        this.gridCols = gridCols;
        this.cellWidth = canvasWidth / gridCols;
        this.cellHeight = canvasHeight / gridRows;
    }

    /** Update dimensions when canvas or grid size changes */
    updateDimensions(
        canvasWidth: number,
        canvasHeight: number,
        gridRows: number,
        gridCols: number
    ): void {
        this.gridRows = gridRows;
        this.gridCols = gridCols;
        this.cellWidth = canvasWidth / gridCols;
        this.cellHeight = canvasHeight / gridRows;
    }

    /** Snap pixel coordinates to grid cell */
    snap(x: number, y: number): GridCoord {
        const col = Math.floor(x / this.cellWidth);
        const row = Math.floor(y / this.cellHeight);

        return {
            row: this.clamp(row, 0, this.gridRows - 1),
            col: this.clamp(col, 0, this.gridCols - 1)
        };
    }

    /** Get pixel bounds for a cell (for rendering) */
    getCellBounds(row: number, col: number): { x: number; y: number; w: number; h: number } {
        return {
            x: col * this.cellWidth,
            y: row * this.cellHeight,
            w: this.cellWidth,
            h: this.cellHeight
        };
    }

    /** Get cell dimensions */
    getCellSize(): { width: number; height: number } {
        return { width: this.cellWidth, height: this.cellHeight };
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }
}
