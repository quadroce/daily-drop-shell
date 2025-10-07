-- Insert 10 test jobs for YouTube auto-comment
INSERT INTO public.social_comment_jobs (
  video_id,
  channel_id,
  video_title,
  video_description,
  topic_slug,
  text_hash,
  utm_campaign,
  utm_content,
  status,
  platform,
  locale
) VALUES
  ('lWPu5hg6jUc', 'UCJZv4d5rbIKd4QHMPkcABCw', 'AI Generated Videos Are Getting Insanely Good', 'From advanced AI video tools to major security issues affecting millions, this week brings critical tech news.', 'genai-tools', md5('lWPu5hg6jUc-test-20251007'), 'test-20251007', '20251007', 'queued', 'youtube', 'en'),
  ('Rn5MqSDTAZc', 'UCJZv4d5rbIKd4QHMPkcABCw', '360° Cameras Are Insane', 'Discover the latest developments in 360-degree camera technology and immersive content creation tools.', 'genai-tools', md5('Rn5MqSDTAZc-test-20251007'), 'test-20251007', '20251007', 'queued', 'youtube', 'en'),
  ('gYSBGKT-aqY', 'UCJZv4d5rbIKd4QHMPkcABCw', 'ChatGPT o1 Preview Will Blow Your Mind', 'ChatGPT''s latest o1 model brings revolutionary reasoning capabilities to AI interactions.', 'media', md5('gYSBGKT-aqY-test-20251007'), 'test-20251007', '20251007', 'queued', 'youtube', 'en'),
  ('wYB-DMpFvxk', 'UCJZv4d5rbIKd4QHMPkcABCw', 'AI Powered Music Is Getting Scary Good', 'The evolution of AI music generation is reaching new heights with unprecedented quality.', 'media', md5('wYB-DMpFvxk-test-20251007'), 'test-20251007', '20251007', 'queued', 'youtube', 'en'),
  ('VoOiZe_BNNQ', 'UCJZv4d5rbIKd4QHMPkcABCw', 'This Huge AI Model Announcement Changes Everything', 'Major AI model releases are reshaping the landscape of artificial intelligence applications.', 'media', md5('VoOiZe_BNNQ-test-20251007'), 'test-20251007', '20251007', 'queued', 'youtube', 'en'),
  ('OVzb5YPgVcE', 'UCJZv4d5rbIKd4QHMPkcABCw', 'Why Local AI Is The Future', 'Local AI processing offers privacy, speed, and independence from cloud services.', 'media', md5('OVzb5YPgVcE-test-20251007'), 'test-20251007', '20251007', 'queued', 'youtube', 'en'),
  ('6wS_n6g8-NU', 'UCJZv4d5rbIKd4QHMPkcABCw', 'The AI Wars Have Officially Begun', 'Competition in the AI industry intensifies as major players battle for dominance.', 'media', md5('6wS_n6g8-NU-test-20251007'), 'test-20251007', '20251007', 'queued', 'youtube', 'en'),
  ('X04d7HZ11iU', 'UCbu2SsF-Or3Rsn3NxqODImw', 'Is AI Actually Getting Worse?', '', 'technology', md5('X04d7HZ11iU-test-20251007'), 'test-20251007', '20251007', 'queued', 'youtube', 'en'),
  ('Kym9UXl-NLI', 'UCbu2SsF-Or3Rsn3NxqODImw', 'AI Can Make You Better At Your Job - With Sheila Heen of Harvard''s Program on Negotiation', '', 'technology', md5('Kym9UXl-NLI-test-20251007'), 'test-20251007', '20251007', 'queued', 'youtube', 'en'),
  ('2qQQFH1wl2A', 'UCbu2SsF-Or3Rsn3NxqODImw', 'OpenAI''s Agents Are HERE & They''re PRICEY', '', 'technology', md5('2qQQFH1wl2A-test-20251007'), 'test-20251007', '20251007', 'queued', 'youtube', 'en');
