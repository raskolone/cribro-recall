import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';

export const GSAPModal = ({ children, isOpen, onClose, maxWidth = 'max-w-lg', className = '' }: { children: React.ReactNode, isOpen: boolean, onClose?: () => void, maxWidth?: string, className?: string }) => {
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
    <div ref={overlayRef} className={`fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-6 overflow-y-auto bg-black/80 ${className}`}>
      <div 
        className="absolute inset-0" 
        onClick={onClose} 
      />
      <div ref={contentRef} className={`relative z-10 w-full ${maxWidth} my-auto`}>
        {children}
      </div>
    </div>
  );
};
