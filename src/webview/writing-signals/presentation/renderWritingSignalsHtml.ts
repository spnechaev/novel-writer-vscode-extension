import { buildAnalysisViewModel } from "../../analysis/buildAnalysisViewModel";

export function renderWritingSignalsHtml(data: string, stylesheetUri = ""): string {
  const analysis = buildAnalysisViewModel(data);
  const analysisData = JSON.stringify(analysis);

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    ${stylesheetUri ? `<link rel="stylesheet" href="${stylesheetUri}" />` : ""}
  </head>
  <body>
    <section class="header">
      <div>
        <h2 class="title">Writing Signals</h2>
        <p class="subtitle">Один экран, где видно, что забыто, что висит хвостом и в какой редакторский проход лучше влезть прямо сейчас.</p>
      </div>
      <div class="stats">
        <span class="pill">Сущностей: ${analysis.summary.entityCount}</span>
        <span class="pill">Сцен: ${analysis.summary.sceneCount}</span>
        <span class="pill">Сигналов: ${analysis.summary.signalCount}</span>
        <span class="pill">Критичных: ${analysis.summary.criticalCount}</span>
        <span class="pill">Предупреждений: ${analysis.summary.warningCount}</span>
      </div>
    </section>

    <section class="toolbar">
      <div id="tabs" class="tabs"></div>
      <div class="toolbar-row">
        <span class="toolbar-label">Серьёзность</span>
        <div id="filters" class="filters"></div>
      </div>
      <div class="toolbar-row">
        <span class="toolbar-label">Статус сигнала</span>
        <div id="statusFilters" class="status-filters"></div>
      </div>
    </section>

    <section id="cards" class="cards"></section>
    <section id="empty" class="empty" hidden>Для выбранного режима сигналов пока нет. Редкий случай: либо вы всё подчистили, либо текст ещё не успел наделать долгов.</section>

    <script>
      const vscode = acquireVsCodeApi();
      const analysis = ${analysisData};
      let activeTab = 'forgotten';
      let activeSeverity = 'all';
      let activeStatus = 'open';

      const cardsEl = document.getElementById('cards');
      const emptyEl = document.getElementById('empty');
      const tabsEl = document.getElementById('tabs');
      const filtersEl = document.getElementById('filters');
      const statusFiltersEl = document.getElementById('statusFilters');

      renderTabs();
      renderFilters();
      renderStatusFilters();
      renderCards();

      window.addEventListener('message', (event) => {
        const message = event.data || {};
        if (message.type !== 'signalStatusSaved') {
          return;
        }

        const signal = analysis.signals.find((item) => item.id === message.signalId);
        if (!signal) {
          return;
        }

        signal.status = message.status;
        renderCards();
      });

      function renderTabs() {
        tabsEl.innerHTML = analysis.tabs
          .map((tab) => {
            const active = tab.id === activeTab ? 'active' : '';
            return '<button class="tab-btn ' + active + '" type="button" data-tab="' + tab.id + '">' + escapeHtml(tab.label) + ' (' + tab.count + ')</button>';
          })
          .join('');

        tabsEl.querySelectorAll('[data-tab]').forEach((button) => {
          button.addEventListener('click', () => {
            activeTab = button.getAttribute('data-tab') || 'forgotten';
            renderTabs();
            renderCards();
          });
        });
      }

      function renderFilters() {
        const filters = [
          { id: 'all', label: 'Все' },
          { id: 'critical', label: 'Критично' },
          { id: 'warning', label: 'Предупреждения' },
          { id: 'info', label: 'Инфо' }
        ];

        filtersEl.innerHTML = filters
          .map((filter) => {
            const active = filter.id === activeSeverity ? 'active' : '';
            return '<button class="filter-btn ' + active + '" type="button" data-severity="' + filter.id + '">' + escapeHtml(filter.label) + '</button>';
          })
          .join('');

        filtersEl.querySelectorAll('[data-severity]').forEach((button) => {
          button.addEventListener('click', () => {
            activeSeverity = button.getAttribute('data-severity') || 'all';
            renderFilters();
            renderCards();
          });
        });
      }

      function renderStatusFilters() {
        const filters = [
          { id: 'open', label: 'Открытые' },
          { id: 'deferred', label: 'Отложенные' },
          { id: 'resolved', label: 'Закрытые' },
          { id: 'ignored', label: 'Игнор' },
          { id: 'all', label: 'Все статусы' }
        ];

        statusFiltersEl.innerHTML = filters
          .map((filter) => {
            const active = filter.id === activeStatus ? 'active' : '';
            return '<button class="filter-btn ' + active + '" type="button" data-status-filter="' + filter.id + '">' + escapeHtml(filter.label) + '</button>';
          })
          .join('');

        statusFiltersEl.querySelectorAll('[data-status-filter]').forEach((button) => {
          button.addEventListener('click', () => {
            activeStatus = button.getAttribute('data-status-filter') || 'open';
            renderStatusFilters();
            renderCards();
          });
        });
      }

      function renderCards() {
        const visibleSignals = analysis.signals.filter((signal) => matchesTab(signal) && matchesSeverity(signal) && matchesStatus(signal));

        if (!visibleSignals.length) {
          cardsEl.innerHTML = '';
          emptyEl.hidden = false;
          return;
        }

        emptyEl.hidden = true;
        cardsEl.innerHTML = visibleSignals
          .map((signal) => {
            const passes = (signal.passes || []).map((pass) => '<span class="pass">' + escapeHtml(renderPassLabel(pass)) + '</span>').join('');
            const encodedPath = encodeURIComponent(String(signal.filePath || ''));
            return (
              '<article class="card ' + escapeHtml(signal.severity) + '">' +
                '<div class="card-top">' +
                  '<h3 class="card-title">' + escapeHtml(signal.title) + '</h3>' +
                  '<span class="badge group-' + escapeHtml(signal.group) + '">' + escapeHtml(renderGroupLabel(signal.group)) + '</span>' +
                '</div>' +
                '<div class="card-meta">' +
                  '<span class="badge">' + escapeHtml(renderSeverityLabel(signal.severity)) + '</span>' +
                  '<span class="badge">Статус: ' + escapeHtml(signal.status) + '</span>' +
                  passes +
                '</div>' +
                '<p class="card-text">' + escapeHtml(signal.description) + '</p>' +
                '<p class="card-action-text">Что сделать: ' + escapeHtml(signal.suggestedAction) + '</p>' +
                '<div class="file">' + escapeHtml(signal.filePath) + '</div>' +
                '<div class="card-actions">' +
                  '<button class="open-btn" type="button" data-file-path="' + encodedPath + '">Открыть файл</button>' +
                  renderStatusButtons(signal) +
                '</div>' +
              '</article>'
            );
          })
          .join('');

        cardsEl.querySelectorAll('[data-file-path]').forEach((button) => {
          button.addEventListener('click', () => {
            const filePath = decodeURIComponent(button.getAttribute('data-file-path') || '');
            if (!filePath) {
              return;
            }
            vscode.postMessage({ type: 'openEntity', filePath });
          });
        });

        cardsEl.querySelectorAll('[data-signal-status]').forEach((button) => {
          button.addEventListener('click', () => {
            const signalId = button.getAttribute('data-signal-id') || '';
            const signalStatus = button.getAttribute('data-signal-status') || 'open';
            const signal = analysis.signals.find((item) => item.id === signalId);
            if (!signal) {
              return;
            }

            signal.status = signalStatus;
            vscode.postMessage({
              type: 'setSignalStatus',
              signalId: signal.id,
              filePath: signal.filePath,
              signalKind: signal.kind,
              status: signalStatus
            });
            renderCards();
          });
        });
      }

      function matchesTab(signal) {
        if (activeTab === 'forgotten') return signal.group === 'forgotten';
        if (activeTab === 'looseEnd') return signal.group === 'looseEnd';
        return Array.isArray(signal.passes) && signal.passes.includes(activeTab);
      }

      function matchesSeverity(signal) {
        return activeSeverity === 'all' ? true : signal.severity === activeSeverity;
      }

      function matchesStatus(signal) {
        return activeStatus === 'all' ? true : signal.status === activeStatus;
      }

      function renderStatusButtons(signal) {
        const statuses = [
          { id: 'open', label: 'Открыт' },
          { id: 'deferred', label: 'Отложить' },
          { id: 'resolved', label: 'Закрыть' },
          { id: 'ignored', label: 'Игнор' }
        ];

        return statuses
          .map((status) => {
            const active = signal.status === status.id ? 'active' : '';
            return '<button class="status-btn ' + active + '" type="button" data-signal-id="' + escapeHtml(signal.id) + '" data-signal-status="' + status.id + '">' + escapeHtml(status.label) + '</button>';
          })
          .join('');
      }

      function renderGroupLabel(group) {
        if (group === 'forgotten') return 'Забытое';
        if (group === 'looseEnd') return 'Хвост';
        return group;
      }

      function renderPassLabel(pass) {
        if (pass === 'logic') return 'Логика';
        if (pass === 'rhythm') return 'Ритм';
        if (pass === 'style') return 'Стиль';
        if (pass === 'texture') return 'Фактура';
        if (pass === 'repetition') return 'Повторы';
        return pass;
      }

      function renderSeverityLabel(severity) {
        if (severity === 'critical') return 'Критично';
        if (severity === 'warning') return 'Предупреждение';
        return 'Инфо';
      }

      function escapeHtml(value) {
        return String(value)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;');
      }
    </script>
  </body>
</html>`;
}
