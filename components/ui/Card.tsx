import React, { ReactNode, forwardRef } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

const Card = forwardRef<HTMLDivElement, CardProps & React.HTMLAttributes<HTMLDivElement>>(({ children, className, ...props }, ref) => {
  return (
    <div 
      ref={ref}
      className={`bg-base-200/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.4),inset_0_1px_0_0_rgba(255,255,255,0.05)] transition-all duration-300 ease-out hover:-translate-y-[2px] hover:shadow-[0_12px_40px_0_rgba(0,0,0,0.5),0_0_30px_rgba(114,240,180,0.15),inset_0_1px_0_0_rgba(255,255,255,0.1)] hover:border-primary/30 hover:bg-base-200/50 ${className || ''}`}
      {...props}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';

export default Card;
