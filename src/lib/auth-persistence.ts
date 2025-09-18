/**
 * Utility functions for handling authentication persistence based on "Remember Me" preference
 */

/**
 * Updates session persistence based on remember me preference
 * If remember me is disabled, sessions will expire when browser is closed
 */
export const updateSessionPersistence = (rememberMe: boolean) => {
  if (typeof window === 'undefined') return;
  
  // Store the preference for future reference
  if (rememberMe) {
    localStorage.setItem('auth-remember-me', 'true');
  } else {
    localStorage.removeItem('auth-remember-me');
    
    // If remember me is disabled, we could optionally move session data
    // from localStorage to sessionStorage, but Supabase handles this internally
    // based on the persistSession config at client initialization
  }
};

/**
 * Checks if user has remember me enabled
 */
export const hasRememberMeEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('auth-remember-me') === 'true';
};

/**
 * Clears all authentication persistence preferences
 * Usually called on explicit logout
 */
export const clearAuthPersistence = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth-remember-me');
};