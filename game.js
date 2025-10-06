// Game constants
const CANVAS_WIDTH = window.innerWidth;
const CANVAS_HEIGHT = window.innerHeight;
const PLAYER_SPEED = 5;
const BULLET_SPEED = 15;
const BOT_SPEED = 3; // Increased bot speed
const MAX_HEALTH = 100;
const WEAPON_DAMAGE = 25;
const CLIP_SIZE = 30;
const RELOAD_TIME = 2000;
const PLAYER_SIZE = 25; // Increased player size

// Bot difficulty settings
const BOT_ACCURACY = 0.85; // 85% accuracy
const BOT_REACTION_TIME = 150; // Faster reaction time
const BOT_DODGE_CHANCE = 0.3; // 30% chance to dodge
const BOT_STRAFE_SPEED = 2; // Strafing speed

// Spawn zones - will be set after canvas initialization
let BLUE_SPAWN, RED_SPAWN;

// Game state
let gameRunning = true;
let keys = {};
let mouse = { x: 0, y: 0, down: false };
let lastShot = 0;
let reloading = false;
let reloadStart = 0;

// Game objects
let player;
let bullets = [];
let bots = [];
let particles = [];
let powerups = [];

// Scores
let playerKills = 0;
let teamKills = 0;
let teamScore = 0;
let enemyScore = 0;

// Kill notifications
let killNotifications = [];

// Kill notification class
class KillNotification {
    constructor(killer, victim) {
        this.killer = killer;
        this.victim = victim;
        this.time = Date.now();
        this.duration = 3000;
    }

    isExpired() {
        return Date.now() - this.time > this.duration;
    }

    draw() {
        const alpha = Math.max(0, 1 - (Date.now() - this.time) / this.duration);
        ctx.globalAlpha = alpha;

        const y = 100 + killNotifications.indexOf(this) * 30;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(CANVAS_WIDTH / 2 - 150, y - 10, 300, 25);

        // Text
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${this.killer} eliminated ${this.victim}`, CANVAS_WIDTH / 2, y + 5);

        ctx.globalAlpha = 1;
    }
}

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// Initialize spawn zones after canvas is set - Larger spawn areas
BLUE_SPAWN = { x: 200, y: CANVAS_HEIGHT / 2, width: 300, height: 400 };
RED_SPAWN = { x: CANVAS_WIDTH - 200, y: CANVAS_HEIGHT / 2, width: 300, height: 400 };

// Player class
class Player {
    constructor(x, y, team = 'blue') {
        this.x = x;
        this.y = y;
        this.angle = 0;
        this.health = MAX_HEALTH;
        this.ammo = CLIP_SIZE;
        this.team = team;
        this.size = PLAYER_SIZE;
        this.speed = PLAYER_SPEED;
    }

    update() {
        // Movement
        let dx = 0, dy = 0;
        if (keys['w'] || keys['W']) dy -= this.speed;
        if (keys['s'] || keys['S']) dy += this.speed;
        if (keys['a'] || keys['A']) dx -= this.speed;
        if (keys['d'] || keys['D']) dx += this.speed;

        // Normalize diagonal movement
        if (dx !== 0 && dy !== 0) {
            dx *= 0.707;
            dy *= 0.707;
        }

        this.x += dx;
        this.y += dy;

        // Keep player in bounds
        this.x = Math.max(this.size, Math.min(CANVAS_WIDTH - this.size, this.x));
        this.y = Math.max(this.size, Math.min(CANVAS_HEIGHT - this.size, this.y));

        // Aim at mouse
        this.angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);

        // Handle reloading
        if (reloading && Date.now() - reloadStart > RELOAD_TIME) {
            this.ammo = CLIP_SIZE;
            reloading = false;
        }
    }

    shoot() {
        if (reloading || this.ammo <= 0 || Date.now() - lastShot < 100) return;

        const bullet = new Bullet(
            this.x + Math.cos(this.angle) * this.size,
            this.y + Math.sin(this.angle) * this.size,
            this.angle,
            this.team
        );
        bullets.push(bullet);

        this.ammo--;
        lastShot = Date.now();

        // Muzzle flash particle with animation manager
        if (typeof animationManager !== 'undefined') {
            animationManager.addMuzzleFlash(
                this.x + Math.cos(this.angle) * this.size,
                this.y + Math.sin(this.angle) * this.size,
                this.angle,
                this.team
            );
        } else {
            for (let i = 0; i < 5; i++) {
                particles.push(new Particle(
                    this.x + Math.cos(this.angle) * this.size,
                    this.y + Math.sin(this.angle) * this.size,
                    '#ffff00',
                    Math.random() * 200 + 100
                ));
            }
        }

        if (this.ammo <= 0) {
            this.reload();
        }
    }

    reload() {
        if (!reloading && this.ammo < CLIP_SIZE) {
            reloading = true;
            reloadStart = Date.now();
        }
    }

    takeDamage(damage, shooter) {
        this.health -= damage;

        // Blood particles with animation manager
        if (typeof animationManager !== 'undefined') {
            animationManager.addBloodSplatter(this.x, this.y);
        } else {
            for (let i = 0; i < 10; i++) {
                particles.push(new Particle(this.x, this.y, '#ff0000', Math.random() * 300 + 200));
            }
        }

        if (this.health <= 0) {
            // Create kill notification when player dies
            if (shooter && typeof killFeedManager !== 'undefined') {
                killFeedManager.addKill(shooter.name || 'ENEMY', 'ADMIN');
            }
            
            // Award kill to enemy team when player dies
            if (shooter && shooter.team === 'red') {
                enemyScore++;
            }
            
            this.respawn();
        }
    }

    respawn() {
        // Spawn in team zone
        const spawn = this.team === 'blue' ? BLUE_SPAWN : RED_SPAWN;
        this.x = spawn.x - spawn.width / 2 + Math.random() * spawn.width;
        this.y = spawn.y - spawn.height / 2 + Math.random() * spawn.height;
        this.health = MAX_HEALTH;
        this.ammo = CLIP_SIZE;
        reloading = false;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Draw shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(2, 2, this.size + 2, this.size * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.rotate(this.angle);

        // Soldier body (torso)
        const bodyColor = this.team === 'blue' ? '#1a4d80' : '#cc4400';
        const accentColor = this.team === 'blue' ? '#0066ff' : '#ff6600';

        // Main body
        ctx.fillStyle = bodyColor;
        ctx.fillRect(-this.size * 0.8, -this.size * 0.5, this.size * 1.6, this.size);

        // Chest armor/vest
        ctx.fillStyle = accentColor;
        ctx.fillRect(-this.size * 0.6, -this.size * 0.4, this.size * 1.2, this.size * 0.8);

        // Head
        ctx.fillStyle = '#ffdbac'; // Skin tone
        ctx.beginPath();
        ctx.arc(-this.size * 0.1, 0, this.size * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Helmet
        ctx.fillStyle = this.team === 'blue' ? '#003366' : '#990000';
        ctx.beginPath();
        ctx.arc(-this.size * 0.1, -this.size * 0.1, this.size * 0.45, Math.PI, Math.PI * 2);
        ctx.fill();

        // Visor/goggles
        ctx.fillStyle = '#222';
        ctx.fillRect(-6, -2, 8, 3);

        // Arms
        ctx.fillStyle = bodyColor;
        // Left arm
        ctx.fillRect(-8, -12, 4, 8);
        // Right arm (holding weapon)
        ctx.fillRect(-8, 4, 4, 8);

        // Legs
        ctx.fillStyle = this.team === 'blue' ? '#003366' : '#663300';
        // Left leg
        ctx.fillRect(-6, 8, 5, 10);
        // Right leg
        ctx.fillRect(1, 8, 5, 10);

        // Boots
        ctx.fillStyle = '#222';
        ctx.fillRect(-6, 16, 5, 4);
        ctx.fillRect(1, 16, 5, 4);

        // Weapon (assault rifle)
        ctx.fillStyle = '#333';
        // Main barrel
        ctx.fillRect(8, -2, 25, 4);
        // Stock
        ctx.fillRect(-8, -1, 8, 2);
        // Grip
        ctx.fillStyle = '#444';
        ctx.fillRect(4, 2, 3, 6);
        // Scope
        ctx.fillStyle = '#666';
        ctx.fillRect(12, -4, 8, 2);

        // Muzzle flash (if recently shot)
        if (Date.now() - lastShot < 50) {
            ctx.fillStyle = '#ffff00';
            ctx.beginPath();
            ctx.moveTo(33, 0);
            ctx.lineTo(40, -3);
            ctx.lineTo(45, 0);
            ctx.lineTo(40, 3);
            ctx.closePath();
            ctx.fill();
        }

        // Health bar
        ctx.restore();

        // Health bar background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(this.x - this.size - 2, this.y - this.size - 15, this.size * 2 + 4, 6);

        // Health bar (red background)
        ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.fillRect(this.x - this.size, this.y - this.size - 13, this.size * 2, 2);

        // Health bar (green foreground)
        ctx.fillStyle = 'rgba(0, 255, 0, 0.9)';
        const healthWidth = (this.size * 2) * (this.health / MAX_HEALTH);
        ctx.fillRect(this.x - this.size, this.y - this.size - 13, healthWidth, 2);

        // Player name tag
        ctx.fillStyle = this.team === 'blue' ? '#00ffff' : '#ffaa00';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('ADMIN', this.x, this.y - this.size - 18);
    }
}

// Bot class
class Bot {
    constructor(x, y, team = 'red', id = 0) {
        this.x = x;
        this.y = y;
        this.angle = 0;
        this.health = MAX_HEALTH;
        this.ammo = CLIP_SIZE;
        this.team = team;
        this.size = PLAYER_SIZE;
        this.speed = BOT_SPEED;
        this.lastShot = 0;
        this.target = null;
        this.lastTargetUpdate = 0;
        this.reloading = false;
        this.reloadStart = 0;
        this.moveTarget = { x: Math.random() * CANVAS_WIDTH, y: Math.random() * CANVAS_HEIGHT };
        this.lastMoveUpdate = 0;
        this.id = id;
        
        // Enhanced naming system
        if (team === 'blue') {
            this.name = id === 0 ? 'PLAYER-1' : `PLAYER-${id + 1}`;
        } else {
            this.name = `ENEMY-${id + 1}`;
        }
        
        // Enhanced AI properties
        this.dodgeTimer = 0;
        this.strafeDirection = Math.random() > 0.5 ? 1 : -1;
        this.lastDodge = 0;
        this.accuracy = BOT_ACCURACY + (Math.random() - 0.5) * 0.2; // Vary accuracy slightly
    }

    update() {
        // Enhanced target finding with faster reaction
        if (Date.now() - this.lastTargetUpdate > BOT_REACTION_TIME) {
            this.findTarget();
            this.lastTargetUpdate = Date.now();
        }

        // Update movement target more frequently for better positioning
        if (Date.now() - this.lastMoveUpdate > 2000) {
            this.moveTarget = { x: Math.random() * CANVAS_WIDTH, y: Math.random() * CANVAS_HEIGHT };
            this.lastMoveUpdate = Date.now();
        }

        // Enhanced AI behavior
        if (this.target) {
            const distToTarget = Math.hypot(this.target.x - this.x, this.target.y - this.y);

            if (distToTarget < 300) { // Increased engagement range
                // Enhanced combat mode with dodging and strafing
                let targetAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                
                // Add accuracy variation for more realistic aiming
                const aimError = (1 - this.accuracy) * (Math.random() - 0.5) * 0.5;
                this.angle = targetAngle + aimError;

                // Enhanced movement with dodging
                if (distToTarget > 80) {
                    // Move closer with strafing
                    const moveAngle = targetAngle + (this.strafeDirection * 0.5);
                    this.x += Math.cos(moveAngle) * this.speed * 0.8;
                    this.y += Math.sin(moveAngle) * this.speed * 0.8;
                } else if (distToTarget < 40) {
                    // Back away while strafing
                    const retreatAngle = targetAngle + Math.PI + (this.strafeDirection * 0.3);
                    this.x += Math.cos(retreatAngle) * this.speed * 0.6;
                    this.y += Math.sin(retreatAngle) * this.speed * 0.6;
                } else {
                    // Optimal range - strafe to avoid bullets
                    const strafeAngle = targetAngle + (Math.PI / 2) * this.strafeDirection;
                    this.x += Math.cos(strafeAngle) * BOT_STRAFE_SPEED;
                    this.y += Math.sin(strafeAngle) * BOT_STRAFE_SPEED;
                }

                // Random dodging behavior
                if (Math.random() < BOT_DODGE_CHANCE && Date.now() - this.lastDodge > 1000) {
                    this.strafeDirection *= -1; // Change strafe direction
                    this.lastDodge = Date.now();
                }

                // Enhanced shooting with burst fire
                if (Date.now() - this.lastShot > 200 && !this.reloading && this.ammo > 0) {
                    if (Math.random() < this.accuracy) { // Only shoot if within accuracy
                        this.shoot();
                    }
                }
            } else {
                // Enhanced patrol mode - move more tactically
                this.moveTowards(this.moveTarget.x, this.moveTarget.y);
            }
        } else {
            // Enhanced patrol mode with better positioning
            this.moveTowards(this.moveTarget.x, this.moveTarget.y);
        }

        // Keep in bounds
        this.x = Math.max(this.size, Math.min(CANVAS_WIDTH - this.size, this.x));
        this.y = Math.max(this.size, Math.min(CANVAS_HEIGHT - this.size, this.y));

        // Handle reloading
        if (this.reloading && Date.now() - this.reloadStart > RELOAD_TIME) {
            this.ammo = CLIP_SIZE;
            this.reloading = false;
        }

        if (this.ammo <= 0 && !this.reloading) {
            this.reload();
        }
    }

    findTarget() {
        let closestDistance = Infinity;
        this.target = null;

        // Target player if different team
        if (player.team !== this.team) {
            const dist = Math.hypot(player.x - this.x, player.y - this.y);
            if (dist < closestDistance && dist < 300) {
                closestDistance = dist;
                this.target = player;
            }
        }

        // Target other bots
        for (let bot of bots) {
            if (bot !== this && bot.team !== this.team) {
                const dist = Math.hypot(bot.x - this.x, bot.y - this.y);
                if (dist < closestDistance && dist < 300) {
                    closestDistance = dist;
                    this.target = bot;
                }
            }
        }
    }

    moveTowards(targetX, targetY) {
        const angle = Math.atan2(targetY - this.y, targetX - this.x);
        this.x += Math.cos(angle) * this.speed;
        this.y += Math.sin(angle) * this.speed;
    }

    shoot() {
        const bullet = new Bullet(
            this.x + Math.cos(this.angle) * this.size,
            this.y + Math.sin(this.angle) * this.size,
            this.angle,
            this.team
        );
        bullets.push(bullet);

        this.ammo--;
        this.lastShot = Date.now();

        // Muzzle flash with animation manager
        if (typeof animationManager !== 'undefined') {
            animationManager.addMuzzleFlash(
                this.x + Math.cos(this.angle) * this.size,
                this.y + Math.sin(this.angle) * this.size,
                this.angle,
                this.team
            );
        } else {
            for (let i = 0; i < 3; i++) {
                particles.push(new Particle(
                    this.x + Math.cos(this.angle) * this.size,
                    this.y + Math.sin(this.angle) * this.size,
                    '#ffff00',
                    Math.random() * 150 + 50
                ));
            }
        }
    }

    reload() {
        this.reloading = true;
        this.reloadStart = Date.now();
    }

    takeDamage(damage, shooter) {
        this.health -= damage;

        // Blood particles with animation manager
        if (typeof animationManager !== 'undefined') {
            animationManager.addBloodSplatter(this.x, this.y);
        } else {
            for (let i = 0; i < 8; i++) {
                particles.push(new Particle(this.x, this.y, '#ff0000', Math.random() * 250 + 150));
            }
        }

        if (this.health <= 0) {
            // Create kill notification
            const killerName = shooter === player ? 'ADMIN' : (shooter ? shooter.name : 'UNKNOWN');
            const victimName = this.name;
            
            // Add to kill feed
            if (typeof killFeedManager !== 'undefined') {
                killFeedManager.addKill(killerName, victimName);
            }
            
            // Award kill to shooter - Fixed kill tracking
            if (shooter === player) {
                playerKills++; // Only player's personal kills
                teamScore++;   // Player kills count toward team score
            } else if (shooter && shooter.team === 'blue') {
                // Bot teammate kills - only count toward team score and team kills
                teamScore++;
                teamKills++; // Only count bot teammate kills, not player kills
            } else if (shooter && shooter.team === 'red') {
                enemyScore++;
            }

            this.respawn();
        }
    }

    respawn() {
        // Spawn in team zone
        const spawn = this.team === 'blue' ? BLUE_SPAWN : RED_SPAWN;
        this.x = spawn.x - spawn.width / 2 + Math.random() * spawn.width;
        this.y = spawn.y - spawn.height / 2 + Math.random() * spawn.height;
        this.health = MAX_HEALTH;
        this.ammo = CLIP_SIZE;
        this.reloading = false;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Draw shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(2, 2, this.size + 2, this.size * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.rotate(this.angle);

        // Bot soldier body
        const bodyColor = this.team === 'blue' ? '#1a4d80' : '#cc4400';
        const accentColor = this.team === 'blue' ? '#0066ff' : '#ff6600';

        // Main body (slightly smaller than player)
        ctx.fillStyle = bodyColor;
        ctx.fillRect(-this.size * 0.6, -this.size * 0.4, this.size * 1.2, this.size * 0.8);

        // Chest armor
        ctx.fillStyle = accentColor;
        ctx.fillRect(-this.size * 0.5, -this.size * 0.3, this.size, this.size * 0.6);

        // Head
        ctx.fillStyle = '#ffdbac';
        ctx.beginPath();
        ctx.arc(-this.size * 0.05, 0, this.size * 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Helmet
        ctx.fillStyle = this.team === 'blue' ? '#003366' : '#990000';
        ctx.beginPath();
        ctx.arc(-this.size * 0.05, -this.size * 0.05, this.size * 0.35, Math.PI, Math.PI * 2);
        ctx.fill();

        // Tactical visor
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(-4, -1, 6, 1);

        // Arms
        ctx.fillStyle = bodyColor;
        ctx.fillRect(-7, -10, 3, 7);
        ctx.fillRect(-7, 3, 3, 7);

        // Legs
        ctx.fillStyle = this.team === 'blue' ? '#003366' : '#663300';
        ctx.fillRect(-5, 7, 4, 8);
        ctx.fillRect(1, 7, 4, 8);

        // Boots
        ctx.fillStyle = '#222';
        ctx.fillRect(-5, 13, 4, 3);
        ctx.fillRect(1, 13, 4, 3);

        // Weapon
        ctx.fillStyle = '#333';
        ctx.fillRect(6, -2, 22, 4);
        ctx.fillRect(-6, -1, 6, 2);
        ctx.fillStyle = '#444';
        ctx.fillRect(3, 2, 2, 5);

        // Muzzle flash
        if (Date.now() - this.lastShot < 50) {
            ctx.fillStyle = '#ffff00';
            ctx.beginPath();
            ctx.moveTo(28, 0);
            ctx.lineTo(35, -2);
            ctx.lineTo(38, 0);
            ctx.lineTo(35, 2);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();

        // Health bar background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(this.x - this.size - 2, this.y - this.size - 15, this.size * 2 + 4, 6);

        // Health bar
        ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.fillRect(this.x - this.size, this.y - this.size - 13, this.size * 2, 2);
        ctx.fillStyle = 'rgba(0, 255, 0, 0.9)';
        const healthWidth = (this.size * 2) * (this.health / MAX_HEALTH);
        ctx.fillRect(this.x - this.size, this.y - this.size - 13, healthWidth, 2);

        // Bot name tag
        ctx.fillStyle = this.team === 'blue' ? '#00aaff' : '#ff8800';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, this.x, this.y - this.size - 18);
    }
}

// Bullet class
class Bullet {
    constructor(x, y, angle, team) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.team = team;
        this.speed = BULLET_SPEED;
        this.size = 3;
        this.life = 100;
    }

    update() {
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
        this.life--;

        // Check collision with player
        if (this.team !== player.team) {
            const dist = Math.hypot(this.x - player.x, this.y - player.y);
            if (dist < player.size) {
                // Find the shooter (bot that fired this bullet)
                const shooter = bots.find(bot => bot.team === this.team);
                player.takeDamage(WEAPON_DAMAGE, shooter);
                return true; // Remove bullet
            }
        }

        // Check collision with bots
        for (let i = 0; i < bots.length; i++) {
            const bot = bots[i];
            if (this.team !== bot.team) {
                const dist = Math.hypot(this.x - bot.x, this.y - bot.y);
                if (dist < bot.size) {
                    const shooter = this.team === player.team ? player : bots.find(b => b.team === this.team);
                    bot.takeDamage(WEAPON_DAMAGE, shooter);
                    return true; // Remove bullet
                }
            }
        }

        // Remove if out of bounds or life expired
        return this.x < 0 || this.x > CANVAS_WIDTH ||
            this.y < 0 || this.y > CANVAS_HEIGHT ||
            this.life <= 0;
    }

    draw() {
        // Bullet core
        ctx.fillStyle = this.team === 'blue' ? '#00ffff' : '#ff8800';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();

        // Bullet glow
        ctx.shadowColor = this.team === 'blue' ? '#00ffff' : '#ff8800';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size - 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Enhanced bullet trail
        const trailLength = 15;
        const gradient = ctx.createLinearGradient(
            this.x, this.y,
            this.x - Math.cos(this.angle) * trailLength,
            this.y - Math.sin(this.angle) * trailLength
        );

        gradient.addColorStop(0, this.team === 'blue' ? 'rgba(0, 255, 255, 0.8)' : 'rgba(255, 136, 0, 0.8)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - Math.cos(this.angle) * trailLength, this.y - Math.sin(this.angle) * trailLength);
        ctx.stroke();
    }
}

// Particle class
class Particle {
    constructor(x, y, color, life) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.size = Math.random() * 4 + 2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.98;
        this.vy *= 0.98;
        this.life--;

        return this.life <= 0;
    }

    draw() {
        const alpha = this.life / this.maxLife;
        ctx.globalAlpha = alpha;

        // Particle glow effect
        ctx.shadowColor = this.color;
        ctx.shadowBlur = this.size * 2;

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }
}

// Initialize game
function init() {
    // Create player in blue spawn zone
    const blueSpawn = BLUE_SPAWN;
    player = new Player(
        blueSpawn.x - blueSpawn.width / 2 + Math.random() * blueSpawn.width,
        blueSpawn.y - blueSpawn.height / 2 + Math.random() * blueSpawn.height,
        'blue'
    );

    // Create bots - 3 blue teammates, 4 red enemies
    bots = [];

    // Blue team bots (teammates)
    for (let i = 0; i < 3; i++) {
        const spawn = BLUE_SPAWN;
        const bot = new Bot(
            spawn.x - spawn.width / 2 + Math.random() * spawn.width,
            spawn.y - spawn.height / 2 + Math.random() * spawn.height,
            'blue',
            i
        );
        bots.push(bot);
    }

    // Red team bots (enemies)
    for (let i = 0; i < 4; i++) {
        const spawn = RED_SPAWN;
        const bot = new Bot(
            spawn.x - spawn.width / 2 + Math.random() * spawn.width,
            spawn.y - spawn.height / 2 + Math.random() * spawn.height,
            'red',
            i
        );
        bots.push(bot);
    }

    // Reset scores
    playerKills = 0;
    teamKills = 0;
    teamScore = 0;
    enemyScore = 0;
    killNotifications = [];
}

// Game loop
function gameLoop() {
    if (!gameRunning) return;

    // Clear canvas with tactical background
    const gradient = ctx.createRadialGradient(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 0, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, Math.max(CANVAS_WIDTH, CANVAS_HEIGHT));
    gradient.addColorStop(0, 'rgba(26, 26, 46, 0.1)');
    gradient.addColorStop(1, 'rgba(10, 10, 20, 0.1)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Update game objects
    player.update();

    for (let bot of bots) {
        bot.update();
    }

    // Update bullets
    bullets = bullets.filter(bullet => !bullet.update());

    // Update particles
    particles = particles.filter(particle => !particle.update());

    // Update kill notifications
    killNotifications = killNotifications.filter(notification => !notification.isExpired());

    // Draw spawn zones
    drawSpawnZones();

    // Draw everything
    player.draw();

    for (let bot of bots) {
        bot.draw();
    }

    for (let bullet of bullets) {
        bullet.draw();
    }

    for (let particle of particles) {
        particle.draw();
    }

    // Draw grid
    drawGrid();

    // Draw kill notifications
    for (let notification of killNotifications) {
        notification.draw();
    }

    // Update UI
    updateUI();

    // Check win condition
    if (teamScore >= 25 || enemyScore >= 25) {
        endGame();
    }

    requestAnimationFrame(gameLoop);
}

function drawGrid() {
    // Enhanced tactical grid
    ctx.strokeStyle = 'rgba(0, 255, 100, 0.15)';
    ctx.lineWidth = 1;

    // Main grid
    for (let x = 0; x < CANVAS_WIDTH; x += 100) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
    }

    for (let y = 0; y < CANVAS_HEIGHT; y += 100) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
    }

    // Fine grid
    ctx.strokeStyle = 'rgba(0, 255, 100, 0.05)';
    for (let x = 0; x < CANVAS_WIDTH; x += 25) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
    }

    for (let y = 0; y < CANVAS_HEIGHT; y += 25) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
    }

    // Add some tactical markers
    ctx.fillStyle = 'rgba(0, 255, 100, 0.3)';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';

    for (let x = 100; x < CANVAS_WIDTH; x += 200) {
        for (let y = 100; y < CANVAS_HEIGHT; y += 200) {
            const gridX = Math.floor(x / 100);
            const gridY = Math.floor(y / 100);
            ctx.fillText(`${String.fromCharCode(65 + (gridX % 26))}${gridY}`, x + 5, y + 15);
        }
    }
}

function updateUI() {
    // Update UI using the new UI manager if available
    if (typeof uiManager !== 'undefined') {
        uiManager.updateUI({
            player: player,
            reloading: reloading,
            playerKills: playerKills,
            teamKills: teamKills,
            teamScore: teamScore,
            enemyScore: enemyScore
        });
    }
    
    // Fallback for direct DOM updates
    const healthValue = document.getElementById('healthValue');
    if (healthValue) {
        healthValue.textContent = Math.max(0, player.health);
    }
}

function drawSpawnZones() {
    // Blue spawn zone
    ctx.strokeStyle = 'rgba(0, 100, 255, 0.5)';
    ctx.fillStyle = 'rgba(0, 100, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.fillRect(
        BLUE_SPAWN.x - BLUE_SPAWN.width / 2,
        BLUE_SPAWN.y - BLUE_SPAWN.height / 2,
        BLUE_SPAWN.width,
        BLUE_SPAWN.height
    );
    ctx.strokeRect(
        BLUE_SPAWN.x - BLUE_SPAWN.width / 2,
        BLUE_SPAWN.y - BLUE_SPAWN.height / 2,
        BLUE_SPAWN.width,
        BLUE_SPAWN.height
    );

    // Blue spawn label - Horizontal text inside the zone
    ctx.fillStyle = 'rgba(0, 102, 255, 0.3)';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.strokeText('BLUE SPAWN', BLUE_SPAWN.x, BLUE_SPAWN.y);
    ctx.fillText('BLUE SPAWN', BLUE_SPAWN.x, BLUE_SPAWN.y);

    // Red spawn zone
    ctx.strokeStyle = 'rgba(255, 100, 0, 0.5)';
    ctx.fillStyle = 'rgba(255, 100, 0, 0.1)';
    ctx.lineWidth = 2;
    ctx.fillRect(
        RED_SPAWN.x - RED_SPAWN.width / 2,
        RED_SPAWN.y - RED_SPAWN.height / 2,
        RED_SPAWN.width,
        RED_SPAWN.height
    );
    ctx.strokeRect(
        RED_SPAWN.x - RED_SPAWN.width / 2,
        RED_SPAWN.y - RED_SPAWN.height / 2,
        RED_SPAWN.width,
        RED_SPAWN.height
    );

    // Red spawn label - Horizontal text inside the zone
    ctx.fillStyle = 'rgba(255, 102, 0, 0.3)';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.strokeText('RED SPAWN', RED_SPAWN.x, RED_SPAWN.y);
    ctx.fillText('RED SPAWN', RED_SPAWN.x, RED_SPAWN.y);
}

// Minimap removed as requested

function endGame() {
    gameRunning = false;
    const winner = teamScore > enemyScore ? 'BLUE TEAM WINS!' : 'RED TEAM WINS!';
    
    // Calculate stats
    const totalShots = (CLIP_SIZE * 10) - player.ammo; // Rough estimate
    const accuracy = totalShots > 0 ? Math.round((playerKills / totalShots) * 100) : 0;
    
    const stats = {
        playerKills: playerKills,
        teamKills: teamKills,
        teamScore: teamScore,
        enemyScore: enemyScore,
        accuracy: Math.min(accuracy, 100)
    };
    
    // Use new animated game over screen if available
    if (typeof uiManager !== 'undefined') {
        uiManager.showGameOver(winner, stats);
    } else {
        // Fallback
        document.getElementById('finalScore').textContent = `${winner} Final Score: ${teamScore} - ${enemyScore}`;
        document.getElementById('gameOver').style.display = 'block';
    }
}

function restartGame() {
    gameRunning = true;
    document.getElementById('gameOver').style.display = 'none';
    init();
    gameLoop();
}

// Event listeners
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;

    if (e.key === 'r' || e.key === 'R') {
        player.reload();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

document.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
});

document.addEventListener('mousedown', (e) => {
    if (e.button === 0) { // Left click
        mouse.down = true;
        player.shoot();
    }
});

document.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
        mouse.down = false;
    }
});

// Auto-fire when holding mouse
setInterval(() => {
    if (mouse.down && gameRunning) {
        player.shoot();
    }
}, 100);

// Prevent context menu
document.addEventListener('contextmenu', (e) => e.preventDefault());

// Start game
init();
gameLoop();