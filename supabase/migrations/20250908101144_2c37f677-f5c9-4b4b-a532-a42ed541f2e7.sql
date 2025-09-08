-- Set your user as admin (replace with your actual user ID if needed)
-- This will update the first user in the profiles table to be an admin
UPDATE profiles 
SET role = 'admin'
WHERE id = (
  SELECT id FROM profiles 
  ORDER BY created_at ASC 
  LIMIT 1
);

-- If no profile exists, this won't do anything, but the trigger should create one when you next log in