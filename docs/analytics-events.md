# DailyDrops Analytics Events Documentation

This document describes all GA4 events implemented in the DailyDrops application.

## User Properties

The following user properties are automatically set when user data is available:

- `subscription_tier`: User's subscription level (free, premium, corporate, sponsor)
- `language_prefs`: Array of user's preferred languages
- `youtube_embed_pref`: Boolean indicating if user prefers YouTube embeds

## Business Conversion Events

These events are marked as conversions in GA4:

### `signup_complete`
**When**: User completes registration/verification
**Parameters**:
- `method`: "email" | "google" | "linkedin"

### `subscription_upgrade` 
**When**: User upgrades to a paid plan
**Parameters**:
- `plan_name`: "premium" | "corporate"  
- `price`: Number (optional)

### `subscription_cancel`
**When**: User cancels their paid plan
**Parameters**:
- `plan_name`: Name of canceled plan

## Onboarding Events

### `onboarding_profile_submitted`
**When**: User completes Step 1 (Profile)
**Parameters**:
- `role_present`: Boolean indicating if company role was provided

### `onboarding_languages_set`
**When**: User completes Step 2 (Languages)
**Parameters**:
- `count`: Number of languages selected
- `languages`: Array of language codes

### `onboarding_embed_pref_set` 
**When**: User sets YouTube embed preference in Step 2
**Parameters**:
- `youtube_embed_pref`: Boolean preference value

### `onboarding_topics_confirmed`
**When**: User completes Step 3 (Topics) 
**Parameters**:
- `l1`: Number of Level 1 topics selected
- `l2`: Number of Level 2 topics selected  
- `l3`: Number of Level 3 topics selected
- `total`: Total topics selected

### `onboarding_completed`
**When**: User finishes entire onboarding flow
**Parameters**:
- `total_topics`: Total number of topics selected

## Feed & Content Events

### `drop_viewed`
**When**: User loads the feed page with content
**Parameters**:
- `drop_id`: ID of first drop shown (optional)
- `topic`: Primary topic of content (optional)

### `content_click`
**When**: User clicks to open content externally
**Parameters**:
- `drop_id`: Content identifier
- `content_id`: Same as drop_id
- `source`: Content source name
- `topic`: Primary topic

### `save_item`
**When**: User bookmarks content
**Parameters**:
- `drop_id`: Content identifier
- `content_id`: Same as drop_id  
- `source`: Content source name
- `topic`: Primary topic

### `dismiss_item`
**When**: User dismisses content from feed
**Parameters**:
- `drop_id`: Content identifier
- `content_id`: Same as drop_id
- `source`: Content source name
- `topic`: Primary topic

### `like_item`
**When**: User likes content
**Parameters**:
- `drop_id`: Content identifier
- `content_id`: Same as drop_id
- `source`: Content source name  
- `topic`: Primary topic

### `dislike_item`
**When**: User dislikes content
**Parameters**:
- `drop_id`: Content identifier
- `content_id`: Same as drop_id
- `source`: Content source name
- `topic`: Primary topic

## Video Events

### `video_play`
**When**: User starts playing embedded YouTube video
**Parameters**:
- `drop_id`: Associated content ID
- `content_id`: Same as drop_id
- `percent_played`: Playback percentage (optional)

### `video_pause` 
**When**: User pauses embedded YouTube video
**Parameters**:
- `drop_id`: Associated content ID
- `content_id`: Same as drop_id
- `percent_played`: Playback percentage (optional)

### `video_complete`
**When**: User watches video to completion
**Parameters**:
- `drop_id`: Associated content ID
- `content_id`: Same as drop_id

## Channel Events

### `newsletter_subscribed`
**When**: User enables newsletter subscription
**Parameters**:
- `slot`: Delivery time slot (optional)

### `newsletter_unsubscribed`  
**When**: User disables newsletter subscription
**Parameters**:
- `slot`: Previous delivery time slot (optional)

### `whatsapp_verified`
**When**: User successfully verifies WhatsApp number
**Parameters**: None

### `whatsapp_drop_sent`
**When**: WhatsApp message is sent to user
**Parameters**:
- `slot`: Time slot ("AM" | "PM") (optional)
- `status`: "sent" | "failed"

## Monetization Events

### `begin_checkout`
**When**: User clicks upgrade button on pricing page
**Parameters**:
- `plan_name`: Selected plan name

### `purchase` 
**When**: User completes payment (when Stripe integration active)
**Parameters**:
- `plan_name`: Purchased plan name
- `amount`: Purchase amount

## Implementation Notes

- Events are only sent in production (`isProd = true`)
- In development, events are logged to console instead
- All events use the centralized `track()` function from `src/lib/analytics.ts`
- User properties are set via `setUserProperties()` function
- Events follow GA4 naming conventions and parameter limits
- No PII (personally identifiable information) is included in event parameters

## GA4 Configuration

- Measurement ID: G-1S2C81YQGW
- Enhanced measurement is enabled
- Conversion events should be manually marked in GA4 interface
- Debug mode available via GA4 DebugView for testing

## Files Updated

- `src/lib/analytics.ts` - Core analytics functions
- `src/lib/trackers/onboarding.ts` - Onboarding event trackers  
- `src/lib/trackers/content.ts` - Content interaction trackers
- `src/lib/trackers/subscription.ts` - Subscription event trackers
- `src/lib/trackers/channels.ts` - Channel subscription trackers
- `src/components/AnalyticsProvider.tsx` - User properties management
- `src/pages/Auth.tsx` - Signup completion events
- `src/pages/Onboarding.tsx` - Onboarding flow events
- `src/pages/Feed.tsx` - Content interaction events
- `src/pages/Pricing.tsx` - Checkout initiation events
- `src/pages/Newsletter.tsx` - Newsletter subscription events
- `src/components/YouTubePlayer.tsx` - Video playback events