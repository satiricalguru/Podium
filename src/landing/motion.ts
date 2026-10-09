import { useEffect, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);
export { gsap, ScrollTrigger };

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Inertial smooth scrolling, driven by GSAP's ticker so ScrollTrigger stays in lockstep. */
export function useSmoothScroll(enabled: boolean) {
  useIsoLayoutEffect(() => {
    if (!enabled) return;
    const lenis = new Lenis({ lerp: .085, wheelMultiplier: .9, touchMultiplier: 1.4, anchors: true });
    lenis.on('scroll', ScrollTrigger.update);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    document.documentElement.classList.add('lenis-on');
    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
      document.documentElement.classList.remove('lenis-on');
    };
  }, [enabled]);
}

/** Pointer-follow "magnetic" pull for hero CTAs. Pure transform, no layout. */
export function magnetic(element: HTMLElement | null, strength = .28) {
  if (!element || window.matchMedia('(pointer: coarse)').matches) return () => undefined;
  const x = gsap.quickTo(element, 'x', { duration: .5, ease: 'power3.out' });
  const y = gsap.quickTo(element, 'y', { duration: .5, ease: 'power3.out' });
  const move = (e: PointerEvent) => {
    const r = element.getBoundingClientRect();
    x((e.clientX - r.left - r.width / 2) * strength); y((e.clientY - r.top - r.height / 2) * strength);
  };
  const leave = () => { x(0); y(0); };
  element.addEventListener('pointermove', move); element.addEventListener('pointerleave', leave);
  return () => { element.removeEventListener('pointermove', move); element.removeEventListener('pointerleave', leave); };
}
