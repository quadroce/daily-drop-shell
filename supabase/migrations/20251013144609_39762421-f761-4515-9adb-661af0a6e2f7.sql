-- Remove placeholder from videos
UPDATE public.drops 
SET image_url = NULL
WHERE type = 'video' AND image_url = 'https://dailydrops.cloud/og-image.png';

-- Update function to skip videos
CREATE OR REPLACE FUNCTION public.set_placeholder_image()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set placeholder for non-video content
  IF NEW.image_url IS NULL AND NEW.type != 'video' THEN
    NEW.image_url := 'https://dailydrops.cloud/og-image.png';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;