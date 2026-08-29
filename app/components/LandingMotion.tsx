'use client';

import { useEffect } from 'react';

/* Landing'in DOM-üstü davranışları — canvas dışındaki her şey:
   - .js sınıfı (reveal gizlemesini yalnızca JS varken aç)
   - satırların telden çıkar gibi açılması (stagger)
   - kaynak evrenine yaklaşma (bulanık/küçük → net/tam boy)
   - zaman teli dolgusu (kaydırma = zamanda geriye)
   - tarih başlıklarının okuma kafasından geçerken parlaması
   - canlı saat
   Hiçbiri içeriği taşımaz; JS çalışmazsa sayfa tam okunur kalır. */

const AY = ['OCA', 'ŞUB', 'MAR', 'NİS', 'MAY', 'HAZ', 'TEM', 'AĞU', 'EYL', 'EKİ', 'KAS', 'ARA'];

export default function LandingMotion() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('js');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cleanups: Array<() => void> = [];

    /* ── canlı saat ── */
    const today = document.getElementById('lp-today');
    const clock = document.getElementById('lp-clock');
    function tick() {
      const d = new Date();
      if (today) today.textContent = `${d.getDate()} ${AY[d.getMonth()]} ${d.getFullYear()}`;
      if (clock) {
        clock.textContent = [d.getHours(), d.getMinutes(), d.getSeconds()]
          .map((n) => String(n).padStart(2, '0')).join(':');
      }
    }
    tick();
    if (!reduce) {
      const id = setInterval(tick, 1000);
      cleanups.push(() => clearInterval(id));
    }

    /* ── reveal (stagger) ── */
    const unmasks = Array.from(document.querySelectorAll<HTMLElement>('.lp-reveal'));
    if (reduce) {
      unmasks.forEach((el) => el.classList.add('on'));
    } else {
      const groups = new Map<Element, number>();
      const revealObs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (!e.isIntersecting) return;
            const el = e.target as HTMLElement;
            const parent = el.parentElement as Element;
            const i = groups.get(parent) || 0;
            groups.set(parent, i + 1);
            setTimeout(() => el.classList.add('on'), i * 90);
            revealObs.unobserve(el);
          });
        },
        { threshold: 0, rootMargin: '0px 0px -12% 0px' }
      );
      unmasks.forEach((el) => revealObs.observe(el));
      cleanups.push(() => revealObs.disconnect());

      // Güvenlik ağı: 3sn sonra hâlâ kapalı görünür eleman varsa aç.
      const safety = setTimeout(() => {
        unmasks.forEach((el) => {
          if (el.classList.contains('on')) return;
          const r = el.getBoundingClientRect();
          if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('on');
        });
      }, 3000);
      cleanups.push(() => clearTimeout(safety));
    }

    /* ── yaklaşma (kaynak evreni girişi) ── */
    const approaches = Array.from(document.querySelectorAll<HTMLElement>('.lp-approach'));
    if (approaches.length) {
      if (reduce) {
        approaches.forEach((el) => el.classList.add('on'));
      } else {
        const approachObs = new IntersectionObserver(
          (entries) => {
            entries.forEach((e) => {
              if (!e.isIntersecting) return;
              (e.target as HTMLElement).classList.add('on');
              approachObs.unobserve(e.target);
            });
          },
          { threshold: 0, rootMargin: '0px 0px -15% 0px' }
        );
        approaches.forEach((el) => approachObs.observe(el));
        cleanups.push(() => approachObs.disconnect());
      }
    }

    /* ── zaman teli dolgusu ── */
    const spine = document.getElementById('lp-spine');
    const fill = document.getElementById('lp-spine-fill');
    if (spine && fill) {
      let ticking = false;
      const onScroll = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          const headY = window.innerHeight * 0.34;
          const top = spine.getBoundingClientRect().top;
          const h = Math.max(0, Math.min(spine.offsetHeight, headY - top));
          fill.style.height = h + 'px';
          ticking = false;
        });
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
      cleanups.push(() => window.removeEventListener('scroll', onScroll));
    }

    /* ── dateline: okuma kafasından geçerken parla ── */
    const band = `-66% 0px -34% 0px`;
    const marks = document.querySelectorAll<HTMLElement>('[data-lp-mark]');
    if (marks.length) {
      const markObs = new IntersectionObserver(
        (entries) => entries.forEach((e) => e.target.classList.toggle('lit', e.isIntersecting)),
        { rootMargin: band, threshold: 0 }
      );
      marks.forEach((el) => markObs.observe(el));
      cleanups.push(() => markObs.disconnect());
    }

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
