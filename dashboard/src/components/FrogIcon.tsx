import React from 'react';
import Image from 'next/image';

interface FrogIconProps {
  className?: string;
  size?: number;
  alt?: string;
}

export default function FrogIcon({ className = 'w-6 h-6', size, alt = 'MewBot Frog' }: FrogIconProps) {
  if (size) {
    return (
      <Image
        src="/mewbot-frog.png"
        width={size}
        height={size}
        alt={alt}
        className={`object-contain inline-block ${className}`}
        priority
      />
    );
  }

  return (
    <img
      src="/mewbot-frog.png"
      alt={alt}
      className={`object-contain inline-block ${className}`}
    />
  );
}

