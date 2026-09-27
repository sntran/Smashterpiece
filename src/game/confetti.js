// Confetti on a 2D canvas over the game.

const COLORS = ['#ff5d73', '#ffd35c', '#4cc9f0', '#4ade80', '#b388ff', '#ff9f43'];

export class Confetti {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.bits = [];
    this.running = false;
  }

  burst(count = 160) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let k = 0; k < count; k++) {
      const fromLeft = k % 2 === 0;
      this.bits.push({
        x: fromLeft ? -10 : w + 10,
        y: h * (0.55 + Math.random() * 0.3),
        vx: (fromLeft ? 1 : -1) * (250 + Math.random() * 500),
        vy: -(500 + Math.random() * 700),
        size: 8 + Math.random() * 10,
        angle: Math.random() * 6,
        spin: (Math.random() - 0.5) * 14,
        color: COLORS[k % COLORS.length],
        round: Math.random() < 0.3,
      });
    }
    if (!this.running) {
      this.running = true;
      this.last = performance.now();
      requestAnimationFrame((t) => this.frame(t));
    }
  }

  frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const ctx = this.ctx;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, window.innerWidth, h);
    for (const b of this.bits) {
      b.vy += 900 * dt;
      b.vx *= 1 - dt * 1.2;
      b.vy = Math.min(b.vy, 260);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.angle += b.spin * dt;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      ctx.fillStyle = b.color;
      if (b.round) {
        ctx.beginPath();
        ctx.arc(0, 0, b.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-b.size / 2, -b.size / 4, b.size, b.size / 2 * Math.abs(Math.cos(b.angle * 2)) + 2);
      }
      ctx.restore();
    }
    this.bits = this.bits.filter((b) => b.y < h + 40);
    if (this.bits.length > 0) {
      requestAnimationFrame((t) => this.frame(t));
    } else {
      this.running = false;
      ctx.clearRect(0, 0, window.innerWidth, h);
    }
  }
}
