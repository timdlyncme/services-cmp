import React, { useState, useEffect } from 'react';
import { Loader2, Building } from 'lucide-react';

interface TenantLoadingOverlayProps {
  isVisible: boolean;
  tenantName: string | null;
}

export function TenantLoadingOverlay({ isVisible, tenantName }: TenantLoadingOverlayProps) {
  const [progress, setProgress] = useState(0);
  const [internalVisible, setInternalVisible] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [displayTenantName, setDisplayTenantName] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  
  const MIN_DISPLAY_DURATION = 3000; // 3 seconds minimum display time
  const PROGRESS_DURATION = 2500; // Progress bar completes in 2.5 seconds

  useEffect(() => {
    if (isVisible && !internalVisible) {
      // Starting to show the overlay
      setInternalVisible(true);
      setStartTime(Date.now());
      setProgress(0);
      setDisplayTenantName(tenantName);
      setIsCompleted(false);
      
      // Start progress animation - complete in 2.5 seconds
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev + (100 / (PROGRESS_DURATION / 100)); // Increment to complete in 2.5s
          if (newProgress >= 100) {
            clearInterval(progressInterval);
            return 100;
          }
          return newProgress;
        });
      }, 100);

      return () => clearInterval(progressInterval);
    } else if (!isVisible && internalVisible && startTime) {
      // Parent wants to hide overlay, mark as completed and check minimum duration
      setIsCompleted(true);
      
      const elapsedTime = Date.now() - startTime;
      
      if (elapsedTime >= MIN_DISPLAY_DURATION) {
        // Minimum time has passed, hide immediately
        setInternalVisible(false);
        setStartTime(null);
        setProgress(0);
        setDisplayTenantName(null);
        setIsCompleted(false);
      } else {
        // Wait for remaining time before hiding
        const remainingTime = MIN_DISPLAY_DURATION - elapsedTime;
        const timeout = setTimeout(() => {
          setInternalVisible(false);
          setStartTime(null);
          setProgress(0);
          setDisplayTenantName(null);
          setIsCompleted(false);
        }, remainingTime);

        return () => clearTimeout(timeout);
      }
    }
  }, [isVisible, internalVisible, startTime, tenantName]);

  // Don't render if not internally visible
  if (!internalVisible) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card border rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
        <div className="flex flex-col items-center text-center space-y-4">
          {/* Animated Icon */}
          <div className="relative">
            <Building className="h-12 w-12 text-muted-foreground" />
          </div>
          
          {/* Loading Text */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">
              {isCompleted ? 'Loading Complete' : 'Loading Tenant'}
            </h3>
            {displayTenantName && (
              <p className="text-sm text-muted-foreground">
                {isCompleted ? 'Successfully switched to' : 'Switching to'} <span className="font-medium text-foreground">{displayTenantName}</span>
              </p>
            )}
          </div>
          
          {/* Dynamic Progress Indicator */}
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-100 ease-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
            ></div>
          </div>
          
          <p className="text-xs text-muted-foreground">
            {isCompleted 
              ? 'Finalizing tenant switch...' 
              : 'Please wait while we load your tenant data...'
            }
          </p>
        </div>
      </div>
    </div>
  );
}

