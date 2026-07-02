import crypto from "node:crypto";
import type { SummaryNoteExportResult, SummaryNotePayload } from "@/lib/types";
import { labelForProblemDiagnosisStatus, labelForProblemPriority } from "@/lib/utils";

type GoogleDocsAdapter = {
  exportSummaryNote(payload: SummaryNotePayload): Promise<SummaryNoteExportResult>;
};

class PlaceholderGoogleDocsAdapter implements GoogleDocsAdapter {
  async exportSummaryNote(): Promise<SummaryNoteExportResult> {
    throw new Error(
      "Google Docs export is not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY to enable it.",
    );
  }
}

class ServiceAccountGoogleDocsAdapter implements GoogleDocsAdapter {
  constructor(
    private readonly serviceAccountEmail: string,
    private readonly privateKey: string,
    private readonly folderId: string | null,
  ) {}

  async exportSummaryNote(payload: SummaryNotePayload): Promise<SummaryNoteExportResult> {
    const accessToken = await this.getAccessToken();
    const title = `WardFlow Summary Note - ${payload.patientLabel} - ${payload.fileLabel}`;
    const createResponse = await fetch("https://docs.googleapis.com/v1/documents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title }),
    });

    if (!createResponse.ok) {
      throw new Error(`Failed to create Google Doc: ${await createResponse.text()}`);
    }

    const created = (await createResponse.json()) as { documentId: string };
    const requests = buildGoogleDocsRequests(payload);
    const batchResponse = await fetch(
      `https://docs.googleapis.com/v1/documents/${created.documentId}:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requests }),
      },
    );

    if (!batchResponse.ok) {
      throw new Error(`Failed to populate Google Doc: ${await batchResponse.text()}`);
    }

    if (this.folderId) {
      const moveResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${created.documentId}?addParents=${encodeURIComponent(
          this.folderId,
        )}&fields=id,webViewLink`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!moveResponse.ok) {
        throw new Error(`Failed to move Google Doc into folder: ${await moveResponse.text()}`);
      }
    }

    return {
      documentId: created.documentId,
      documentUrl: `https://docs.google.com/document/d/${created.documentId}/edit`,
      title,
    };
  }

  private async getAccessToken() {
    const now = Math.floor(Date.now() / 1000);
    const jwt = signJwt(
      {
        alg: "RS256",
        typ: "JWT",
      },
      {
        iss: this.serviceAccountEmail,
        scope: [
          "https://www.googleapis.com/auth/documents",
          "https://www.googleapis.com/auth/drive.file",
        ].join(" "),
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now,
      },
      this.privateKey,
    );

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to authenticate Google service account: ${await response.text()}`);
    }

    const body = (await response.json()) as { access_token: string };
    return body.access_token;
  }
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function signJwt(header: object, payload: object, privateKey: string) {
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${encodedHeader}.${encodedPayload}`);
  signer.end();

  const signature = signer.sign(privateKey);
  return `${encodedHeader}.${encodedPayload}.${base64UrlEncode(signature)}`;
}

type GoogleDocsRequest =
  | {
      insertText: {
        location: { index: number };
        text: string;
      };
    }
  | {
      updateParagraphStyle: {
        range: { startIndex: number; endIndex: number };
        paragraphStyle: { namedStyleType: string };
        fields: string;
      };
    }
  | {
      createParagraphBullets: {
        range: { startIndex: number; endIndex: number };
        bulletPreset: string;
      };
    };

function buildGoogleDocsRequests(payload: SummaryNotePayload): GoogleDocsRequest[] {
  const requests: GoogleDocsRequest[] = [];
  let cursor = 1;

  const insertParagraph = (text: string, namedStyleType?: string) => {
    const paragraph = `${text}\n`;
    const startIndex = cursor;
    const endIndex = startIndex + paragraph.length;
    requests.push({
      insertText: {
        location: { index: startIndex },
        text: paragraph,
      },
    });
    if (namedStyleType) {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex, endIndex },
          paragraphStyle: { namedStyleType },
          fields: "namedStyleType",
        },
      });
    }
    cursor = endIndex;
  };

  const insertBullets = (items: string[]) => {
    if (!items.length) return;
    const text = `${items.map((item) => item.trim()).join("\n")}\n`;
    const startIndex = cursor;
    const endIndex = startIndex + text.length;
    requests.push({
      insertText: {
        location: { index: startIndex },
        text,
      },
    });
    requests.push({
      createParagraphBullets: {
        range: { startIndex, endIndex: endIndex - 1 },
        bulletPreset: "BULLET_DISC_CIRCLE_SQUARE",
      },
    });
    cursor = endIndex;
  };

  const insertSection = (heading: string, items: string[]) => {
    insertParagraph(heading, "HEADING_2");
    insertBullets(items);
    insertParagraph("");
  };

  insertParagraph(payload.heading, "TITLE");
  insertParagraph("(Off Service Note / Summary Note)", "SUBTITLE");
  insertParagraph("");

  insertSection(payload.patientFacts.heading, payload.patientFacts.bullets);
  insertSection(payload.summaryDate.heading, payload.summaryDate.bullets);
  insertSection(payload.briefBackground.heading, payload.briefBackground.bullets);
  insertSection(payload.reasonForAdmission.heading, payload.reasonForAdmission.bullets);
  insertSection(payload.hospitalCourse.heading, payload.hospitalCourse.bullets);

  insertParagraph("Active Problem List", "HEADING_2");
  if (payload.activeProblems.length === 0) {
    insertBullets(["None"]);
  } else {
    for (const problem of payload.activeProblems) {
      insertParagraph(
        `${problem.problemName} [${labelForProblemPriority(problem.priority)} | ${labelForProblemDiagnosisStatus(problem.diagnosisStatus)}]`,
        "HEADING_3",
      );
      insertBullets([
        `Current Summary: ${problem.currentSummary.join(" | ")}`,
        `Latest Note: ${problem.latestNote.join(" | ")}`,
        `History: ${problem.history.join(" || ")}`,
        `Pending Tasks: ${problem.pendingTasks.join(" | ")}`,
      ]);
    }
  }
  insertParagraph("");

  insertSection("Resolved / Chronic Problems", payload.resolvedProblems);
  insertSection("Consultations", payload.consultations);
  insertSection("Pending Issues", payload.pendingIssues);
  insertSection("Suggested Plan", payload.suggestedPlan);
  insertSection("Safety Alerts", payload.safetyAlerts);
  insertSection("Tasks", payload.tasks);

  return requests;
}

function getGoogleDocsAdapter(): GoogleDocsAdapter {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() || null;

  if (!email || !privateKey) {
    return new PlaceholderGoogleDocsAdapter();
  }

  return new ServiceAccountGoogleDocsAdapter(email, privateKey, folderId);
}

export async function exportSummaryNoteToGoogleDocs(
  payload: SummaryNotePayload,
): Promise<SummaryNoteExportResult> {
  return getGoogleDocsAdapter().exportSummaryNote(payload);
}
