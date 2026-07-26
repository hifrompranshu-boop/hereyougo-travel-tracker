import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s/g, "-");
  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          "glass-inset flex h-11 w-full rounded-xl px-4 text-sm text-card-fg shadow-sm transition-colors placeholder:text-card-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20",
          error && "border-red-300 focus:border-red-400 focus:ring-red-200",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Textarea({ label, className, id, ...props }: TextareaProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s/g, "-");
  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={cn(
          "glass-inset flex min-h-[100px] w-full rounded-xl px-4 py-3 text-sm text-card-fg shadow-sm transition-colors placeholder:text-card-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20",
          className
        )}
        {...props}
      />
    </div>
  );
}
