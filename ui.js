// UI Management and Enhancements
class UIManager {
    constructor() {
        this.playerHighlight = null;
        this.reloadPrompt = null;
        this.gameOverAnimation = null;
        this.init();
    }

    init() {
        this.createPlayerHighlight();
        this.createReloadPrompt();
        this.setupEventListeners();
    }

    createPlayerHighlight() {
        this.playerHighlight = document.createElement('div');
        this.playerHighlight.className = 'player-highlight';
        document.getElementById('ui').appendChild(this.playerHighlight);
    }

    createReloadPrompt() {
        this.reloadPrompt = document.createElement('div');
        this.reloadPrompt.className = 'reload-prompt';
        this.reloadPrompt.textContent = 'Press R to Reload!';
        document.getElementById('ui').appendChild(this.reloadPrompt);
    }

    updatePlayerHighlight(player) {
        if (this.playerHighlight && player) {
            const size = player.size * 2.5;
            this.playerHighlight.style.left = (player.x - size / 2) + 'px';
            this.playerHighlight.style.top = (player.y - size / 2) + 'px';
            this.playerHighlight.style.width = size + 'px';
            this.playerHighlight.style.height = size + 'px';
        }
    }

    showReloadPrompt() {
        if (this.reloadPrompt) {
            this.reloadPrompt.style.display = 'block';
        }
    }

    hideReloadPrompt() {
        if (this.reloadPrompt) {
            this.reloadPrompt.style.display = 'none';
        }
    }

    updateUI(gameState) {
        // Update health bar
        const healthFill = document.querySelector('.health-fill');
        if (healthFill) {
            const healthPercent = (gameState.player.health / MAX_HEALTH) * 100;
            healthFill.style.width = healthPercent + '%';
        }

        // Update ammo display
        const ammoDisplay = document.getElementById('ammo');
        if (ammoDisplay) {
            if (gameState.reloading) {
                ammoDisplay.textContent = 'RELOADING...';
                ammoDisplay.className = 'ammo-display reload-indicator';
            } else {
                ammoDisplay.textContent = `${gameState.player.ammo}/${CLIP_SIZE}`;
                ammoDisplay.className = 'ammo-display';
            }
        }

        // Update kills and scores
        document.getElementById('playerKills').textContent = gameState.playerKills;
        document.getElementById('teamKills').textContent = gameState.teamKills;
        document.getElementById('teamScore').textContent = gameState.teamScore;
        document.getElementById('enemyScore').textContent = gameState.enemyScore;

        // Show/hide reload prompt
        if (gameState.player.ammo === 0 && !gameState.reloading) {
            this.showReloadPrompt();
        } else {
            this.hideReloadPrompt();
        }

        // Update player highlight
        this.updatePlayerHighlight(gameState.player);
    }

    showGameOver(winner, stats) {
        const gameOverDiv = document.getElementById('gameOver');
        const content = gameOverDiv.querySelector('.game-over-content');

        // Create animated game over screen
        content.innerHTML = `
            <div class="game-over-title">${winner}</div>
            <div class="game-over-stats">
                <div class="stat-row">
                    <span class="label">Your Kills:</span>
                    <span class="value">${stats.playerKills}</span>
                </div>
                <div class="stat-row">
                    <span class="label">Team Kills:</span>
                    <span class="value">${stats.teamKills}</span>
                </div>
                <div class="stat-row">
                    <span class="label">Final Score:</span>
                    <span class="value">${stats.teamScore} - ${stats.enemyScore}</span>
                </div>
                <div class="stat-row">
                    <span class="label">Accuracy:</span>
                    <span class="value">${stats.accuracy}%</span>
                </div>
            </div>
            <button onclick="restartGame()">PLAY AGAIN</button>
            <button onclick="window.location.reload()">MAIN MENU</button>
        `;

        // Animate the game over screen
        gameOverDiv.style.display = 'block';
        gameOverDiv.style.opacity = '0';

        // Fade in animation
        let opacity = 0;
        const fadeIn = setInterval(() => {
            opacity += 0.05;
            gameOverDiv.style.opacity = opacity;
            if (opacity >= 1) {
                clearInterval(fadeIn);
            }
        }, 50);

        // Add particle effects
        this.createGameOverParticles();
    }

    createGameOverParticles() {
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');

        // Create explosion particles
        for (let i = 0; i < 50; i++) {
            particles.push(new Particle(
                CANVAS_WIDTH / 2 + (Math.random() - 0.5) * 200,
                CANVAS_HEIGHT / 2 + (Math.random() - 0.5) * 200,
                Math.random() > 0.5 ? '#ff6600' : '#ffff00',
                Math.random() * 500 + 300
            ));
        }
    }

    setupEventListeners() {
        // Add reload key listener
        document.addEventListener('keydown', (e) => {
            if (e.key === 'r' || e.key === 'R') {
                if (player && !reloading) {
                    player.reload();
                }
            }
        });
    }
}

// Kill Feed Manager
class KillFeedManager {
    constructor() {
        this.notifications = [];
        this.container = this.createContainer();
    }

    createContainer() {
        const container = document.createElement('div');
        container.id = 'killFeed';
        container.style.position = 'absolute';
        container.style.top = '60px';
        container.style.left = '50%';
        container.style.transform = 'translateX(-50%)';
        container.style.zIndex = '60';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'center';
        container.style.pointerEvents = 'none';
        document.getElementById('ui').appendChild(container);
        return container;
    }

    addKill(killer, victim, weapon = 'rifle') {
        // Clear existing notification
        this.container.innerHTML = '';

        const notification = document.createElement('div');
        notification.className = 'kill-notification';
        notification.innerHTML = `
            <span style="color: #00ff00">${killer}</span>
            <span style="color: #ff6600"> eliminated </span>
            <span style="color: #ff0000">${victim}</span>
        `;

        this.container.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.opacity = '0';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 500);
            }
        }, 3000);
    }
}

// Animation Manager
class AnimationManager {
    constructor() {
        this.animations = [];
    }

    addExplosion(x, y, size = 50, color = '#ff6600') {
        // Create explosion particles
        for (let i = 0; i < 20; i++) {
            const angle = (Math.PI * 2 * i) / 20;
            const speed = Math.random() * 10 + 5;
            particles.push(new Particle(
                x + Math.cos(angle) * (Math.random() * size),
                y + Math.sin(angle) * (Math.random() * size),
                color,
                Math.random() * 300 + 200
            ));
        }
    }

    addMuzzleFlash(x, y, angle, team) {
        const flashColor = team === 'blue' ? '#00ffff' : '#ff8800';

        // Create muzzle flash particles
        for (let i = 0; i < 8; i++) {
            const spreadAngle = angle + (Math.random() - 0.5) * 0.5;
            particles.push(new Particle(
                x + Math.cos(spreadAngle) * 30,
                y + Math.sin(spreadAngle) * 30,
                flashColor,
                Math.random() * 100 + 50
            ));
        }
    }

    addBloodSplatter(x, y, intensity = 1) {
        // Create blood particles
        for (let i = 0; i < 15 * intensity; i++) {
            particles.push(new Particle(
                x + (Math.random() - 0.5) * 20,
                y + (Math.random() - 0.5) * 20,
                '#ff0000',
                Math.random() * 400 + 200
            ));
        }
    }
}

// Initialize UI managers
let uiManager, killFeedManager, animationManager;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    uiManager = new UIManager();
    killFeedManager = new KillFeedManager();
    animationManager = new AnimationManager();
});