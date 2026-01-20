interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Paddle extends GameObject {
  dy: number;
  speed: number;
}

interface Ball extends GameObject {
  dx: number;
  dy: number;
  speed: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

class PongGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private player1: Paddle;
  private player2: Paddle;
  private ball: Ball;
  private keys: { [key: string]: boolean } = {};
  private gameRunning = false;
  private player1Score = 0;
  private player2Score = 0;
  private lastTime = 0;
  private particles: Particle[] = [];
  private animationFrame: number | null = null;
  private touchActive = false;
  private touchSide: 'left' | 'right' | null = null;
  private countdownActive = false;
  private countdownValue = 3;

  private aiPlayer: boolean = true;
  private aiFirstMove: boolean = false;
  private aiTargetY: number = 0;
  private aiReactionCooldown: number = 0;

  private readonly PADDLE_SPEED = 400; // px/s 
  private readonly BALL_SPEED = 550; 
  private readonly MAX_BALL_SPEED = 1100; 

  private readonly AI_READ_BOUNCE_CHANCE = 0.8;
  private readonly AI_ERROR_RANGE = 70;
  private readonly AI_REACTION_TIME_S = 0.4;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

    // Create ball in center
    this.ball = {
      x: this.canvas.width / 2 - 5,
      y: this.canvas.height / 2,
      width: 10,
      height: 10,
      dx: this.BALL_SPEED,
      dy: this.BALL_SPEED * 0.3,
      speed: this.BALL_SPEED
    };

    // Left paddle
    this.player1 = {
      x: 20,
      y: this.canvas.height / 2 - 50,
      width: 10,
      height: 100,
      dy: 0,
      speed: this.PADDLE_SPEED
    };

    // Right paddle
    this.player2 = {
      x: this.canvas.width - 30,
      y: this.canvas.height / 2 - 50,
      width: 10,
      height: 100,
      dy: 0,
      speed: this.PADDLE_SPEED
    };

    this.setupEventListeners();
    this.setupTouchControls();
    this.lastTime = performance.now();
    this.gameLoop(); 
  }

  public setAIPlayer(hasAIPlayer: boolean): void {
    this.aiPlayer = hasAIPlayer;
  }
  
  private resetAIPlayer(): void {
    this.aiFirstMove = false;
    this.aiTargetY = 0;
    this.aiReactionCooldown = 0;
  }

  private predictBallY(): number {
    const { ball, canvas } = this;

    // time until ball reaches AI paddle
    const distanceX = this.player2.x - ball.x - ball.width;

    // horizontal velocity scaled by dt
    const vx = ball.dx;
    const vy = ball.dy;

    const time = distanceX / vx;
    if (time <= 0) return ball.y;

    let predictedY = ball.y + vy * time;

    const height = canvas.height - ball.height;

    // misread ball speed threshold
    if (this.ball.dx < 700 || Math.random() < this.AI_READ_BOUNCE_CHANCE) {
      while (predictedY < 0 || predictedY > height) {
        if (predictedY < 0) predictedY = -predictedY;
        else if (predictedY > height)
          predictedY = height - (predictedY - height);
      }
    }

    const error = (Math.random() - Math.random()) * this.AI_ERROR_RANGE; // triangular

    return predictedY + ball.height / 2 + error;
  }

  private updateAIDecision(): void {
    if (this.ball.dx <= 0) {
      this.aiTargetY = this.canvas.height / 2;
      return;
    }

    this.aiReactionCooldown = this.AI_REACTION_TIME_S;
    this.aiTargetY = this.predictBallY();
  }

  private updateAIMovement(dt: number): void {
    if (this.aiReactionCooldown > 0) {
      this.aiReactionCooldown -= dt;
      return;
    }
    const paddleCenter = this.player2.y + this.player2.height / 2;
    const diffY = this.aiTargetY - paddleCenter;


    // deadzone
    if (diffY > 10)
      this.player2.y += this.PADDLE_SPEED * dt;
    else if (diffY < -10)
      this.player2.y -= this.PADDLE_SPEED * dt;
  }

  private setupEventListeners(): void {
    document.addEventListener("keydown", (e) => {
      this.keys[e.key] = true;

      if (e.key === " ") {
        e.preventDefault();
        if (!this.gameRunning && !this.countdownActive) {
          this.startCountdown();
          this.hideMobileOverlay();
        }
      }
    });

    document.addEventListener("keyup", (e) => {
      this.keys[e.key] = false;
    });
  }

  private setupTouchControls(): void {
    console.log('[Pong] Setting up touch controls');
    
    // Fullscreen button for mobile
    const fullscreenButton = document.getElementById('fullscreenButton');
    if (fullscreenButton) {
      fullscreenButton.addEventListener('click', () => {
        this.toggleFullscreen();
      });

      // Listen for fullscreen changes to update button text
      document.addEventListener('fullscreenchange', () => {
        this.updateFullscreenButton();
      });
    }
    
    // Start button
    const mobileStartButton = document.getElementById('mobileStartButton');
    if (mobileStartButton) {
      console.log('[Pong] Mobile start button found');
      
      mobileStartButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[Pong] Mobile start button CLICKED');
        if (!this.gameRunning && !this.countdownActive) {
          this.startCountdown();
          this.hideMobileOverlay();
        }
      });
      
      mobileStartButton.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[Pong] Mobile start button TOUCHED');
        if (!this.gameRunning && !this.countdownActive) {
          this.startCountdown();
          this.hideMobileOverlay();
        }
      });
    }

    // Touch controls for paddles
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (!this.gameRunning) {
        console.log('[Pong] Touch ignored - game not running');
        return;
      }
      
      console.log('[Pong] Touch start - game running');
      
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const x = (touch.clientX - rect.left) * (this.canvas.width / rect.width);
      const y = (touch.clientY - rect.top) * (this.canvas.height / rect.height);

      this.touchActive = true;
      this.touchSide = x < this.canvas.width / 2 ? 'left' : 'right';

      console.log(`[Pong] Touch on ${this.touchSide} side at y=${y}`);
      this.updateTouchKeys(y);
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!this.touchActive || !this.gameRunning) return;

      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const y = (touch.clientY - rect.top) * (this.canvas.height / rect.height);

      this.updateTouchKeys(y);
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      console.log('[Pong] Touch end');
      this.touchActive = false;
      this.touchSide = null;
      
      // Clear all keys
      this.keys['w'] = false;
      this.keys['s'] = false;
      this.keys['ArrowUp'] = false;
      this.keys['ArrowDown'] = false;
    }, { passive: false });

    this.canvas.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      this.touchActive = false;
      this.touchSide = null;
      this.keys['w'] = false;
      this.keys['s'] = false;
      this.keys['ArrowUp'] = false;
      this.keys['ArrowDown'] = false;
    }, { passive: false });
  }

    private hideMobileOverlay(): void {
    const overlay = document.getElementById('mobileStartOverlay');
    if (overlay) {
      overlay.classList.add('hidden');
      console.log('[Pong] Mobile overlay hidden');
    }
  }

  private showMobileOverlay(): void {
    const overlay = document.getElementById('mobileStartOverlay');
    if (overlay) {
      console.log('[Pong] Showing mobile overlay');
      console.log('[Pong] Window width:', window.innerWidth);
      console.log('[Pong] Overlay classes before:', overlay.className);
      
      // Remove hidden class
      overlay.classList.remove('hidden');
      
      console.log('[Pong] Overlay classes after:', overlay.className);

    }
  }

  private updateTouchKeys(y: number): void {
    if (!this.touchSide) return;

    // Clear all keys first
    this.keys['w'] = false;
    this.keys['s'] = false;
    this.keys['ArrowUp'] = false;
    this.keys['ArrowDown'] = false;

    if (this.touchSide === 'left') {
      const paddle = this.player1;
      if (y < paddle.y + paddle.height / 2) {
        this.keys['w'] = true;
      } else {
        this.keys['s'] = true;
      }
    } else {
      const paddle = this.player2;
      if (y < paddle.y + paddle.height / 2) {
        this.keys['ArrowUp'] = true;
      } else {
        this.keys['ArrowDown'] = true;
      }
    }
  }

  private toggleFullscreen(): void {
    const elem = document.documentElement;
    
    if (!document.fullscreenElement) {
      // Enter fullscreen
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {
        });
      }
      console.log('[Pong] Entering fullscreen mode');
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {
        });
      }
      console.log('[Pong] Exiting fullscreen mode');
    }
  }

  private updateFullscreenButton(): void {
    const fullscreenButton = document.getElementById('fullscreenButton');
    if (!fullscreenButton) return;

    const isFullscreen = !!document.fullscreenElement;
    
    if (isFullscreen) {
      fullscreenButton.innerHTML = 'Exit Fullscreen';
      console.log('[Pong] Updated button: Exit Fullscreen');
    } else {
      fullscreenButton.innerHTML = 'Fullscreen';
      console.log('[Pong] Updated button: Fullscreen');
    }
  }

  private startCountdown(): void {
    this.countdownActive = true;
    this.countdownValue = 3;

    // Scroll canvas into view and center it
    this.canvas.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center',
      inline: 'center'
    });

    const countdownInterval = setInterval(() => {
      this.countdownValue--;
      
      if (this.countdownValue <= 0) {
        clearInterval(countdownInterval);
        this.countdownActive = false;
        this.startGame(); // Start game after countdown
      }
    }, 1000); // 1 second per count
  }

  private startGame(): void {
    console.log('[Pong] Game starting!');
    this.gameRunning = true;
    this.lastTime = performance.now();
    this.gameLoop();
  }

  private gameLoop(): void {
    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
    this.lastTime = currentTime;

    this.updateParticles(deltaTime);

    // Only update game physics when running
    if (this.gameRunning) {
      this.update(deltaTime);
    }
    this.draw();
    this.animationFrame = requestAnimationFrame(() => this.gameLoop());
  }

  public destroy(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  private update(dt: number): void {
    // Move player1 (W/S)
    if (this.keys["w"] || this.keys["W"]) {
      this.player1.y -= this.player1.speed * dt;
    }
    if (this.keys["s"] || this.keys["S"]) {
      this.player1.y += this.player1.speed * dt;
    }

    // Move player2 (Arrow keys)
    if (this.aiPlayer) {
      this.updateAIMovement(dt);
      if (!this.aiFirstMove) {
        if (this.ball.dx > 0)
          this.updateAIDecision();
        this.aiFirstMove = true;
      }
    }
    else {
      if (this.keys["ArrowUp"]) {
        this.player2.y -= this.player2.speed * dt;
      }
      if (this.keys["ArrowDown"]) {
        this.player2.y += this.player2.speed * dt;
      }
    }

    // Keep paddles inside the canvas
    this.player1.y = Math.max(0, Math.min(this.canvas.height - this.player1.height, this.player1.y));
    this.player2.y = Math.max(0, Math.min(this.canvas.height - this.player2.height, this.player2.y));

    // Move ball
    this.ball.x += this.ball.dx * dt;
    this.ball.y += this.ball.dy * dt;

    // Ball collision with top/bottom walls
    if (this.ball.y <= 0 && this.ball.dy < 0) {
      this.ball.y = 0;
      this.ball.dy = -this.ball.dy;
    } else if (this.ball.y + this.ball.height >= this.canvas.height && this.ball.dy > 0) {
      this.ball.y = this.canvas.height - this.ball.height;
      this.ball.dy = -this.ball.dy;
    }

    // Ball collision with left paddle
    if (this.checkCollision(this.ball, this.player1) && this.ball.dx < 0) {
      this.ball.dx = Math.abs(this.ball.dx); // always move right
      this.ball.x = this.player1.x + this.player1.width; // push ball out so it doesn't stick
      if (this.ball.dx >= this.MAX_BALL_SPEED) {
        this.ball.dx = this.MAX_BALL_SPEED;
      }
      else {
        this.ball.dx *= 1.05; // gradually increase ball speed  
      }
      this.ball.dy = (Math.random() - 0.5) * (0.7 * this.ball.dx);     
      this.updateAIDecision();
    }

    // Ball collision with right paddle
    if (this.checkCollision(this.ball, this.player2) && this.ball.dx > 0) {
      this.ball.dx = -Math.abs(this.ball.dx); // always move left
      this.ball.x = this.player2.x - this.ball.width; // push ball out
      if (this.ball.dx >= this.MAX_BALL_SPEED) {
        this.ball.dx = this.MAX_BALL_SPEED;
      }
      else {
        this.ball.dx *= 1.05; // gradually increase ball speed  
      }
      this.ball.dy = (Math.random() - 0.5) * (0.7 * this.ball.dx);
      this.aiTargetY = this.canvas.height / 2;
    }

    // Scoring
    if (this.ball.x < 0) {
      this.player2Score++;
      this.createGoalExplosion(this.ball.x, this.ball.y + this.ball.height / 2);
      this.resetAIPlayer();
      this.updateScore();
      this.resetBall();
    } else if (this.ball.x > this.canvas.width) {
      this.player1Score++;
      this.createGoalExplosion(this.ball.x, this.ball.y + this.ball.height / 2);
      this.resetAIPlayer();
      this.updateScore();
      this.resetBall();
    }
  }

  private createGoalExplosion(x: number, y: number): void {
    const colors = ['#ef4444', '#f97316', '#facc15', '#ffffff', '#22d3ee'];
    const particleCount = 30;

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
      const speed = 150 + Math.random() * 100;
      
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50, // slight upward bias
        life: 0.8 + Math.random() * 0.4,
        maxLife: 1.2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 3 + Math.random() * 4,
      });
    }
  }

  private updateParticles(dt: number): void {
    this.particles = this.particles.filter(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 200 * dt; // gravity
      p.life -= dt;
      return p.life > 0;
    });
  }

  private checkCollision(rect1: GameObject, rect2: GameObject): boolean {
    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  }

  private resetBall(): void {
    this.ball.x = this.canvas.width / 2 - this.ball.width / 2;
    this.ball.y = this.canvas.height / 2 - this.ball.height / 2;
    
    // Random angle between -30° and +30°, like in game.ts
    const angle = (Math.random() * Math.PI) / 3 - Math.PI / 6;
    const sign = Math.random() < 0.5 ? 1 : -1;
    
    this.ball.dx = Math.cos(angle) * this.BALL_SPEED * sign;
    this.ball.dy = Math.sin(angle) * this.BALL_SPEED;

    this.player1.y = this.canvas.height / 2 - this.player1.height / 2;
    this.player2.y = this.canvas.height / 2 - this.player2.height / 2;
    
    this.gameRunning = false;
    this.showMobileOverlay();
  }

  private updateScore(): void {
    const p1Score = document.getElementById('player1Score');
    const p2Score = document.getElementById('player2Score');
    if (p1Score) p1Score.textContent = this.player1Score.toString();
    if (p2Score) p2Score.textContent = this.player2Score.toString();
  }

  private draw(): void {
    // Clear screen
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw dashed line in middle
    this.ctx.setLineDash([5, 15]);
    this.ctx.beginPath();
    this.ctx.moveTo(this.canvas.width / 2, 0);
    this.ctx.lineTo(this.canvas.width / 2, this.canvas.height);
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // Draw paddles
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(this.player1.x, this.player1.y, this.player1.width, this.player1.height);
    this.ctx.fillRect(this.player2.x, this.player2.y, this.player2.width, this.player2.height);

    // Draw ball
    this.ctx.fillRect(this.ball.x, this.ball.y, this.ball.width, this.ball.height);

    // Particles
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1;

    if (this.countdownActive) {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      
      this.ctx.fillStyle = '#4ade80';
      this.ctx.font = 'bold 120px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      
      const text = this.countdownValue > 0 ? this.countdownValue.toString() : 'GO!';
      this.ctx.fillText(text, this.canvas.width / 2, this.canvas.height / 2);
    }

    // If not started yet, show text
    if (!this.gameRunning && !this.aiPlayer && window.innerWidth >= 900) {
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      this.ctx.font = '24px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText("Press SPACE to start", this.canvas.width / 2, this.canvas.height / 2 + 50);
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  console.log('[Pong] DOM loaded, initializing game');
  const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;

  if (canvas) {
    console.log('[Pong] Canvas found, creating game');
    const game = new PongGame(canvas);

    const params = new URLSearchParams(location.search);
    const isAIMode = params.get('mode') === 'ai';
    game.setAIPlayer(isAIMode);
    
    // Update instructions based on mode
    if (isAIMode) {
      const playerControls = document.getElementById('playerControls');
      const mobileControls = document.getElementById('mobileControls');
      
      if (playerControls) {
        playerControls.innerHTML = 'You are the left Player<br>Keys: W/S';
      }
      if (mobileControls) {
        mobileControls.innerHTML = 'Tap the left screen to control your paddle';
      }
    }
    
    window.addEventListener('beforeunload', () => {
      game.destroy();
    });
  } else {
  }
});
