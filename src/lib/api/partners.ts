import { supabase } from '@/integrations/supabase/client';

const FUNCTION_URL = 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/partner-api';

export interface Partner {
  id: number;
  slug: string;
  name: string;
  title?: string;
  logo_url?: string;
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  scheduled_at?: string;
  banner_url?: string;
  youtube_url?: string;
  description_md?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PartnerLink {
  partner_id: number;
  position: number;
  label: string;
  url: string;
  utm?: string;
}

export interface PartnerTopic {
  id: number;
  slug: string;
  label: string;
}

export interface PartnerData {
  partner: Partner;
  links: PartnerLink[];
  topics: PartnerTopic[];
  is_following?: boolean;
}

export async function getPartnerBySlug(slug: string): Promise<PartnerData | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const response = await fetch(`${FUNCTION_URL}?action=getBySlug&slug=${encodeURIComponent(slug)}`, {
      headers,
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching partner:', error);
    return null;
  }
}

export async function getPartnerFeed(slug: string, cursor?: string | null, limit: number = 20, languageCode?: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    let url = `${FUNCTION_URL}?action=feed&slug=${encodeURIComponent(slug)}&limit=${limit}`;
    if (cursor) {
      url += `&cursor=${encodeURIComponent(cursor)}`;
    }
    if (languageCode) {
      url += `&languageCode=${encodeURIComponent(languageCode)}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error('Failed to fetch partner feed');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching partner feed:', error);
    throw error;
  }
}

export async function followPartner(slug: string) {
  const { data: { session } } = await supabase.auth.getSession();
  
  const response = await fetch(`${FUNCTION_URL}?action=follow`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({ slug }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to follow partner');
  }

  return await response.json();
}

export async function trackPartnerEvent(slug: string, type: 'view' | 'link_click' | 'follow_click', meta?: any) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    await fetch(`${FUNCTION_URL}?action=track`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ slug, type, meta }),
    });
  } catch (error) {
    console.error('Error tracking partner event:', error);
  }
}

export async function createPartner(data: any) {
  const { data: { session } } = await supabase.auth.getSession();
  
  const response = await fetch(`${FUNCTION_URL}?action=create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create partner');
  }

  return await response.json();
}

export async function updatePartner(id: number, data: any) {
  const { data: { session } } = await supabase.auth.getSession();
  
  const response = await fetch(`${FUNCTION_URL}?action=update`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({ id, ...data }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update partner');
  }

  return await response.json();
}

export async function publishPartner(id: number, scheduled_at?: string) {
  const { data: { session } } = await supabase.auth.getSession();
  
  const response = await fetch(`${FUNCTION_URL}?action=publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({ id, scheduled_at }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to publish partner');
  }

  return await response.json();
}

export async function listPartners() {
  const { data: { session } } = await supabase.auth.getSession();
  
  const response = await fetch(`${FUNCTION_URL}?action=list`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to list partners');
  }

  return await response.json();
}
