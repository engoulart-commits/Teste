/**
 * NEO SHOT - Minimalist Target Shooter
 * Lógica do Jogo
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const timerElement = document.getElementById('timer');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const hud = document.getElementById('hud');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const finalScoreElement = document.getElementById('final-score');

// Áudio (Sintetizado para minimalismo)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    switch(type) {
        case 'shoot':
            osc.type = 'square';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
            break;
        case 'hit':
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
            break;
        case 'explosion':
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
            break;
        case 'start':
            osc.type = 'square';
            [440, 554, 659].forEach((freq, i) => {
                const o = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                o.type = 'square';
                o.frequency.value = freq;
                o.connect(g);
                g.connect(audioCtx.destination);
                g.gain.setValueAtTime(0.05, now + i * 0.1);
                g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.1);
                o.start(now + i * 0.1);
                o.stop(now + i * 0.1 + 0.1);
            });
            break;
    }
}

// Configurações do Jogo
let score = 0;
let timeLeft = 60;
let gameActive = false;
let targets = [];
let spawnRate = 1000; // ms
let lastSpawnTime = 0;
let targetsHit = 0;
let animationId;
let particles = [];

// Tipos de Alvos
const TARGET_TYPES = {
    COMMON: { color: '#00ff88', points: 10, radius: 25, duration: 2000, chance: 0.7 },
    FAST: { color: '#ffcc00', points: 50, radius: 15, duration: 1000, chance: 0.2 },
    EXPLOSIVE: { color: '#ff3366', points: -100, radius: 30, duration: 2500, chance: 0.1 }
};

// Gerenciamento do Cursor Personalizado
window.addEventListener('mousemove', (e) => {
    document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
    document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
});

// Redimensionamento do Canvas
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Classe Target (Alvo)
class Target {
    constructor() {
        this.type = this.getRandomType();
        this.radius = this.type.radius;
        this.maxRadius = this.type.radius;
        this.x = Math.random() * (canvas.width - this.radius * 2) + this.radius;
        this.y = Math.random() * (canvas.height - this.radius * 2) + this.radius;
        this.spawnTime = Date.now();
        this.duration = this.type.duration;
        this.color = this.type.color;
        this.isDead = false;
    }

    getRandomType() {
        const rand = Math.random();
        if (rand < TARGET_TYPES.COMMON.chance) return TARGET_TYPES.COMMON;
        if (rand < TARGET_TYPES.COMMON.chance + TARGET_TYPES.FAST.chance) return TARGET_TYPES.FAST;
        return TARGET_TYPES.EXPLOSIVE;
    }

    update() {
        const elapsed = Date.now() - this.spawnTime;
        const progress = elapsed / this.duration;
        
        if (progress >= 1) {
            this.isDead = true;
            return;
        }

        // Efeito de encolhimento
        this.radius = this.maxRadius * (1 - progress);
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.closePath();
        
        // Brilho interno
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fill();
        ctx.closePath();
        
        ctx.shadowBlur = 0; // Reset
    }
}

// Classe Particle (Partículas para explosão)
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.radius = Math.random() * 3 + 1;
        this.velocity = {
            x: (Math.random() - 0.5) * 8,
            y: (Math.random() - 0.5) * 8
        };
        this.alpha = 1;
        this.decay = Math.random() * 0.02 + 0.01;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.alpha -= this.decay;
    }
}

// Loop Principal
function gameLoop(timestamp) {
    if (!gameActive) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Spawning
    if (timestamp - lastSpawnTime > spawnRate) {
        targets.push(new Target());
        lastSpawnTime = timestamp;
    }

    // Update e Draw Alvos
    for (let i = targets.length - 1; i >= 0; i--) {
        targets[i].update();
        targets[i].draw();

        if (targets[i].isDead) {
            targets.splice(i, 1);
        }
    }

    // Update e Draw Partículas
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw();
        if (particles[i].alpha <= 0) {
            particles.splice(i, 1);
        }
    }

    animationId = requestAnimationFrame(gameLoop);
}

// Lógica de Tiro
canvas.addEventListener('mousedown', (e) => {
    if (!gameActive) return;
    playSound('shoot');
});

canvas.addEventListener('click', (e) => {
    if (!gameActive) return;

    const mouseX = e.clientX;
    const mouseY = e.clientY;

    let hitAnything = false;

    for (let i = targets.length - 1; i >= 0; i--) {
        const t = targets[i];
        const dist = Math.sqrt((mouseX - t.x) ** 2 + (mouseY - t.y) ** 2);

        if (dist < t.maxRadius) { // Usamos maxRadius para ser mais justo com alvos que encolhem
            createExplosion(t.x, t.y, t.color);
            
            if (t.type === TARGET_TYPES.EXPLOSIVE) {
                playSound('explosion');
            } else {
                playSound('hit');
            }

            updateScore(t.type.points);
            targets.splice(i, 1);
            hitAnything = true;
            
            if (t.type !== TARGET_TYPES.EXPLOSIVE) {
                targetsHit++;
                checkProgression();
            }
            break; // Apenas um alvo por clique
        }
    }
});

function createExplosion(x, y, color) {
    for (let i = 0; i < 15; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function updateScore(points) {
    score += points;
    if (score < 0) score = 0;
    scoreElement.textContent = score;
    
    // Feedback visual no HUD
    scoreElement.style.transform = 'scale(1.2)';
    setTimeout(() => scoreElement.style.transform = 'scale(1)', 100);
}

function checkProgression() {
    if (targetsHit % 10 === 0) {
        spawnRate = Math.max(300, spawnRate - 100); // Mínimo 300ms
    }
}

// Timer
function startTimer() {
    const timerInterval = setInterval(() => {
        if (!gameActive) {
            clearInterval(timerInterval);
            return;
        }

        timeLeft--;
        timerElement.textContent = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            endGame();
        }
    }, 1000);
}

// Gerenciamento de Estado
function startGame() {
    playSound('start');
    score = 0;
    timeLeft = 60;
    targetsHit = 0;
    spawnRate = 1000;
    targets = [];
    gameActive = true;
    
    scoreElement.textContent = score;
    timerElement.textContent = timeLeft;
    
    startScreen.classList.remove('active');
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    hud.classList.add('active');
    
    lastSpawnTime = performance.now();
    animationId = requestAnimationFrame(gameLoop);
    startTimer();
}

function endGame() {
    gameActive = false;
    cancelAnimationFrame(animationId);
    
    finalScoreElement.textContent = score;
    hud.classList.remove('active');
    hud.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
    gameOverScreen.classList.add('active');
}

// Eventos de Botão
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
