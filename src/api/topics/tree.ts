// This is a mock API endpoint for development
// In a real implementation, this would be handled by your backend
import { fetchTopicsTree } from "@/lib/api/topics";

export async function GET() {
  try {
    const topics = await fetchTopicsTree();
    return new Response(JSON.stringify(topics), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('API Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch topics' }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}