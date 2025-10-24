/**
 * Email validation utility
 * Uses a regex that properly validates email format
 */
export const validateEmail = (email: string): boolean => {
  // RFC 5322 simplified email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Email validation with detailed error message
 */
export const validateEmailWithMessage = (email: string): { valid: boolean; error?: string } => {
  if (!email.trim()) {
    return { valid: false, error: 'Email is required' };
  }

  if (!validateEmail(email)) {
    return { valid: false, error: 'Please enter a valid email address' };
  }

  return { valid: true };
};

/**
 * Password strength validation
 * Requirements:
 * - Minimum 8 characters
 * - Must contain uppercase letters
 * - Must contain lowercase letters
 * - Must contain numbers
 */
export const validatePasswordStrength = (password: string): { valid: boolean; error?: string } => {
  if (!password) {
    return { valid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }

  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);

  if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
    return {
      valid: false,
      error: 'Password must contain uppercase, lowercase, and numbers',
    };
  }

  return { valid: true };
};

/**
 * Check if password has special characters (for recommendations)
 */
export const hasSpecialCharacters = (password: string): boolean => {
  return /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
};

/**
 * Full name validation
 */
export const validateFullName = (name: string): { valid: boolean; error?: string } => {
  if (!name.trim()) {
    return { valid: false, error: 'Full name is required' };
  }

  if (name.trim().length < 2) {
    return { valid: false, error: 'Full name must be at least 2 characters' };
  }

  return { valid: true };
};

/**
 * Phone number validation (basic - allows various formats)
 */
export const validatePhoneNumber = (phone: string): { valid: boolean; error?: string } => {
  if (!phone) {
    return { valid: true }; // Phone is optional
  }

  // Allow common phone formats: +1 (555) 123-4567, 555-123-4567, 5551234567, etc.
  const phoneRegex = /^[\d\s\-+()]*\d[\d\s\-+()]*$/;
  if (!phoneRegex.test(phone)) {
    return { valid: false, error: 'Please enter a valid phone number' };
  }

  return { valid: true };
};
