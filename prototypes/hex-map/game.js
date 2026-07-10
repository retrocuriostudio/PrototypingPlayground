// Hex Map Explorer Game - Mobile-First Rebuild
// Complete rewrite for pixel-perfect visual and tap alignment
// VERSION: 1.1 (increment by 0.1 for each change unless specified otherwise)

class HexMapGame {
    constructor() {
        // DOM elements
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.tileSelectionDiv = document.getElementById('tile-selection');
        this.tileOptionsDiv = document.getElementById('tile-options');
        this.gameOverDiv = document.getElementById('game-over');
        this.restartBtn = document.getElementById('restart-btn');
        this.remainingCountSpan = document.getElementById('remaining-count');
        this.foodCountSpan = document.getElementById('food-count');
        this.materialsCountSpan = document.getElementById('materials-count');
        this.debugBtn = document.getElementById('debug-btn');
        this.debugOverlay = document.getElementById('debug-overlay');
        this.debugCloseBtn = document.getElementById('debug-close-btn');
        this.forceRestartBtn = document.getElementById('force-restart-btn');
        this.hexRadiusSlider = document.getElementById('hex-radius-slider');
        this.hexRadiusValue = document.getElementById('hex-radius-value');
        this.resourcesPopupDurationSlider = document.getElementById('resources-popup-duration');
        this.resourcesPopupDurationValue = document.getElementById('resources-popup-duration-value');
        this.securePopup = document.getElementById('secure-popup');
        this.secureBtn = document.getElementById('secure-btn');
        this.secureCancelBtn = document.getElementById('secure-cancel-btn');
        this.secureMessage = document.getElementById('secure-message');
        this.secureMaterialsCost = document.getElementById('secure-materials-cost');
        this.secureFoodCost = document.getElementById('secure-food-cost');
        this.starvationPopup = document.getElementById('starvation-popup');
        this.starvationRestartBtn = document.getElementById('starvation-restart-btn');
        this.welcomePopup = document.getElementById('welcome-popup');
        this.welcomeCloseBtn = document.getElementById('welcome-close-btn');
        this.welcomeMessage = document.getElementById('welcome-message');
        this.winPopup = document.getElementById('win-popup');
        this.winRestartBtn = document.getElementById('win-restart-btn');
        this.winMessage = document.getElementById('win-message');
        this.resourcesFoundPopup = document.getElementById('resources-found-popup');
        this.resourcesFoundList = document.getElementById('resources-found-list');

        // Game config (messages, etc.)
        this.gameConfig = {};

        // Hex geometry - using pointy-top orientation
        // Mobile-first: larger hex size for better touch targets
        this.hexRadius = 60; // Increased from 50 for better mobile touch

        // Camera/viewport
        this.camera = { x: 0, y: 0 };
        this.viewportWidth = 0;
        this.viewportHeight = 0;

        // Interaction state
        this.isDragging = false;
        this.dragStartPos = { x: 0, y: 0 };
        this.dragLastPos = { x: 0, y: 0 };
        this.tapStartHex = null; // Track which hex was tapped initially
        this.TAP_WIGGLE_THRESHOLD = 10; // pixels - max movement to still count as a tap

        // Game state
        this.tiles = new Map(); // key: "q,r" -> value: { type, secured }
        this.tilePool = [];
        this.tileConfig = {}; // Store tile configuration with resources
        this.pendingHex = null; // Hex awaiting tile selection
        this.pendingSecureHex = null; // Hex awaiting secure action
        this.arkPosition = null; // Position of the Ark tile
        this.hasWon = false; // Track if player has won

        // Resources
        this.food = 10;
        this.materials = 10;
        this.secureCost = { materials: 5, food: 1 }; // Cost to secure a tile

        // Debug
        this.showDebugOverlay = false;
        this.debugTapRadius = 60; // For visualization only
        this.resourcesFoundPopupDuration = 2000; // milliseconds

        this.init();
    }

    async init() {
        await this.loadGameConfig();
        await this.loadTileConfig();
        this.setupCanvas();
        this.setupEventListeners();
        this.placeCenterTile();
        this.placeArk();
        this.render();

        // Show welcome popup on game start
        this.showWelcomePopup();

        // Handle window resize
        window.addEventListener('resize', () => {
            this.setupCanvas();
            this.render();
        });
    }

    async loadGameConfig() {
        const response = await fetch('GameConfig.json');
        this.gameConfig = await response.json();
    }

    async loadTileConfig() {
        const response = await fetch('TileConfig.json');
        const config = await response.json();

        // Store tile configuration
        this.tileConfig = {};
        config.tiles.forEach(tile => {
            this.tileConfig[tile.type] = {
                foodMin: tile.foodMin,
                foodMax: tile.foodMax,
                materialsMin: tile.materialsMin,
                materialsMax: tile.materialsMax,
                color: tile.color
            };
        });

        // Build tile pool
        this.tilePool = [];
        config.tiles.forEach(tile => {
            for (let i = 0; i < tile.count; i++) {
                this.tilePool.push(tile.type);
            }
        });

        // Shuffle tile pool
        for (let i = this.tilePool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.tilePool[i], this.tilePool[j]] = [this.tilePool[j], this.tilePool[i]];
        }

        this.updateTileCounter();
        this.updateResourceCounters();
    }

    setupCanvas() {
        // Get actual display size
        const rect = this.canvas.getBoundingClientRect();
        this.viewportWidth = rect.width;
        this.viewportHeight = rect.height;

        // Set internal canvas size with device pixel ratio for sharp rendering
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.viewportWidth * dpr;
        this.canvas.height = this.viewportHeight * dpr;

        // Scale context to match DPR, but work in logical pixels
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    placeCenterTile() {
        this.tiles.set('0,0', { type: 'Home Base', secured: true });
    }

    // Calculate distance between two hex coordinates
    hexDistance(q1, r1, q2, r2) {
        return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
    }

    // Get all hexes at exactly a given distance from a position
    getHexesAtDistance(q, r, distance) {
        const hexes = [];

        // Use cube coordinates for easier ring generation
        for (let dq = -distance; dq <= distance; dq++) {
            for (let dr = -distance; dr <= distance; dr++) {
                const ds = -dq - dr;

                // Check if this is exactly at the target distance
                if (Math.abs(dq) <= distance && Math.abs(dr) <= distance && Math.abs(ds) <= distance) {
                    const actualDist = this.hexDistance(0, 0, dq, dr);
                    if (actualDist === distance) {
                        hexes.push({ q: q + dq, r: r + dr });
                    }
                }
            }
        }

        return hexes;
    }

    // Place the Ark at a random position exactly 10 tiles from home base
    placeArk() {
        const arkDistance = 10;
        const possiblePositions = this.getHexesAtDistance(0, 0, arkDistance);

        // Pick a random position
        const randomIndex = Math.floor(Math.random() * possiblePositions.length);
        this.arkPosition = possiblePositions[randomIndex];

        // Place the Ark tile (not secured by default, not in tile pool)
        const key = `${this.arkPosition.q},${this.arkPosition.r}`;
        this.tiles.set(key, { type: 'Ark', secured: false });
    }

    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.handlePointerDown(e.clientX, e.clientY));
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDragging) this.handlePointerMove(e.clientX, e.clientY);
        });
        this.canvas.addEventListener('mouseup', (e) => this.handlePointerUp(e.clientX, e.clientY));
        this.canvas.addEventListener('mouseleave', () => this.handlePointerUp());

        // Touch events
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                e.preventDefault();
                const touch = e.touches[0];
                this.handlePointerDown(touch.clientX, touch.clientY);
            }
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1 && this.isDragging) {
                e.preventDefault();
                const touch = e.touches[0];
                this.handlePointerMove(touch.clientX, touch.clientY);
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            // Get the last touch position from changedTouches
            if (e.changedTouches.length > 0) {
                const touch = e.changedTouches[0];
                this.handlePointerUp(touch.clientX, touch.clientY);
            } else {
                this.handlePointerUp();
            }
        }, { passive: false });

        // UI buttons
        this.restartBtn.addEventListener('click', () => this.restart());
        // The shared debug widget owns opening/closing the panel; these
        // listeners only sync the canvas tap-radius visualization with it.
        this.debugBtn.addEventListener('click', () => {
            this.showDebugOverlay = !this.debugOverlay.classList.contains('hidden');
            this.render();
        });
        this.debugCloseBtn.addEventListener('click', () => {
            this.showDebugOverlay = false;
            this.render();
        });
        this.forceRestartBtn.addEventListener('click', () => {
            this.closeDebugPanel();
            this.restart();
        });
        this.hexRadiusSlider.addEventListener('input', (e) => {
            this.debugTapRadius = parseInt(e.target.value);
            this.hexRadiusValue.textContent = this.debugTapRadius;
            this.render();
        });
        this.resourcesPopupDurationSlider.addEventListener('input', (e) => {
            this.resourcesFoundPopupDuration = parseInt(e.target.value);
            this.resourcesPopupDurationValue.textContent = this.resourcesFoundPopupDuration;
        });

        // Secure popup buttons
        this.secureBtn.addEventListener('click', () => this.secureTile());
        this.secureCancelBtn.addEventListener('click', () => this.closeSecurePopup());

        // Starvation popup button
        this.starvationRestartBtn.addEventListener('click', () => this.restart());

        // Welcome popup button
        this.welcomeCloseBtn.addEventListener('click', () => this.closeWelcomePopup());

        // Win popup button
        this.winRestartBtn.addEventListener('click', () => this.restart());
    }

    // Convert client coordinates to canvas logical coordinates
    clientToCanvas(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    handlePointerDown(clientX, clientY) {
        const canvasPos = this.clientToCanvas(clientX, clientY);

        // Store the tap start position and hex
        this.dragStartPos = canvasPos;
        this.dragLastPos = canvasPos;
        this.tapStartHex = this.findHexAtPosition(canvasPos.x, canvasPos.y);

        // Always start in dragging mode - we'll determine on pointer up if it was a tap or pan
        this.isDragging = true;
        this.canvas.classList.add('dragging');
    }

    handlePointerMove(clientX, clientY) {
        if (!this.isDragging) return;

        const canvasPos = this.clientToCanvas(clientX, clientY);
        const dx = canvasPos.x - this.dragLastPos.x;
        const dy = canvasPos.y - this.dragLastPos.y;

        this.camera.x += dx;
        this.camera.y += dy;
        this.dragLastPos = canvasPos;

        this.render();
    }

    handlePointerUp(clientX, clientY) {
        if (!this.isDragging) return;

        this.isDragging = false;
        this.canvas.classList.remove('dragging');

        // Check if this was a tap (minimal movement) rather than a pan
        if (clientX !== undefined && clientY !== undefined) {
            const canvasPos = this.clientToCanvas(clientX, clientY);
            const distanceMoved = Math.sqrt(
                Math.pow(canvasPos.x - this.dragStartPos.x, 2) +
                Math.pow(canvasPos.y - this.dragStartPos.y, 2)
            );

            // If movement was within wiggle threshold, treat as a tap
            if (distanceMoved <= this.TAP_WIGGLE_THRESHOLD) {
                // If secure popup is open, close it and don't process hex taps
                if (!this.securePopup.classList.contains('hidden')) {
                    this.closeSecurePopup();
                } else {
                    const endHex = this.findHexAtPosition(canvasPos.x, canvasPos.y);

                    if (endHex) {
                        const key = `${endHex.q},${endHex.r}`;
                        const tile = this.tiles.get(key);

                        // Check if we tapped on a discovered (placed) tile that's not secured
                        if (tile && !tile.secured) {
                            this.showSecurePopup(endHex);
                        }
                        // Check if we tapped on an adjacent empty hex (for exploration)
                        else if (this.isAdjacentToSecured(endHex.q, endHex.r) && !tile) {
                            // Show tile selection for this hex
                            this.showTileSelection(endHex);
                        }
                    }
                }
            }
        }

        // Clear tap state
        this.tapStartHex = null;
    }

    // =============================================================================
    // HEX COORDINATE SYSTEM - POINTY-TOP ORIENTATION
    // Reference: https://www.redblobgames.com/grids/hexagons/
    // =============================================================================

    // Convert hex axial coordinates (q, r) to pixel position (x, y)
    // CRITICAL: No rounding here - return exact floating point position
    hexToPixel(q, r) {
        const x = this.hexRadius * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
        const y = this.hexRadius * (3 / 2 * r);

        // Apply camera offset and center in viewport
        return {
            x: x + this.viewportWidth / 2 + this.camera.x,
            y: y + this.viewportHeight / 2 + this.camera.y
        };
    }

    // Convert pixel position (x, y) to hex axial coordinates (q, r)
    // CRITICAL: Uses exact inverse of hexToPixel - no rounding
    pixelToHex(x, y) {
        // Remove camera offset and viewport centering
        const relX = x - this.viewportWidth / 2 - this.camera.x;
        const relY = y - this.viewportHeight / 2 - this.camera.y;

        // Convert to fractional hex coordinates
        const q = (Math.sqrt(3) / 3 * relX - 1 / 3 * relY) / this.hexRadius;
        const r = (2 / 3 * relY) / this.hexRadius;

        // Round to nearest integer hex coordinates
        return this.roundHex(q, r);
    }

    // Round fractional hex coordinates to nearest integer hex
    roundHex(q, r) {
        const s = -q - r;

        let rq = Math.round(q);
        let rr = Math.round(r);
        let rs = Math.round(s);

        const qDiff = Math.abs(rq - q);
        const rDiff = Math.abs(rr - r);
        const sDiff = Math.abs(rs - s);

        // Reset the component with the largest rounding error
        if (qDiff > rDiff && qDiff > sDiff) {
            rq = -rr - rs;
        } else if (rDiff > sDiff) {
            rr = -rq - rs;
        }

        return { q: rq, r: rr };
    }

    // Find which hex (if any) contains the given pixel position
    findHexAtPosition(x, y) {
        const hex = this.pixelToHex(x, y);
        const hexCenter = this.hexToPixel(hex.q, hex.r);

        // Check if point is actually inside this hex (not just in its bounding box)
        const distance = Math.sqrt(
            Math.pow(x - hexCenter.x, 2) +
            Math.pow(y - hexCenter.y, 2)
        );

        // Use hex radius as the hit test boundary
        if (distance <= this.hexRadius) {
            return hex;
        }

        return null;
    }

    // Get the six adjacent hex coordinates
    getAdjacentHexes(q, r) {
        return [
            { q: q + 1, r: r },     // right
            { q: q + 1, r: r - 1 }, // top-right
            { q: q, r: r - 1 },     // top-left
            { q: q - 1, r: r },     // left
            { q: q - 1, r: r + 1 }, // bottom-left
            { q: q, r: r + 1 }      // bottom-right
        ];
    }

    // Check if a hex is adjacent to any placed tile and is empty
    isAdjacentEmpty(q, r) {
        const key = `${q},${r}`;

        // Must be empty
        if (this.tiles.has(key)) return false;

        // Must be adjacent to at least one placed tile
        const adjacent = this.getAdjacentHexes(q, r);
        return adjacent.some(hex => this.tiles.has(`${hex.q},${hex.r}`));
    }

    // Check if a hex is adjacent to a secured tile
    isAdjacentToSecured(q, r) {
        const key = `${q},${r}`;

        // Must be empty
        if (this.tiles.has(key)) return false;

        // Must be adjacent to at least one secured tile
        const adjacent = this.getAdjacentHexes(q, r);
        return adjacent.some(hex => {
            const tile = this.tiles.get(`${hex.q},${hex.r}`);
            return tile && tile.secured;
        });
    }

    // Check if a tile can be secured (must be adjacent to another secured tile)
    canSecureTile(q, r) {
        const adjacent = this.getAdjacentHexes(q, r);
        return adjacent.some(hex => {
            const tile = this.tiles.get(`${hex.q},${hex.r}`);
            return tile && tile.secured;
        });
    }

    // Get all hexes that are adjacent to secured tiles and empty
    getAllAdjacentEmptyHexes() {
        const emptyHexes = new Set();

        this.tiles.forEach((tile, key) => {
            // Only consider secured tiles
            if (!tile.secured) return;

            const [q, r] = key.split(',').map(Number);
            const adjacent = this.getAdjacentHexes(q, r);

            adjacent.forEach(hex => {
                const hexKey = `${hex.q},${hex.r}`;
                if (!this.tiles.has(hexKey)) {
                    emptyHexes.add(hexKey);
                }
            });
        });

        return Array.from(emptyHexes).map(key => {
            const [q, r] = key.split(',').map(Number);
            return { q, r };
        });
    }

    // =============================================================================
    // RENDERING
    // =============================================================================

    // Get all hexes in a radius around the center that should be visible
    getAllHexesInRadius(radius) {
        const hexes = [];
        for (let q = -radius; q <= radius; q++) {
            for (let r = -radius; r <= radius; r++) {
                const s = -q - r;
                if (Math.abs(s) <= radius) {
                    hexes.push({ q, r });
                }
            }
        }
        return hexes;
    }

    render() {
        // Clear canvas
        this.ctx.fillStyle = '#f0f0f0';
        this.ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);

        // Draw the entire hex grid in light gray (unexplored tiles)
        const gridRadius = 15; // Show a 15-tile radius grid
        const allHexes = this.getAllHexesInRadius(gridRadius);
        allHexes.forEach(hex => {
            const key = `${hex.q},${hex.r}`;
            // Only draw if not already placed
            if (!this.tiles.has(key)) {
                const pos = this.hexToPixel(hex.q, hex.r);
                this.drawHexagon(pos.x, pos.y, 'rgba(220, 220, 220, 0.3)', 'rgba(180, 180, 180, 0.5)', '', false, null);
            }
        });

        // Draw all placed tiles
        this.tiles.forEach((tile, key) => {
            const [q, r] = key.split(',').map(Number);
            const pos = this.hexToPixel(q, r);
            let textColor;

            if (tile.type === 'Home Base') {
                textColor = '#FFD700';
            } else if (tile.type === 'Ark') {
                textColor = '#9B59B6'; // Purple for Ark
            } else {
                textColor = (this.tileConfig[tile.type] && this.tileConfig[tile.type].color) || '#CCCCCC';
            }

            this.drawHexagon(pos.x, pos.y, '#fff', '#333', tile.type, tile.secured, textColor);
        });

        // Draw adjacent empty hexes (exploration targets) with question marks
        const adjacentEmpty = this.getAllAdjacentEmptyHexes();
        adjacentEmpty.forEach(hex => {
            const pos = this.hexToPixel(hex.q, hex.r);
            this.drawHexagon(pos.x, pos.y, 'rgba(200, 200, 200, 0.5)', '#999', '?', false, null);
        });

        // Debug visualization
        if (this.showDebugOverlay) {
            this.drawDebugOverlay(adjacentEmpty);
        }
    }

    drawHexagon(centerX, centerY, fillColor, strokeColor, text, secured = false, textColor = null) {
        this.ctx.beginPath();

        // Draw pointy-top hexagon
        for (let i = 0; i < 6; i++) {
            const angleDeg = 60 * i - 30;
            const angleRad = Math.PI / 180 * angleDeg;
            const x = centerX + this.hexRadius * Math.cos(angleRad);
            const y = centerY + this.hexRadius * Math.sin(angleRad);

            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }

        this.ctx.closePath();

        // Fill
        this.ctx.fillStyle = fillColor;
        this.ctx.fill();

        // Stroke
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Draw double inset outline for secured tiles
        if (secured) {
            const insetRadius1 = this.hexRadius - 8;
            const insetRadius2 = this.hexRadius - 12;
            const secureColor = '#1e7e34'; // Dark green

            // First inset outline
            this.ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angleDeg = 60 * i - 30;
                const angleRad = Math.PI / 180 * angleDeg;
                const x = centerX + insetRadius1 * Math.cos(angleRad);
                const y = centerY + insetRadius1 * Math.sin(angleRad);

                if (i === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
            this.ctx.closePath();
            this.ctx.strokeStyle = secureColor;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Second inset outline
            this.ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angleDeg = 60 * i - 30;
                const angleRad = Math.PI / 180 * angleDeg;
                const x = centerX + insetRadius2 * Math.cos(angleRad);
                const y = centerY + insetRadius2 * Math.sin(angleRad);

                if (i === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
            this.ctx.closePath();
            this.ctx.strokeStyle = secureColor;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }

        // Text with colored square background
        if (text && textColor) {
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';

            // Measure text width
            const textMetrics = this.ctx.measureText(text);
            const textWidth = textMetrics.width;
            const padding = 6;
            const boxWidth = textWidth + padding * 2;
            const boxHeight = 20;

            // Draw colored square background
            this.ctx.fillStyle = textColor;
            this.ctx.fillRect(
                centerX - boxWidth / 2,
                centerY - boxHeight / 2,
                boxWidth,
                boxHeight
            );

            // Draw text in white for better contrast
            this.ctx.fillStyle = '#fff';
            this.ctx.fillText(text, centerX, centerY);
        } else if (text) {
            // Fallback for text without color (e.g., "?" on empty tiles)
            this.ctx.fillStyle = '#000';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(text, centerX, centerY);
        }
    }

    drawDebugOverlay(adjacentEmpty) {
        // Draw hit test circles for adjacent hexes
        adjacentEmpty.forEach(hex => {
            const pos = this.hexToPixel(hex.q, hex.r);

            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, this.debugTapRadius, 0, Math.PI * 2);
            this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Draw crosshair at center
            this.ctx.beginPath();
            this.ctx.moveTo(pos.x - 10, pos.y);
            this.ctx.lineTo(pos.x + 10, pos.y);
            this.ctx.moveTo(pos.x, pos.y - 10);
            this.ctx.lineTo(pos.x, pos.y + 10);
            this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        });
    }

    // =============================================================================
    // GAME LOGIC
    // =============================================================================

    showTileSelection(hex) {
        if (this.tilePool.length === 0) {
            this.gameOver();
            return;
        }

        // Check if there's enough food to explore
        if (this.food < 1) {
            this.showStarvationPopup();
            return;
        }

        // Deduct 1 food for exploring
        this.food -= 1;
        this.updateResourceCounters();

        this.pendingHex = hex;

        // Get up to 3 unique random tile options
        const uniqueTileTypes = [...new Set(this.tilePool)];
        const numOptions = Math.min(3, uniqueTileTypes.length);
        const options = [];

        // Shuffle unique tile types and pick the first numOptions
        const shuffled = [...uniqueTileTypes].sort(() => Math.random() - 0.5);
        for (let i = 0; i < numOptions; i++) {
            options.push(shuffled[i]);
        }

        // Clear and populate tile options
        this.tileOptionsDiv.innerHTML = '';
        options.forEach(tileType => {
            // Create tile option container
            const optionDiv = document.createElement('div');
            optionDiv.className = 'tile-option';

            // Tile name
            const nameDiv = document.createElement('div');
            nameDiv.className = 'tile-option-name';
            nameDiv.textContent = tileType;
            optionDiv.appendChild(nameDiv);

            // Resources section
            const resourcesDiv = document.createElement('div');
            resourcesDiv.className = 'tile-option-resources';

            const resourcesLabel = document.createElement('div');
            resourcesLabel.className = 'tile-option-resources-label';
            resourcesLabel.textContent = 'Resources:';
            resourcesDiv.appendChild(resourcesLabel);

            // Get resource info for this tile type
            const resources = this.tileConfig[tileType];

            if (resources) {
                // Calculate average and threshold for food
                const foodMin = resources.foodMin;
                const foodMax = resources.foodMax;

                // Only show food if not both zero
                if (foodMin > 0 || foodMax > 0) {
                    const foodAvg = foodMin + (foodMax - foodMin) / 2;
                    let foodThreshold;
                    let foodClass;

                    if (foodAvg >= 1 && foodAvg <= 3) {
                        foodThreshold = 'low';
                        foodClass = 'resource-low';
                    } else if (foodAvg >= 4 && foodAvg <= 6) {
                        foodThreshold = 'mid';
                        foodClass = 'resource-mid';
                    } else if (foodAvg >= 7) {
                        foodThreshold = 'high';
                        foodClass = 'resource-high';
                    }

                    const foodItem = document.createElement('div');
                    foodItem.className = 'tile-option-resource-item';
                    foodItem.innerHTML = `🍕<span class="${foodClass}">${foodThreshold}</span>`;
                    resourcesDiv.appendChild(foodItem);
                }

                // Calculate average and threshold for materials
                const materialsMin = resources.materialsMin;
                const materialsMax = resources.materialsMax;

                // Only show materials if not both zero
                if (materialsMin > 0 || materialsMax > 0) {
                    const materialsAvg = materialsMin + (materialsMax - materialsMin) / 2;
                    let materialsThreshold;
                    let materialsClass;

                    if (materialsAvg >= 1 && materialsAvg <= 3) {
                        materialsThreshold = 'low';
                        materialsClass = 'resource-low';
                    } else if (materialsAvg >= 4 && materialsAvg <= 6) {
                        materialsThreshold = 'mid';
                        materialsClass = 'resource-mid';
                    } else if (materialsAvg >= 7) {
                        materialsThreshold = 'high';
                        materialsClass = 'resource-high';
                    }

                    const materialsItem = document.createElement('div');
                    materialsItem.className = 'tile-option-resource-item';
                    materialsItem.innerHTML = `🛠️<span class="${materialsClass}">${materialsThreshold}</span>`;
                    resourcesDiv.appendChild(materialsItem);
                }
            }

            optionDiv.appendChild(resourcesDiv);

            // Pick Tile button
            const pickButton = document.createElement('button');
            pickButton.className = 'tile-option-btn';
            pickButton.textContent = 'Pick Tile';
            pickButton.addEventListener('click', () => this.selectTile(tileType));
            optionDiv.appendChild(pickButton);

            this.tileOptionsDiv.appendChild(optionDiv);
        });

        this.tileSelectionDiv.classList.remove('hidden');
    }

    showSecurePopup(hex) {
        this.pendingSecureHex = hex;
        const key = `${hex.q},${hex.r}`;
        const tile = this.tiles.get(key);

        if (!tile || tile.secured) {
            return;
        }

        // Check if player has 0 food - show starvation popup
        if (this.food < this.secureCost.food) {
            this.showStarvationPopup();
            return;
        }

        // Check if tile can be secured (adjacent to secured tiles)
        const canSecure = this.canSecureTile(hex.q, hex.r);

        // Check if player has enough resources
        const hasEnoughMaterials = this.materials >= this.secureCost.materials;
        const hasEnoughFood = this.food >= this.secureCost.food;
        const hasEnoughResources = hasEnoughMaterials && hasEnoughFood;

        // Color-code the resource amounts
        if (hasEnoughMaterials) {
            this.secureMaterialsCost.style.color = '#4169E1'; // Royal blue
        } else {
            this.secureMaterialsCost.style.color = '#DC143C'; // Crimson red
        }

        if (hasEnoughFood) {
            this.secureFoodCost.style.color = '#4169E1'; // Royal blue
        } else {
            this.secureFoodCost.style.color = '#DC143C'; // Crimson red
        }

        // Update button state and message
        if (!canSecure) {
            this.secureBtn.disabled = true;
            this.secureMessage.textContent = 'You can only secure tiles next to other secured tiles';
            this.secureMessage.style.display = 'block';
        } else if (!hasEnoughResources) {
            this.secureBtn.disabled = true;
            this.secureMessage.textContent = "You don't have enough resources";
            this.secureMessage.style.display = 'block';
        } else {
            this.secureBtn.disabled = false;
            this.secureMessage.textContent = '';
            this.secureMessage.style.display = 'none';
        }

        this.securePopup.classList.remove('hidden');
    }

    closeSecurePopup() {
        this.securePopup.classList.add('hidden');
        this.pendingSecureHex = null;
    }

    showStarvationPopup() {
        this.starvationPopup.classList.remove('hidden');
    }

    showWelcomePopup() {
        if (this.gameConfig.welcomeMessage) {
            this.welcomeMessage.textContent = this.gameConfig.welcomeMessage;
        }
        this.welcomePopup.classList.remove('hidden');
    }

    closeWelcomePopup() {
        this.welcomePopup.classList.add('hidden');
    }

    showWinPopup() {
        if (this.gameConfig.winMessage) {
            this.winMessage.textContent = this.gameConfig.winMessage;
        }
        this.winPopup.classList.remove('hidden');
    }

    showResourcesFoundPopup(foodAmount, materialsAmount) {
        // Don't show popup if no resources were found
        if (foodAmount === 0 && materialsAmount === 0) {
            return;
        }

        // Clear previous content
        this.resourcesFoundList.innerHTML = '';

        // Only show resources that were actually found (non-zero amounts)
        if (foodAmount > 0) {
            const foodDiv = document.createElement('div');
            foodDiv.textContent = `🍕${foodAmount}`;
            this.resourcesFoundList.appendChild(foodDiv);
        }

        if (materialsAmount > 0) {
            const materialsDiv = document.createElement('div');
            materialsDiv.textContent = `🛠️${materialsAmount}`;
            this.resourcesFoundList.appendChild(materialsDiv);
        }

        // Show the popup
        this.resourcesFoundPopup.classList.remove('hidden');

        // Hide after configured duration
        setTimeout(() => {
            this.resourcesFoundPopup.classList.add('hidden');
        }, this.resourcesFoundPopupDuration);
    }

    // Check if there's a secured path from home base to Ark using BFS
    checkWinCondition() {
        if (!this.arkPosition || this.hasWon) return false;

        const arkKey = `${this.arkPosition.q},${this.arkPosition.r}`;
        const arkTile = this.tiles.get(arkKey);

        // Ark must be secured
        if (!arkTile || !arkTile.secured) return false;

        // Use BFS to check if there's a path of secured tiles from home base to Ark
        const visited = new Set();
        const queue = [{ q: 0, r: 0 }]; // Start from home base
        visited.add('0,0');

        while (queue.length > 0) {
            const current = queue.shift();
            const currentKey = `${current.q},${current.r}`;

            // Check if we reached the Ark
            if (current.q === this.arkPosition.q && current.r === this.arkPosition.r) {
                return true;
            }

            // Get adjacent hexes
            const adjacent = this.getAdjacentHexes(current.q, current.r);

            for (const hex of adjacent) {
                const hexKey = `${hex.q},${hex.r}`;

                // Skip if already visited
                if (visited.has(hexKey)) continue;

                const tile = this.tiles.get(hexKey);

                // Only traverse secured tiles
                if (tile && tile.secured) {
                    visited.add(hexKey);
                    queue.push(hex);
                }
            }
        }

        return false;
    }

    secureTile() {
        if (!this.pendingSecureHex) return;

        const key = `${this.pendingSecureHex.q},${this.pendingSecureHex.r}`;
        const tile = this.tiles.get(key);

        if (!tile || tile.secured) {
            this.closeSecurePopup();
            return;
        }

        // Check if can secure and has resources
        if (!this.canSecureTile(this.pendingSecureHex.q, this.pendingSecureHex.r)) {
            this.closeSecurePopup();
            return;
        }

        if (this.materials < this.secureCost.materials || this.food < this.secureCost.food) {
            this.closeSecurePopup();
            return;
        }

        // Deduct resources
        this.materials -= this.secureCost.materials;
        this.food -= this.secureCost.food;

        // Mark tile as secured
        tile.secured = true;
        this.tiles.set(key, tile);

        // Update UI
        this.updateResourceCounters();
        this.render();
        this.closeSecurePopup();

        // Check win condition
        if (this.checkWinCondition()) {
            this.hasWon = true;
            this.showWinPopup();
        }
    }

    selectTile(tileType) {
        // Remove tile from pool
        const index = this.tilePool.indexOf(tileType);
        if (index > -1) {
            this.tilePool.splice(index, 1);
        }

        // Place tile (not secured by default)
        const key = `${this.pendingHex.q},${this.pendingHex.r}`;
        this.tiles.set(key, { type: tileType, secured: false });

        // Track resources found
        let foodAmount = 0;
        let materialsAmount = 0;

        // Add random resources from the placed tile based on min/max ranges
        if (this.tileConfig[tileType]) {
            const config = this.tileConfig[tileType];

            // Generate random food amount
            foodAmount = Math.floor(Math.random() * (config.foodMax - config.foodMin + 1)) + config.foodMin;
            this.food += foodAmount;

            // Generate random materials amount
            materialsAmount = Math.floor(Math.random() * (config.materialsMax - config.materialsMin + 1)) + config.materialsMin;
            this.materials += materialsAmount;
        }

        // Clear selection
        this.tileSelectionDiv.classList.add('hidden');
        this.pendingHex = null;

        // Update UI
        this.updateTileCounter();
        this.updateResourceCounters();
        this.render();

        // Show resources found popup
        this.showResourcesFoundPopup(foodAmount, materialsAmount);

        // Check game over
        if (this.tilePool.length === 0) {
            this.gameOver();
        }
    }

    updateTileCounter() {
        this.remainingCountSpan.textContent = this.tilePool.length;
    }

    updateResourceCounters() {
        this.foodCountSpan.textContent = this.food;
        this.materialsCountSpan.textContent = this.materials;
    }

    gameOver() {
        this.gameOverDiv.classList.remove('hidden');
    }

    closeDebugPanel() {
        this.debugOverlay.classList.add('hidden');
        this.showDebugOverlay = false;
        this.render();
    }

    restart() {
        // Reset all state
        this.tiles.clear();
        this.tilePool = [];
        this.pendingHex = null;
        this.pendingSecureHex = null;
        this.camera = { x: 0, y: 0 };
        this.food = 10;
        this.materials = 10;
        this.arkPosition = null;
        this.hasWon = false;

        // Hide overlays
        this.gameOverDiv.classList.add('hidden');
        this.tileSelectionDiv.classList.add('hidden');
        this.securePopup.classList.add('hidden');
        this.starvationPopup.classList.add('hidden');
        this.welcomePopup.classList.add('hidden');
        this.winPopup.classList.add('hidden');
        this.resourcesFoundPopup.classList.add('hidden');

        // Reinitialize game
        this.loadTileConfig().then(() => {
            this.placeCenterTile();
            this.placeArk();
            this.render();
            this.showWelcomePopup();
        });
    }
}

// Initialize game when page loads
window.addEventListener('DOMContentLoaded', () => {
    new HexMapGame();
});
