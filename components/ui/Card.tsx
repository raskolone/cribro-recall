
import React, { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

const Card: React.FC<CardProps & React.HTMLAttributes<HTMLDivElement>> = ({ children, className, ...props }) => {
  return (
    <div 
      className={`bg-base-200 border border-base-300 rounded-lg p-6 transition-all duration-250 ease-out hover:-translate-y-[3px] hover:shadow-[0_0_24px_rgba(114,240,180,0.15),0_8px_32px_rgba(0,0,0,0.3)] hover:border-primary/30 ${className || ''}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
