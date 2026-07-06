"use client";
import React from 'react';
import { motion } from 'framer-motion';

export function AnimatedSection({ children, className, delay = 0.1 }: { children: React.ReactNode, className?: string, delay?: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 40, filter: 'blur(4px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1, delay, ease: [0.25, 0.4, 0.25, 1] }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

export function AnimatedStaggerGroup({ children, className }: { children: React.ReactNode, className?: string }) {
    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.15 }
        }
    };

    return (
        <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

export function AnimatedStaggerItem({ children, className }: { children: React.ReactNode, className?: string }) {
    const item = {
        hidden: { opacity: 0, y: 30, filter: 'blur(4px)' },
        show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.8, ease: [0.25, 0.4, 0.25, 1] } }
    };

    return (
        <motion.div variants={item} className={className}>
            {children}
        </motion.div>
    );
}
