'use client';

import { useEffect, useRef } from 'react';

/* Kaynak takımyıldızı: her düğüm bir kaynak, renk = tür. Yakın düğümler
   bağlanır; imleç yaklaşınca düğümler kaçar ve o bölgedeki bağlantılar
   parlar, güçlü parıltıda kaynak adı belirir. Ürünün "senin seçtiğin
   kaynaklar" fikrini soyut ama okunur bir ağ olarak gösterir. */

type Tur = 'youtube' | 'blog' | 'x' | 'academic';

const COLORS: Record<Tur, [number, number, number]> = {
  youtube: [229, 112, 138],
  blog: [217, 166, 78],
  x: [180, 180, 196],
  academic: [76, 187, 138],
};

/* Genel bir kaynak evreni — kullanıcının gerçekten takip ettikleriyle
   sınırlı değil. Herkesin takip edebileceği, farklı ilgi alanlarından
   tanınır isimler; haritanın amacı "bu kadar geniş bir ağdan seçebilirsin"
   fikrini vermek. */
const SOURCES: [string, Tur][] = [
  ['Veritasium', 'youtube'], ['OMNIBUS', 'youtube'], ['Mahalle Yanarken', 'youtube'],
  ['Moxo Türkiye', 'youtube'], ['Kurzgesagt', 'youtube'], ['3Blue1Brown', 'youtube'],
  ['Fireship', 'youtube'], ['Lex Fridman', 'youtube'], ['ODTÜ', 'youtube'],
  ['Real Engineering', 'youtube'], ['Two Minute Papers', 'youtube'], ['Not Just Bikes', 'youtube'],
  ['ColdFusion', 'youtube'], ['Numberphile', 'youtube'], ['PBS Space Time', 'youtube'],
  ['Steve Mould', 'youtube'], ['Practical Engineering', 'youtube'], ['Computerphile', 'youtube'],
  ['Vsauce', 'youtube'], ['CGP Grey', 'youtube'], ['Tom Scott', 'youtube'], ['Wendover Productions', 'youtube'],
  ['Yanis Varoufakis', 'blog'], ['Stratechery', 'blog'], ['Marginal Revolution', 'blog'],
  ['Astral Codex Ten', 'blog'], ['Construction Physics', 'blog'], ['The Diff', 'blog'],
  ['Ben Thompson', 'blog'], ['Noahpinion', 'blog'], ['Slow Boring', 'blog'], ['Money Stuff', 'blog'],
  ['LessWrong', 'blog'], ['Farnam Street', 'blog'], ['Wait But Why', 'blog'], ['Zvi Mowshowitz', 'blog'],
  ['@balajis', 'x'], ['@pmarca', 'x'], ['@karpathy', 'x'], ['@tylercowen', 'x'],
  ['@sama', 'x'], ['@AndrewYNg', 'x'], ['@simonw', 'x'], ['@swyx', 'x'], ['@emollick', 'x'],
  ['arXiv: cs.AI', 'academic'], ['Nature', 'academic'], ['SSRN', 'academic'], ['NBER', 'academic'],
  ['Science', 'academic'], ['PNAS', 'academic'], ['The Lancet', 'academic'], ['ACM Digital Library', 'academic'],
];

const LINK_DIST = 128;
const MOUSE_R = 200;

type Node = {
  name: string; type: Tur;
  x: number; y: number; vx: number; vy: number;
  r: number; base: number; glow: number; phase: number;
};

export default function Constellation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const context = canvasEl.getContext('2d', { alpha: true });
    if (!context) return;
    const canvas: HTMLCanvasElement = canvasEl;
    const ctx: CanvasRenderingContext2D = context;

    const host = canvas.parentElement as HTMLElement;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    let W = 0, H = 0;
    let nodes: Node[] = [];
    let raf = 0;
    const mouse = { x: -9999, y: -9999, active: false };

    function resize() {
      const r = host.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    function build() {
      const area = W * H;
      let target = Math.round(area / 11000);
      target = Math.max(30, Math.min(target, 150));
      if (W < 640) target = Math.min(target, 42);
      nodes = [];
      for (let i = 0; i < target; i++) {
        const [name, type] = SOURCES[i % SOURCES.length];
        nodes.push({
          name, type,
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.24,
          vy: (Math.random() - 0.5) * 0.24,
          r: (type === 'youtube' || type === 'blog') ? 2.2 + Math.random() * 1.4 : 1.5 + Math.random(),
          base: (type === 'x' || type === 'academic') ? 0.4 : 0.72,
          glow: 0,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }

    function frame() {
      ctx.clearRect(0, 0, W, H);

      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < -20) n.x = W + 20; else if (n.x > W + 20) n.x = -20;
        if (n.y < -20) n.y = H + 20; else if (n.y > H + 20) n.y = -20;

        if (mouse.active) {
          const dx = n.x - mouse.x, dy = n.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < MOUSE_R * MOUSE_R) {
            const d = Math.sqrt(d2) || 1;
            const force = 1 - d / MOUSE_R;
            n.x += (dx / d) * force * 2.2;
            n.y += (dy / d) * force * 2.2;
            n.glow = Math.min(1, n.glow + force * 0.14);
          }
        }
        n.glow *= 0.94;
        n.phase += 0.01;
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK_DIST * LINK_DIST) {
            const d = Math.sqrt(d2);
            const prox = 1 - d / LINK_DIST;
            const lit = Math.max(a.glow, b.glow);
            const alpha = prox * (0.22 + lit * 0.55);
            if (alpha < 0.012) continue;
            let col: string;
            if (lit > 0.04) {
              const ca = COLORS[a.type], cb = COLORS[b.type];
              col = `rgba(${(ca[0] + cb[0]) / 2 | 0},${(ca[1] + cb[1]) / 2 | 0},${(ca[2] + cb[2]) / 2 | 0},${alpha})`;
            } else {
              col = `rgba(128,128,168,${alpha})`;
            }
            ctx.strokeStyle = col;
            ctx.lineWidth = 0.7 + lit * 1.1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (const n of nodes) {
        const c = COLORS[n.type];
        const twinkle = 0.85 + Math.sin(n.phase) * 0.15;
        const a = Math.min(1, (n.base + n.glow * 0.5) * twinkle);

        if (n.glow > 0.04) {
          const halo = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 14 + n.glow * 10);
          halo.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${n.glow * 0.4})`);
          halo.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(n.x, n.y, 14 + n.glow * 10, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${a})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + n.glow * 1.5, 0, Math.PI * 2);
        ctx.fill();

        if (n.glow > 0.5) {
          ctx.fillStyle = `rgba(240,240,245,${(n.glow - 0.5) * 1.6})`;
          ctx.font = '500 10px var(--font-geist-mono), monospace';
          ctx.fillText(n.name, n.x + 9, n.y + 3);
        }
      }

      raf = requestAnimationFrame(frame);
    }

    function start() { if (!raf) raf = requestAnimationFrame(frame); }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

    function onMove(e: PointerEvent) {
      const r = host.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
      mouse.active = true;
    }
    function onLeave() { mouse.active = false; mouse.x = mouse.y = -9999; }

    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);

    let resizeTimer: ReturnType<typeof setTimeout>;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { resize(); build(); }, 150);
    }
    window.addEventListener('resize', onResize);

    resize();
    build();

    if (reduce) {
      // Hareketsiz tek kare: statik ağ.
      ctx.clearRect(0, 0, W, H);
      for (const n of nodes) {
        const c = COLORS[n.type];
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${n.base})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Sadece görünürken çiz (pil/performans).
      const io = new IntersectionObserver(
        (entries) => entries.forEach((e) => (e.isIntersecting ? start() : stop())),
        { threshold: 0 }
      );
      io.observe(host);

      return () => {
        io.disconnect();
        stop();
        host.removeEventListener('pointermove', onMove);
        host.removeEventListener('pointerleave', onLeave);
        window.removeEventListener('resize', onResize);
        clearTimeout(resizeTimer);
      };
    }

    return () => {
      stop();
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('resize', onResize);
      clearTimeout(resizeTimer);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="absolute inset-0 z-0 block h-full w-full"
    />
  );
}
