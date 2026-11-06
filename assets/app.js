/* Бумажный список задач.
   Без внешних зависимостей, без innerHTML для пользовательских данных,
   состояние — только в localStorage этого браузера. */
(() => {
  "use strict";

  const KEY = "todo.paper.v1";
  const THEME_KEY = "todo.paper.theme";
  const MAX_LEN = 200;

  const $ = (sel) => document.querySelector(sel);
  const list = $("#list");
  const form = $("#add-form");
  const input = $("#new-task");
  const empty = $("#empty");
  const emptyText = $("#empty-text");
  const counter = $("#counter");
  const announce = $("#announce");
  const tpl = $("#item-tpl");
  const themeBtn = $("#theme");
  const themeIcon = $("#theme-icon");
  const clearBtn = $("#clear-done");

  let state = { tasks: [], filter: "all" };
  let nextId = 1;

  /* ---------- хранилище ---------- */
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.tasks)) return;
      state.tasks = data.tasks
        .filter((t) => t && typeof t.text === "string")
        .slice(0, 500)
        .map((t) => ({
          id: String(t.id || nextId++),
          text: t.text.slice(0, MAX_LEN),
          done: Boolean(t.done),
          created: Number(t.created) || Date.now(),
        }));
      state.filter = ["all", "active", "done"].includes(data.filter) ? data.filter : "all";
    } catch (err) {
      /* битые данные не должны ломать страницу */
      state.tasks = [];
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ tasks: state.tasks, filter: state.filter }));
    } catch (err) {
      announce_(err && err.name === "QuotaExceededError"
        ? "Хранилище заполнено, задача не сохранена"
        : "Не удалось сохранить");
    }
  }

  /* ---------- утилиты ---------- */
  function announce_(msg) {
    announce.textContent = "";
    /* повторный текст должен озвучиваться заново */
    requestAnimationFrame(() => { announce.textContent = msg; });
  }

  const plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  };

  function visibleTasks() {
    if (state.filter === "active") return state.tasks.filter((t) => !t.done);
    if (state.filter === "done") return state.tasks.filter((t) => t.done);
    return state.tasks;
  }

  /* ---------- отрисовка ---------- */
  function render() {
    const shown = visibleTasks();
    list.textContent = "";

    for (const task of shown) {
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.dataset.id = task.id;
      node.classList.toggle("is-done", task.done);

      const text = node.querySelector(".task__text");
      text.textContent = task.text;          /* только textContent — XSS закрыт */
      text.setAttribute("title", "Двойной клик — изменить");

      const check = node.querySelector(".task__check");
      check.setAttribute("aria-pressed", String(task.done));
      check.querySelector(".visually-hidden").textContent =
        task.done ? "Снять отметку" : "Отметить выполненной";

      list.append(node);
    }

    empty.hidden = shown.length !== 0;
    if (state.tasks.length === 0) {
      emptyText.textContent = "Пока пусто. Запишите первую задачу.";
    } else if (shown.length === 0) {
      emptyText.textContent = state.filter === "done"
        ? "Готовых задач пока нет."
        : "Все задачи выполнены.";
    }

    const left = state.tasks.filter((t) => !t.done).length;
    counter.textContent = state.tasks.length === 0
      ? "0 задач"
      : `${left} ${plural(left, "активная", "активные", "активных")} · всего ${state.tasks.length}`;
  }

  /* ---------- действия ---------- */
  function addTask(text) {
    const clean = text.trim().replace(/\s+/g, " ").slice(0, MAX_LEN);
    if (!clean) return false;
    state.tasks.unshift({
      id: String(nextId++),
      text: clean,
      done: false,
      created: Date.now(),
    });
    save();
    render();
    announce_(`Добавлено: ${clean}`);
    return true;
  }

  function toggleTask(id) {
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;
    task.done = !task.done;
    save();
    render();
    announce_(task.done ? `Выполнено: ${task.text}` : `Снова активна: ${task.text}`);
  }

  function removeTask(id) {
    const idx = state.tasks.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const [task] = state.tasks.splice(idx, 1);
    save();
    render();
    announce_(`Удалено: ${task.text}`);
  }

  function editTask(id, text) {
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;
    const clean = text.trim().replace(/\s+/g, " ").slice(0, MAX_LEN);
    if (!clean) { removeTask(id); return; }
    task.text = clean;
    save();
    render();
    announce_(`Изменено: ${clean}`);
  }

  /* ---------- события ---------- */
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (addTask(input.value)) {
      input.value = "";
      input.focus();
    }
  });

  list.addEventListener("click", (e) => {
    const node = e.target.closest(".task");
    if (!node) return;
    if (e.target.closest(".task__check")) {
      toggleTask(node.dataset.id);
      return;
    }
    if (e.target.closest(".task__del")) {
      node.classList.add("is-removing");
      const id = node.dataset.id;
      setTimeout(() => removeTask(id), 120);
    }
  });

  /* двойной клик по тексту — правка через contenteditable без вставки HTML */
  list.addEventListener("dblclick", (e) => {
    const textEl = e.target.closest(".task__text");
    if (!textEl) return;
    const node = textEl.closest(".task");
    textEl.contentEditable = "plaintext-only";
    textEl.focus();
    const stop = () => {
      textEl.contentEditable = "false";
      editTask(node.dataset.id, textEl.textContent || "");
      textEl.removeEventListener("blur", stop);
    };
    textEl.addEventListener("blur", stop);
    textEl.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") { ev.preventDefault(); textEl.blur(); }
      if (ev.key === "Escape") { textEl.textContent = ""; textEl.blur(); }
    });
  });

  /* клавиатура: стрелки, Space, Delete */
  list.addEventListener("keydown", (e) => {
    const textEl = e.target.closest(".task__text");
    if (!textEl) return;
    const node = textEl.closest(".task");
    const items = [...list.querySelectorAll(".task__text")];
    const i = items.indexOf(textEl);

    if (e.key === "ArrowDown" && items[i + 1]) { e.preventDefault(); items[i + 1].focus(); }
    else if (e.key === "ArrowUp" && items[i - 1]) { e.preventDefault(); items[i - 1].focus(); }
    else if (e.key === " ") { e.preventDefault(); toggleTask(node.dataset.id); }
    else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      const next = items[i + 1] || items[i - 1];
      removeTask(node.dataset.id);
      if (next) next.focus();
    }
  });

  /* свайп по карточке — удаление (мобильные) */
  let touchStartX = 0, touchNode = null;
  list.addEventListener("pointerdown", (e) => {
    const node = e.target.closest(".task");
    if (!node || e.pointerType === "mouse") return;
    touchNode = node;
    touchStartX = e.clientX;
  });
  list.addEventListener("pointerup", (e) => {
    if (!touchNode) return;
    const dx = e.clientX - touchStartX;
    if (Math.abs(dx) > 90) {
      const id = touchNode.dataset.id;
      touchNode.classList.add("is-removing");
      setTimeout(() => removeTask(id), 120);
    }
    touchNode = null;
  });

  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      state.filter = chip.dataset.filter;
      document.querySelectorAll(".chip").forEach((c) => {
        const on = c === chip;
        c.classList.toggle("is-on", on);
        c.setAttribute("aria-selected", String(on));
      });
      save();
      render();
    });
  });

  clearBtn.addEventListener("click", () => {
    const done = state.tasks.filter((t) => t.done).length;
    if (!done) { announce_("Готовых задач нет"); return; }
    state.tasks = state.tasks.filter((t) => !t.done);
    save();
    render();
    announce_(`Убрано готовых: ${done}`);
  });

  /* тема */
  function applyTheme(mode) {
    document.documentElement.dataset.theme = mode;
    themeIcon.textContent = mode === "dark" ? "◑" : "◐";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", mode === "dark" ? "#1c1a17" : "#f3ece1");
    try { localStorage.setItem(THEME_KEY, mode); } catch (err) { /* игнорируем */ }
  }

  themeBtn.addEventListener("click", () => {
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });

  /* ---------- старт ---------- */
  load();
  nextId = state.tasks.reduce((m, t) => Math.max(m, Number(t.id) || 0), 0) + 1;

  let stored = null;
  try { stored = localStorage.getItem(THEME_KEY); } catch (err) { /* игнорируем */ }
  applyTheme(stored || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

  document.querySelectorAll(".chip").forEach((c) => {
    const on = c.dataset.filter === state.filter;
    c.classList.toggle("is-on", on);
    c.setAttribute("aria-selected", String(on));
  });

  render();
})();
