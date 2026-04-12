import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', type = 'text', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={props.id}
            className="block mb-2 text-sm font-semibold text-[#141413]/80"
          >
            {label}
            {props.required && <span className="text-[#b53333] ml-1">*</span>}
          </label>
        )}
        <input
          id={props.id}
          ref={ref}
          type={type}
          className={`
            w-full px-4 py-2.5 rounded-lg
            bg-white border border-[#e8e6dc]
            text-[#141413] text-sm placeholder:text-[#b0aea5]
            transition-all duration-200
            focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-[#b53333] focus:border-[#b53333] focus:ring-[#b53333]/20' : ''}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-xs text-[#b53333] font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">error</span>
            {error}
          </p>
        )}
        {helperText && !error && (
          <p className="mt-1.5 text-xs text-[#87867f]">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
