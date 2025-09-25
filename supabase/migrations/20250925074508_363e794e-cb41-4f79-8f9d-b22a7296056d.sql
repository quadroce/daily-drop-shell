-- Fix newsletter subscription confirmed status for existing onboarded users (without updated_at column)
UPDATE newsletter_subscriptions 
SET confirmed = true
WHERE user_id IN (
  SELECT id 
  FROM profiles 
  WHERE onboarding_completed = true 
    AND is_active = true
)
AND confirmed = false;

-- For users who don't have newsletter subscription yet, create one with confirmed = true
INSERT INTO newsletter_subscriptions (user_id, active, confirmed, cadence, slot)
SELECT 
  id as user_id,
  true as active,
  true as confirmed,
  CASE 
    WHEN subscription_tier IN ('premium', 'corporate', 'sponsor') THEN 'daily'
    ELSE 'weekly'
  END as cadence,
  'morning' as slot
FROM profiles 
WHERE onboarding_completed = true 
  AND is_active = true
  AND id NOT IN (SELECT user_id FROM newsletter_subscriptions)
ON CONFLICT (user_id) DO NOTHING;