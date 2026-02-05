"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AutoRefresh({ intervalMs = 30000 }) {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => router.refresh();
    const timer = setInterval(refresh, intervalMs);
    window.addEventListener("pd-activity-logged", refresh);
    window.addEventListener("pd-refresh", refresh);
    let channel;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channel = new BroadcastChannel("pd-updates");
      channel.onmessage = () => refresh();
    }
    return () => {
      clearInterval(timer);
      window.removeEventListener("pd-activity-logged", refresh);
      window.removeEventListener("pd-refresh", refresh);
      if (channel) {
        channel.close();
      }
    };
  }, [intervalMs, router]);

  return null;
}
