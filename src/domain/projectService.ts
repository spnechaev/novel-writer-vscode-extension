import * as vscode from "vscode";
import { MarkdownRepository } from "../storage/markdownRepository";
import { EntityType } from "../types";

export class ProjectService {
  constructor(private readonly repository: MarkdownRepository) {}

  async initializeWorkspace(): Promise<void> {
    await this.repository.initializeProject();
  }

  async createEntityInteractive(): Promise<void> {
    const typeItems: Array<vscode.QuickPickItem & { value: EntityType }> = [
      { label: "Character", value: "character" },
      { label: "Plotline", value: "plotline" },
      { label: "Relationship", value: "relationship" },
      { label: "Chapter", value: "chapter" },
      { label: "Scene", value: "scene" },
      { label: "Editorial Task", value: "editorialTask" },
      { label: "Checklist", value: "checklist" }
    ];

    const selected = await vscode.window.showQuickPick(typeItems, {
      placeHolder: "Select entity type"
    });

    if (!selected) {
      return;
    }

    const title = await vscode.window.showInputBox({
      title: "Entity title",
      prompt: "Enter title",
      validateInput: (value) => (value.trim() ? undefined : "Title is required")
    });

    if (!title) {
      return;
    }

    const uri = await this.repository.createEntity(selected.value, title.trim());
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: false });
  }

  async getIndexJson(): Promise<string> {
    const index = await this.repository.readIndex();
    return JSON.stringify(index, null, 2);
  }
}
