/**
 * StorageManager - Saves patterns to LocalStorage
 */

import { Grid } from './Grid';

export interface SavedFrame {
    r: number;
    c: number;
    char: string;
}

export interface SavedPattern {
    id: string;
    name: string;
    timestamp: number;
    rows: number;
    cols: number;
    frames: SavedFrame[][]; // Array of frames, each frame is array of cells
}

export class StorageManager {
    private static readonly KEY = 'pattern_builder_saves_v2';

    static savePattern(name: string, grids: Grid[]): void {
        const saves = this.getSaves();

        const framesData: SavedFrame[][] = grids.map(grid => {
            const data: SavedFrame[] = [];
            for (let r = 0; r < grid.rows; r++) {
                for (let c = 0; c < grid.cols; c++) {
                    const cell = grid.getCell(r, c);
                    if (cell && cell.char) {
                        data.push({ r, c, char: cell.char });
                    }
                }
            }
            return data;
        });

        // Overwrite if name exists
        const existingIdx = saves.findIndex(s => s.name === name);
        if (existingIdx >= 0) saves.splice(existingIdx, 1);

        const pattern: SavedPattern = {
            id: Date.now().toString(),
            name,
            timestamp: Date.now(),
            rows: grids[0].rows,
            cols: grids[0].cols,
            frames: framesData
        };

        saves.push(pattern);
        localStorage.setItem(this.KEY, JSON.stringify(saves));
    }

    static getSaves(): SavedPattern[] {
        const json = localStorage.getItem(this.KEY);
        if (!json) return [];
        try {
            return JSON.parse(json);
        } catch {
            return [];
        }
    }

    static listPatterns(): string[] {
        return this.getSaves().map(s => s.name);
    }

    static loadPattern(name: string): SavedPattern | null {
        const saves = this.getSaves();
        return saves.find(s => s.name === name) || null;
    }

    static deletePattern(name: string): void {
        const saves = this.getSaves().filter(s => s.name !== name);
        localStorage.setItem(this.KEY, JSON.stringify(saves));
    }
}
