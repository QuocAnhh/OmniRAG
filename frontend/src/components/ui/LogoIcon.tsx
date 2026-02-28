import React from 'react';

interface LogoIconProps extends React.SVGProps<SVGSVGElement> { }

export const LogoIcon: React.FC<LogoIconProps> = ({ className, ...props }) => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 100 100"
            fill="none"
            className={className}
            {...props}
        >
            <defs>
                <linearGradient id="omniGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06b6d4" /> {/* Cyan 500 */}
                    <stop offset="100%" stopColor="#3b82f6" /> {/* Blue 500 */}
                </linearGradient>
            </defs>

            <g>
                {/* Outer Continuous 'O' track */}
                <path
                    d="M 50 15 A 35 35 0 1 0 50 85 A 35 35 0 0 0 78 68"
                    stroke="url(#omniGradient)"
                    strokeWidth="6"
                    strokeLinecap="round"
                />

                {/* 'R' Inner Loop originating from the O */}
                <path
                    d="M 50 15 L 70 15 A 20 20 0 0 1 70 55 L 45 55"
                    stroke="url(#omniGradient)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* 'R' Leg extending outwards */}
                <path
                    d="M 60 55 L 82 85"
                    stroke="url(#omniGradient)"
                    strokeWidth="6"
                    strokeLinecap="round"
                />

                {/* Inner detailed data track (Glass tech feel) */}
                <path
                    d="M 50 28 A 22 22 0 1 0 50 72 A 22 22 0 0 0 66 57"
                    stroke="url(#omniGradient)"
                    strokeWidth="2"
                    strokeOpacity="0.5"
                    strokeLinecap="round"
                />

                <circle cx="50" cy="50" r="3" fill="url(#omniGradient)" />
            </g>
        </svg>
    );
};
