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
}: {
  channel: string;
  filters: RealtimeFilter[];
  fallbackMs?: number;
}) {
  const router = useRouter();
  const refresh = useEffectEvent(() => {
    router.refresh();
  });
  const subscriptionRef = useRef<{ unsubscribe?: () => void } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let intervalId: ReturnType<typeof setInterval> | null = null;

    if (!supabase || filters.length === 0) {
      intervalId = setInterval(() => refresh(), fallbackMs);
      return () => {
        if (intervalId) clearInterval(intervalId);
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
        refresh,
      );
    });

    liveChannel.subscribe((status: string) => {
      if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && !intervalId) {
        intervalId = setInterval(() => refresh(), fallbackMs);
      }
      if (status === "SUBSCRIBED" && intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    });

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (subscriptionRef.current) {
        void supabase.removeChannel(subscriptionRef.current as never);
      }
    };
  }, [channel, fallbackMs, filters, router]);

  return null;
}
