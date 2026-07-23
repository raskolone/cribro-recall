
import React, { ReactNode } from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  className, 
  variant = 'primary', 
  size = 'md', 
  isLoading = false,
  ...props 
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-bold font-sans rounded-full focus:outline-none transition-all duration-300 ease-out disabled:opacity-50 disabled:cursor-not-allowed';

  const variantStyles = {
    primary: 'liquid-glass-button',
    secondary: 'bg-white/5 backdrop-blur-md border border-white/10 text-content hover:border-primary/40 hover:text-primary hover:bg-white/10 hover:-translate-y-[1px] shadow-[0_4px_16px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(114,240,180,0.15)]',
    ghost: 'bg-transparent text-primary hover:bg-primary/10 hover:-translate-y-[1px]',
    danger: 'bg-red-500/10 backdrop-blur-md text-red-400 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 hover:-translate-y-[1px] shadow-[0_4px_16px_rgba(0,0,0,0.2)]',
  };

  const sizeStyles = {
    sm: 'px-5 py-2 text-xs',
    md: 'px-8 py-3 text-sm',
    lg: 'px-10 py-4 text-base',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className || ''}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : children}
    </button>
  );
};

export default Button;
