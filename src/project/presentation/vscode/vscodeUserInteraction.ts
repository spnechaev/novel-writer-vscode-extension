import * as vscode from "vscode";
import type { UserInteractionPort, EntityTypeOption } from "../../application/ports/userInteractionPort";

export class VscodeUserInteraction implements UserInteractionPort {
  async pickEntityType(options: EntityTypeOption[]): Promise<EntityTypeOption["value"] | undefined> {
    const items: Array<vscode.QuickPickItem & { value: EntityTypeOption["value"] }> = options.map((option) => ({
      label: option.label,
      value: option.value
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: "Select entity type"
    });

    return selected?.value;
  }

  async inputEntityTitle(): Promise<string | undefined> {
    return vscode.window.showInputBox({
      title: "Entity title",
      prompt: "Enter title",
      validateInput: (value) => (value.trim() ? undefined : "Title is required")
    });
  }

  async openCreatedEntity(filePath: string): Promise<void> {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
    await vscode.window.showTextDocument(doc, { preview: false });
  }
}
