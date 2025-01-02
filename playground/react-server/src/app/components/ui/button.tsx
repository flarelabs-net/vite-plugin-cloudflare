'use client';

import { Slot } from '@radix-ui/react-slot';
import { cn } from '~/lib/utils';
import { cva } from 'class-variance-authority';
import { Button as BaseButton } from 'react-aria-components';
import type { VariantProps } from 'class-variance-authority';
import type { ButtonProps as BaseButtonProps } from 'react-aria-components';

export const buttonVariants = cva(
	cn(
		'inline-flex items-center justify-center gap-2 whitepsace-nowrap [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0',
		'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border disabled:cursor-not-allowed disabled:opacity-50',
	),
	{
		variants: {
			size: {
				sm: 'px-2 py-1 text-base',
				md: 'px-2 py-1 text-lg',
				lg: 'px-3 py-2 text-xl',
				icon: 'h-9 w-9 aspect-square',
			},
			variant: {
				default:
					'font-bold bg-background text-foreground border-2 border-border',
				primary:
					'font-bold bg-primary text-primary-foreground border-2 border-border',
				destructive:
					'font-bold bg-background text-destructive border-2 border-destructive focus-visible:ring-destructive',
			},
		},
		defaultVariants: {
			size: 'md',
			variant: 'default',
		},
	},
);

export type ButtonProps = React.ComponentProps<'button'> &
	BaseButtonProps &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	};

export function Button({
	asChild,
	className,
	disabled,
	onKeyDown,
	size,
	variant,
	...props
}: ButtonProps) {
	const Comp: any = asChild ? Slot : BaseButton;
	return (
		<Comp
			isDisabled={disabled}
			className={cn(buttonVariants({ size, variant }), className)}
			{...props}
		/>
	);
}
