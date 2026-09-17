import React from 'react';

interface VampireSquidLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

/**
 * Vampio Logo
 * Modern, abstract, geometric representation of a vampire squid / data crystal.
 * Clean intersecting layers, enterprise SaaS aesthetic (similar to Postman, Vercel, Figma).
 * The outer swoops represent the mantle/wings, while the core represents a data node.
 */
export const VampireSquidLogo: React.FC<VampireSquidLogoProps> = ({
  size = 28,
  className = '',
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      {/* Left abstract wing / swoop */}
      <path 
        d="M 20 25 L 45 55 L 28 85 C 10 65 10 40 20 25 Z" 
        fill="currentColor" 
        opacity="0.4" 
      />
      
      {/* Right abstract wing / swoop */}
      <path 
        d="M 80 25 L 55 55 L 72 85 C 90 65 90 40 80 25 Z" 
        fill="currentColor" 
        opacity="0.4" 
      />
      
      {/* Core data crystal / mantle */}
      <path 
        d="M 50 10 L 75 42 L 50 92 L 25 42 Z" 
        fill="currentColor" 
      />
      
      {/* Inner bright highlight/cutout for a faceted 3D tech look */}
      <path 
        d="M 50 10 L 75 42 L 50 65 Z" 
        fill="white" 
        opacity="0.25" 
      />
    </svg>
  );
};

export default VampireSquidLogo;

