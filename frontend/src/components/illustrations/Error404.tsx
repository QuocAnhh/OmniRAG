import type { IllustrationProps } from './types';
import { sizeMap } from './types';

/**
 * Hand-drawn illustration — 404 not found.
 * Gently-confused bot holding a map / compass.
 */
export function Error404({ className, title, size = 'lg' }: IllustrationProps) {
  const dim = sizeMap[size];
  const decorative = !title;
  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 240 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={decorative ? 'presentation' : 'img'}
      aria-hidden={decorative}
      aria-label={title}
      className={className}
    >
      {title ? <title>{title}</title> : null}
      {/* Big 404 text — hand drawn */}
      <text
        x="50%"
        y="62"
        textAnchor="middle"
        fontFamily="Georgia, serif"
        fontSize="64"
        fontWeight="500"
        fill="currentColor"
        opacity="0.88"
      >
        404
      </text>
      {/* Underline squiggle */}
      <path
        d="M72 78 Q90 72 108 78 T144 78 T180 78"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
      {/* Compass — rounded */}
      <circle cx="120" cy="136" r="30" fill="#fbe1d6" stroke="currentColor" strokeWidth="2.6" />
      <circle cx="120" cy="136" r="2.6" fill="currentColor" />
      {/* Compass needle — lost direction */}
      <path
        d="M120 136 L108 120"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M120 136 L134 150"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.6"
      />
      {/* N marker */}
      <text
        x="120"
        y="116"
        textAnchor="middle"
        fontFamily="Georgia, serif"
        fontSize="9"
        fontWeight="500"
        fill="currentColor"
      >
        N
      </text>
      {/* Question marks floating */}
      <text
        x="68"
        y="118"
        fontFamily="Georgia, serif"
        fontSize="22"
        fontWeight="500"
        fill="currentColor"
        opacity="0.65"
      >
        ?
      </text>
      <text
        x="172"
        y="128"
        fontFamily="Georgia, serif"
        fontSize="18"
        fontWeight="500"
        fill="currentColor"
        opacity="0.55"
      >
        ?
      </text>
      {/* Dotted ground */}
      <path
        d="M60 186 Q90 182 120 186 T180 186"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeDasharray="3 5"
        fill="none"
        opacity="0.4"
      />
    </svg>
  );
}
