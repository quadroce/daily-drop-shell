import { useState, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { trackOnboardingError, trackOnboardingRetry } from '@/lib/trackers/onboarding';

interface UseOnboardingErrorReturn {
  error: string | null;
  retryCount: number;
  isRetrying: boolean;
  handleError: (error: Error, step: number, context?: string) => void;
  retry: (operation: () => Promise<void>, step: number) => Promise<void>;
  clearError: () => void;
}

export function useOnboardingError(): UseOnboardingErrorReturn {
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleError = useCallback((error: Error, step: number, context?: string) => {
    const errorMessage = error.message || 'An unexpected error occurred';
    setError(errorMessage);

    // Track the error
    trackOnboardingError(step, error.name || 'Unknown', errorMessage);

    // Show user-friendly toast
    let userMessage = 'Something went wrong. Please try again.';
    
    // Customize message based on error type
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      userMessage = 'Connection error. Please check your internet and try again.';
    } else if (errorMessage.includes('auth') || errorMessage.includes('unauthorized')) {
      userMessage = 'Authentication error. Please refresh the page and log in again.';
    } else if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      userMessage = 'Please check your information and try again.';
    } else if (errorMessage.includes('timeout')) {
      userMessage = 'Request timed out. Please try again.';
    }

    toast({
      title: context ? `Error in ${context}` : 'Error',
      description: userMessage,
      variant: 'destructive',
    });
  }, []);

  const retry = useCallback(async (operation: () => Promise<void>, step: number) => {
    setIsRetrying(true);
    const newRetryCount = retryCount + 1;
    setRetryCount(newRetryCount);

    // Track retry attempt
    trackOnboardingRetry(step, newRetryCount);

    try {
      await operation();
      setError(null); // Clear error on success
      setRetryCount(0); // Reset retry count
      
      toast({
        title: 'Success',
        description: 'Operation completed successfully.',
      });
    } catch (retryError) {
      handleError(retryError as Error, step, 'retry operation');
    } finally {
      setIsRetrying(false);
    }
  }, [retryCount, handleError]);

  const clearError = useCallback(() => {
    setError(null);
    setRetryCount(0);
  }, []);

  return {
    error,
    retryCount,
    isRetrying,
    handleError,
    retry,
    clearError,
  };
}