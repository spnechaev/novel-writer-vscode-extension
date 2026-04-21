import * as path from "node:path";
import * as vscode from "vscode";
import { PROJECT_PATHS } from "../../../project/infrastructure/config/projectPaths";
import type { TypographyConfig } from "../../application/types/exportTypes";

export class FileTypographyConfigRepository {
  constructor(private readonly workspaceRoot: string) {}

  async read(): Promise<TypographyConfig> {
    const defaults: TypographyConfig = {
      bodyFontFamily: "Times New Roman",
      bodyFontSizePt: 12
    };

    const configUri = vscode.Uri.file(path.join(this.workspaceRoot, PROJECT_PATHS.exportTypographyConfig));
    try {
      const content = Buffer.from(await vscode.workspace.fs.readFile(configUri)).toString("utf8");
      const parsed = JSON.parse(content) as Partial<TypographyConfig>;
      const bodyFontFamily =
        typeof parsed.bodyFontFamily === "string" && parsed.bodyFontFamily.trim()
          ? parsed.bodyFontFamily.trim()
          : defaults.bodyFontFamily;
      const bodyFontSizePtRaw = Number(parsed.bodyFontSizePt);
      const bodyFontSizePt = Number.isFinite(bodyFontSizePtRaw) && bodyFontSizePtRaw >= 6 && bodyFontSizePtRaw <= 48
        ? bodyFontSizePtRaw
        : defaults.bodyFontSizePt;

      return { bodyFontFamily, bodyFontSizePt };
    } catch {
      return defaults;
    }
  }
}
