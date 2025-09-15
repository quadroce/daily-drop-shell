// IndexNow integration for rapid re-crawling by Bing/Microsoft
export class IndexNowService {
  private static readonly BING_INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
  private static readonly API_KEY = 'dailydrops-indexnow-2025';

  static async submitUrl(url: string): Promise<boolean> {
    try {
      const payload = {
        host: new URL(url).hostname,
        key: this.API_KEY,
        keyLocation: `${new URL(url).origin}/${this.API_KEY}.txt`,
        urlList: [url]
      };

      const response = await fetch(this.BING_INDEXNOW_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      return response.ok;
    } catch (error) {
      console.error('IndexNow submission failed:', error);
      return false;
    }
  }

  static async submitUrls(urls: string[]): Promise<boolean> {
    if (urls.length === 0) return true;

    try {
      const baseUrl = new URL(urls[0]);
      const payload = {
        host: baseUrl.hostname,
        key: this.API_KEY,
        keyLocation: `${baseUrl.origin}/${this.API_KEY}.txt`,
        urlList: urls
      };

      const response = await fetch(this.BING_INDEXNOW_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      return response.ok;
    } catch (error) {
      console.error('IndexNow batch submission failed:', error);
      return false;
    }
  }

  static async submitCurrentPage(): Promise<boolean> {
    return this.submitUrl(window.location.href);
  }
}

// Utility hook for triggering IndexNow submissions
export const useIndexNow = () => {
  const submitCurrentPage = async () => {
    await IndexNowService.submitCurrentPage();
  };

  const submitUrl = async (url: string) => {
    await IndexNowService.submitUrl(url);
  };

  const submitUrls = async (urls: string[]) => {
    await IndexNowService.submitUrls(urls);
  };

  return { submitCurrentPage, submitUrl, submitUrls };
};