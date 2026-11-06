/* E2E-проверка списка задач на живом браузере.
   Запуск: node tests/e2e.mjs [baseUrl]
   Использует системный Chromium через playwright-core (без скачивания браузеров). */
import { chromium } from "playwright-core";

const BASE = process.argv[2] || "http://127.0.0.1:8099/";
const EXEC = process.env.CHROMIUM_PATH || "/usr/bin/chromium-browser";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok, extra });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
}

const browser = await chromium.launch({
  executablePath: EXEC,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 900, height: 800 } });

const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto(BASE, { waitUntil: "load" });

const count = () => page.locator(".task").count();
const add = async (text) => {
  await page.fill("#new-task", text);
  await page.press("#new-task", "Enter");
};

/* 1. добавление */
await add("Купить хлеб");
await add("Позвонить в сервис");
check("добавление двух задач", (await count()) === 2, `задач: ${await count()}`);

/* 2. порядок и текст */
const firstText = await page.locator(".task__text").first().textContent();
check("новая задача сверху", firstText.trim() === "Позвонить в сервис", firstText.trim());

/* 3. отметка выполненной */
await page.locator(".task").first().locator(".task__check").click();
const pressed = await page.locator(".task").first().locator(".task__check").getAttribute("aria-pressed");
check("отметка выполненной", pressed === "true", `aria-pressed=${pressed}`);

/* 4. сохранение после перезагрузки */
await page.reload({ waitUntil: "load" });
check("после перезагрузки задачи на месте", (await count()) === 2, `задач: ${await count()}`);
const doneAfterReload = await page.locator(".task").first().locator(".task__check").getAttribute("aria-pressed");
check("статус «выполнено» сохранился", doneAfterReload === "true", `aria-pressed=${doneAfterReload}`);

/* 5. фильтры */
await page.click('[data-filter="active"]');
check("фильтр «активные» скрывает готовые", (await count()) === 1, `видно: ${await count()}`);
await page.click('[data-filter="done"]');
check("фильтр «готовые» показывает одну", (await count()) === 1, `видно: ${await count()}`);
await page.click('[data-filter="all"]');
check("фильтр «все» возвращает обе", (await count()) === 2, `видно: ${await count()}`);

/* 6. удаление */
await page.locator(".task").first().locator(".task__del").click();
await page.waitForTimeout(250);
check("удаление задачи", (await count()) === 1, `осталось: ${await count()}`);
await page.reload({ waitUntil: "load" });
check("удаление сохранилось после перезагрузки", (await count()) === 1, `осталось: ${await count()}`);

/* 7. защита от пустой задачи */
await page.fill("#new-task", "   ");
await page.press("#new-task", "Enter");
check("пустая задача не добавляется", (await count()) === 1, `задач: ${await count()}`);

/* 8. XSS: текст вставляется как текст, а не как разметка */
const payload = '<img src=x onerror="window.__xss=1">';
await add(payload);
await page.waitForTimeout(150);
const injected = await page.evaluate(() => Boolean(window.__xss));
const asText = await page.locator(".task__text").first().textContent();
check("HTML из ввода не исполняется", injected === false && asText.includes("<img"), asText.slice(0, 40));

/* 9. тема переключается и сохраняется */
await page.click("#theme");
const themeAfter = await page.evaluate(() => document.documentElement.dataset.theme);
await page.reload({ waitUntil: "load" });
const themeReload = await page.evaluate(() => document.documentElement.dataset.theme);
check("тема переключается и сохраняется", themeAfter === themeReload, `${themeAfter} → ${themeReload}`);

/* 10. ошибок в консоли нет */
check("нет ошибок JS в консоли", errors.length === 0, errors.slice(0, 2).join(" | "));

/* 11. размер страницы и отсутствие внешних запросов */
const external = [];
page.on("request", (r) => {
  const u = r.url();
  if (!u.startsWith(BASE) && !u.startsWith("data:")) external.push(u);
});
await page.reload({ waitUntil: "load" });
check("нет внешних сетевых запросов", external.length === 0, external.slice(0, 3).join(", "));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\nитог: ${results.length - failed.length}/${results.length} проверок пройдено`);
process.exit(failed.length ? 1 : 0);
