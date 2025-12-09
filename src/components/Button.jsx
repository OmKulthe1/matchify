import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

export const Button = ({ children, onClick, className, variant = 'primary', ...props }) => {
    const baseStyles = "px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 transform flex items-center justify-center gap-2 relative overflow-hidden group";

    const variants = {
        primary: "bg-brand-primary text-bg-dark hover:bg-brand-secondary hover:shadow-[0_0_20px_rgba(29,185,84,0.4)]",
        secondary: "bg-transparent border border-text-secondary text-text-primary hover:border-text-primary hover:bg-white/5",
        ghost: "bg-transparent text-text-secondary hover:text-text-primary"
    };

    return (
        <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cn(baseStyles, variants[variant], className)}
            onClick={onClick}
            {...props}
        >
            <span className="relative z-10 flex items-center gap-2">{children}</span>
            {variant === 'primary' && (
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
            )}
        </motion.button>
    );
};
