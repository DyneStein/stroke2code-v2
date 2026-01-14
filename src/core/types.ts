/**
 * Core type definitions for the stroke-to-code platform
 */

/** A single cell in the grid */
export interface Cell {
    char: string | null;  // null = empty
    strokeId: number;     // which stroke placed this (-1 if empty)
    timestamp: number;    // when it was placed
}

/** Coordinates in the grid */
export interface GridCoord {
    row: number;
    col: number;
}

/** A sampled point from user input */
export interface SamplePoint {
    x: number;            // pixel x
    y: number;            // pixel y
    char: string;         // character to place
    timestamp: number;
}

/** A complete stroke with its samples */
export interface Stroke {
    id: number;
    samples: SamplePoint[];
    tool: ToolType;
}

/** Available drawing tools */
export type ToolType = 'draw' | 'line' | 'rectangle' | 'erase';

/** A predicate that describes when a cell should be filled */
export interface Predicate {
    type: PredicateType;
    char: string;
    expression: string;       // The C++ condition string
    params: string[];         // Parameters used (e.g., ['H', 'W'])
    isScalable: boolean;      // Whether this scales with dimensions
    confidence: number;       // 0-1, how confident we are in this pattern
}

export type PredicateType =
    | 'border'
    | 'diagonal'
    | 'anti_diagonal'
    | 'horizontal_line'
    | 'vertical_line'
    | 'filled_rect'
    | 'checkerboard'
    | 'coordinate_set';

/** Result of pattern analysis */
export interface AnalysisResult {
    predicates: Predicate[];
    warnings: string[];
    isFullyParametric: boolean;
}

/** Generated C++ code output */
export interface GeneratedCode {
    code: string;
    params: Map<string, number>;   // Parameter name -> default value
    warnings: string[];
    isScalable: boolean;
}

/** Validation result comparing grid to output */
export interface ValidationResult {
    valid: boolean;
    differences: Difference[];
}

export interface Difference {
    row: number;
    col: number;
    expected: string;
    actual: string;
}
