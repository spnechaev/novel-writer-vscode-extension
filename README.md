# novelWriter (VS Code Extension)

novelWriter helps authors manage a book project inside VS Code using Markdown files.

## Features

- Initialize a ready-to-use book workspace.
- Create entities (character, plotline, relationship, chapter, scene, editorial task, checklist).
- Open **Story Board**, **Writing Signals**, and **Relationship Graph** panels.
- Export manuscript to DOCX and PDF.
- Run language/style diagnostics for Markdown content.

## Requirements

- VS Code `^1.90.0`
- Node.js + npm (for local build/package)

## Install for development

1. Clone the repository.
2. Install dependencies:

```bash
npm install
```

3. Build extension:

```bash
npm run build
```

4. Press **F5** in VS Code to launch an Extension Development Host.

## How to use

Open a folder in VS Code, then run commands from Command Palette (`Cmd+Shift+P`):

- `novelWriter: Initialize Workspace`
  - Creates `book-project/` structure.
  - Opens `book-project/project.md`.
- `novelWriter: Create Entity`
  - Prompts entity type + title.
  - Creates a Markdown file with frontmatter.
  - For `scene`, adds service metadata fields and markup template:
    - What happens
    - Why this scene exists
    - POV character
    - What changes by the end
    - Related plotlines
- `novelWriter: Open Story Board`
  - Opens a panel with chapter/scene lanes.
  - Shows scene service metadata on cards and highlights missing fields.
- `novelWriter: Open Writing Signals`
  - Opens an analysis panel for missed details, loose ends, and focused editorial passes.
  - Includes tabs for forgotten details, loose ends, and passes: logic, rhythm, style, texture, repetition.
  - Lets you filter signals by severity and status.
  - Supports opening the source file directly from a signal card.
  - Supports marking a signal as `open`, `deferred`, `resolved`, or `ignored`.
- `novelWriter: Open Relationship Graph`
  - Opens relationship graph data view.
- `novelWriter: Export to DOCX`
  - Writes `book-project/exports/manuscript.docx`.
- `novelWriter: Export to PDF`
  - Writes `book-project/exports/manuscript.pdf`.

## Analysis signals and lightweight workflow

The extension now builds a lightweight analysis layer on top of project Markdown data.

### Scene fields used by analysis

For `scene` entities, the first version of the analyzer relies on these frontmatter fields:

- `sceneWhy`
- `sceneChange`
- `scenePov`
- `scenePlotlines`
- `refs`
- `status`

### Current signal types

The first version detects signals such as:

- missing scene purpose;
- missing scene change;
- missing POV;
- missing plotline links;
- scene without meaningful links;
- scene with low texture/material density;
- scene monotony when the same POV goes on for too long;
- repetition clusters inside a scene;
- dropped characters that disappear from recent scenes;
- plotline without progression;
- entity created but never mentioned;
- style filler-word clusters;
- repeated punctuation clusters;
- spaces before punctuation;
- editorial task without links;
- relationship not integrated into the project.

### Style integration

The analyzer now reuses lightweight language checks from [`LanguageDiagnostics`](src/diagnostics/languageDiagnostics.ts:6) through [`analyzeMarkdownText()`](src/diagnostics/languageDiagnostics.ts:43).

That means the `style` pass in **Writing Signals** can surface:

- filler words;
- repeated punctuation;
- spacing before punctuation.

This keeps the style pass tied to real text diagnostics instead of inventing a second competing system, because one bureaucratic hydra is already more than enough.

### Persisted signal statuses

Signal state is stored in frontmatter so the author does not have to fight the same warnings forever.

- `analysisIgnore` — hide specific signal kinds entirely for an entity.
- `analysisSignals` — persist signal status per kind:
  - `open`
  - `deferred`
  - `resolved`
  - `ignored`

Example:

```yaml
analysisIgnore:
  - missing-scene-plotlines
analysisSignals:
  missing-scene-purpose: deferred
  missing-scene-change: resolved
```

This keeps the workflow practical: the extension points at structural trouble, and the author decides whether it is a real problem or just another beautiful false alarm in human form.

## Project structure generated after initialization

```text
book-project/
  project.md
  .bookmeta/schema-version.md
  characters/
  plotlines/
  relationships/
  chapters/
  editorial/tasks/
  editorial/checklists/
```

## Build commands

- `npm run build` — compile TypeScript
- `npm run watch` — compile in watch mode
- `npm run lint` — run ESLint

## License

MIT (see [LICENSE](LICENSE)).
