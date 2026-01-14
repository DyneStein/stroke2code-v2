/**
 * PatternAnalyzer - Discovers algebraic patterns in grid data
 * 
 * This is the core analysis engine that attempts to find
 * parameterized predicates for occupied cells.
 */

import { Grid } from '../core/Grid';
import { GridCoord, Predicate, AnalysisResult } from '../core/types';

export class PatternAnalyzer {
    private grid: Grid;
    private H: number;
    private W: number;

    constructor(grid: Grid) {
        this.grid = grid;
        this.H = grid.rows;
        this.W = grid.cols;
    }

    /** Main analysis entry point */
    analyze(): AnalysisResult {
        const cellsByChar = this.grid.getCellsByChar();
        const predicates: Predicate[] = [];
        const warnings: string[] = [];
        let isFullyParametric = true;

        for (const [char, cells] of cellsByChar) {
            const predicate = this.discoverPredicate(cells, char);
            predicates.push(predicate);

            if (!predicate.isScalable) {
                isFullyParametric = false;
                warnings.push(
                    `Character '${char}': Pattern could not be parameterized. ` +
                    `Using coordinate set (${cells.length} points).`
                );
            }
        }

        if (!isFullyParametric) {
            warnings.push(
                '\n⚠ WARNING: Some patterns use coordinate sets.\n' +
                'Changing H or W will NOT scale these patterns proportionally.'
            );
        }

        return { predicates, warnings, isFullyParametric };
    }

    /** Attempt to find the best predicate for a set of cells */
    private discoverPredicate(cells: GridCoord[], char: string): Predicate {
        // Try each detector in priority order
        const detectors: Array<() => Predicate | null> = [
            () => this.tryFill(cells, char),
            () => this.tryBorder(cells, char),
            () => this.tryDiagonal(cells, char),
            () => this.tryAntiDiagonal(cells, char),
            () => this.tryHorizontalLine(cells, char),
            () => this.tryVerticalLine(cells, char),
            () => this.tryFilledRectangle(cells, char),
            () => this.tryCheckerboard(cells, char),
        ];

        for (const detector of detectors) {
            const result = detector();
            if (result) return result;
        }

        // Fallback: coordinate set
        return this.fallbackCoordinateSet(cells, char);
    }

    /** Check if ALL cells are filled */
    private tryFill(cells: GridCoord[], char: string): Predicate | null {
        if (cells.length !== this.H * this.W) return null;

        return {
            type: 'filled_rect',
            char,
            expression: 'true',
            params: ['H', 'W'],
            isScalable: true,
            confidence: 1.0
        };
    }

    /** Check for border pattern */
    private tryBorder(cells: GridCoord[], char: string): Predicate | null {
        const cellSet = new Set(cells.map(c => `${c.row},${c.col}`));

        // Expected border cells
        const expectedBorder = new Set<string>();
        for (let c = 0; c < this.W; c++) {
            expectedBorder.add(`0,${c}`);
            expectedBorder.add(`${this.H - 1},${c}`);
        }
        for (let r = 1; r < this.H - 1; r++) {
            expectedBorder.add(`${r},0`);
            expectedBorder.add(`${r},${this.W - 1}`);
        }

        // Check exact match
        if (cellSet.size !== expectedBorder.size) return null;
        for (const key of expectedBorder) {
            if (!cellSet.has(key)) return null;
        }

        return {
            type: 'border',
            char,
            expression: 'r == 0 || r == H-1 || c == 0 || c == W-1',
            params: ['H', 'W'],
            isScalable: true,
            confidence: 1.0
        };
    }

    /** Check for main diagonal (r == c) */
    private tryDiagonal(cells: GridCoord[], char: string): Predicate | null {
        const minDim = Math.min(this.H, this.W);
        if (cells.length !== minDim) return null;

        for (const cell of cells) {
            if (cell.row !== cell.col) return null;
        }

        return {
            type: 'diagonal',
            char,
            expression: 'r == c',
            params: ['H', 'W'],
            isScalable: true,
            confidence: 1.0
        };
    }

    /** Check for anti-diagonal (r + c == min(H,W) - 1) */
    private tryAntiDiagonal(cells: GridCoord[], char: string): Predicate | null {
        const minDim = Math.min(this.H, this.W);
        if (cells.length !== minDim) return null;

        const target = minDim - 1;
        for (const cell of cells) {
            if (cell.row + cell.col !== target) return null;
        }

        // Use parametric expression
        const expr = this.H <= this.W
            ? 'r + c == H - 1 && c < H'
            : 'r + c == W - 1 && r < W';

        return {
            type: 'anti_diagonal',
            char,
            expression: expr,
            params: ['H', 'W'],
            isScalable: true,
            confidence: 1.0
        };
    }

    /** Check for horizontal line */
    private tryHorizontalLine(cells: GridCoord[], char: string): Predicate | null {
        if (cells.length !== this.W) return null;

        const row = cells[0].row;
        for (const cell of cells) {
            if (cell.row !== row) return null;
        }

        // Check if row has parametric meaning
        const param = this.parameterizeValue(row, this.H, 'H');

        return {
            type: 'horizontal_line',
            char,
            expression: `r == ${param}`,
            params: param.includes('H') ? ['H', 'W'] : ['W'],
            isScalable: param.includes('H'),
            confidence: param.includes('H') ? 1.0 : 0.5
        };
    }

    /** Check for vertical line */
    private tryVerticalLine(cells: GridCoord[], char: string): Predicate | null {
        if (cells.length !== this.H) return null;

        const col = cells[0].col;
        for (const cell of cells) {
            if (cell.col !== col) return null;
        }

        // Check if col has parametric meaning
        const param = this.parameterizeValue(col, this.W, 'W');

        return {
            type: 'vertical_line',
            char,
            expression: `c == ${param}`,
            params: param.includes('W') ? ['H', 'W'] : ['H'],
            isScalable: param.includes('W'),
            confidence: param.includes('W') ? 1.0 : 0.5
        };
    }

    /** Check for filled rectangle region */
    private tryFilledRectangle(cells: GridCoord[], char: string): Predicate | null {
        if (cells.length === 0) return null;

        // Find bounding box
        let minR = Infinity, maxR = -Infinity;
        let minC = Infinity, maxC = -Infinity;

        for (const cell of cells) {
            minR = Math.min(minR, cell.row);
            maxR = Math.max(maxR, cell.row);
            minC = Math.min(minC, cell.col);
            maxC = Math.max(maxC, cell.col);
        }

        // Check if all cells in bounding box are filled
        const expectedCount = (maxR - minR + 1) * (maxC - minC + 1);
        if (cells.length !== expectedCount) return null;

        const cellSet = new Set(cells.map(c => `${c.row},${c.col}`));
        for (let r = minR; r <= maxR; r++) {
            for (let c = minC; c <= maxC; c++) {
                if (!cellSet.has(`${r},${c}`)) return null;
            }
        }

        // Parameterize bounds
        const r1 = this.parameterizeValue(minR, this.H, 'H');
        const r2 = this.parameterizeValue(maxR + 1, this.H, 'H');
        const c1 = this.parameterizeValue(minC, this.W, 'W');
        const c2 = this.parameterizeValue(maxC + 1, this.W, 'W');

        const isScalable =
            r1.includes('H') || r2.includes('H') ||
            c1.includes('W') || c2.includes('W');

        return {
            type: 'filled_rect',
            char,
            expression: `r >= ${r1} && r < ${r2} && c >= ${c1} && c < ${c2}`,
            params: ['H', 'W'],
            isScalable,
            confidence: isScalable ? 1.0 : 0.7
        };
    }

    /** Check for checkerboard pattern */
    private tryCheckerboard(cells: GridCoord[], char: string): Predicate | null {
        // Expected: half the cells (rounded)
        const expectedCount = Math.ceil((this.H * this.W) / 2);
        if (Math.abs(cells.length - expectedCount) > 1) return null;

        // Check if all cells satisfy (r + c) % 2 == 0 or == 1
        let evenCount = 0;
        let oddCount = 0;

        for (const cell of cells) {
            if ((cell.row + cell.col) % 2 === 0) evenCount++;
            else oddCount++;
        }

        if (evenCount === cells.length) {
            return {
                type: 'checkerboard',
                char,
                expression: '(r + c) % 2 == 0',
                params: ['H', 'W'],
                isScalable: true,
                confidence: 1.0
            };
        }

        if (oddCount === cells.length) {
            return {
                type: 'checkerboard',
                char,
                expression: '(r + c) % 2 == 1',
                params: ['H', 'W'],
                isScalable: true,
                confidence: 1.0
            };
        }

        return null;
    }

    /** Fallback: explicit coordinate set */
    private fallbackCoordinateSet(cells: GridCoord[], char: string): Predicate {
        // Generate set literal (stored for debugging/documentation)
        const _coords = cells.map(c => `{${c.row}, ${c.col}}`).join(', ');

        return {
            type: 'coordinate_set',
            char,
            expression: `occupied_${char.charCodeAt(0)}.count({r, c})`,
            params: [],
            isScalable: false,
            confidence: 0.0
        };
    }

    /** Convert a literal value to a parametric expression if possible */
    private parameterizeValue(value: number, dimension: number, dimName: string): string {
        if (value === 0) return '0';
        if (value === dimension) return dimName;
        if (value === dimension - 1) return `${dimName}-1`;
        if (value === Math.floor(dimension / 2)) return `${dimName}/2`;
        if (value === dimension - 2) return `${dimName}-2`;

        // Check for fraction relationships
        if (dimension % 4 === 0 && value === dimension / 4) return `${dimName}/4`;
        if (dimension % 3 === 0 && value === dimension / 3) return `${dimName}/3`;

        // No parametric relationship found
        return value.toString();
    }

    /** Get cells grouped by character (for code generation) */
    getCellsByChar(): Map<string, GridCoord[]> {
        return this.grid.getCellsByChar();
    }
}
