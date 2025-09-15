import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Building } from "lucide-react";

interface OnboardingStep1Props {
  formData: {
    first_name: string;
    last_name: string;
    company_role: string;
  };
  onChange: (field: string, value: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export const OnboardingStep1Profile: React.FC<OnboardingStep1Props> = ({
  formData,
  onChange,
  onNext,
  onBack
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Tell us about yourself
        </CardTitle>
        <p className="text-muted-foreground">
          This information helps us personalize your experience. You can skip optional fields.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                type="text"
                placeholder="John"
                value={formData.first_name}
                onChange={(e) => onChange('first_name', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                type="text"
                placeholder="Doe"
                value={formData.last_name}
                onChange={(e) => onChange('last_name', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company_role">Role / Title (Optional)</Label>
            <div className="relative">
              <Building className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="company_role"
                type="text"
                placeholder="e.g. Product Manager, Software Engineer, Founder"
                className="pl-10"
                value={formData.company_role}
                onChange={(e) => onChange('company_role', e.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Help us understand your professional context
            </p>
          </div>

          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={onBack}>
              Back
            </Button>
            <Button type="submit">
              Continue
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};