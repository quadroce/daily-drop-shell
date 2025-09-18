import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Mail, 
  MessageCircle, 
  Send, 
  Hash, 
  Slack, 
  Users, 
  Bell, 
  Rss,
  Crown,
  ExternalLink 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { toast } from "@/hooks/use-toast";
import { track } from "@/lib/analytics";

// Feature flag for premium toggles
const ENABLE_PREMIUM_TOGGLES = false;

interface Channel {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isPremium: boolean;
  enabled: boolean;
}

interface ChannelToggleListProps {
  location: 'onboarding' | 'profile';
  onChannelsChange?: (channels: { [key: string]: boolean }) => void;
  className?: string;
}

export const ChannelToggleList: React.FC<ChannelToggleListProps> = ({
  location,
  onChannelsChange,
  className = ""
}) => {
  const { user } = useAuth();
  const { profile, isPremium } = useUserProfile();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelStates, setChannelStates] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<{ [key: string]: boolean }>({});

  // Define all communication channels
  const allChannels: Channel[] = [
    {
      id: 'newsletter',
      name: 'Email Newsletter',
      description: 'Get daily content digests delivered to your inbox',
      icon: Mail,
      isPremium: false,
      enabled: true
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      description: 'Receive updates and content via WhatsApp messages',
      icon: MessageCircle,
      isPremium: true,
      enabled: ENABLE_PREMIUM_TOGGLES && isPremium
    },
    {
      id: 'telegram',
      name: 'Telegram',
      description: 'Get notifications through Telegram bot',
      icon: Send,
      isPremium: true,
      enabled: ENABLE_PREMIUM_TOGGLES && isPremium
    },
    {
      id: 'discord',
      name: 'Discord',
      description: 'Connect your Discord account for community updates',
      icon: Hash,
      isPremium: true,
      enabled: ENABLE_PREMIUM_TOGGLES && isPremium
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Integrate with your workspace for team content sharing',
      icon: Slack,
      isPremium: true,
      enabled: ENABLE_PREMIUM_TOGGLES && isPremium
    },
    {
      id: 'teams',
      name: 'Microsoft Teams',
      description: 'Share content within your Teams channels',
      icon: Users,
      isPremium: true,
      enabled: ENABLE_PREMIUM_TOGGLES && isPremium
    },
    {
      id: 'push',
      name: 'Push Notifications',
      description: 'Browser push notifications for breaking content',
      icon: Bell,
      isPremium: true,
      enabled: ENABLE_PREMIUM_TOGGLES && isPremium
    },
    {
      id: 'rss',
      name: 'Personalized RSS',
      description: 'Custom RSS feed tailored to your interests',
      icon: Rss,
      isPremium: true,
      enabled: ENABLE_PREMIUM_TOGGLES && isPremium
    }
  ];

  // Track step view for onboarding
  useEffect(() => {
    if (location === 'onboarding') {
      track('onboarding_step_view', { step: 'communication_channels' });
    }
  }, [location]);

  // Load initial channel states
  useEffect(() => {
    const loadChannelStates = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Load newsletter subscription state
        const { data: newsletter, error: newsletterError } = await supabase
          .from('newsletter_subscriptions')
          .select('active, slot, cadence')
          .eq('user_id', user.id)
          .maybeSingle();

        if (newsletterError && newsletterError.code !== 'PGRST116') {
          console.error('Error loading newsletter subscription:', newsletterError);
        }

        // Set initial states
        const initialStates: { [key: string]: boolean } = {
          newsletter: newsletter?.active ?? true, // Default to true if no record
        };

        // Initialize other channels as false (will be enabled based on premium status)
        allChannels.forEach(channel => {
          if (channel.id !== 'newsletter') {
            initialStates[channel.id] = false;
          }
        });

        setChannelStates(initialStates);
        setChannels(allChannels);

        // Create default newsletter subscription if none exists
        if (!newsletter) {
          await supabase
            .from('newsletter_subscriptions')
            .upsert({
              user_id: user.id,
              active: true,
              slot: 'morning',
              cadence: 'daily'
            });
        }

      } catch (error) {
        console.error('Error loading channel states:', error);
        toast({
          title: "Error",
          description: "Failed to load communication preferences",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadChannelStates();
  }, [user?.id, isPremium]);

  // Notify parent component of channel changes
  useEffect(() => {
    if (onChannelsChange) {
      onChannelsChange(channelStates);
    }
  }, [channelStates, onChannelsChange]);

  const handleToggle = async (channelId: string, newState: boolean) => {
    if (!user?.id) return;

    // Check if channel is enabled
    const channel = channels.find(c => c.id === channelId);
    if (!channel?.enabled) return;

    // Optimistic update
    const previousState = channelStates[channelId];
    setChannelStates(prev => ({
      ...prev,
      [channelId]: newState
    }));

    setSaving(prev => ({ ...prev, [channelId]: true }));

    try {
      if (channelId === 'newsletter') {
        const { error } = await supabase
          .from('newsletter_subscriptions')
          .upsert({
            user_id: user.id,
            active: newState,
            slot: 'morning',
            cadence: 'daily'
          });

        if (error) throw error;

        // Track the toggle event
        track('channel_toggle', {
          channel: 'newsletter',
          state: newState ? 'on' : 'off',
          location
        });

        toast({
          title: newState ? "Newsletter enabled" : "Newsletter disabled",
          description: newState 
            ? "You'll receive daily content digests via email"
            : "You won't receive newsletter emails anymore",
        });
      }
      // Handle other premium channels when ENABLE_PREMIUM_TOGGLES is true
      // This would be where WhatsApp, Telegram, etc. handling would go

    } catch (error) {
      console.error(`Error updating ${channelId}:`, error);
      
      // Rollback optimistic update
      setChannelStates(prev => ({
        ...prev,
        [channelId]: previousState
      }));

      toast({
        title: "Error",
        description: `Failed to update ${channel?.name || channelId} settings`,
        variant: "destructive",
      });
    } finally {
      setSaving(prev => ({ ...prev, [channelId]: false }));
    }
  };

  const handlePremiumCTA = (channelId: string) => {
    const channel = channels.find(c => c.id === channelId);
    
    track('premium_channel_cta_click', {
      channel: channelId,
      location
    });

    toast({
      title: "Premium Feature",
      description: `${channel?.name || 'This channel'} is available for Premium users`,
      action: (
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => window.open('/pricing', '_blank')}
        >
          <Crown className="h-3 w-3 mr-1" />
          Upgrade
        </Button>
      ),
    });
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Communication Channels</CardTitle>
          <CardDescription>Loading your preferences...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-muted rounded" />
                  <div className="space-y-1">
                    <div className="w-24 h-4 bg-muted rounded" />
                    <div className="w-32 h-3 bg-muted rounded" />
                  </div>
                </div>
                <div className="w-11 h-6 bg-muted rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Communication Channels
          </CardTitle>
          <CardDescription>
            Choose how you'd like to receive content updates and notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {channels.map((channel) => {
              const IconComponent = channel.icon;
              const isEnabled = channel.enabled;
              const isActive = channelStates[channel.id] ?? false;
              const isSaving = saving[channel.id] ?? false;

              return (
                <div
                  key={channel.id}
                  className={`flex items-center justify-between p-4 border rounded-lg transition-all ${
                    !isEnabled ? 'opacity-60 bg-muted/20' : 'hover:bg-muted/10'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <IconComponent className="h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm">{channel.name}</h4>
                        {channel.isPremium && (
                          <Badge 
                            variant="secondary" 
                            className="text-xs px-2 py-0.5 bg-gradient-to-r from-orange-500 to-pink-500 text-white border-0"
                          >
                            <Crown className="h-3 w-3 mr-1" />
                            PREMIUM
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {channel.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isEnabled && channel.isPremium && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePremiumCTA(channel.id)}
                        className="text-xs px-2 py-1 h-7"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Upgrade
                      </Button>
                    )}
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Switch
                            checked={isActive}
                            onCheckedChange={(checked) => handleToggle(channel.id, checked)}
                            disabled={!isEnabled || isSaving}
                            aria-label={`Toggle ${channel.name}`}
                            aria-disabled={!isEnabled}
                          />
                        </div>
                      </TooltipTrigger>
                      {!isEnabled && (
                        <TooltipContent>
                          <p className="text-xs">
                            {channel.isPremium ? 'Premium only' : 'Not available'}
                          </p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>

          {location === 'profile' && (
            <div className="mt-6 p-4 bg-muted/30 rounded-lg">
              <div className="flex items-start gap-3">
                <Bell className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium mb-1">About Communication Channels</p>
                  <p>
                    Premium channels are coming soon! Email newsletter is currently the primary way to receive content updates. 
                    Premium users will get access to WhatsApp, Telegram, Discord, and other notification channels.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};