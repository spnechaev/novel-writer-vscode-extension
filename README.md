# novelWriter (VS Code Extension)

novelWriter helps authors manage a book project inside VS Code using Markdown files.

## Features

- Initialize a ready-to-use book workspace.
- Create entities (character, plotline, relationship, chapter, scene, editorial task, checklist).
- Open **Story Board** and **Relationship Graph** panels.
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
- `novelWriter: Open Relationship Graph`
  - Opens relationship graph data view.
- `novelWriter: Export to DOCX`
  - Writes `book-project/exports/manuscript.docx`.
- `novelWriter: Export to PDF`
  - Writes `book-project/exports/manuscript.pdf`.

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
