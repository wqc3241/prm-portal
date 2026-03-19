import { cn } from '../../utils/cn';
import type { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  error,
  required,
  hint,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium leading-6 text-gray-900"
      >
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs text-gray-500">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// Pre-styled input for use inside FormField
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export function Input({ hasError, className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'block w-full rounded-md border-0 py-2 px-3 text-gray-900 shadow-sm ring-1 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6',
        hasError
          ? 'ring-red-300 focus:ring-red-500'
          : 'ring-gray-300 focus:ring-panw-blue',
        className
      )}
      {...props}
    />
  );
}

// Pre-styled select for use inside FormField
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
}

export function Select({ hasError, className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'block w-full rounded-md border-0 py-2 px-3 text-gray-900 shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6',
        hasError
          ? 'ring-red-300 focus:ring-red-500'
          : 'ring-gray-300 focus:ring-panw-blue',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

// Pre-styled textarea
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
}

export function Textarea({ hasError, className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        'block w-full rounded-md border-0 py-2 px-3 text-gray-900 shadow-sm ring-1 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6',
        hasError
          ? 'ring-red-300 focus:ring-red-500'
          : 'ring-gray-300 focus:ring-panw-blue',
        className
      )}
      {...props}
    />
  );
}
