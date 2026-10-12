import React, { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import gsap from "gsap";
import { GEN_VIEWBOX, TANGLED_YARN_PATH, SPIRAL_CIRCLE_PATH } from "../../utils/generatingAnimation";

interface GeneratingAnimationProps {
  className?: string;
  reducedMotion?: boolean;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Przywrócona oryginalna animacja oczekiwania na generowanie (kłębek odwijający się w koło).
 * Wizualnie i behawioralnie zgodna z wersją sprzed regresji w 3549a1ba, z zachowaniem dostępności
 * (role=status, aria-live=polite), i18n oraz pełnego poszanowania prefers-reduced-motion.
 */
const GeneratingAnimation: React.FC<GeneratingAnimationProps> = ({ className, reducedMotion }) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const tangledRef = useRef<SVGPathElement>(null);
  const spiralRef = useRef<SVGPathElement>(null);
  const statusTextRef = useRef<HTMLParagraphElement>(null);

  const reduced = useMemo(() => reducedMotion ?? prefersReducedMotion(), [reducedMotion]);

  useEffect(() => {
    if (reduced) {
      if (tangledRef.current) {
        tangledRef.current.style.opacity = "1";
        tangledRef.current.style.strokeDashoffset = "0";
      }
      if (spiralRef.current) {
        spiralRef.current.style.opacity = "0";
      }
      return;
    }

    const _gsap = (gsap as any)?.gsap ?? gsap;
    if (!_gsap || typeof _gsap.context !== "function") return;

    const ctx = _gsap.context(() => {
      const tangledLength = tangledRef.current?.getTotalLength ? tangledRef.current.getTotalLength() || 10000 : 10000;
      const spiralLength = spiralRef.current?.getTotalLength ? spiralRef.current.getTotalLength() || 6000 : 6000;

      // Reset state
      _gsap.set(tangledRef.current, { strokeDasharray: tangledLength, strokeDashoffset: 0, opacity: 1 });
      _gsap.set(spiralRef.current, { strokeDasharray: spiralLength, strokeDashoffset: spiralLength, opacity: 0 });

      const tl = _gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: 1.5 });

      // Krok 1: Odwijanie i wygaszanie kłębka
      tl.to(tangledRef.current, { 
        strokeDashoffset: tangledLength, 
        opacity: 0,
        duration: 5, 
        ease: "power2.inOut" 
      }, 0);

      // Krok 2: Rysowanie odręcznego koła i rozjaśnianie
      tl.to(spiralRef.current, { 
        strokeDashoffset: 0, 
        opacity: 1,
        duration: 5, 
        ease: "power2.inOut" 
      }, 0);

      // Ciągła powolna rotacja koła
      _gsap.to(spiralRef.current, {
        rotation: 360,
        transformOrigin: "350px 150px",
        duration: 45,
        ease: "none",
        repeat: -1
      });

      // Subtelny puls kontenera kłębka
      _gsap.to(".yarn-container", {
        scale: 1.04,
        duration: 4,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
      });

      if (statusTextRef.current) {
        _gsap.to(statusTextRef.current, {
          opacity: 0.6,
          duration: 1.5,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      }
    }, containerRef);

    return () => ctx.revert();
  }, [reduced]);

  return (
    <div
      ref={containerRef}
      role="status"
      aria-live="polite"
      data-testid="generating-animation"
      className={`flex flex-col items-center justify-center p-6 sm:p-8 text-center w-full max-w-4xl mx-auto my-auto relative min-h-[380px] select-none ${className ?? ""}`}
    >
      <div className="yarn-container relative w-full max-w-[500px] aspect-video mb-4 flex items-center justify-center select-none overflow-visible">
        <div className="absolute inset-0 bg-[var(--accent)]/10 blur-[80px] rounded-full pointer-events-none" />
        
        <svg
          aria-hidden="true"
          focusable="false"
          className="w-full h-full overflow-visible"
          viewBox={GEN_VIEWBOX}
          fill="none"
        >
          <defs>
            <filter id="yarnShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="2" dy="4" stdDeviation="4" floodColor="var(--ink)" floodOpacity="0.6" />
            </filter>
            <filter id="yarnGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="10" floodColor="var(--accent)" floodOpacity="0.2" />
            </filter>
          </defs>

          <g filter="url(#yarnGlow)">
            <g filter="url(#yarnShadow)">
              {/* Tangled Yarn Ball (kłębek) */}
              <path
                ref={tangledRef}
                d={TANGLED_YARN_PATH}
                stroke="var(--accent)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                data-testid="yarn-tangle"
              />

              {/* Hand-drawn messy circle (koło) */}
              <path
                ref={spiralRef}
                d={SPIRAL_CIRCLE_PATH}
                stroke="var(--accent)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                data-testid="yarn-spiral"
              />
            </g>
          </g>
        </svg>
      </div>

      <h3 className="text-2xl font-bold text-text-hi mb-3 tracking-tight flex items-center justify-center gap-3">
        <Sparkles className="w-6 h-6 text-[var(--accent)] animate-pulse" aria-hidden="true" />
        <span>{t("Upraszczanie i porządkowanie...")}</span>
      </h3>
      
      <p ref={statusTextRef} className="text-base text-text-hi/80 font-medium tracking-wide max-w-sm mx-auto">
        {t("Inteligentny system eliminuje chaos i tworzy przejrzystą strukturę.")}
      </p>
    </div>
  );
};

export default GeneratingAnimation;
