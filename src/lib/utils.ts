import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatError(err: any): string {
  if (!err) return 'Unknown error';

  // Supabase error object
  if (typeof err === 'object') {
    // supabase returns { message, details, hint, code }
    const parts: string[] = [];
    if (err.message) parts.push(String(err.message));
    if (err.details) parts.push(String(err.details));
    if (err.hint) parts.push(String(err.hint));
    if (err.code) parts.push(`code: ${String(err.code)}`);
    if (parts.length) return parts.join(' - ');

    // check nested properties
    if (err.error) return formatError(err.error);

    try {
      return JSON.stringify(err);
    } catch (e) {
      return String(err);
    }
  }

  // strings or other primitives
  return String(err);
}
