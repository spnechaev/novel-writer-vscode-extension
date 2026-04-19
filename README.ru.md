# novelWriter (расширение VS Code)

novelWriter помогает писателям вести книжный проект в VS Code на базе Markdown-файлов.

## Возможности

- Инициализация готового рабочего пространства книги.
- Создание сущностей (персонаж, сюжетная линия, отношение, глава, сцена, редакторская задача, чеклист).
- Панели **Story Board** и **Relationship Graph**.
- Экспорт рукописи в DOCX и PDF.
- Языковые/стилистические диагностики для Markdown.

## Требования

- VS Code `^1.90.0`
- Node.js + npm (для локальной сборки/упаковки)

## Установка для разработки

1. Клонируйте репозиторий.
2. Установите зависимости:

```bash
npm install
```

3. Соберите расширение:

```bash
npm run build
```

4. Нажмите **F5** в VS Code, чтобы открыть Extension Development Host.

## Как пользоваться

Откройте папку в VS Code и вызывайте команды через Command Palette (`Cmd+Shift+P`):

- `novelWriter: Initialize Workspace`
  - Создаёт структуру `book-project/`.
  - Открывает `book-project/project.md`.
- `novelWriter: Create Entity`
  - Запрашивает тип сущности и заголовок.
  - Создаёт Markdown-файл с frontmatter.
  - Для сцены добавляет служебные поля и шаблон разметки:
    - Что происходит
    - Зачем нужна
    - Чьими глазами
    - Что меняется к концу сцены
    - К каким линиям относится
- `novelWriter: Open Story Board`
  - Открывает панель с дорожками глав и сцен.
  - На карточках сцен показывает служебную информацию и подсвечивает незаполненные поля.
- `novelWriter: Open Relationship Graph`
  - Открывает представление данных графа связей.
- `novelWriter: Export to DOCX`
  - Записывает `book-project/exports/manuscript.docx`.
- `novelWriter: Export to PDF`
  - Записывает `book-project/exports/manuscript.pdf`.

## Структура проекта после инициализации

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

## Команды сборки

- `npm run build` — компиляция TypeScript
- `npm run watch` — компиляция в watch-режиме
- `npm run lint` — запуск ESLint

## Лицензия

MIT (см. [LICENSE](LICENSE)).
