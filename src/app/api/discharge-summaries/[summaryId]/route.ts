import { NextResponse } from "next/server";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { requireAppSession } from "@/lib/auth";
import { getDischargeSummaryById } from "@/lib/wardflow";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ summaryId: string }> },
) {
  const session = await requireAppSession();
  const { summaryId } = await params;
  const payload = await getDischargeSummaryById(session, summaryId);

  if (!payload) {
    return NextResponse.json({ error: "Summary not found" }, { status: 404 });
  }

  const { summary, patient, ward } = payload;
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          heading("Discharge Summary"),
          line(`Patient: ${patient.displayName}`),
          line(`Ward: ${ward?.name ?? "-"}`),
          line(`Bed: ${patient.bed}`),
          line(`Discharge date: ${summary.dischargeDate}`),
          blank(),
          section("Diagnosis", summary.diagnosis),
          section("Precaution", summary.precaution),
          section("Condition at discharge", summary.conditionAtDischarge),
          section("Hospital course", summary.hospitalCourse),
          section("Active problems", summary.activeProblems),
          section("Completed tasks", summary.completedTasks),
          section("Pending items", summary.pendingItems),
          section("Medication changes", summary.medicationChanges),
          section("Follow-up plan", summary.followUpPlan),
          section("Discharge instructions", summary.dischargeInstructions),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const filename = `${patient.displayName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-discharge-summary.docx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function heading(text: string) {
  return new Paragraph({
    spacing: { after: 240 },
    children: [new TextRun({ text, bold: true, size: 32 })],
  });
}

function line(text: string) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun(text)],
  });
}

function section(title: string, value: string) {
  return new Paragraph({
    spacing: { after: 180 },
    children: [
      new TextRun({ text: `${title}: `, bold: true }),
      new TextRun(value || "-"),
    ],
  });
}

function blank() {
  return new Paragraph({ children: [] });
}
