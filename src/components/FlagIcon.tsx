import React from 'react';
import { SupportedLocale } from '../i18n/types';

interface FlagIconProps {
  country: SupportedLocale | string;
  className?: string;
  title?: string;
}

/**
 * High-definition vector flag icons rendered as clean inline SVGs.
 * Solves the issue where Windows PCs lack flag emoji fonts and show
 * regional indicator letters (e.g. "US", "TH", "JP") instead of flags.
 */
export const FlagIcon: React.FC<FlagIconProps> = ({ country, className = 'w-4 h-3', title }) => {
  const code = (country || 'en').toLowerCase();

  switch (code) {
    case 'en':
    case 'us':
      return (
        <svg
          viewBox="0 0 640 480"
          className={`inline-block overflow-hidden rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.12)] shrink-0 select-none align-middle ${className}`}
          role="img"
          aria-label={title || 'United States Flag'}
        >
          {title && <title>{title}</title>}
          {/* 13 Stripes */}
          <rect width="640" height="480" fill="#B22234" />
          <path
            d="M0,36.92h640M0,110.77h640M0,184.62h640M0,258.46h640M0,332.31h640M0,406.15h640"
            stroke="#FFFFFF"
            strokeWidth="36.92"
          />
          {/* Blue Canton */}
          <rect width="256" height="258.46" fill="#3C3B6E" />
          {/* Star Pattern grid in blue canton */}
          <g fill="#FFFFFF">
            {[
              [24, 25], [64, 25], [104, 25], [144, 25], [184, 25], [224, 25],
              [44, 52], [84, 52], [124, 52], [164, 52], [204, 52],
              [24, 79], [64, 79], [104, 79], [144, 79], [184, 79], [224, 79],
              [44, 106], [84, 106], [124, 106], [164, 106], [204, 106],
              [24, 133], [64, 133], [104, 133], [144, 133], [184, 133], [224, 133],
              [44, 160], [84, 160], [124, 160], [164, 160], [204, 160],
              [24, 187], [64, 187], [104, 187], [144, 187], [184, 187], [224, 187],
              [44, 214], [84, 214], [124, 214], [164, 214], [204, 214],
              [24, 241], [64, 241], [104, 241], [144, 241], [184, 241], [224, 241],
            ].map(([cx, cy], idx) => (
              <polygon
                key={idx}
                points={`${cx},${cy - 7.5} ${cx + 2.3},${cy - 2.3} ${cx + 7.5},${cy - 2.3} ${cx + 3.3},${cy + 1} ${cx + 4.8},${cy + 6} ${cx},${cy + 2.7} ${cx - 4.8},${cy + 6} ${cx - 3.3},${cy + 1} ${cx - 7.5},${cy - 2.3} ${cx - 2.3},${cy - 2.3}`}
              />
            ))}
          </g>
        </svg>
      );

    case 'th':
      return (
        <svg
          viewBox="0 0 640 480"
          className={`inline-block overflow-hidden rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.12)] shrink-0 select-none align-middle ${className}`}
          role="img"
          aria-label={title || 'Thailand Flag'}
        >
          {title && <title>{title}</title>}
          {/* Thailand 5 bands: Red (1), White (1), Blue (2), White (1), Red (1) */}
          <rect width="640" height="480" fill="#A51931" />
          <rect y="80" width="640" height="320" fill="#F4F5F8" />
          <rect y="160" width="640" height="160" fill="#2D2A4A" />
        </svg>
      );

    case 'ja':
    case 'jp':
      return (
        <svg
          viewBox="0 0 640 480"
          className={`inline-block overflow-hidden rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.12)] shrink-0 select-none align-middle ${className}`}
          role="img"
          aria-label={title || 'Japan Flag'}
        >
          {title && <title>{title}</title>}
          {/* Japan: White field with Crimson Red disc */}
          <rect width="640" height="480" fill="#FFFFFF" />
          <circle cx="320" cy="240" r="144" fill="#BC002D" />
        </svg>
      );

    case 'zh':
    case 'cn':
      return (
        <svg
          viewBox="0 0 640 480"
          className={`inline-block overflow-hidden rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.12)] shrink-0 select-none align-middle ${className}`}
          role="img"
          aria-label={title || 'China Flag'}
        >
          {title && <title>{title}</title>}
          {/* China: Red field with 5 yellow stars */}
          <rect width="640" height="480" fill="#DE2910" />
          {/* Large Star */}
          <polygon
            fill="#FFDE00"
            points="106.7,50 119.5,89.5 161,89.5 127.5,113.9 140.3,153.3 106.7,129 73.1,153.3 85.9,113.9 52.3,89.5 93.8,89.5"
          />
          {/* 4 Small Stars */}
          <polygon
            fill="#FFDE00"
            transform="translate(213.3, 32) rotate(-30)"
            points="0,-16 4.7,-4.9 16.8,-4.9 7.1,2.2 10.8,13.7 0,7.1 -10.8,13.7 -7.1,2.2 -16.8,-4.9 -4.7,-4.9"
          />
          <polygon
            fill="#FFDE00"
            transform="translate(256, 74.7) rotate(-10)"
            points="0,-16 4.7,-4.9 16.8,-4.9 7.1,2.2 10.8,13.7 0,7.1 -10.8,13.7 -7.1,2.2 -16.8,-4.9 -4.7,-4.9"
          />
          <polygon
            fill="#FFDE00"
            transform="translate(256, 138.7) rotate(15)"
            points="0,-16 4.7,-4.9 16.8,-4.9 7.1,2.2 10.8,13.7 0,7.1 -10.8,13.7 -7.1,2.2 -16.8,-4.9 -4.7,-4.9"
          />
          <polygon
            fill="#FFDE00"
            transform="translate(213.3, 192) rotate(35)"
            points="0,-16 4.7,-4.9 16.8,-4.9 7.1,2.2 10.8,13.7 0,7.1 -10.8,13.7 -7.1,2.2 -16.8,-4.9 -4.7,-4.9"
          />
        </svg>
      );

    case 'es':
      return (
        <svg
          viewBox="0 0 640 480"
          className={`inline-block overflow-hidden rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.12)] shrink-0 select-none align-middle ${className}`}
          role="img"
          aria-label={title || 'Spain Flag'}
        >
          {title && <title>{title}</title>}
          {/* Spain: Red, Yellow (double height), Red */}
          <rect width="640" height="480" fill="#AA151B" />
          <rect y="120" width="640" height="240" fill="#F1BF00" />
          {/* Simplified Spanish coat of arms badge */}
          <g transform="translate(160, 200)">
            {/* Crown top */}
            <path d="M-22,-44 L22,-44 L16,-34 L-16,-34 Z" fill="#AA151B" />
            <circle cx="-16" cy="-48" r="3" fill="#F1BF00" />
            <circle cx="0" cy="-50" r="3.5" fill="#F1BF00" />
            <circle cx="16" cy="-48" r="3" fill="#F1BF00" />
            {/* Pillars */}
            <rect x="-38" y="-30" width="6" height="65" rx="2" fill="#FFFFFF" stroke="#888888" strokeWidth="1" />
            <rect x="32" y="-30" width="6" height="65" rx="2" fill="#FFFFFF" stroke="#888888" strokeWidth="1" />
            {/* Shield */}
            <path
              d="M-20,-30 H20 V12 C20,28 0,42 0,42 C0,42 -20,28 -20,12 Z"
              fill="#AA151B"
              stroke="#F1BF00"
              strokeWidth="2.5"
            />
            <rect x="-14" y="-24" width="28" height="30" fill="#F1BF00" opacity="0.85" />
            <path d="M-14,-24 L14,6 M-14,6 L14,-24" stroke="#AA151B" strokeWidth="2" />
          </g>
        </svg>
      );

    default:
      return (
        <span
          className={`inline-flex items-center justify-center font-mono font-bold text-[10px] rounded-[2px] bg-secondary text-content border border-border-subtle ${className}`}
        >
          {code.toUpperCase()}
        </span>
      );
  }
};
