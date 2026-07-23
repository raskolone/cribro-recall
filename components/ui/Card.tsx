import React, { ReactNode, forwardRef } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

const Card = forwardRef<HTMLDivElement, CardProps & React.HTMLAttributes<HTMLDivElement>>(({ children, className, ...props }, ref) => {
  return (
    <div 
      ref={ref}
      className={`liquid-glass-card p-6 ${className || ''}`}
      {...props}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';

export default Card;
