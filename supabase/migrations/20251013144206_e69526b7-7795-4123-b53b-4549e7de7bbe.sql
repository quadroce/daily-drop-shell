-- Update existing drops with NULL image_url to use placeholder
UPDATE public.drops 
SET image_url = 'https://dailydrops.cloud/og-image.png'
WHERE image_url IS NULL;

-- Create function to set placeholder image on insert/update
CREATE OR REPLACE FUNCTION public.set_placeholder_image()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.image_url IS NULL THEN
    NEW.image_url := 'https://dailydrops.cloud/og-image.png';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set placeholder image
DROP TRIGGER IF EXISTS trigger_set_placeholder_image ON public.drops;
CREATE TRIGGER trigger_set_placeholder_image
  BEFORE INSERT OR UPDATE ON public.drops
  FOR EACH ROW
  EXECUTE FUNCTION public.set_placeholder_image();