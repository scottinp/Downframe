// Faint grid of After Effects style keyframes behind the hero, pulsing on a wave that travels down.

const SPACING = 32; // px between keyframe centres
const OFFSET = 16; // px from the top-left to the first centre
const MIN_SIZE = 2.5; // half-width at the bottom of the wave
const GROWTH = 3; // extra half-width at the top of the wave
const SPEED = 1.1; // wave speed, radians per second
const ROW_PHASE = 0.45; // wave offset per row: makes it travel down
const COL_PHASE = 0.12; // wave offset per column: slight diagonal

const FPS = 30; // the wave is slow, so 30fps looks the same as 60 at half the work
const SPRITE = 32; // px; one keyframe drawn once, then stamped per cell (clipping every cell made scrolling lag)

const clamp = (v: number) => Math.min(1, Math.max(0, v));

const canvas = document.querySelector<HTMLCanvasElement>("canvas.keyframes");
const ctx = canvas?.getContext("2d");

// Rounded diamond: left half white, right half white at half opacity. Per-cell opacity comes from globalAlpha.
const sprite = document.createElement("canvas");
sprite.width = sprite.height = SPRITE;
const sctx = sprite.getContext("2d");
if (sctx) {
  const c = SPRITE / 2, s = SPRITE / 2, r = s * 0.2;
  sctx.beginPath();
  sctx.moveTo(c, c - s);
  sctx.arcTo(c + s, c, c, c + s, r);
  sctx.arcTo(c, c + s, c - s, c, r);
  sctx.arcTo(c - s, c, c, c - s, r);
  sctx.arcTo(c, c - s, c + s, c, r);
  sctx.closePath();
  sctx.clip();
  sctx.fillStyle = "#fff";
  sctx.fillRect(0, 0, c, SPRITE);
  sctx.fillStyle = "rgb(255 255 255 / 0.5)";
  sctx.fillRect(c, 0, c, SPRITE);
}

function draw(seconds: number) {
  if (!canvas || !ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  for (let row = 0, y = OFFSET; y < height; row++, y += SPACING) {
    for (let col = 0, x = OFFSET; x < width; col++, x += SPACING) {
      const wave = 0.5 + 0.5 * Math.sin(row * ROW_PHASE - seconds * SPEED + col * COL_PHASE);
      const fadeX = clamp((x / width - 0.2) / 0.3);
      const fadeY = clamp((height - y) / (height * 0.3)) * clamp(y / 60);
      const opacity = (0.07 + 0.2 * wave) * fadeX * fadeY;
      if (opacity < 0.01) continue;
      const s = MIN_SIZE + GROWTH * wave;
      ctx.globalAlpha = opacity;
      ctx.drawImage(sprite, x - s, y - s, 2 * s, 2 * s);
    }
  }
  ctx.globalAlpha = 1;
}

if (canvas && ctx) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    draw(0);
    window.addEventListener("resize", () => draw(0));
  } else {
    let frame = 0;
    let last = -Infinity;
    const loop = (ms: number) => {
      // Small tolerance so 60Hz displays reliably draw every second frame.
      if (ms - last >= 1000 / FPS - 2) {
        last = ms;
        draw(ms / 1000);
      }
      frame = requestAnimationFrame(loop);
    };
    new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(frame);
      if (entry.isIntersecting) frame = requestAnimationFrame(loop);
    }).observe(canvas);
  }
}
