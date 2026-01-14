/**
 * OutputValidator - Character-perfect validation of generated output
 */

import { Grid } from '../core/Grid';
import { ValidationResult, Difference } from '../core/types';

export class OutputValidator {
    /** Validate that program output matches the grid exactly */
    static validate(grid: Grid, programOutput: string): ValidationResult {
        const expected = grid.toString();
        const actual = programOutput.trimEnd(); // Remove trailing newline

        if (expected === actual) {
            return { valid: true, differences: [] };
        }

        return {
            valid: false,
            differences: this.computeDiff(expected, actual)
        };
    }

    /** Compute character-level differences */
    private static computeDiff(expected: string, actual: string): Difference[] {
        const diffs: Difference[] = [];

        const expectedLines = expected.split('\n');
        const actualLines = actual.split('\n');

        const maxRows = Math.max(expectedLines.length, actualLines.length);

        for (let r = 0; r < maxRows; r++) {
            const expLine = expectedLines[r] ?? '';
            const actLine = actualLines[r] ?? '';

            const maxCols = Math.max(expLine.length, actLine.length);

            for (let c = 0; c < maxCols; c++) {
                const expChar = expLine[c] ?? ' ';
                const actChar = actLine[c] ?? ' ';

                if (expChar !== actChar) {
                    diffs.push({
                        row: r,
                        col: c,
                        expected: this.formatChar(expChar),
                        actual: this.formatChar(actChar)
                    });
                }
            }
        }

        return diffs;
    }

    /** Format character for display */
    private static formatChar(char: string): string {
        if (char === ' ') return '(space)';
        if (char === '\t') return '(tab)';
        if (char === '\n') return '(newline)';
        return `'${char}'`;
    }

    /** Generate diff report */
    static formatDiffReport(result: ValidationResult): string {
        if (result.valid) {
            return '✓ Output matches grid exactly.';
        }

        const lines = ['✗ Output does not match grid:', ''];

        // Limit to first 10 differences
        const shown = result.differences.slice(0, 10);

        for (const diff of shown) {
            lines.push(
                `  Row ${diff.row}, Col ${diff.col}: ` +
                `expected ${diff.expected}, got ${diff.actual}`
            );
        }

        if (result.differences.length > 10) {
            lines.push(`  ... and ${result.differences.length - 10} more differences`);
        }

        return lines.join('\n');
    }
}
