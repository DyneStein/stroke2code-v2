/**
 * App Entry - Dynamic Sizing & Feature Wiring
 */

import './styles/main.css';

import { CanvasManager, ExtendedToolType } from './canvas/CanvasManager';
import { PatternAnalyzer } from './analysis/PatternAnalyzer';
import { CodeGenerator } from './codegen/CodeGenerator';
import { Grid } from './core/Grid';
import { StorageManager } from './core/StorageManager';

class App {
    private canvasManager!: CanvasManager;
    private codeOutput!: HTMLElement;
    private terminalPreview!: HTMLElement;
    private cursorPos!: HTMLElement;
    private gridDims!: HTMLElement;
    private cellCount!: HTMLElement;

    // Default cell size target
    private readonly TARGET_CELL_SIZE = 26;

    constructor() {
        this.cacheElements();
        this.initializeCanvas();
        this.setupUI();

        const wrapper = document.querySelector('.canvas-wrapper');
        if (wrapper) {
            new ResizeObserver(() => {
                if (this.resizeTimer) clearTimeout(this.resizeTimer);
                this.resizeTimer = setTimeout(() => this.fitCanvasToScreen(), 100);
            }).observe(wrapper);
        }

        // Safety check: force resize attempts if 0x0
        this.ensureCanvasSize();
    }
    private resizeTimer: any;

    private cacheElements(): void {
        this.codeOutput = document.getElementById('code-output')!;
        this.terminalPreview = document.getElementById('terminal-preview')!;
        this.cursorPos = document.getElementById('cursor-pos')!;
        this.gridDims = document.getElementById('grid-dims')!;
        this.cellCount = document.getElementById('cell-count')!;
    }

    private initializeCanvas(): void {
        const canvas = document.getElementById('drawing-canvas') as HTMLCanvasElement;
        this.canvasManager = new CanvasManager(canvas, 10, 10);

        this.canvasManager.onGridChange = (grid) => {
            this.updateStats(grid);
            this.liveUpdate(grid);
        };

        this.canvasManager.onCursorMove = (r, c) => {
            this.cursorPos.textContent = `Row ${r}, Col ${c}`;
        };

        // Initial fit attempt
        setTimeout(() => this.fitCanvasToScreen(), 50);
    }

    private ensureCanvasSize(): void {
        let attempts = 0;
        const check = setInterval(() => {
            attempts++;
            const wrapper = document.querySelector('.canvas-wrapper') as HTMLElement;
            if (wrapper && wrapper.clientWidth > 0 && wrapper.clientHeight > 0) {
                this.fitCanvasToScreen();
                // If we have successful dims, stop checking
                if (this.canvasManager.getGrid().rows > 0) clearInterval(check);
            }
            if (attempts > 20) clearInterval(check); // Stop after 10s (20 * 500ms)
        }, 500);
    }

    private fitCanvasToScreen(): void {
        const wrapper = document.querySelector('.canvas-wrapper') as HTMLElement;
        if (!wrapper) return;

        const width = wrapper.clientWidth;
        const height = wrapper.clientHeight;

        // If hidden or collapsed, don't break state, just return
        if (width === 0 || height === 0) return;

        const cols = Math.floor(width / this.TARGET_CELL_SIZE);
        const rows = Math.floor(height / this.TARGET_CELL_SIZE);

        // Prevent 0x0 if small container
        if (cols <= 0 || rows <= 0) return;

        const pxWidth = cols * this.TARGET_CELL_SIZE;
        const pxHeight = rows * this.TARGET_CELL_SIZE;

        this.canvasManager.resize(rows, cols, pxWidth, pxHeight);
        this.gridDims.textContent = `${rows}x${cols}`;
    }

    private setupUI(): void {
        // 1. Tool Selection
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.id === 'layer-fg' || btn.id === 'layer-bg') return;
                document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
                if (btn.hasAttribute('data-tool')) {
                    btn.classList.add('active');
                    const tool = btn.getAttribute('data-tool') as ExtendedToolType;
                    this.canvasManager.setTool(tool);
                }
            });
        });

        // 2. Undo / Redo
        document.getElementById('undo-btn')!.addEventListener('click', () => this.canvasManager.undo());
        document.getElementById('redo-btn')!.addEventListener('click', () => this.canvasManager.redo());

        // 3. Layers
        const layerFg = document.getElementById('layer-fg')!;
        const layerBg = document.getElementById('layer-bg')!;
        layerFg.addEventListener('click', () => {
            layerFg.classList.add('active'); layerBg.classList.remove('active');
            this.canvasManager.setActiveLayer('foreground');
        });
        layerBg.addEventListener('click', () => {
            layerBg.classList.add('active'); layerFg.classList.remove('active');
            this.canvasManager.setActiveLayer('background');
        });

        // 4. Fill Toggle
        const fillBtn = document.getElementById('toggle-fill')!;
        fillBtn.addEventListener('click', () => {
            this.canvasManager.isFilled = !this.canvasManager.isFilled;
            fillBtn.classList.toggle('active', this.canvasManager.isFilled);
            fillBtn.innerHTML = this.canvasManager.isFilled ?
                '<span class="material-icons-round">format_color_fill</span> Fill' :
                '<span class="material-icons-round">check_box_outline_blank</span> Outline';
        });

        // 5. Symmetry (X/Y)
        const symX = document.getElementById('sym-x')!;
        symX.addEventListener('click', () => {
            this.canvasManager.symmetryX = !this.canvasManager.symmetryX;
            symX.classList.toggle('active', this.canvasManager.symmetryX);
        });
        const symY = document.getElementById('sym-y')!;
        symY.addEventListener('click', () => {
            this.canvasManager.symmetryY = !this.canvasManager.symmetryY;
            symY.classList.toggle('active', this.canvasManager.symmetryY);
        });

        // 6. Transforms
        document.getElementById('flip-h')!.addEventListener('click', () => this.canvasManager.flipHorizontal());
        document.getElementById('flip-v')!.addEventListener('click', () => this.canvasManager.flipVertical());

        // 7. Timeline
        const frameCounter = document.getElementById('frame-counter')!;
        const updateFrameInfo = (idx: number, total: number) => {
            frameCounter.textContent = `Frame ${idx + 1} / ${total}`;
        };

        this.canvasManager.onFrameUpdate = (idx, total) => {
            updateFrameInfo(idx, total);
            this.liveUpdate(this.canvasManager.getGrid());
            this.updateStats(this.canvasManager.getGrid());
        };

        document.getElementById('prev-frame')!.addEventListener('click', () => this.canvasManager.frameManager.prevFrame());
        document.getElementById('next-frame')!.addEventListener('click', () => this.canvasManager.frameManager.nextFrame());
        document.getElementById('add-frame')!.addEventListener('click', () => this.canvasManager.frameManager.addFrame());
        document.getElementById('copy-frame')!.addEventListener('click', () => this.canvasManager.frameManager.addFrame(true));
        document.getElementById('del-frame')!.addEventListener('click', () => this.canvasManager.frameManager.deleteCurrentFrame());

        // 8. Playback
        let isPlaying = false;
        let playTimer: any;
        const playBtn = document.getElementById('play-anim')!;

        playBtn.addEventListener('click', () => {
            isPlaying = !isPlaying;
            playBtn.classList.toggle('active', isPlaying);
            playBtn.innerHTML = isPlaying ? '<span class="material-icons-round">stop</span>' : '<span class="material-icons-round">play_arrow</span>';

            if (isPlaying) {
                const playLoop = () => {
                    this.canvasManager.frameManager.nextFrame();
                    if (this.canvasManager.frameManager.getCurrentIndex() === this.canvasManager.frameManager.getFrameCount() - 1) {
                        setTimeout(() => this.canvasManager.frameManager.gotoFrame(0), 200);
                    }
                    playTimer = setTimeout(playLoop, 200);
                };
                playLoop();
            } else {
                clearTimeout(playTimer);
            }
        });

        // 9. Brush Logic
        document.getElementById('brush-char')!.addEventListener('input', (e) => this.canvasManager.setChar((e.target as HTMLInputElement).value));
        const paletteContainer = document.getElementById('palette-container')!;

        document.getElementById('brush-mode')!.addEventListener('change', (e) => {
            const mode = (e.target as HTMLSelectElement).value as any;
            this.canvasManager.setBrushMode(mode);
            if (mode === 'shading') paletteContainer.classList.remove('hidden');
            else paletteContainer.classList.add('hidden');
        });

        document.getElementById('custom-palette')!.addEventListener('input', (e) => {
            const val = (e.target as HTMLInputElement).value;
            if (val.length > 0) this.canvasManager.setShadeChars(val);
        });

        // 10. Exports
        document.getElementById('export-png')!.addEventListener('click', () => {
            const canvas = document.getElementById('drawing-canvas') as HTMLCanvasElement;
            const link = document.createElement('a');
            link.download = `pattern-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        });

        document.getElementById('export-json')!.addEventListener('click', () => {
            // Serialize everything
            const data = {
                version: 2,
                timestamp: Date.now(),
                rows: this.canvasManager.frameManager.getCurrentGrid().rows,
                cols: this.canvasManager.frameManager.getCurrentGrid().cols,
                background: this.gridToData(this.canvasManager.backgroundGrid),
                frames: this.canvasManager.frameManager.getAllFrames().map(g => this.gridToData(g))
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            link.download = `pattern-${Date.now()}.json`;
            link.href = URL.createObjectURL(blob);
            link.click();
        });

        // 11. Custom Keyboard Listeners
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); this.canvasManager.undo(); }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); this.canvasManager.redo(); }
        });

        // 12. Gallery Utils
        document.getElementById('new-btn')!.addEventListener('click', () => {
            if (confirm('Are you sure you want to start a new project? All unsaved changes will be lost.')) {
                this.canvasManager.resetProject();
            }
        });
        document.getElementById('save-btn')!.addEventListener('click', () => {
            const name = prompt('Enter pattern name:');
            if (name) {
                StorageManager.savePattern(name, this.canvasManager.frameManager.getAllFrames());
                alert(`Pattern "${name}" saved!`);
            }
        });

        document.getElementById('load-btn')!.addEventListener('click', async () => {
            const patterns = StorageManager.listPatterns();
            if (patterns.length === 0) { alert('No saved patterns found.'); return; }
            const patternName = prompt('Enter pattern name to load:\n' + patterns.map((p: string) => `- ${p}`).join('\n'));
            if (patternName) {
                const saved = StorageManager.loadPattern(patternName);
                if (saved) {
                    this.canvasManager.resize(saved.rows, saved.cols, saved.cols * this.TARGET_CELL_SIZE, saved.rows * this.TARGET_CELL_SIZE);
                    this.canvasManager.frameManager.loadFrames(saved.frames as any, saved.rows, saved.cols);
                    // TODO: Load background if version 2? Currently StorageManager only does frames.
                    // For now, loading resets background.
                } else { alert(`Pattern "${patternName}" not found.`); }
            }
        });

        document.getElementById('clear-canvas')!.addEventListener('click', () => this.canvasManager.clear());

        document.getElementById('copy-code')!.addEventListener('click', (e) => {
            navigator.clipboard.writeText(this.codeOutput.textContent || '');
            const target = e.target as HTMLButtonElement;
            const old = target.textContent;
            target.textContent = "Copied!";
            setTimeout(() => target.textContent = old, 1500);
        });

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const tab = btn.getAttribute('data-tab');
                document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
                document.getElementById(`tab-${tab}`)!.classList.remove('hidden');
            });
        });
    }

    // Helper for JSON Export
    private gridToData(grid: Grid) {
        const data: any[] = [];
        for (let r = 0; r < grid.rows; r++) {
            for (let c = 0; c < grid.cols; c++) {
                const cell = grid.getCell(r, c);
                if (cell && cell.char) data.push({ r, c, char: cell.char });
            }
        }
        return data;
    }

    private updateStats(grid: Grid): void {
        this.cellCount.textContent = `${grid.getOccupiedCount()} cells`;
    }

    private liveUpdate(grid: Grid): void {
        if (grid.getOccupiedCount() === 0) {
            this.codeOutput.innerHTML = '<code>// Draw to generate code</code>';
            this.terminalPreview.textContent = '';
            return;
        }
        const analyzer = new PatternAnalyzer(grid);
        const analysis = analyzer.analyze();
        const generator = new CodeGenerator(analysis.predicates, grid.rows, grid.cols, analyzer.getCellsByChar());
        const result = generator.generate();

        this.codeOutput.innerHTML = `<code>${this.escapeHtml(result.code)}</code>`;
        this.terminalPreview.textContent = grid.toString();
    }

    private escapeHtml(text: string): string { return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
}

document.addEventListener('DOMContentLoaded', () => new App());
