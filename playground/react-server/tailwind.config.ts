import type { Config } from 'tailwindcss';

export default {
	content: ['./src/**/*.{js,jsx,ts,tsx}'],
	theme: {
		extend: {
			fontFamily: {
				sans: ['monospace'],
				mono: ['monospace'],
			},
			colors: {
				background: 'var(--background)',
				foreground: 'var(--foreground)',
				'foreground-muted': 'var(--foreground-muted)',
				primary: 'var(--primary)',
				'primary-foreground': 'var(--primary-foreground)',
				destructive: 'var(--destructive)',
				'destructive-foreground': 'var(--destructive-foreground)',
				border: 'var(--border)',
			},
			animation: {
				progress: 'progress 1s infinite linear',
			},
			keyframes: {
				progress: {
					'0%': { transform: 'translateX(0) scaleX(0)' },
					'40%': { transform: 'translateX(0) scaleX(0.4)' },
					'100%': { transform: 'translateX(100%) scaleX(0.5)' },
				},
			},
			transformOrigin: {
				'left-right': '0% 50%',
			},
		},
	},
	plugins: [],
} satisfies Config;
