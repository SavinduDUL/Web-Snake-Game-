const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
// UI Elements
const currentScoreEl = document.getElementById('current-score');
const highScoreEl = document.getElementById('high-score');
const finalScoreEl = document.getElementById('final-score');
const difficultySelect = document.getElementById('difficulty-select');
const gridToggle = document.getElementById('grid-toggle');
const themeBtn = document.getElementById('theme-btn');
const soundBtn = document.getElementById('sound-btn');
// Screens
const startScreen = document.getElementById('start-screen');
const pauseScreen = document.getElementById('pause-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const loadingScreen = document.getElementById('loading-screen');
const startBtn = document.getElementById('start-btn');
const resumeBtn = document.getElementById('resume-btn');
const restartBtn = document.getElementById('restart-btn');
// Mobile Controls
const btnUp = document.getElementById('btn-up');
const btnDown = document.getElementById('btn-down');
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
// Game Constants and Variables
const gridSize = 20;
const tileCount = canvas.width / gridSize;
let snake = [];
let dx = 0;
let dy = 0;
let nextDx = 0;
let nextDy = 0;
let food = { x: 0, y: 0, special: false };
let specialFoodTimer = null;
let specialFoodActive = false;
let score = 0;
let highScore = localStorage.getItem('snakeHighScore') || 0;
let isPaused = false;
let isGameOver = false;
let gameRunning = false;
let baseSpeed = 100; // ms per frame
let currentSpeed = 100;
let lastRenderTime = 0;
let soundEnabled = true;
let showGrid = false;
let isDarkTheme = true;
// Initialize
highScoreEl.innerText = highScore;
// Remove loading screen after 1s to simulate initialization
setTimeout(() => {
    loadingScreen.classList.remove('active');
}, 800);
// Colors
let primaryColor = '#10b981';
let specialColor = '#f59e0b';
let bgColor = '#09090b';
function updateColors() {
    const style = getComputedStyle(document.body);
    primaryColor = style.getPropertyValue('--primary').trim() || '#10b981';
    specialColor = style.getPropertyValue('--special').trim() || '#f59e0b';
    bgColor = style.getPropertyValue('--bg').trim() || '#09090b';
}
// Audio context (lazy init)
let audioCtx;
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}
function playSound(type) {
    if (!soundEnabled || !audioCtx) return;
    
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    
    if (type === 'eat') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(600, now);
        oscillator.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        oscillator.start(now);
        oscillator.stop(now + 0.1);
    } else if (type === 'special') {
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(400, now);
        oscillator.frequency.linearRampToValueAtTime(1200, now + 0.2);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        oscillator.start(now);
        oscillator.stop(now + 0.2);
    } else if (type === 'over') {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(300, now);
        oscillator.frequency.exponentialRampToValueAtTime(50, now + 0.6);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        oscillator.start(now);
        oscillator.stop(now + 0.6);
    }
}
// Controls
function changeDirection(newDx, newDy) {
    if (isPaused || isGameOver || !gameRunning) return;
    // Prevent 180-degree turns
    if (newDx !== 0 && dx !== -newDx) {
        nextDx = newDx;
        nextDy = 0;
    } else if (newDy !== 0 && dy !== -newDy) {
        nextDx = 0;
        nextDy = newDy;
    }
}
window.addEventListener('keydown', e => {
    switch(e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            e.preventDefault();
            changeDirection(0, -1);
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            e.preventDefault();
            changeDirection(0, 1);
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            e.preventDefault();
            changeDirection(-1, 0);
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            e.preventDefault();
            changeDirection(1, 0);
            break;
        case ' ':
            e.preventDefault();
            togglePause();
            break;
    }
});
// Mobile button controls
btnUp.addEventListener('touchstart', (e) => { e.preventDefault(); changeDirection(0, -1); });
btnDown.addEventListener('touchstart', (e) => { e.preventDefault(); changeDirection(0, 1); });
btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); changeDirection(-1, 0); });
btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); changeDirection(1, 0); });
// Swipe logic
let touchStartX = 0;
let touchStartY = 0;
const minSwipeDist = 30;
window.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}, {passive: false});
window.addEventListener('touchend', e => {
    // Only capture swipes on main element to prevent accidental scrolling interference
    if (!e.target.closest('.game-container') && !e.target.closest('canvas')) return;
    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;
    
    const distX = touchEndX - touchStartX;
    const distY = touchEndY - touchStartY;
    
    if (Math.abs(distX) > Math.abs(distY)) {
        if (Math.abs(distX) > minSwipeDist) {
            if (distX > 0) changeDirection(1, 0);
            else changeDirection(-1, 0);
        }
    } else {
        if (Math.abs(distY) > minSwipeDist) {
            if (distY > 0) changeDirection(0, 1);
            else changeDirection(0, -1);
        }
    }
}, {passive: false});
// Game Setup
function setDifficulty() {
    const diff = difficultySelect.value;
    if (diff === 'easy') baseSpeed = 150;
    else if (diff === 'medium') baseSpeed = 100;
    else if (diff === 'hard') baseSpeed = 60;
    currentSpeed = baseSpeed;
}
difficultySelect.addEventListener('change', setDifficulty);
gridToggle.addEventListener('change', (e) => { showGrid = e.target.checked; if (!gameRunning || isPaused) render(); });
function initGame() {
    initAudio();
    updateColors();
    setDifficulty();
    
    snake = [
        { x: Math.floor(tileCount/2), y: Math.floor(tileCount/2) },
        { x: Math.floor(tileCount/2), y: Math.floor(tileCount/2) + 1 },
        { x: Math.floor(tileCount/2), y: Math.floor(tileCount/2) + 2 }
    ];
    dx = 0;
    dy = -1;
    nextDx = 0;
    nextDy = -1;
    
    score = 0;
    currentScoreEl.innerText = score;
    isGameOver = false;
    isPaused = false;
    gameRunning = true;
    
    spawnFood();
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    pauseScreen.classList.remove('active');
    
    lastRenderTime = performance.now();
    requestAnimationFrame(gameLoop);
}
function spawnFood() {
    let valid = false;
    while (!valid) {
        food.x = Math.floor(Math.random() * tileCount);
        food.y = Math.floor(Math.random() * tileCount);
        valid = true;
        for (let segment of snake) {
            if (segment.x === food.x && segment.y === food.y) {
                valid = false;
                break;
            }
        }
    }
    
    // 15% chance for special food if score > 50
    if (score >= 50 && Math.random() < 0.15 && !specialFoodActive) {
        food.special = true;
        specialFoodActive = true;
        
        // Remove special food after 5 seconds if not eaten
        clearTimeout(specialFoodTimer);
        specialFoodTimer = setTimeout(() => {
            if (food.special && gameRunning && !isPaused) {
                spawnFood(); // Respawn normally
            }
        }, 5000);
    } else {
        food.special = false;
        specialFoodActive = false;
    }
}
// Main Loop
function gameLoop(currentTime) {
    if (isGameOver || !gameRunning) return;
    
    requestAnimationFrame(gameLoop);
    
    // Frame throttling based on current speed
    const msSinceLastRender = currentTime - lastRenderTime;
    if (msSinceLastRender < currentSpeed) return;
    
    if (!isPaused) {
        lastRenderTime = currentTime;
        update();
        render();
    }
}
function update() {
    dx = nextDx;
    dy = nextDy;
    
    const head = { x: snake[0].x + dx, y: snake[0].y + dy };
    
    // Wall Collision
    if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
        gameOver();
        return;
    }
    
    // Self Collision
    for (let segment of snake) {
        if (head.x === segment.x && head.y === segment.y) {
            gameOver();
            return;
        }
    }
    
    snake.unshift(head);
    
    // Food Collision
    if (head.x === food.x && head.y === food.y) {
        if (food.special) {
            score += 50;
            playSound('special');
            clearTimeout(specialFoodTimer);
            specialFoodActive = false;
        } else {
            score += 10;
            playSound('eat');
        }
        currentScoreEl.innerText = score;
        
        // Increase speed slightly
        if (currentSpeed > 40) {
            currentSpeed -= 1;
        }
        
        spawnFood();
    } else {
        snake.pop();
    }
}
function render() {
    // Clear canvas
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw Grid
    if (showGrid) {
        const gridColor = getComputedStyle(document.body).getPropertyValue('--grid-color').trim();
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        for (let i = 0; i <= canvas.width; i += gridSize) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
        }
    }
    
    // Draw Food
    const { x, y, special } = food;
    ctx.fillStyle = special ? specialColor : primaryColor;
    ctx.shadowBlur = special ? 15 : 10;
    ctx.shadowColor = ctx.fillStyle;
    
    // Pulsing effect for special food
    let radius = (gridSize / 2) - 2;
    if (special) {
        radius += Math.sin(Date.now() / 150) * 2; // Pulsate
    } else {
        // Subtle pulse for normal food
        radius += Math.sin(Date.now() / 300) * 0.5;
    }
    
    ctx.beginPath();
    ctx.arc(x * gridSize + gridSize/2, y * gridSize + gridSize/2, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0; // Reset shadow for snake to avoid lag
    
    // Draw Snake
    for (let i = 0; i < snake.length; i++) {
        const seg = snake[i];
        // Gradient color based on position
        const alpha = 1 - (i / snake.length) * 0.6; // Head is alpha 1, tail is ~0.4
        
        ctx.fillStyle = `rgba(${hexToRgb(primaryColor)}, ${alpha})`;
        
        const px = seg.x * gridSize + 1;
        const py = seg.y * gridSize + 1;
        const size = gridSize - 2;
        
        drawRoundedRect(ctx, px, py, size, size, 4);
        
        // Draw eyes on head
        if (i === 0) {
            ctx.fillStyle = bgColor;
            const eyeSize = 2.5;
            // Determine eye positions based on direction
            let ex1 = px + size/2, ey1 = py + size/2;
            let ex2 = px + size/2, ey2 = py + size/2;
            
            if (dx === 1) { // Right
                ex1 = px + size - 5; ey1 = py + 5;
                ex2 = px + size - 5; ey2 = py + size - 5;
            } else if (dx === -1) { // Left
                ex1 = px + 5; ey1 = py + 5;
                ex2 = px + 5; ey2 = py + size - 5;
            } else if (dy === 1) { // Down
                ex1 = px + 5; ey1 = py + size - 5;
                ex2 = px + size - 5; ey2 = py + size - 5;
            } else if (dy === -1) { // Up
                ex1 = px + 5; ey1 = py + 5;
                ex2 = px + size - 5; ey2 = py + 5;
            } else { // Static (up by default)
                ex1 = px + 5; ey1 = py + 5;
                ex2 = px + size - 5; ey2 = py + 5;
            }
            
            ctx.beginPath(); ctx.arc(ex1, ey1, eyeSize, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(ex2, ey2, eyeSize, 0, Math.PI*2); ctx.fill();
        }
    }
}
function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
}
function hexToRgb(hex) {
    // Parse hex color like #10b981 to "16, 185, 129"
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return '16, 185, 129'; // default green
    return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}
function gameOver() {
    playSound('over');
    isGameOver = true;
    gameRunning = false;
    
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('snakeHighScore', highScore);
        highScoreEl.innerText = highScore;
    }
    
    finalScoreEl.innerText = score;
    gameOverScreen.classList.add('active');
}
function togglePause() {
    if (isGameOver || !gameRunning) return;
    isPaused = !isPaused;
    
    if (isPaused) {
        pauseScreen.classList.add('active');
    } else {
        pauseScreen.classList.remove('active');
        lastRenderTime = performance.now(); // reset delta to avoid massive jump
        requestAnimationFrame(gameLoop);
    }
}
// Event Listeners for UI
startBtn.addEventListener('click', initGame);
restartBtn.addEventListener('click', initGame);
resumeBtn.addEventListener('click', togglePause);
themeBtn.addEventListener('click', () => {
    isDarkTheme = !isDarkTheme;
    if (isDarkTheme) {
        document.getElementById('app').classList.replace('light-theme', 'dark-theme');
        themeBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
    } else {
        document.getElementById('app').classList.replace('dark-theme', 'light-theme');
        themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }
    updateColors();
    if (gameRunning && !isPaused) render();
});
soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    if (soundEnabled) {
        soundBtn.innerHTML = '<i class="fa-solid fa-volume-up"></i>';
        initAudio();
    } else {
        soundBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
    }
});
