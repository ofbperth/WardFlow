"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type RealtimeFilter = {
  schema: string;
  table: string;
  event?: "*" | "INSERT" | "UPDATE" | "DELETE";
  filter?: string;
};

export function RealtimeRefresh({
  channel,
  filters,
  fallbackMs = 25000,
  debounceMs = 300,
}: {
  channel: string;
  filters: RealtimeFilter[];
  fallbackMs?: number;
  debounceMs?: number;
}) {
  const router = useRouter();
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refresh = useEffectEvent(() => {
    router.refresh();
  });
  const scheduleRefresh = useEffectEvent(() => {
    if (refreshTimeoutRef.current) {
      return;
    }

    refreshTimeoutRef.current = setTimeout(() => {
      refreshTimeoutRef.current = null;
      refresh();
    }, debounceMs);
  });
  const subscriptionRef = useRef<{ unsubscribe?: () => void } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let intervalId: ReturnType<typeof setInterval> | null = null;

    if (!supabase || filters.length === 0) {
      intervalId = setInterval(() => scheduleRefresh(), fallbackMs);
      return () => {
        if (intervalId) clearInterval(intervalId);
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current);
          refreshTimeoutRef.current = null;
        }
      };
    }

    const liveChannel = supabase.channel(channel);
    subscriptionRef.current = liveChannel;

    filters.forEach((entry) => {
      liveChannel.on(
        "postgres_changes",
        {
          event: entry.event ?? "*",
          schema: entry.schema,
          table: entry.table,
          filter: entry.filter,
        },
        scheduleRefresh,
      );
    });

    liveChannel.subscribe((status: string) => {
      if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && !intervalId) {
        intervalId = setInterval(() => scheduleRefresh(), fallbackMs);
      }
      if (status === "SUBSCRIBED" && intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    });

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      if (subscriptionRef.current) {
        void supabase.removeChannel(subscriptionRef.current as never);
      }
    };
  }, [channel, debounceMs, fallbackMs, filters, router]);

  return null;
}
