import { supabase } from '@/integrations/supabase/client';

export class IndexNowService {
  /**
   * Submit a single URL to IndexNow via the new integration
   */
  static async submitUrl(url: string): Promise<boolean> {
    return this.submitUrls([url]);
  }

  /**
   * Submit multiple URLs to IndexNow via the new integration
   */
  static async submitUrls(urls: string[]): Promise<boolean> {
    if (!urls.length) return false;

    try {
      const { data, error } = await supabase.functions.invoke('indexnow-integration', {
        body: { urls, trigger: 'manual' }
      });

      if (error) {
        console.error('IndexNow submission error:', error);
        return false;
      }

      return data?.success || false;
    } catch (error) {
      console.error('Error invoking IndexNow integration:', error);
      return false;
    }
  }

  /**
   * Submit the current page URL to IndexNow
   */
  static async submitCurrentPage(): Promise<boolean> {
    const currentUrl = window.location.href;
    return this.submitUrl(currentUrl);
  }
}

/**
 * React hook for IndexNow submissions
 */
export function useIndexNow() {
  const submitCurrentPage = async (): Promise<boolean> => {
    return IndexNowService.submitCurrentPage();
  };

  const submitUrl = async (url: string): Promise<boolean> => {
    return IndexNowService.submitUrl(url);
  };

  const submitUrls = async (urls: string[]): Promise<boolean> => {
    return IndexNowService.submitUrls(urls);
  };

  return {
    submitCurrentPage,
    submitUrl,
    submitUrls
  };
}