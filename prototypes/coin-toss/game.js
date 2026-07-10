// Coin Toss Game - XP and Money

class CoinTossGame {
    constructor() {
        // DOM elements
        this.coin = document.getElementById('coin');
        this.flipButton = document.getElementById('flipButton');
        this.resultElement = document.getElementById('result');
        this.xpBar = document.getElementById('xpBar');
        this.xpText = document.getElementById('xpText');
        this.levelText = document.getElementById('levelText');
        this.moneyCounter = document.getElementById('moneyCounter');
        this.flipsLeftCounter = document.getElementById('flipsLeftCounter');
        this.gameOverPopup = document.getElementById('gameOver');
        this.playAgainBtn = document.getElementById('playAgainBtn');

        // Game state
        this.xp = 0;
        this.level = 1;
        this.money = 0;
        this.flipsLeft = 100;
        this.isFlipping = false;

        this.initialize();
    }

    initialize() {
        // Set up event listeners
        this.flipButton.addEventListener('click', () => this.flipCoin());
        this.playAgainBtn.addEventListener('click', () => this.resetGame());

        // Initialize UI
        this.updateUI();
    }

    flipCoin() {
        if (this.isFlipping || this.flipsLeft <= 0) {
            return;
        }

        this.isFlipping = true;
        this.flipButton.disabled = true;
        this.resultElement.textContent = '';
        this.resultElement.classList.remove('show');

        // Remove any existing animation classes
        this.coin.classList.remove('flipping-xp', 'flipping-money');

        // Randomly determine the outcome
        const isXP = Math.random() < 0.5;

        // Force a reflow to restart the animation
        void this.coin.offsetWidth;

        // Add the appropriate animation class
        if (isXP) {
            this.coin.classList.add('flipping-xp');
        } else {
            this.coin.classList.add('flipping-money');
        }

        // Wait for the animation to complete
        setTimeout(() => {
            this.processFlipResult(isXP);
            this.flipsLeft--;
            this.updateUI();

            // Check for game over
            if (this.flipsLeft <= 0) {
                setTimeout(() => this.showGameOver(), 500);
            } else {
                this.isFlipping = false;
                this.flipButton.disabled = false;
            }
        }, 500); // Match the animation duration
    }

    processFlipResult(isXP) {
        if (isXP) {
            this.xp++;
            // Check if level up (every 5 XP)
            if (this.xp % 5 === 0) {
                this.level++;
                this.resultElement.textContent = `You got XP! LEVEL UP! Now Level ${this.level}!`;
            } else {
                this.resultElement.textContent = 'You got XP!';
            }
        } else {
            this.money += 10;
            this.resultElement.textContent = 'You got Money!';
        }
        this.resultElement.classList.add('show');
    }

    updateUI() {
        // Calculate XP within current level (0-5 range)
        const xpInCurrentLevel = this.xp % 5;
        const xpPercentage = (xpInCurrentLevel / 5) * 100;
        this.xpBar.style.width = `${xpPercentage}%`;
        this.xpText.textContent = `${xpInCurrentLevel}/5`;

        // Update level text
        if (this.levelText) {
            this.levelText.textContent = `Level ${this.level}`;
        }

        // Update money counter
        this.moneyCounter.textContent = `💰${this.money}`;

        // Update flips left
        this.flipsLeftCounter.textContent = `Flips Left: ${this.flipsLeft}`;
    }

    showGameOver() {
        this.gameOverPopup.classList.remove('hidden');
    }

    resetGame() {
        // Reset game state
        this.xp = 0;
        this.level = 1;
        this.money = 0;
        this.flipsLeft = 100;
        this.isFlipping = false;

        // Reset UI
        this.gameOverPopup.classList.add('hidden');
        this.resultElement.textContent = '';
        this.resultElement.classList.remove('show');
        this.coin.classList.remove('flipping-xp', 'flipping-money');
        this.flipButton.disabled = false;

        this.updateUI();
    }
}

// Initialize the game when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CoinTossGame();
});
