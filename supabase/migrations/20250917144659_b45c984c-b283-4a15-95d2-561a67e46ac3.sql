-- Insert default newsletter subscription for existing admin user
INSERT INTO newsletter_subscriptions (user_id, cadence, confirmed, active) 
VALUES ('b4c9447c-babd-4999-b462-afca6cbce147', 'daily', true, true) 
ON CONFLICT (user_id) DO UPDATE SET 
  active = true, 
  confirmed = true;