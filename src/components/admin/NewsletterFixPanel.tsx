import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const NewsletterFixPanel = () => {
  const [loading, setLoading] = useState(false);
  const [testUserId, setTestUserId] = useState('6a783984-08f0-49c9-bd1f-f3e3711bb40e');
  const [results, setResults] = useState<any>(null);

  const problemUserIds = [
    '6a783984-08f0-49c9-bd1f-f3e3711bb40e',
    '637fc77f-93aa-488a-a0e1-ebd00826d4b3'
  ];

  const checkUserCache = async () => {
    if (!testUserId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('newsletter-admin-tools', {
        body: {
          action: 'check_cache',
          userId: testUserId
        }
      });

      if (error) throw error;

      setResults({
        type: 'cache_check',
        data
      });
      
      toast.success('Cache status retrieved successfully');
    } catch (error) {
      console.error('Error checking cache:', error);
      toast.error(`Failed to check cache: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const regenerateCache = async () => {
    if (!testUserId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('newsletter-admin-tools', {
        body: {
          action: 'regenerate_cache',
          userId: testUserId
        }
      });

      if (error) throw error;

      toast.success('Cache regeneration triggered');
      setResults({
        type: 'regenerate',
        data
      });
    } catch (error) {
      console.error('Error regenerating cache:', error);
      toast.error(`Failed to regenerate cache: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const testNewsletter = async () => {
    if (!testUserId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('newsletter-admin-tools', {
        body: {
          action: 'test_newsletter',
          userId: testUserId
        }
      });

      if (error) throw error;

      toast.success('Newsletter test completed');
      setResults({
        type: 'newsletter_test',
        data
      });
    } catch (error) {
      console.error('Error testing newsletter:', error);
      toast.error(`Failed to test newsletter: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const fixProblemUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('newsletter-admin-tools', {
        body: {
          action: 'fix_users',
          userIds: problemUserIds
        }
      });

      if (error) throw error;

      toast.success('Problem users fix completed');
      setResults({
        type: 'fix_users',
        data
      });
    } catch (error) {
      console.error('Error fixing users:', error);
      toast.error(`Failed to fix users: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const activateNewSystem = async () => {
    setLoading(true);
    try {
      // This would typically be done via environment variable update
      // For now we'll show instructions
      toast.info('Set USE_NEW_NEWSLETTER_SYSTEM=true in environment variables');
      
      // We can test the current system with new flag
      const { data, error } = await supabase.functions.invoke('build-digest', {
        body: {
          userId: testUserId,
          cadence: 'daily',
          slot: 'morning',
          testMode: true
        }
      });

      console.log('Test with current settings:', data);
      setResults({
        type: 'system_test',
        data: { digest: data, error }
      });
      
    } catch (error) {
      console.error('Error testing system:', error);
      toast.error(`System test failed: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📧 Newsletter Fix Panel
          <Badge variant="destructive">Critical</Badge>
        </CardTitle>
        <CardDescription>
          Tools to diagnose and fix newsletter issues for problem users
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Problem Users Summary */}
        <div className="space-y-3">
          <h3 className="font-semibold text-destructive">Problem Users</h3>
          <div className="space-y-2">
            {problemUserIds.map(userId => (
              <div key={userId} className="flex items-center gap-2 p-2 bg-destructive/5 rounded">
                <code className="text-xs bg-background px-2 py-1 rounded">{userId}</code>
                <span className="text-sm text-destructive">Receiving old/empty newsletters</span>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Test User Input */}
        <div className="space-y-3">
          <label className="text-sm font-medium">Test User ID:</label>
          <Input 
            value={testUserId}
            onChange={(e) => setTestUserId(e.target.value)}
            placeholder="Enter user ID to test"
          />
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Button 
              onClick={checkUserCache}
              disabled={loading || !testUserId}
              variant="outline"
            >
              🔍 Check Cache
            </Button>
            
            <Button 
              onClick={regenerateCache}
              disabled={loading || !testUserId}
              variant="outline"
            >
              🔄 Regenerate Cache
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <Button 
              onClick={testNewsletter}
              disabled={loading || !testUserId}
            >
              📧 Test Newsletter
            </Button>
            
            <Button 
              onClick={activateNewSystem}
              disabled={loading}
              variant="secondary"
            >
              🚀 Test New System
            </Button>
          </div>
          
          <Button 
            onClick={fixProblemUsers}
            disabled={loading}
            className="w-full"
            variant="destructive"
          >
            🔧 Fix Problem Users
          </Button>
        </div>

        {/* Results Display */}
        {results && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="font-semibold">Results</h3>
              <div className="bg-muted/50 p-4 rounded-lg">
                <pre className="text-xs overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(results.data, null, 2)}
                </pre>
              </div>
            </div>
          </>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Fix Plan</h4>
          <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>1. ✅ Fixed date filtering bug in build-digest legacy system</li>
            <li>2. 🔧 Use "Test New System" to verify corrections work</li>
            <li>3. 📧 Test newsletter generation for problem users</li>
            <li>4. 🚀 Set USE_NEW_NEWSLETTER_SYSTEM=true in production</li>
          </ol>
        </div>

      </CardContent>
    </Card>
  );
};