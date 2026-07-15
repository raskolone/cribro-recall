import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';

export const GSAPView = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (ref.current) {
      gsap.fromTo(ref.current,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }
      );
    }
  }, []);

  return <div ref={ref} className={className}>{children}</div>;
};

export const GSAPModal = ({ children, className = '', isOpen, onClose }: { children: React.ReactNode, className?: string, isOpen: boolean, onClose: () => void }) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (overlayRef.current) {
        gsap.fromTo(overlayRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.3, ease: "power2.out" }
        );
      }
      if (contentRef.current) {
        gsap.fromTo(contentRef.current,
          { opacity: 0, scale: 0.95, y: 20 },
          { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: "back.out(1.2)" }
        );
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div ref={overlayRef} className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 ${className}`}>
      <div 
        className="absolute inset-0" 
        onClick={onClose} 
      />
      <div ref={contentRef} className="relative z-10 w-full max-w-lg">
        {children}
      </div>
    </div>
  );
};
