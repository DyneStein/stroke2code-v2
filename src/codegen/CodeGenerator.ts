/**
 * CodeGenerator - Emits BASIC C++ code
 * 
 * RULES:
 * - ONLY #include <iostream>
 * - ONLY basic for loops
 * - ONLY simple if/else
 * - NO std::set, NO std::pair, NO advanced features
 * - For coordinate fallback: use simple OR chain
 */

import { Predicate, GeneratedCode, GridCoord } from '../core/types';

export class CodeGenerator {
    private predicates: Predicate[];
    private H: number;
    private W: number;
    private cellsByChar: Map<string, GridCoord[]>;

    constructor(
        predicates: Predicate[],
        H: number,
        W: number,
        cellsByChar: Map<string, GridCoord[]>
    ) {
        this.predicates = predicates;
        this.H = H;
        this.W = W;
        this.cellsByChar = cellsByChar;
    }

    /** Generate complete C++ program - BASIC ONLY */
    generate(): GeneratedCode {
        const warnings: string[] = [];
        const params = new Map<string, number>();
        params.set('H', this.H);
        params.set('W', this.W);

        const hasCoordinateSets = this.predicates.some(p => p.type === 'coordinate_set');
        const isScalable = !hasCoordinateSets;

        if (hasCoordinateSets) {
            warnings.push('⚠ Contains fixed coordinates - will not scale with H/W changes.');
        }

        const code = this.buildCode();

        return { code, params, warnings, isScalable };
    }

    private buildCode(): string {
        const lines: string[] = [];

        // ONLY iostream - nothing else
        lines.push('#include <iostream>');
        lines.push('using namespace std;');
        lines.push('');
        lines.push('int main() {');
        lines.push(`    int H = ${this.H};  // Height - change to scale`);
        lines.push(`    int W = ${this.W};  // Width - change to scale`);
        lines.push('');

        // Simple nested loops
        lines.push('    for (int r = 0; r < H; r++) {');
        lines.push('        for (int c = 0; c < W; c++) {');

        // Generate conditions
        const conditions = this.generateConditions();
        lines.push(conditions);

        lines.push('        }');
        lines.push('        cout << endl;');
        lines.push('    }');
        lines.push('');
        lines.push('    return 0;');
        lines.push('}');

        return lines.join('\n');
    }

    /** Generate simple if-else chain */
    private generateConditions(): string {
        if (this.predicates.length === 0) {
            return "            cout << ' ';";
        }

        const lines: string[] = [];

        for (let i = 0; i < this.predicates.length; i++) {
            const pred = this.predicates[i];
            const condition = this.predicateToCondition(pred);
            const charLiteral = this.charToLiteral(pred.char);

            if (i === 0) {
                lines.push(`            if (${condition}) {`);
            } else {
                lines.push(`            } else if (${condition}) {`);
            }
            lines.push(`                cout << ${charLiteral};`);
        }

        // Default: space
        lines.push('            } else {');
        lines.push("                cout << ' ';");
        lines.push('            }');

        return lines.join('\n');
    }

    /** Convert predicate to BASIC C++ condition */
    private predicateToCondition(pred: Predicate): string {
        // If it's a coordinate set, generate simple OR chain
        if (pred.type === 'coordinate_set') {
            const cells = this.cellsByChar.get(pred.char) || [];
            return this.generateCoordinateCondition(cells);
        }
        return pred.expression;
    }

    /** Generate simple (r==X && c==Y) || ... chain */
    private generateCoordinateCondition(cells: GridCoord[]): string {
        if (cells.length === 0) return 'false';

        // If too many cells, group by row for readability
        if (cells.length > 20) {
            return this.generateGroupedCondition(cells);
        }

        // Simple OR chain
        const conditions = cells.map(c => `(r==${c.row} && c==${c.col})`);

        // Break into lines if many conditions
        if (conditions.length <= 5) {
            return conditions.join(' || ');
        }

        // Multi-line for readability
        return conditions.join(' ||\n                ');
    }

    /** Group coordinates by row for cleaner code */
    private generateGroupedCondition(cells: GridCoord[]): string {
        // Group cells by row
        const byRow = new Map<number, number[]>();
        for (const cell of cells) {
            if (!byRow.has(cell.row)) {
                byRow.set(cell.row, []);
            }
            byRow.get(cell.row)!.push(cell.col);
        }

        const rowConditions: string[] = [];
        for (const [row, cols] of byRow) {
            if (cols.length === 1) {
                rowConditions.push(`(r==${row} && c==${cols[0]})`);
            } else {
                // Multiple columns in same row
                const colChecks = cols.map(c => `c==${c}`).join(' || ');
                rowConditions.push(`(r==${row} && (${colChecks}))`);
            }
        }

        return rowConditions.join(' ||\n                ');
    }

    /** Convert character to C++ char literal */
    private charToLiteral(char: string): string {
        switch (char) {
            case '\\': return "'\\\\'";
            case '\'': return "'\\''";
            case '\n': return "'\\n'";
            case '\t': return "'\\t'";
            default: return `'${char}'`;
        }
    }
}
