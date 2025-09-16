import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to trigger IndexNow submission when content is updated
 */
export async function useIndexNowSubmission() {
  
  const submitUrlsToIndexNow = async (urls: string[], trigger: string = 'content-update'): Promise<boolean> => {
    try {
      console.log(`Submitting ${urls.length} URLs to IndexNow (trigger: ${trigger})`);
      
      const { data, error } = await supabase.functions.invoke('indexnow-integration', {
        body: { urls, trigger }
      });

      if (error) {
        console.error('IndexNow submission error:', error);
        return false;
      }

      if (data?.success) {
        console.log(`Successfully submitted ${data.submitted} URLs to IndexNow`);
        return true;
      } else {
        console.warn('IndexNow submission failed:', data);
        return false;
      }
    } catch (error) {
      console.error('Error invoking IndexNow integration:', error);
      return false;
    }
  };

  const submitCurrentPage = async (): Promise<boolean> => {
    const currentUrl = window.location.href;
    return submitUrlsToIndexNow([currentUrl], 'manual');
  };

  const submitTopicPage = async (topicSlug: string): Promise<boolean> => {
    const baseUrl = window.location.origin;
    const urls = [
      `${baseUrl}/topics/${topicSlug}`,
      `${baseUrl}/topics/${topicSlug}/archive`
    ];
    return submitUrlsToIndexNow(urls, 'topic-update');
  };

  const submitHomepage = async (): Promise<boolean> => {
    const baseUrl = window.location.origin;
    return submitUrlsToIndexNow([baseUrl], 'homepage-update');
  };

  return {
    submitUrlsToIndexNow,
    submitCurrentPage,
    submitTopicPage,
    submitHomepage
  };
}

/**
 * Automatically submit URLs to IndexNow when content changes
 */
export class IndexNowAutoSubmitter {
  private static instance: IndexNowAutoSubmitter;
  private submissionQueue: Set<string> = new Set();
  private timeout: number | null = null;

  static getInstance(): IndexNowAutoSubmitter {
    if (!IndexNowAutoSubmitter.instance) {
      IndexNowAutoSubmitter.instance = new IndexNowAutoSubmitter();
    }
    return IndexNowAutoSubmitter.instance;
  }

  private constructor() {}

  /**
   * Queue URLs for IndexNow submission (batched with 30 second delay)
   */
  queueUrls(urls: string[], trigger: string = 'auto-update'): void {
    urls.forEach(url => this.submissionQueue.add(url));
    
    // Clear existing timeout
    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    // Set new timeout to batch submissions
    this.timeout = window.setTimeout(async () => {
      if (this.submissionQueue.size > 0) {
        const urlsToSubmit = Array.from(this.submissionQueue);
        this.submissionQueue.clear();
        
        const { submitUrlsToIndexNow } = await useIndexNowSubmission();
        await submitUrlsToIndexNow(urlsToSubmit, trigger);
      }
    }, 30000); // 30 second delay
  }

  /**
   * Queue a single URL for submission
   */
  queueUrl(url: string, trigger: string = 'auto-update'): void {
    this.queueUrls([url], trigger);
  }
}

// Export singleton instance
export const indexNowAutoSubmitter = IndexNowAutoSubmitter.getInstance();