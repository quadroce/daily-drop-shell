-- Insert some sample RSS sources for testing (without conflict handling)
INSERT INTO public.sources (name, feed_url, status, type) VALUES 
('TechCrunch', 'https://techcrunch.com/feed/', 'active', 'website'),
('Hacker News', 'https://hnrss.org/frontpage', 'active', 'website'),
('CSS-Tricks', 'https://css-tricks.com/feed/', 'active', 'website'),
('Smashing Magazine', 'https://www.smashingmagazine.com/feed/', 'active', 'website');