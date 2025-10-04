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

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

    // Create ball in center
    this.ball = {
      x: this.canvas.width / 2 - 5,
      y: this.canvas.height / 2,
      width: 10,
      height: 10,
      dx: 5,
      dy: 3,
      speed: 5
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


    // Only draw once at first
    this.draw();
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


    // Message
    this.ctx.fillStyle = 'rgba(255,255,255,0.8)';
    this.ctx.font = '24px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Press SPACE to start', this.canvas.width / 2, this.canvas.height / 2 + 50);
  }
}


document.addEventListener("DOMContentLoaded", () => {
  // This code only runs once the HTML is fully loaded
  const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;

  if (canvas) {
    new PongGame(canvas); // start the game
  }
});
