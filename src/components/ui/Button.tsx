import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
}

export const Button = ({ children, className, variant = 'primary', ...props }: ButtonProps) => {
  const variants = {
    primary:   "bg-black text-white hover:bg-[#00FF00] hover:text-black border-2 border-black",
    secondary: "bg-[#00FF00] text-black hover:bg-black hover:text-[#00FF00] border-2 border-black",
    outline:   "border-2 border-black bg-white hover:bg-[#00FF00] hover:text-black",
  };
  return (
    <button 
      className={cn(
        "px-5 py-2.5 font-bold uppercase tracking-wider transition-all duration-150 outline-none active:scale-95 disabled:opacity-40 disabled:pointer-events-none shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:shadow-[6px_6px_0_0_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:-translate-x-0.5", 
        variants[variant], 
        className
      )} 
      {...props}
    >
      {children}
    </button>
  );
};
