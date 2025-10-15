
-- Aggiorna il profilo corretto a premium (se non lo è già)
UPDATE profiles 
SET subscription_tier = 'premium'
WHERE id = 'b4c9447c-babd-4999-b462-afca6cbce147'
AND subscription_tier != 'premium';
