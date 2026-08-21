
import React, { ReactNode } from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

/**
 * Warianty wg design/theme/components.md.
 *
 * `primary` to jedyne miejsce w motywie, gdzie akcent wypełnia większą
 * powierzchnię — używaj go dla jednej głównej akcji na ekranie. Domyślnym
 * przyciskiem jest `secondary` (obrys + przezroczysty akcent).
 */
const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-sans rounded-full transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] disabled:opacity-45 disabled:pointer-events-none';

  const variantStyles = {
    // Jedyne dozwolone wypełnienie akcentem — stąd ciemny tekst i poświata.
    primary:
      'bg-accent text-accent-ink font-bold shadow-btn hover:brightness-110 hover:-translate-y-px active:translate-y-0 active:brightness-95',
    // Domyślny przycisk: obrys, tekst akcentem, poświata dopiero na hover.
    secondary:
      'font-medium text-accent border border-accent/25 bg-[linear-gradient(135deg,var(--accent-15),var(--accent-04))] hover:border-accent/55 hover:shadow-glow hover:-translate-y-px',
    // Trzeciorzędny: etykieta monospace, neutralna powierzchnia.
    ghost:
      'font-medium font-mono tracking-[0.06em] text-text-2 bg-white/[0.04] border border-line-strong hover:bg-white/[0.07] hover:text-content',
    danger:
      'font-medium text-danger border border-danger/30 bg-danger/10 hover:border-danger/55 hover:bg-danger/15 hover:-translate-y-px',
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
