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


  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

    // Create ball in center
    this.ball = {
      x: this.canvas.width / 2 - 5,
      y: this.canvas.height / 2,
      width: 10,
      height: 10,
      dx: 15,
      dy: 3,
      speed: 15
    };

    // Left paddle
    this.player1 = {
      x: 20,
      y: this.canvas.height / 2 - 50,
      width: 10,
      height: 100,
      dy: 0,
      speed: 8
    };

    // Right paddle
    this.player2 = {
      x: this.canvas.width - 30,
      y: this.canvas.height / 2 - 50,
      width: 10,
      height: 100,
      dy: 0,
      speed: 8
    };

    this.setupEventListeners();

    // Only draw once at first
    this.draw();
  }

  private setupEventListeners(): void {
    document.addEventListener("keydown", (e) => {
      this.keys[e.key] = true;

      if (e.key === " ") {
        e.preventDefault();
        if (!this.gameRunning) {
          this.startGame();
        }
      }
    });

    document.addEventListener("keyup", (e) => {
      this.keys[e.key] = false;
    });
  }

  private startGame(): void {
    this.gameRunning = true;
    this.gameLoop();
  }

  private gameLoop(): void {
    if (!this.gameRunning) return;

    this.update();
    this.draw();
    requestAnimationFrame(() => this.gameLoop());
  }

  private update(): void {
    // Move player1 (W/S)
    if (this.keys["w"] || this.keys["W"]) {
      this.player1.y -= this.player1.speed;
    }
    if (this.keys["s"] || this.keys["S"]) {
      this.player1.y += this.player1.speed;
    }

    // Move player2 (Arrow keys)
    if (this.keys["ArrowUp"]) {
      this.player2.y -= this.player2.speed;
    }
    if (this.keys["ArrowDown"]) {
      this.player2.y += this.player2.speed;
    }

    // Keep paddles inside the canvas
    this.player1.y = Math.max(0, Math.min(this.canvas.height - this.player1.height, this.player1.y));
    this.player2.y = Math.max(0, Math.min(this.canvas.height - this.player2.height, this.player2.y));

    // Move ball
    this.ball.x += this.ball.dx;
    this.ball.y += this.ball.dy;

    // Ball collision with top/bottom walls
    if (this.ball.y <= 0 || this.ball.y >= this.canvas.height - this.ball.height) {
      this.ball.dy = -this.ball.dy; // reverse vertical direction
      this.ball.dx *= 1.05; // gradually increase ball speed  
    }

    // Ball collision with left paddle
    if (this.checkCollision(this.ball, this.player1)) {
      this.ball.dx = Math.abs(this.ball.dx); // always move right
      this.ball.x = this.player1.x + this.player1.width; // push ball out so it doesn't stick
      this.ball.dx *= 1.05; // gradually increase ball speed  
      this.ball.dy = (Math.random() - 0.5) * (0.7 * this.ball.dx);     
    }

    // Ball collision with right paddle
    if (this.checkCollision(this.ball, this.player2)) {
      this.ball.dx = -Math.abs(this.ball.dx); // always move left
      this.ball.x = this.player2.x - this.ball.width; // push ball out
      this.ball.dx *= 1.05; // gradually increase ball speed  
      this.ball.dy = (Math.random() - 0.5) * (0.7 * this.ball.dx);
    }

    // Ball out of bounds (scoring)
    if (this.ball.x < 0) {
      // Player 2 scores
      this.player2Score++;
      this.resetBall();
    } else if (this.ball.x > this.canvas.width) {
      // Player 1 scores
      this.player1Score++;
      this.resetBall();
    }

    this.updateScore();

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
    this.ball.x = this.canvas.width / 2;
    this.ball.y = this.canvas.height / 2;
    // Ball goes in opposite direction depending on who scored
    this.ball.dx = this.ball.dx > 0 ? -this.ball.speed : this.ball.speed;
    // Give ball a random vertical angle
    this.ball.dy = (Math.random() - 0.5) * 8;
    this.gameRunning = false; // pause game until space is pressed
  }

  private updateScore(): void {
    const player1ScoreEl = document.getElementById('player1Score');
    const player2ScoreEl = document.getElementById('player2Score');
    if (player1ScoreEl) player1ScoreEl.textContent = this.player1Score.toString();
    if (player2ScoreEl) player2ScoreEl.textContent = this.player2Score.toString();
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


    // If not started yet, show text
    if (!this.gameRunning) {
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      this.ctx.font = '24px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText("Press SPACE to start", this.canvas.width / 2, this.canvas.height / 2 + 50);
    }
  }
}


document.addEventListener("DOMContentLoaded", () => {
  // This code only runs once the HTML is fully loaded
  const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;

  if (canvas) {
    new PongGame(canvas); // start the game
  }
});
