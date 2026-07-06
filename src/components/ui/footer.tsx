'use client';
import React from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { FacebookIcon, FlaskConical, InstagramIcon, LinkedinIcon, YoutubeIcon } from 'lucide-react';

interface FooterLink {
	title: string;
	href: string;
	icon?: React.ComponentType<{ className?: string }>;
}

interface FooterSection {
	label: string;
	links: FooterLink[];
}

const footerLinks: FooterSection[] = [
	{
		label: 'Formulations',
		links: [
			{ title: 'All Products', href: '/products' },
			{ title: 'Functional Foods', href: '/products' },
			{ title: 'Clinical Supplements', href: '/products' },
			{ title: 'Institutional Orders', href: '/contact' },
		],
	},
	{
		label: 'Science',
		links: [
			{ title: 'Our Patents', href: '/patents' },
			{ title: 'Research Registry', href: '/patents' },
			{ title: 'Quality Standards', href: '/quality' },
			{ title: 'Certifications', href: '/science' },
		],
	},
	{
		label: 'Company',
		links: [
			{ title: 'About Cashmir Biotech', href: '/about' },
			{ title: 'Board Members', href: '/team' },
			{ title: 'Privacy Policy', href: '/privacy' },
			{ title: 'Terms of Service', href: '/terms' }
		],
	},
	{
		label: 'Connect',
		links: [
			{ title: 'Facebook', href: '#', icon: FacebookIcon },
			{ title: 'Instagram', href: '#', icon: InstagramIcon },
			{ title: 'Youtube', href: '#', icon: YoutubeIcon },
			{ title: 'LinkedIn', href: '#', icon: LinkedinIcon },
		],
	},
];

export function Footer() {
	return (
		<motion.footer
			initial={{ opacity: 0, y: 40 }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true, margin: '-50px' }}
			transition={{ duration: 0.8, ease: 'easeOut' }}
			className="relative mx-auto mt-20 w-full max-w-6xl rounded-t-[2.3rem] border-t border-outline-variant/30 bg-[radial-gradient(35%_150px_at_50%_0%,theme(colors.primary.DEFAULT/12%),transparent)] px-6 py-12 lg:py-16"
		>
			<div className="absolute left-1/2 top-0 h-px w-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/25 blur-sm" />
			<div className="grid w-full gap-8 xl:grid-cols-3 xl:gap-10">
				<AnimatedContainer className="space-y-4">
					<div className="mb-4 flex items-center gap-2 text-primary">
						<FlaskConical className="size-7" />
						<span className="text-xl font-bold tracking-tight text-heading [font-family:var(--font-headline)]">
							Cashmir Biotech
						</span>
					</div>
					<p className="mt-8 max-w-xs text-sm leading-relaxed text-on-muted md:mt-0">
						Precision biotech innovation built on Kashmiri biodiversity, scientific rigor, and patented
						formulation pathways.
					</p>
					<p className="text-xs uppercase tracking-[0.16em] text-on-muted">
						© {new Date().getFullYear()} Cashmir Biotech Pvt Ltd
					</p>
				</AnimatedContainer>

				<div className="mt-10 grid grid-cols-2 gap-8 md:grid-cols-4 xl:col-span-2 xl:mt-0">
					{footerLinks.map((section, index) => (
						<AnimatedContainer key={section.label} delay={0.1 + index * 0.1}>
							<div className="mb-10 md:mb-0">
								<h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{section.label}</h3>
								<ul className="mt-6 space-y-3 text-sm text-on-muted">
									{section.links.map((link, i) => (
										<li key={i}>
											<a
												href={link.href}
												className="inline-flex items-center transition-all duration-300 hover:text-primary"
											>
												{link.icon && <link.icon className="me-2 size-4 opacity-70" />}
												{link.title}
											</a>
										</li>
									))}
								</ul>
							</div>
						</AnimatedContainer>
					))}
				</div>
			</div>
		</motion.footer>
	);
}

type ViewAnimationProps = {
	delay?: number;
	className?: ComponentProps<typeof motion.div>['className'];
	children: ReactNode;
};

function AnimatedContainer({ className, delay = 0.1, children }: ViewAnimationProps) {
	const reducedPref = useReducedMotion();
	const [motionReady, setMotionReady] = React.useState(false);
	React.useEffect(() => {
		setMotionReady(true);
	}, []);
	/** Avoid div vs motion.div mismatch: defer reduced-motion until after first paint. */
	const shouldReduceMotion = motionReady && Boolean(reducedPref);

	if (shouldReduceMotion) {
		return <div className={className}>{children}</div>;
	}

	return (
		<motion.div
			initial={{ filter: 'blur(4px)', translateY: -8, opacity: 0 }}
			whileInView={{ filter: 'blur(0px)', translateY: 0, opacity: 1 }}
			viewport={{ once: true }}
			transition={{ delay, duration: 0.8 }}
			className={className}
		>
			{children}
		</motion.div>
	);
}
