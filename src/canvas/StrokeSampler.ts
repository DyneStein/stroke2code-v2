/**
 * StrokeSampler - Shape algorithms (Filled & Outlined)
 */

import { SamplePoint } from '../core/types';

export class StrokeSampler {
    private static readonly MIN_DISTANCE = 2;
    private static readonly MIN_INTERVAL = 5;

    private brushMode: 'solid' | 'shading' | 'noise' = 'solid';
    private shadeChars = [' ', '.', ':', '+', '#', '@']; // Light to Dark

    private lastPoint: { x: number; y: number } | null = null;
    private lastTime = 0;
    private samples: SamplePoint[] = [];
    private currentChar = '#';

    startStroke(char: string): void {
        this.samples = [];
        this.lastPoint = null;
        this.lastTime = 0;
        this.currentChar = char;
    }

    setBrushMode(mode: 'solid' | 'shading' | 'noise'): void {
        this.brushMode = mode;
    }

    setShadeChars(chars: string): void {
        this.shadeChars = chars.split('');
    }

    addPoint(x: number, y: number): SamplePoint | null {
        const now = Date.now();
        const shouldSample =
            this.lastPoint === null ||
            this.distance(this.lastPoint, { x, y }) >= StrokeSampler.MIN_DISTANCE ||
            now - this.lastTime >= StrokeSampler.MIN_INTERVAL;

        if (shouldSample) {
            let char = this.currentChar;

            if (this.brushMode === 'shading') {
                // Time-based density? Or just random density?
                // Let's do random for "texture" feel
                const density = Math.random();
                const idx = Math.floor(density * this.shadeChars.length);
                char = this.shadeChars[idx];
            } else if (this.brushMode === 'noise') {
                // Random 50% chance
                if (Math.random() > 0.5) return null;
            }

            const sample: SamplePoint = { x, y, char, timestamp: now };
            this.samples.push(sample);
            this.lastPoint = { x, y };
            this.lastTime = now;
            return sample;
        }
        return null;
    }

    endStroke(): SamplePoint[] {
        const result = [...this.samples];
        this.samples = [];
        this.lastPoint = null;
        return result;
    }

    /** Line using Bresenham */
    static getLinePoints(x0: number, y0: number, x1: number, y1: number): Array<{ x: number; y: number }> {
        const points: Array<{ x: number; y: number }> = [];
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;
        let x = x0, y = y0;

        while (true) {
            points.push({ x, y });
            if (x === x1 && y === y1) break;
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x += sx; }
            if (e2 < dx) { err += dx; y += sy; }
        }
        return points;
    }

    // RECTANGLE
    static getRectPoints(c0: number, r0: number, c1: number, r1: number, filled: boolean): Array<{ x: number; y: number }> {
        const points: Array<{ x: number; y: number }> = [];
        const minC = Math.min(c0, c1), maxC = Math.max(c0, c1);
        const minR = Math.min(r0, r1), maxR = Math.max(r0, r1);

        if (filled) {
            for (let r = minR; r <= maxR; r++) {
                for (let c = minC; c <= maxC; c++) {
                    points.push({ x: c, y: r });
                }
            }
        } else {
            for (let c = minC; c <= maxC; c++) { points.push({ x: c, y: minR }); points.push({ x: c, y: maxR }); }
            for (let r = minR + 1; r < maxR; r++) { points.push({ x: minC, y: r }); points.push({ x: maxC, y: r }); }
        }
        return points;
    }

    // TRIANGLE
    static getTrianglePoints(c0: number, r0: number, c1: number, r1: number, filled: boolean): Array<{ x: number; y: number }> {
        const points: Array<{ x: number; y: number }> = [];
        // Vertices: (minC, maxR), (maxC, maxR), (midC, minR) - Isosceles-ish
        // Or users drag implies bounding box? Let's stick to Right-Angled for drag simplicity or the previous logic
        // Previous logic was right-angled. Let's make it smarter: Bounding Box -> Isosceles
        const minR = Math.min(r0, r1), maxR = Math.max(r0, r1);
        const minC = Math.min(c0, c1), maxC = Math.max(c0, c1);
        const midC = Math.floor((minC + maxC) / 2);

        const v1 = { c: midC, r: minR };
        const v2 = { c: minC, r: maxR };
        const v3 = { c: maxC, r: maxR };

        if (filled) {
            // Scanline or just check bounds? Simple scanline
            return this.scanTriangle(v1, v2, v3);
        } else {
            // Outline
            points.push(...this.getLinePoints(v1.c, v1.r, v2.c, v2.r));
            points.push(...this.getLinePoints(v2.c, v2.r, v3.c, v3.r));
            points.push(...this.getLinePoints(v3.c, v3.r, v1.c, v1.r));
            return points;
        }
    }

    private static scanTriangle(v1: any, v2: any, v3: any) {
        // Simple barycentric or bounding box check
        const points = [];
        const minC = Math.min(v1.c, v2.c, v3.c), maxC = Math.max(v1.c, v2.c, v3.c);
        const minR = Math.min(v1.r, v2.r, v3.r), maxR = Math.max(v1.r, v2.r, v3.r);

        for (let r = minR; r <= maxR; r++) {
            for (let c = minC; c <= maxC; c++) {
                if (this.isPointInTriangle(c, r, v1, v2, v3)) {
                    points.push({ x: c, y: r });
                }
            }
        }
        return points;
    }

    private static isPointInTriangle(x: number, y: number, v1: any, v2: any, v3: any) {
        const denominator = ((v2.r - v3.r) * (v1.c - v3.c) + (v3.c - v2.c) * (v1.r - v3.r));
        const a = ((v2.r - v3.r) * (x - v3.c) + (v3.c - v2.c) * (y - v3.r)) / denominator;
        const b = ((v3.r - v1.r) * (x - v3.c) + (v1.c - v3.c) * (y - v3.r)) / denominator;
        const c = 1 - a - b;
        return a >= 0 && a <= 1 && b >= 0 && b <= 1 && c >= 0 && c <= 1;
    }

    // DIAMOND
    static getDiamondPoints(c0: number, r0: number, c1: number, r1: number, filled: boolean): Array<{ x: number; y: number }> {
        const points: Array<{ x: number; y: number }> = [];
        const centerC = Math.round((c0 + c1) / 2);
        const centerR = Math.round((r0 + r1) / 2);
        const radiusC = Math.abs(c1 - c0) / 2;
        const radiusR = Math.abs(r1 - r0) / 2;

        const minR = Math.min(r0, r1), maxR = Math.max(r0, r1);

        if (filled) {
            for (let r = minR; r <= maxR; r++) {
                const distR = Math.abs(r - centerR) / radiusR;
                if (distR > 1) continue;
                const span = Math.round((1 - distR) * radiusC);
                for (let c = centerC - span; c <= centerC + span; c++) {
                    points.push({ x: c, y: r });
                }
            }
        } else {
            // Outline: 4 lines
            const top = { c: centerC, r: minR };
            const bottom = { c: centerC, r: maxR };
            const left = { c: Math.round(centerC - radiusC), r: centerR };
            const right = { c: Math.round(centerC + radiusC), r: centerR };

            points.push(...this.getLinePoints(top.c, top.r, right.c, right.r));
            points.push(...this.getLinePoints(right.c, right.r, bottom.c, bottom.r));
            points.push(...this.getLinePoints(bottom.c, bottom.r, left.c, left.r));
            points.push(...this.getLinePoints(left.c, left.r, top.c, top.r));
        }
        return points;
    }

    // CIRCLE
    static getCirclePoints(c0: number, r0: number, c1: number, r1: number, filled: boolean): Array<{ x: number; y: number }> {
        const points: Array<{ x: number; y: number }> = [];
        const centerC = (c0 + c1) / 2;
        const centerR = (r0 + r1) / 2;
        const radiusC = Math.abs(c1 - c0) / 2;
        const radiusR = Math.abs(r1 - r0) / 2;

        const minR = Math.floor(centerR - radiusR);
        const maxR = Math.ceil(centerR + radiusR);
        const minC = Math.floor(centerC - radiusC);
        const maxC = Math.ceil(centerC + radiusC);

        if (filled) {
            for (let r = minR; r <= maxR; r++) {
                for (let c = minC; c <= maxC; c++) {
                    const dx = (c - centerC) / radiusC;
                    const dy = (r - centerR) / radiusR;
                    if (dx * dx + dy * dy <= 1) {
                        points.push({ x: c, y: r });
                    }
                }
            }
        } else {
            // Simple outline scan
            for (let r = minR; r <= maxR; r++) {
                for (let c = minC; c <= maxC; c++) {
                    const dx = (c - centerC) / radiusC;
                    const dy = (r - centerR) / radiusR;
                    const dist = dx * dx + dy * dy;
                    // A bit fuzzy for small circles, but works for "pixel art" feel
                    if (dist <= 1 && dist >= 0.7) {
                        points.push({ x: c, y: r });
                    }
                }
            }
        }
        return points;
    }

    private distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
        return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    }
}
