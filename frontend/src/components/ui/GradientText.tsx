import React from 'react';

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p';
}

export const GradientText: React.FC<GradientTextProps> = ({
  children,
  className = '',
  as: Component = 'span'
}) => {
  return (
    <Component className={`bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent-500 animate-gradient-x ${className}`}>
      {children}
    </Component>
  );
};

export default GradientText;
