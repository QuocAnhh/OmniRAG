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
    <Component className={`bg-clip-text text-transparent bg-gradient-to-br from-[#7eb3f5] via-[#4f8ef0] to-[#3a6fd4] ${className}`}>
      {children}
    </Component>
  );
};

export default GradientText;
