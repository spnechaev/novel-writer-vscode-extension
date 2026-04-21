# AGENTS

## Назначение

Этот документ фиксирует правила работы с кодовой базой расширения и описывает, где что лежит, куда добавлять новую функциональность и как не превратить проект обратно в один большой героический комок.

Базовый принцип: код раскладывается по контекстам и слоям, а зависимости направляются внутрь.

Целевое направление зависимостей:

- `presentation -> application -> domain`
- `infrastructure -> application/domain` через адаптеры и реализации портов
- `domain` не зависит от [`vscode`](package.json), [`docx`](package.json), [`pdfkit`](package.json), [`gray-matter`](package.json) и прочих внешних библиотек

## Структура проекта

### Корень проекта

- [`src/`](src) — основной исходный код расширения
- [`test/`](test) — тесты Node test runner
- [`plans/`](plans) — архитектурные и миграционные планы
- [`package.json`](package.json) — скрипты, зависимости, manifest расширения
- [`tsconfig.json`](tsconfig.json) — конфигурация TypeScript
- [`AGENTS.md`](AGENTS.md) — этот документ

## Что лежит в [`src/`](src)

### [`src/extension.ts`](src/extension.ts)

Только тонкая точка входа VS Code extension.

Сюда можно добавлять:
- минимальный bootstrap вызов

Сюда нельзя добавлять:
- бизнес-логику
- файловую логику
- HTML webview
- анализ проекта
- экспорт

Если код начинает разрастаться — значит он должен уехать в [`src/bootstrap/`](src/bootstrap).

### [`src/bootstrap/`](src/bootstrap)

Слой сборки зависимостей и регистрации runtime-интеграций.

Текущие файлы:
- [`compositionRoot.ts`](src/bootstrap/compositionRoot.ts) — создание object graph
- [`registerCommands.ts`](src/bootstrap/registerCommands.ts) — регистрация команд
- [`registerSubscriptions.ts`](src/bootstrap/registerSubscriptions.ts) — подписки на события workspace и lifecycle

Добавлять сюда:
- wiring зависимостей
- регистрацию новых команд и подписок
- создание адаптеров и сервисов на старте extension

Не добавлять сюда:
- доменные правила
- алгоритмы анализа
- HTML/рендеринг

### [`src/project/`](src/project)

Контекст проектных сущностей книги и работы с проектом.

#### [`src/project/domain/`](src/project/domain)

Проектные типы и чистые модели проекта.

Сейчас:
- [`projectTypes.ts`](src/project/domain/types/projectTypes.ts)

Сюда добавлять:
- типы сущностей проекта
- value objects
- чистые доменные интерфейсы репозиториев

#### [`src/project/application/`](src/project/application)

Use cases проекта.

Сейчас:
- [`projectApplicationService.ts`](src/project/application/services/projectApplicationService.ts)
- [`userInteractionPort.ts`](src/project/application/ports/userInteractionPort.ts)

Сюда добавлять:
- сценарии `initialize project`, `create entity`, `load project index`
- application services
- команды и запросы
- DTO и порты

#### [`src/project/infrastructure/`](src/project/infrastructure)

Реализации доступа к файлам и конфигу проекта.

Сейчас:
- [`fileSystemProjectRepository.ts`](src/project/infrastructure/persistence/fileSystemProjectRepository.ts)
- [`projectPaths.ts`](src/project/infrastructure/config/projectPaths.ts)

Сюда добавлять:
- файловые репозитории
- YAML/Markdown/JSON persistence
- шаблоны файлов и конфигов

#### [`src/project/presentation/`](src/project/presentation)

Адаптеры пользовательского взаимодействия.

Сейчас:
- [`vscodeUserInteraction.ts`](src/project/presentation/vscode/vscodeUserInteraction.ts)

Сюда добавлять:
- `showQuickPick`, `showInputBox`, `showTextDocument`
- прочие VS Code presentation adapters

### [`src/analysis/`](src/analysis)

Контекст аналитики текста и сигналов.

#### [`src/analysis/domain/`](src/analysis/domain)

Типы и доменные сервисы анализа.

Сейчас:
- [`analysisTypes.ts`](src/analysis/domain/types/analysisTypes.ts)
- [`projectAnalyzer.ts`](src/analysis/domain/services/projectAnalyzer.ts)

Добавлять сюда:
- доменные типы сигналов
- чистые правила анализа
- rule-модули

#### [`src/analysis/application/`](src/analysis/application)

Порты и use cases анализа.

Сейчас:
- [`textDiagnosticsPort.ts`](src/analysis/application/ports/textDiagnosticsPort.ts)

Добавлять сюда:
- команды смены статуса сигнала
- запросы получения анализа
- порты для внешних анализаторов

#### [`src/analysis/infrastructure/`](src/analysis/infrastructure)

Адаптеры к внешним инструментам анализа.

Сейчас:
- [`languageDiagnosticsAdapter.ts`](src/analysis/infrastructure/diagnostics/languageDiagnosticsAdapter.ts)

Добавлять сюда:
- адаптеры к text diagnostics
- интеграции с внешними анализаторами

### [`src/export/`](src/export)

Контекст экспорта рукописи.

#### [`src/export/application/`](src/export/application)

Сценарии построения данных для экспорта.

Сейчас:
- [`buildOrderedManuscript.ts`](src/export/application/queries/buildOrderedManuscript.ts)
- [`exportTypes.ts`](src/export/application/types/exportTypes.ts)

Сюда добавлять:
- команды/queries для подготовки manuscript
- DTO и типы render pipeline

#### [`src/export/infrastructure/`](src/export/infrastructure)

Рендереры и файловые реализации экспорта.

Сейчас:
- [`fileTypographyConfigRepository.ts`](src/export/infrastructure/config/fileTypographyConfigRepository.ts)
- [`markdownBlockRenderer.ts`](src/export/infrastructure/renderers/markdownBlockRenderer.ts)
- [`docxRenderer.ts`](src/export/infrastructure/renderers/docxRenderer.ts)
- [`pdfRenderer.ts`](src/export/infrastructure/renderers/pdfRenderer.ts)

Сюда добавлять:
- renderers для новых форматов
- readers конфигов типографики
- writers для файлов экспорта

#### [`src/export/exportService.ts`](src/export/exportService.ts)

Тонкий orchestration layer для экспорта.

Сюда можно добавлять:
- координацию существующих use case / renderer / writer модулей

Сюда нельзя добавлять:
- длинные алгоритмы парсинга markdown
- low-level PDF/DOCX rendering прямо внутри класса

### [`src/webview/`](src/webview)

Контекст webview UI.

#### [`src/webview/panelProvider.ts`](src/webview/panelProvider.ts)

Только orchestration панелей и связывание message handlers.

Сюда можно добавлять:
- создание новых `WebviewPanel`
- вызовы feature-specific renderers
- routing входящих сообщений

Сюда нельзя добавлять:
- большие HTML template strings
- тяжёлую трансформацию данных
- парсинг доменных сущностей

#### [`src/webview/board/`](src/webview/board)

Storyboard UI.

Сейчас:
- [`boardTypes.ts`](src/webview/board/boardTypes.ts)
- [`renderBoardHtml.ts`](src/webview/board/presentation/renderBoardHtml.ts)

Добавлять сюда:
- всё, что относится только к board-панели

#### [`src/webview/writing-signals/`](src/webview/writing-signals)

UI панели сигналов.

Сейчас:
- [`renderWritingSignalsHtml.ts`](src/webview/writing-signals/presentation/renderWritingSignalsHtml.ts)

Добавлять сюда:
- HTML/JS для панели сигналов
- feature-specific UI helpers

#### [`src/webview/graph/`](src/webview/graph)

Парсеры и logic-хелперы для relationship graph.

Сейчас:
- [`relationshipParser.ts`](src/webview/graph/relationshipParser.ts)

Если появится полноценная graph-панель, её presentation-код надо класть в отдельную подпапку по аналогии с board/signals.

#### [`src/webview/shared/`](src/webview/shared)

Только реально общие webview helpers.

Сейчас:
- [`html.ts`](src/webview/shared/html.ts)
- [`sceneMeta.ts`](src/webview/shared/sceneMeta.ts)
- [`openEntityMessageBinder.ts`](src/webview/shared/openEntityMessageBinder.ts)
- [`webviewAssets.ts`](src/webview/shared/webviewAssets.ts)

Правило: если helper используется одной панелью — держать его рядом с этой панелью, а не тащить в `shared` ради красивой общей помойки.

### [`src/diagnostics/`](src/diagnostics)

VS Code diagnostics integration.

Сейчас:
- [`languageDiagnostics.ts`](src/diagnostics/languageDiagnostics.ts)

Сюда добавлять:
- lifecycle-интеграцию с VS Code diagnostics
- text diagnostic rules, если они являются частью editor diagnostics

Но если эта логика нужна application/domain-слою, она должна быть доступна через порт в [`src/analysis/application/`](src/analysis/application).

## Куда добавлять новую функциональность

### Если добавляется новая команда VS Code

1. Зарегистрировать команду в [`package.json`](package.json)
2. Зарегистрировать handler в [`src/bootstrap/registerCommands.ts`](src/bootstrap/registerCommands.ts)
3. Вынести сценарий в соответствующий `application`-слой
4. При необходимости подключить через [`createExtensionComposition()`](src/bootstrap/compositionRoot.ts:15)

### Если добавляется новая проектная операция

Примеры: создать сущность, обновить frontmatter, построить индекс, добавить шаблон.

Класть в:
- доменные типы → [`src/project/domain/`](src/project/domain)
- use case → [`src/project/application/`](src/project/application)
- файловая реализация → [`src/project/infrastructure/`](src/project/infrastructure)
- VS Code UI/adapters → [`src/project/presentation/`](src/project/presentation)

### Если добавляется новое аналитическое правило

Класть в:
- типы и rule logic → [`src/analysis/domain/`](src/analysis/domain)
- порты для зависимостей → [`src/analysis/application/`](src/analysis/application)
- адаптеры к внешним анализаторам → [`src/analysis/infrastructure/`](src/analysis/infrastructure)

Не тянуть внутрь правила `vscode` API.

### Если добавляется новый формат экспорта

Класть в:
- pipeline/use case → [`src/export/application/`](src/export/application)
- renderer/writer → [`src/export/infrastructure/`](src/export/infrastructure)
- orchestration вызов → [`ExportService`](src/export/exportService.ts:8)

Новый формат не должен превращать [`ExportService`](src/export/exportService.ts:8) обратно в 400 строк техно-каши.

### Если добавляется новая webview-панель

Создать новую feature-папку в [`src/webview/`](src/webview), например:

```text
src/webview/my-feature/
  presentation/
    renderMyFeatureHtml.ts
```

Дальше:
1. Создать renderer HTML рядом с feature
2. Если нужны helpers — держать их в той же feature-папке
3. В [`PanelProvider`](src/webview/panelProvider.ts:9) добавить только создание панели и связывание с renderer
4. Общие message binder / assets выносить в [`src/webview/shared/`](src/webview/shared) только если они реально переиспользуются

## Как добавлять код правильно

### 1. Сначала определить контекст

Перед добавлением файла ответить на вопрос:

- это `project`?
- это `analysis`?
- это `export`?
- это `webview`?
- это `bootstrap`?

Если ответ звучит как «ну оно вроде везде нужно» — это обычно либо маленький utility, либо начало архитектурной ошибки.

### 2. Потом определить слой

- `domain` — чистые сущности, типы, правила
- `application` — use cases, orchestration, ports, DTO
- `infrastructure` — файловая система, внешние библиотеки, persistence, adapters
- `presentation` — VS Code UI, webview HTML, интеракции с пользователем

### 3. Не делать god objects

Запрещённый стиль:
- один класс знает про VS Code, файловую систему, JSON, Markdown, HTML, PDF и смысл жизни персонажа

Если файл начинает делать слишком много — резать по обязанностям.

### 4. Не плодить новый `shared` без причины

`shared` нужен только для реально общих вещей.

Если helper используется в одном месте, он должен жить рядом с feature.

### 5. Сначала порты, потом адаптеры

Если `application` или `domain` зависит от внешнего мира:

1. описать порт
2. реализовать адаптер в infrastructure/presentation
3. подключить в bootstrap

## Правила импортов

Разрешённые направления:

- feature presentation может импортировать свой application/domain/shared
- application может импортировать свой domain и shared
- infrastructure может импортировать domain/application/shared
- bootstrap может импортировать всё, потому что он composition root

Нежелательно:

- `domain` -> `vscode`
- `domain` -> `pdfkit/docx/gray-matter`
- один infrastructure-контекст лезет напрямую во внутренности другого infrastructure-контекста

## Правила для тестов

- Тесты лежат в [`test/`](test)
- Для новых feature-модулей добавлять отдельные тесты, а не только интеграционные комбайны
- При рефакторинге можно временно сохранять compatibility API, если тесты ещё опираются на старый контракт
- После стабилизации следующий шаг — постепенно переводить тесты на новые entrypoints

## Минимальный алгоритм добавления новой функциональности

1. Определить контекст и слой
2. Создать доменные типы/DTO, если нужны
3. Создать use case или renderer в правильной папке
4. Создать порт и адаптер, если есть зависимость от VS Code/FS/внешней библиотеки
5. Подключить всё через [`src/bootstrap/compositionRoot.ts`](src/bootstrap/compositionRoot.ts)
6. Зарегистрировать команду/панель/подписку при необходимости
7. Добавить тест
8. Прогнать `npm run build` и `npm test` из [`package.json`](package.json)

## Что не делать

- не складывать новые большие типы обратно в [`src/types.ts`](src/types.ts)
- не класть новую business logic в [`src/extension.ts`](src/extension.ts)
- не раздувать [`PanelProvider`](src/webview/panelProvider.ts:9) и [`ExportService`](src/export/exportService.ts:8)
- не выносить всё подряд в `shared`, потому что так якобы аккуратнее

## Если сомневаетесь, куда класть код

Выбирать по правилу:

- ближе к feature, если код специфичен
- ближе к слою, если код определяет архитектурную роль
- в `shared` только если есть реальное повторное использование минимум в двух независимых местах

Иначе проект снова поползёт к старой доброй свалке, а мы её уже один раз цивилизовали, второй раз будет просто обидно.
