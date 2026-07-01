"use client";

import { useEffect, useRef, useState } from "react";
import { cn, formatDateTime, formatPatientSex, labelForLifecycle, labelForPatientStatus, labelForPrecaution } from "@/lib/utils";
import type { Patient } from "@/lib/types";

type SummaryItem = {
  label: string;
  value: string;
};

export function PatientSummaryGrid({
  patient,
  ward,
}: {
  patient: Patient;
  ward: string | null;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) {
      return;
    }

    const updateWidth = () => {
      setContainerWidth(node.clientWidth);
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  const primaryItems: SummaryItem[] = [
    { label: "Ward", value: ward ?? "-" },
    { label: "Bed", value: patient.bed },
    { label: "Age / Sex", value: `${patient.age ?? "-"} / ${formatPatientSex(patient.sex)}` },
    { label: "Diagnosis", value: patient.diagnosis },
    { label: "Responsible", value: patient.responsibleDoctorName ?? "Unassigned" },
    { label: "Status", value: labelForPatientStatus(patient.status) },
  ];
  const secondaryItems: SummaryItem[] = [
    { label: "Precaution", value: labelForPrecaution(patient.precaution) },
    { label: "Lifecycle", value: labelForLifecycle(patient.lifecycle) },
    { label: "Discharged at", value: patient.dischargedAt ? formatDateTime(patient.dischargedAt) : "-" },
  ];
  const allItems = [...primaryItems, ...secondaryItems];

  const isCompact = containerWidth > 0 ? containerWidth < 640 : true;

  return (
    <div ref={rootRef}>
      {isCompact ? (
        <div className="grid gap-2.5 grid-cols-1">
          {primaryItems.map((item) => (
            <div
              key={item.label}
              className={cn(
                "rounded-[16px] border clinical-divider bg-white p-3",
                item.label === "Diagnosis" ? "[grid-column:1/-1]" : "",
              )}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{item.label}</p>
              <p className="mt-1.5 break-words text-sm font-semibold leading-5 text-foreground">{item.value}</p>
            </div>
          ))}

          <details className="panel-muted rounded-[16px] p-3 [grid-column:1/-1]">
            <summary className="cursor-pointer list-none text-sm font-semibold text-[color:var(--color-ink)]">
              Clinical details
            </summary>
            <div className="mt-2.5 grid gap-2 grid-cols-1">
              {secondaryItems.map((item) => (
                <div key={item.label} className="rounded-[14px] border clinical-divider bg-white p-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{item.label}</p>
                  <p className="mt-1.5 break-words text-sm font-semibold leading-5 text-foreground">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </details>
        </div>
      ) : (
        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))]">
          {allItems.map((item) => (
            <div key={item.label} className="rounded-[16px] border clinical-divider bg-white p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{item.label}</p>
              <p className="mt-1.5 break-words text-sm font-semibold leading-5 text-foreground">{item.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
