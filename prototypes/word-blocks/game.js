// Word Blocks Game - Mobile-First Word Puzzle
// VERSION: 1.5 (increment by 0.1 for each change unless specified otherwise)

class WordBlocksGame {
    constructor() {
        // DOM elements
        this.gridContainer = document.getElementById('grid-container');
        this.debugBtn = document.getElementById('debug-btn');
        this.debugOverlay = document.getElementById('debug-overlay');
        this.debugCloseBtn = document.getElementById('debug-close-btn');
        this.forceRestartBtn = document.getElementById('force-restart-btn');

        // Config sliders
        this.disappearTimeSlider = document.getElementById('disappear-time-slider');
        this.disappearTimeValue = document.getElementById('disappear-time-value');
        this.fallTimeSlider = document.getElementById('fall-time-slider');
        this.fallTimeValue = document.getElementById('fall-time-value');
        this.blockSizeSlider = document.getElementById('block-size-slider');
        this.blockSizeValue = document.getElementById('block-size-value');

        // Progress bar elements
        this.progressText = document.getElementById('progress-text');
        this.progressBarFill = document.getElementById('progress-bar-fill');

        // Longest word elements
        this.longestWordContainer = document.getElementById('longest-word-container');
        this.longestWordText = document.getElementById('longest-word-text');

        // Challenge friend elements
        this.challengeFriendBtn = document.getElementById('challenge-friend-btn');
        this.challengePopup = document.getElementById('challenge-popup');
        this.popupCloseBtn = document.getElementById('popup-close-btn');
        this.challengeText = document.getElementById('challenge-text');
        this.copyBtn = document.getElementById('copy-btn');

        // Seeded random number generator for daily puzzles
        this.seedRng();

        // Config values
        this.disappearTime = 300; // ms
        this.fallTime = 300; // ms
        this.blockSize = 50; // px - size of each cell
        this.blockGap = 8; // px - gap between blocks

        // Grid settings
        this.gridSize = 5;
        this.grid = []; // 2D array of letters
        this.cellElements = []; // 2D array of DOM elements
        this.totalBlocks = this.gridSize * this.gridSize; // Total number of blocks in the grid

        // Letter distribution
        this.letterDistribution = {};
        this.letterPool = []; // Flat array of letters based on weights

        // Selection state
        this.isSelecting = false;
        this.selectedCells = []; // Array of {row, col} objects
        this.currentWord = '';

        // Longest word tracking
        this.longestWord = '';

        // Touch tracking
        this.lastTouchedCell = null;

        this.init();
    }

    // Calculate the pixel position for a block at given row/col
    getBlockPosition(row, col) {
        // Get the current padding from the grid container to ensure proper centering
        const computedStyle = getComputedStyle(this.gridContainer);
        const padding = parseFloat(computedStyle.paddingTop);

        const top = row * (this.blockSize + this.blockGap) + padding;
        const left = col * (this.blockSize + this.blockGap) + padding;

        return { top, left };
    }

    // Initialize seeded random number generator using current date
    seedRng() {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1; // Months are 0-indexed
        const day = today.getDate();

        // Create a seed from YYYYMMDD (e.g., 20251117)
        this.seed = year * 10000 + month * 100 + day;
    }

    // Seeded random number generator using mulberry32 algorithm
    // Returns a pseudo-random number between 0 and 1
    seededRandom() {
        let t = this.seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }

    async init() {
        await this.loadLetterDistribution();
        this.setupEventListeners();
        this.setupConfigListeners();
        this.updateCSSVariables();
        this.initializeGrid();
        this.renderGrid();
        this.updateProgress();
    }

    async loadLetterDistribution() {
        const response = await fetch('LetterDistribution.json');
        this.letterDistribution = await response.json();

        // Create a flat array of letters based on their weights
        this.letterPool = [];
        for (const [letter, weight] of Object.entries(this.letterDistribution)) {
            for (let i = 0; i < weight; i++) {
                this.letterPool.push(letter);
            }
        }
    }

    getRandomLetter() {
        const randomIndex = Math.floor(this.seededRandom() * this.letterPool.length);
        return this.letterPool[randomIndex];
    }

    initializeGrid() {
        // Initialize grid with random letters
        this.grid = [];
        for (let row = 0; row < this.gridSize; row++) {
            this.grid[row] = [];
            for (let col = 0; col < this.gridSize; col++) {
                this.grid[row][col] = this.getRandomLetter();
            }
        }
    }

    renderGrid() {
        // Clear existing grid
        this.gridContainer.innerHTML = '';
        this.cellElements = [];

        // Create grid cells with absolute positioning
        for (let row = 0; row < this.gridSize; row++) {
            this.cellElements[row] = [];
            for (let col = 0; col < this.gridSize; col++) {
                const cell = document.createElement('div');
                cell.className = 'letter-cell';
                cell.textContent = this.grid[row][col];
                cell.dataset.row = row;
                cell.dataset.col = col;

                // Set absolute position
                const { top, left } = this.getBlockPosition(row, col);
                cell.style.top = `${top}px`;
                cell.style.left = `${left}px`;

                this.cellElements[row][col] = cell;
                this.gridContainer.appendChild(cell);
            }
        }
    }

    // Update all block positions (useful when block size changes)
    updateAllBlockPositions() {
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const { top, left } = this.getBlockPosition(row, col);
                this.cellElements[row][col].style.top = `${top}px`;
                this.cellElements[row][col].style.left = `${left}px`;
            }
        }
    }

    setupEventListeners() {
        // Mouse events
        this.gridContainer.addEventListener('mousedown', (e) => this.handlePointerDown(e));
        document.addEventListener('mousemove', (e) => this.handlePointerMove(e));
        document.addEventListener('mouseup', (e) => this.handlePointerUp(e));

        // Touch events
        this.gridContainer.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handlePointerDown(e);
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            // Don't prevent default if touch is within debug overlay
            if (!this.debugOverlay.contains(e.target)) {
                e.preventDefault();
                this.handlePointerMove(e);
            }
        }, { passive: false });

        document.addEventListener('touchend', (e) => {
            // Don't prevent default if touch is within debug overlay
            if (!this.debugOverlay.contains(e.target)) {
                e.preventDefault();
                this.handlePointerUp(e);
            }
        }, { passive: false });

        // Prevent touch event propagation from debug overlay to grid
        this.debugOverlay.addEventListener('touchstart', (e) => {
            e.stopPropagation();
        }, { passive: true });

        this.debugOverlay.addEventListener('touchmove', (e) => {
            e.stopPropagation();
        }, { passive: true });

        this.debugOverlay.addEventListener('touchend', (e) => {
            e.stopPropagation();
        }, { passive: true });

        // The shared debug widget handles click events on its button and close
        // control; these touchend handlers keep the panel usable on mobile,
        // where preventDefault suppresses the synthesized click.
        this.debugBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.debugOverlay.classList.toggle('hidden');
        });

        this.debugCloseBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.closeDebugPanel();
        });

        this.forceRestartBtn.addEventListener('click', () => {
            this.closeDebugPanel();
            this.restart();
        });
        this.forceRestartBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.closeDebugPanel();
            this.restart();
        });

        // Challenge friend button
        this.challengeFriendBtn.addEventListener('click', () => this.openChallengePopup());
        this.challengeFriendBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.openChallengePopup();
        });

        // Popup close button
        this.popupCloseBtn.addEventListener('click', () => this.closeChallengePopup());
        this.popupCloseBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.closeChallengePopup();
        });

        // Copy button
        this.copyBtn.addEventListener('click', () => this.copyToClipboard());
        this.copyBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.copyToClipboard();
        });

        // Close popup when clicking outside
        this.challengePopup.addEventListener('click', (e) => {
            if (e.target === this.challengePopup) {
                this.closeChallengePopup();
            }
        });
    }

    setupConfigListeners() {
        // Disappear time slider
        this.disappearTimeSlider.addEventListener('input', (e) => {
            this.disappearTime = parseInt(e.target.value);
            this.disappearTimeValue.textContent = this.disappearTime;
            this.updateCSSVariables();
        });

        // Fall time slider
        this.fallTimeSlider.addEventListener('input', (e) => {
            this.fallTime = parseInt(e.target.value);
            this.fallTimeValue.textContent = this.fallTime;
            this.updateCSSVariables();
        });

        // Block size slider
        this.blockSizeSlider.addEventListener('input', (e) => {
            this.blockSize = parseFloat(e.target.value);
            this.blockSizeValue.textContent = this.blockSize;
            this.updateCSSVariables();
            // Update all block positions when size changes
            this.updateAllBlockPositions();
        });
    }

    updateCSSVariables() {
        document.documentElement.style.setProperty('--disappear-time', `${this.disappearTime}ms`);
        document.documentElement.style.setProperty('--fall-time', `${this.fallTime}ms`);
        document.documentElement.style.setProperty('--block-size', `${this.blockSize}px`);
    }

    getCellFromEvent(e) {
        let clientX, clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const element = document.elementFromPoint(clientX, clientY);
        if (element && element.classList.contains('letter-cell')) {
            const row = parseInt(element.dataset.row);
            const col = parseInt(element.dataset.col);

            // Only return cell if it has content (not empty/null)
            if (this.grid[row][col] !== null) {
                return {
                    row: row,
                    col: col,
                    element: element
                };
            }
        }
        return null;
    }

    handlePointerDown(e) {
        const cellInfo = this.getCellFromEvent(e);
        if (!cellInfo) return;

        this.isSelecting = true;
        this.selectedCells = [];
        this.currentWord = '';

        this.addCellToSelection(cellInfo.row, cellInfo.col);
        this.lastTouchedCell = { row: cellInfo.row, col: cellInfo.col };
    }

    handlePointerMove(e) {
        if (!this.isSelecting) return;

        const cellInfo = this.getCellFromEvent(e);
        if (!cellInfo) return;

        const { row, col } = cellInfo;

        // Check if this is a different cell than the last one
        if (this.lastTouchedCell &&
            this.lastTouchedCell.row === row &&
            this.lastTouchedCell.col === col) {
            return;
        }

        // Check if already selected
        const alreadySelected = this.selectedCells.some(
            cell => cell.row === row && cell.col === col
        );

        if (alreadySelected) {
            return;
        }

        // Check if adjacent to the last selected cell (including diagonal)
        if (this.selectedCells.length > 0) {
            const lastCell = this.selectedCells[this.selectedCells.length - 1];
            if (!this.isAdjacent(lastCell.row, lastCell.col, row, col)) {
                return;
            }
        }

        this.addCellToSelection(row, col);
        this.lastTouchedCell = { row, col };
    }

    handlePointerUp(e) {
        if (!this.isSelecting) return;

        this.isSelecting = false;
        this.lastTouchedCell = null;

        // Check if the word is valid
        if (this.currentWord.length >= 3) {
            this.checkWord(this.currentWord);
        } else {
            // Clear selection if word is too short
            this.clearSelection();
        }
    }

    isAdjacent(row1, col1, row2, col2) {
        const rowDiff = Math.abs(row1 - row2);
        const colDiff = Math.abs(col1 - col2);

        // Adjacent includes horizontal, vertical, and diagonal (8 directions)
        return rowDiff <= 1 && colDiff <= 1 && (rowDiff + colDiff > 0);
    }

    addCellToSelection(row, col) {
        this.selectedCells.push({ row, col });
        this.currentWord += this.grid[row][col];
        this.cellElements[row][col].classList.add('selected');
    }

    clearSelection() {
        this.selectedCells.forEach(cell => {
            this.cellElements[cell.row][cell.col].classList.remove('selected');
        });
        this.selectedCells = [];
        this.currentWord = '';
    }

    async checkWord(word) {
        // Simple word validation - check if it's in a basic English dictionary
        // For now, we'll use a simple API call to check if the word is valid
        const isValid = await this.isValidWord(word);

        if (isValid) {
            console.log('Valid word:', word);

            // Update longest word if this word is longer
            if (word.length > this.longestWord.length) {
                this.longestWord = word;
                this.updateLongestWord();
            }

            await this.removeSelectedCells();
            await this.applyGravity();
            this.updateProgress();
            this.checkGameOver();
        } else {
            console.log('Invalid word:', word);
            this.clearSelection();
        }
    }

    async isValidWord(word) {
        // Use a free dictionary API to validate the word
        try {
            const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`);
            return response.ok;
        } catch (error) {
            console.error('Error validating word:', error);
            // If API fails, accept words of 3+ letters as a fallback
            return word.length >= 3;
        }
    }

    async removeSelectedCells() {
        // Animate removal
        this.selectedCells.forEach(cell => {
            this.cellElements[cell.row][cell.col].classList.add('removing');
        });

        // Wait for animation to complete
        await new Promise(resolve => setTimeout(resolve, this.disappearTime));

        // Clear the cells
        this.selectedCells.forEach(cell => {
            this.grid[cell.row][cell.col] = null;
            this.cellElements[cell.row][cell.col].textContent = '';
            this.cellElements[cell.row][cell.col].classList.remove('selected', 'removing');
        });

        this.selectedCells = [];
        this.currentWord = '';
    }

    async applyGravity() {
        // Track which cells will move and their animation info
        const cellsToAnimate = [];

        // Process each column from bottom to top
        for (let col = 0; col < this.gridSize; col++) {
            // Collect non-null letters with their original row positions
            const lettersWithPositions = [];
            for (let row = this.gridSize - 1; row >= 0; row--) {
                if (this.grid[row][col] !== null) {
                    lettersWithPositions.push({ letter: this.grid[row][col], originalRow: row });
                }
            }

            // Fill from bottom with collected letters
            let letterIndex = 0;
            for (let row = this.gridSize - 1; row >= 0; row--) {
                if (letterIndex < lettersWithPositions.length) {
                    const { letter, originalRow } = lettersWithPositions[letterIndex];
                    this.grid[row][col] = letter;
                    this.cellElements[row][col].textContent = letter;
                    this.cellElements[row][col].classList.remove('empty');

                    // Only animate if the block moved to a different position
                    if (originalRow !== row) {
                        const fromPosition = this.getBlockPosition(originalRow, col);
                        const toPosition = this.getBlockPosition(row, col);
                        cellsToAnimate.push({
                            row,
                            col,
                            fromRow: originalRow,
                            fromTop: fromPosition.top,
                            toTop: toPosition.top,
                            distance: row - originalRow // How many rows it falls
                        });
                    }
                    letterIndex++;
                } else {
                    this.grid[row][col] = null;
                    this.cellElements[row][col].textContent = '';
                    this.cellElements[row][col].classList.add('empty');
                }
            }
        }

        // Only animate if there are cells to animate
        if (cellsToAnimate.length > 0) {
            // Animate blocks individually with physics-like effect
            // Start all animations at once but with different durations based on fall distance
            const animationPromises = cellsToAnimate.map((cell, index) => {
                return new Promise(resolve => {
                    const cellElement = this.cellElements[cell.row][cell.col];

                    // Stagger start time slightly for visual effect (50ms per block)
                    setTimeout(() => {
                        // Set initial position (where it's coming from)
                        cellElement.style.top = `${cell.fromTop}px`;
                        cellElement.style.transition = 'none';

                        // Force reflow
                        void cellElement.offsetHeight;

                        // Animate to final position with easing that simulates physics
                        // Use cubic-bezier for a bouncy, physics-like effect
                        const duration = this.fallTime + (cell.distance * 50); // Longer falls take more time
                        cellElement.style.transition = `top ${duration}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
                        cellElement.style.top = `${cell.toTop}px`;

                        // Resolve after animation completes
                        setTimeout(() => {
                            cellElement.style.transition = '';
                            resolve();
                        }, duration);
                    }, index * 50); // 50ms stagger between each block
                });
            });

            // Wait for all animations to complete
            await Promise.all(animationPromises);
        }
    }

    checkGameOver() {
        // Count remaining blocks
        let remainingBlocks = 0;
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                if (this.grid[row][col] !== null) {
                    remainingBlocks++;
                }
            }
        }

        if (remainingBlocks === 0) {
            // Game over - no blocks left
            setTimeout(() => {
                alert('Game Over! All blocks are gone.');
                this.restart();
            }, 500);
        }
    }

    updateProgress() {
        // Count remaining blocks
        let remainingBlocks = 0;
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                if (this.grid[row][col] !== null) {
                    remainingBlocks++;
                }
            }
        }

        // Calculate blocks cleared
        const clearedBlocks = this.totalBlocks - remainingBlocks;
        const progressPercentage = Math.round((clearedBlocks / this.totalBlocks) * 100);

        // Update the progress text and bar
        if (this.progressText) {
            this.progressText.textContent = `Cleared: ${progressPercentage}% (${clearedBlocks} / ${this.totalBlocks})`;
        }
        if (this.progressBarFill) {
            this.progressBarFill.style.width = `${progressPercentage}%`;
        }
    }

    updateLongestWord() {
        // Update the longest word display
        if (this.longestWordText) {
            this.longestWordText.textContent = this.longestWord;
        }

        // Show the container if we have a longest word
        if (this.longestWord && this.longestWordContainer) {
            this.longestWordContainer.classList.remove('hidden');
        }
    }

    closeDebugPanel() {
        this.debugOverlay.classList.add('hidden');
    }

    openChallengePopup() {
        const challengeText = this.generateChallengeText();
        this.challengeText.value = challengeText;
        this.challengePopup.classList.remove('hidden');
    }

    closeChallengePopup() {
        this.challengePopup.classList.add('hidden');
    }

    generateChallengeText() {
        const gameUrl = 'https://designerplays.github.io/PrototypingPlayground/prototypes/word-blocks/index.html';

        // Generate the grid visualization
        let gridText = '';
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                // ⬜️ for cleared blocks (null), 🟨 for remaining blocks
                gridText += this.grid[row][col] === null ? '⬜️' : '🟨';
            }
            gridText += '\n';
        }

        // Create the challenge message
        const message = `I challenge you to daily word-blocks!
My longest Word: ${this.longestWord}
${gridText}

${gameUrl}`;

        return message;
    }

    async copyToClipboard() {
        try {
            await navigator.clipboard.writeText(this.challengeText.value);
            // Provide visual feedback
            const originalText = this.copyBtn.textContent;
            this.copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                this.copyBtn.textContent = originalText;
            }, 2000);
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            // Fallback for older browsers
            this.challengeText.select();
            document.execCommand('copy');
            const originalText = this.copyBtn.textContent;
            this.copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                this.copyBtn.textContent = originalText;
            }, 2000);
        }
    }

    restart() {
        this.seedRng(); // Reset seed to today's date for consistent daily puzzle
        this.longestWord = ''; // Reset longest word

        // Hide the longest word container
        if (this.longestWordContainer) {
            this.longestWordContainer.classList.add('hidden');
        }

        this.initializeGrid();
        this.renderGrid();
        this.clearSelection();
        this.updateProgress();
    }
}

// Initialize game when page loads
window.addEventListener('DOMContentLoaded', () => {
    new WordBlocksGame();
});
