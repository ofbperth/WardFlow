import { AppFeedbackToast } from "@/components/app-feedback-toast";

export function AdminFeedbackToast({ toastKey }: { toastKey?: string }) {
  return <AppFeedbackToast toastKey={toastKey} />;
}
