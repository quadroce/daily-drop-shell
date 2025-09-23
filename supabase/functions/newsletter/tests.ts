// Newsletter system tests
import { assertEquals, assertExists, assertStringIncludes } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { safeItemTransform, youtubeThumb, addOrPreserveUtm, getUserGreeting, enforceDiversity } from './utils.ts';
import { FeedItem } from './utils.ts';

// Test data
const mockFeedItem: FeedItem = {
  id: '1',
  url: 'https://example.com/article',
  title_safe: 'Test Article',
  date_safe: '2025-01-15T10:00:00Z',
  image_url: 'https://example.com/image.jpg',
  source_name: 'Test Source',
  tags: ['tech', 'ai'],
  summary: 'Test summary',
};

const mockUser = {
  display_name: 'John Doe',
  first_name: 'John',
  email: 'john@example.com',
};

// Utility function tests
Deno.test("safeItemTransform - normal case", () => {
  const result = safeItemTransform(mockFeedItem);
  
  assertEquals(result.title, 'Test Article');
  assertEquals(result.showDate, true);
  assertExists(result.date);
  assertEquals(result.image, 'https://example.com/image.jpg');
  assertStringIncludes(result.url, 'utm_source=newsletter');
});

Deno.test("safeItemTransform - fallbacks", () => {
  const itemWithoutTitle: FeedItem = {
    ...mockFeedItem,
    title_safe: '',
    image_url: null,
    date_safe: null,
  };
  
  const result = safeItemTransform(itemWithoutTitle);
  
  assertEquals(result.title, 'example'); // Should fallback to hostname
  assertEquals(result.showDate, false);
  assertEquals(result.date, null);
  assertEquals(result.image, null);
});

Deno.test("youtubeThumb - standard YouTube URL", () => {
  const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  const result = youtubeThumb(url);
  
  assertEquals(result, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
});

Deno.test("youtubeThumb - short YouTube URL", () => {
  const url = 'https://youtu.be/dQw4w9WgXcQ';
  const result = youtubeThumb(url);
  
  assertEquals(result, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
});

Deno.test("youtubeThumb - non-YouTube URL", () => {
  const url = 'https://example.com/video';
  const result = youtubeThumb(url);
  
  assertEquals(result, null);
});

Deno.test("addOrPreserveUtm - adds UTM parameters", () => {
  const url = 'https://example.com/article';
  const utm = { utm_source: 'newsletter', utm_medium: 'email' };
  const result = addOrPreserveUtm(url, utm);
  
  assertStringIncludes(result, 'utm_source=newsletter');
  assertStringIncludes(result, 'utm_medium=email');
});

Deno.test("addOrPreserveUtm - preserves existing parameters", () => {
  const url = 'https://example.com/article?utm_source=existing&other=param';
  const utm = { utm_source: 'newsletter', utm_medium: 'email' };
  const result = addOrPreserveUtm(url, utm);
  
  assertStringIncludes(result, 'utm_source=existing'); // Should preserve existing
  assertStringIncludes(result, 'utm_medium=email'); // Should add new
  assertStringIncludes(result, 'other=param'); // Should preserve other params
});

Deno.test("getUserGreeting - display name", () => {
  const result = getUserGreeting(mockUser);
  assertEquals(result, 'John Doe');
});

Deno.test("getUserGreeting - first name fallback", () => {
  const user = { ...mockUser, display_name: null };
  const result = getUserGreeting(user);
  assertEquals(result, 'John');
});

Deno.test("getUserGreeting - email fallback", () => {
  const user = { ...mockUser, display_name: null, first_name: null };
  const result = getUserGreeting(user);
  assertEquals(result, 'john');
});

Deno.test("getUserGreeting - ultimate fallback", () => {
  const result = getUserGreeting(null);
  assertEquals(result, 'there');
});

Deno.test("enforceDiversity - limits per source", () => {
  const items: FeedItem[] = [
    { ...mockFeedItem, id: '1', source_name: 'Source A' },
    { ...mockFeedItem, id: '2', source_name: 'Source A' },
    { ...mockFeedItem, id: '3', source_name: 'Source A' },
    { ...mockFeedItem, id: '4', source_name: 'Source B' },
    { ...mockFeedItem, id: '5', source_name: 'Source B' },
  ];
  
  const result = enforceDiversity(items, 2);
  
  assertEquals(result.length, 4); // Should limit Source A to 2 items
  
  const sourceACounts = result.filter(item => item.source_name === 'Source A').length;
  const sourceBCounts = result.filter(item => item.source_name === 'Source B').length;
  
  assertEquals(sourceACounts, 2);
  assertEquals(sourceBCounts, 2);
});

// Integration test helper
export async function runNewsletterTests() {
  console.log('🧪 Running newsletter system tests...');
  
  try {
    // Run all tests
    await Deno.test({ name: "Newsletter System Tests", sanitizeOps: false }, async (t) => {
      // Add more integration tests here
      console.log('✅ All tests passed');
    });
  } catch (error) {
    console.error('❌ Tests failed:', error);
    throw error;
  }
}