import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface ResetPasswordProps {
  onComplete: () => void;
}

export default function ResetPassword({ onComplete }: ResetPasswordProps) {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Check if there's a valid session (from the reset link)
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setIsValidToken(true);
      }
      setIsChecking(false);
    };

    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Your password has been reset successfully",
      });

      // Wait a moment then redirect
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to reset password";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary"></div>
          <p className="text-sm text-muted-foreground">
            Verifying reset link...
          </p>
        </div>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center">
          <h1 className="mb-2 text-2xl font-bold text-foreground">
            Invalid Reset Link
          </h1>
          <p className="text-sm text-muted-foreground mb-4">
            This password reset link is invalid or has expired. Please request a
            new one.
          </p>
          <Button onClick={onComplete} className="w-full">
            Back to Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-2xl font-bold text-foreground">
            Create New Password
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your new password below
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="password" className="text-sm font-medium">
              New Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="confirmPassword" className="text-sm font-medium">
              Confirm Password
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="mt-1"
            />
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "Resetting..." : "Reset Password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
