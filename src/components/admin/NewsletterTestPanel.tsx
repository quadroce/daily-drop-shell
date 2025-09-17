import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mail, User, Clock, Loader2, Send, Search } from "lucide-react";

interface User {
  id: string;
  email: string;
  display_name: string | null;
  username: string | null;
  subscription_tier: string;
  created_at: string;
}

interface NewsletterSubscription {
  user_id: string;
  slot?: string;
  confirmed?: boolean;
  active?: boolean;
  cadence?: string;
}

export const NewsletterTestPanel = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [subscriptions, setSubscriptions] = useState<NewsletterSubscription[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [cadence, setCadence] = useState<string>("daily");
  const [slot, setSlot] = useState<string>("morning");
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
    fetchSubscriptions();
  }, []);

  // Add refresh function for after creating subscriptions
  const refreshData = () => {
    fetchUsers();
    fetchSubscriptions();
  };

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, display_name, username, subscription_tier, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to fetch users list",
        variant: "destructive",
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchSubscriptions = async () => {
    try {
      const { data, error } = await supabase
        .from('newsletter_subscriptions')
        .select('*')
        .limit(5);

      if (error) {
        console.error('Error fetching subscriptions:', error);
        // If table doesn't exist or has different schema, just set empty array
        setSubscriptions([]);
        return;
      }
      
      console.log('Newsletter subscriptions sample:', data);
      setSubscriptions(data || []);
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      setSubscriptions([]);
    }
  };

  const sendTestNewsletter = async () => {
    if (!selectedUserId) {
      toast({
        title: "Error",
        description: "Please select a user first",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // First, build the digest for this user
      const { data: digestData, error: digestError } = await supabase.functions.invoke('build-digest', {
        body: {
          userId: selectedUserId,
          cadence: cadence,
          slot: slot,
          testMode: true
        }
      });

      if (digestError) throw digestError;

      if (!digestData || !digestData.success) {
        throw new Error(digestData?.error || 'Failed to build digest');
      }

      // Then send the newsletter
      const { data: emailData, error: emailError } = await supabase.functions.invoke('send-email-digest', {
        body: {
          userId: selectedUserId,
          digestContent: digestData.digestContent,
          testMode: true
        }
      });

      if (emailError) throw emailError;

      if (emailData?.success) {
        toast({
          title: "Newsletter Sent Successfully",
          description: `Test newsletter sent to user ${selectedUserId}. Email: ${emailData.emailSent}`,
        });
        
        // Refresh data to show updated subscription status
        refreshData();
      } else {
        throw new Error(emailData?.error || 'Failed to send newsletter');
      }
    } catch (error) {
      console.error('Error sending test newsletter:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to send test newsletter',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchEmail.toLowerCase()) ||
    (user.display_name && user.display_name.toLowerCase().includes(searchEmail.toLowerCase())) ||
    (user.username && user.username.toLowerCase().includes(searchEmail.toLowerCase()))
  );

  const selectedUser = users.find(u => u.id === selectedUserId);
  const userSubscription = subscriptions.find(s => s.user_id === selectedUserId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Newsletter Test Panel
        </CardTitle>
        <CardDescription>
          Send test newsletters to specific users for testing purposes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* User Selection */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="search">Search Users</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by email, username, or display name..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Select User</Label>
            {loadingUsers ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading users...
              </div>
            ) : (
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a user to send test newsletter" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {filteredUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>{user.email}</span>
                        {user.display_name && (
                          <Badge variant="secondary" className="text-xs">
                            {user.display_name}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {user.subscription_tier}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Selected User Info */}
          {selectedUser && (
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="font-medium">{selectedUser.email}</span>
                    <Badge>{selectedUser.subscription_tier}</Badge>
                  </div>
                  {selectedUser.display_name && (
                    <div className="text-sm text-muted-foreground">
                      Display Name: {selectedUser.display_name}
                    </div>
                  )}
                  {selectedUser.username && (
                    <div className="text-sm text-muted-foreground">
                      Username: {selectedUser.username}
                    </div>
                  )}
                  <div className="text-sm text-muted-foreground">
                    Member since: {new Date(selectedUser.created_at).toLocaleDateString()}
                  </div>
                  
                  {/* Newsletter Subscription Status */}
                  {userSubscription ? (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                      <Badge variant={userSubscription.active ? "default" : "secondary"}>
                        {userSubscription.active ? "Subscribed" : "Inactive"}
                      </Badge>
                      {userSubscription.slot && (
                        <Badge variant="outline">
                          {userSubscription.slot}
                        </Badge>
                      )}
                      {userSubscription.confirmed !== undefined && (
                        userSubscription.confirmed ? (
                          <Badge variant="default">Confirmed</Badge>
                        ) : (
                          <Badge variant="destructive">Unconfirmed</Badge>
                        )
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 pt-3 border-t">
                      <Badge variant="secondary">No Newsletter Subscription</Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Newsletter Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Newsletter Cadence</Label>
            <Select value={cadence} onValueChange={setCadence}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Time Slot</Label>
            <Select value={slot} onValueChange={setSlot}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="morning">Morning</SelectItem>
                <SelectItem value="afternoon">Afternoon</SelectItem>
                <SelectItem value="evening">Evening</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Send Button */}
        <Button 
          onClick={sendTestNewsletter} 
          disabled={!selectedUserId || loading}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Sending Test Newsletter...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Send Test Newsletter
            </>
          )}
        </Button>

        <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
          <div className="flex items-start gap-2">
            <Clock className="h-4 w-4 mt-0.5" />
            <div>
              <strong>Test Mode:</strong> This will send a real newsletter email to the selected user with test content. 
              Make sure to use a test email address or notify the user before sending.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};