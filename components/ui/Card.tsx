
import React, { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

const Card: React.FC<CardProps & React.HTMLAttributes<HTMLDivElement>> = ({ children, className, ...props }) => {
  return (
    <div 
      className={`bg-base-100 border border-base-300 rounded-[8px] p-4 sm:p-6 ${className || ''}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
