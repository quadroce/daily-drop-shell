import React, { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

interface HardDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    email: string;
    display_name?: string;
    subscription_tier: string;
    role: string;
  };
  onConfirm: (userId: string, force: boolean) => Promise<void>;
  isDeleting: boolean;
}

export const HardDeleteDialog = ({ 
  open, 
  onOpenChange, 
  user, 
  onConfirm, 
  isDeleting 
}: HardDeleteDialogProps) => {
  const [confirmText, setConfirmText] = useState("");
  const [forceDelete, setForceDelete] = useState(false);
  
  const requiredText = `DELETE ${user.email}`;
  const isConfirmValid = confirmText === requiredText;
  const needsForce = ['sponsor', 'corporate'].includes(user.subscription_tier);

  const handleConfirm = async () => {
    if (isConfirmValid) {
      await onConfirm(user.id, forceDelete);
      setConfirmText("");
      setForceDelete(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Permanent User Deletion
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <div className="text-left">
              <p className="font-medium mb-2">You are about to permanently delete:</p>
              <div className="bg-muted p-3 rounded-md space-y-1">
                <p className="font-mono text-sm">{user.email}</p>
                {user.display_name && (
                  <p className="text-sm text-muted-foreground">{user.display_name}</p>
                )}
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline">{user.subscription_tier}</Badge>
                  <Badge variant="outline">{user.role}</Badge>
                </div>
              </div>
            </div>

            <div className="text-left space-y-2">
              <p className="text-sm font-medium text-destructive">This action will:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Delete the user account permanently</li>
                <li>Remove all user data (preferences, bookmarks, etc.)</li>
                <li>Clear engagement history and analytics</li>
                <li>Cancel any active subscriptions</li>
                <li>Cannot be undone</li>
              </ul>
            </div>

            {needsForce && (
              <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-md">
                <p className="text-sm text-destructive font-medium">⚠️ Warning</p>
                <p className="text-sm text-destructive/80">
                  This user has an active {user.subscription_tier} subscription. 
                  Forced deletion is required.
                </p>
                <div className="flex items-center space-x-2 mt-2">
                  <Checkbox 
                    id="force" 
                    checked={forceDelete}
                    onCheckedChange={(checked) => setForceDelete(checked as boolean)}
                  />
                  <Label htmlFor="force" className="text-sm text-destructive">
                    Force delete {user.subscription_tier} user
                  </Label>
                </div>
              </div>
            )}

            <div className="text-left">
              <Label htmlFor="confirm-text" className="text-sm font-medium">
                Type <code className="bg-muted px-1 rounded">{requiredText}</code> to confirm:
              </Label>
              <Input
                id="confirm-text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={requiredText}
                className="mt-1 font-mono"
                disabled={isDeleting}
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!isConfirmValid || isDeleting || (needsForce && !forceDelete)}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting..." : "Delete Permanently"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};