import { useEffect, useState, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { openMemoryClient } from "@/lib/api-client";
import { Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

export function ConnectionStatus() {
  const [status, setStatus] = useState<
    "connected" | "disconnected" | "checking"
  >("checking");
  const [version, setVersion] = useState<string>("");
  const toastIdRef = useRef<string | number | null>(null);
  const retryCountRef = useRef(0);

  const checkConnection = useCallback(async () => {
    try {
      const health = await openMemoryClient.health();
      if (health.ok) {
        const wasDisconnected = status === "disconnected";
        const hadRetries = retryCountRef.current > 0;

        setStatus("connected");
        setVersion(health.version);
        retryCountRef.current = 0;

        // Dismiss the offline toast if it exists
        if (toastIdRef.current) {
          toast.dismiss(toastIdRef.current);
          toastIdRef.current = null;
        }

        // Only show reconnection success if we actually reconnected (not initial connection)
        if (wasDisconnected && hadRetries) {
          toast.success(`Connection Restored - OpenMemory v${health.version}`, {
            duration: 3000,
          });
        }
      } else {
        setStatus("disconnected");
      }
    } catch {
      const wasConnected = status === "connected";
      setStatus("disconnected");
      retryCountRef.current += 1;

      // Show or update the offline toast - but DON'T refresh the page
      if (wasConnected) {
        toastIdRef.current = toast.error(
          "Connection Lost - Attempting to reconnect...",
          {
            duration: Infinity,
            description: `Retry attempt: ${retryCountRef.current}`,
            action: {
              label: "Retry Now",
              onClick: () => checkConnection(),
            },
          },
        );
      } else if (toastIdRef.current) {
        // Update existing toast with new retry count
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = toast.error(
          "Backend Offline - Auto-reconnecting...",
          {
            duration: Infinity,
            description: `Retry attempt: ${retryCountRef.current}`,
            action: {
              label: "Retry Now",
              onClick: () => checkConnection(),
            },
          },
        );
      } else {
        toastIdRef.current = toast.error(
          "Backend Offline - Auto-reconnecting...",
          {
            duration: Infinity,
            description: `Retry attempt: ${retryCountRef.current}`,
            action: {
              label: "Retry Now",
              onClick: () => checkConnection(),
            },
          },
        );
      }
    }
  }, [status]);

  useEffect(() => {
    checkConnection();

    // Check every 10 seconds when disconnected, every 30 seconds when connected
    const interval = setInterval(
      checkConnection,
      status === "disconnected" ? 10000 : 30000,
    );

    return () => {
      clearInterval(interval);
      // Clean up toast on unmount
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
      }
    };
  }, [checkConnection, status]);

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-t">
      {status === "connected" ? (
        <Wifi className="h-3.5 w-3.5 text-green-600" />
      ) : status === "disconnected" ? (
        <WifiOff className="h-3.5 w-3.5 text-destructive" />
      ) : (
        <Wifi className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />
      )}

      <div className="flex items-center gap-2 text-xs flex-1">
        <Badge
          variant={
            status === "connected"
              ? "default"
              : status === "checking"
                ? "outline"
                : "destructive"
          }
          className="h-5 px-2 text-xs"
        >
          {status === "connected"
            ? "● Connected"
            : status === "checking"
              ? "Checking..."
              : "● Offline"}
        </Badge>
        {version && status === "connected" && (
          <span className="text-muted-foreground">v{version}</span>
        )}
      </div>
    </div>
  );
}
