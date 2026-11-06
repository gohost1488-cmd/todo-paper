/* Скриншоты для отчёта: светлая/тёмная тема и мобильный вид. */
import { chromium } from "playwright-core";

const BASE = process.argv[2] || "http://127.0.0.1:8099/";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium-browser",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const seed = async (page) => {
  await page.evaluate(() => {
    localStorage.setItem("todo.paper.v1", JSON.stringify({
      filter: "all",
      tasks: [
        { id: "5", text: "Сдать тестовое задание", done: false, created: 5 },
        { id: "4", text: "Проверить работу на телефоне", done: false, created: 4 },
        { id: "3", text: "Позвонить в сервис", done: true, created: 3 },
        { id: "2", text: "Купить хлеб и молоко", done: false, created: 2 },
        { id: "1", text: "Прочитать документацию", done: true, created: 1 },
      ],
    }));
  });
  await page.reload({ waitUntil: "load" });
};

const page = await browser.newPage({ viewport: { width: 1100, height: 820 }, deviceScaleFactor: 2 });
await page.goto(BASE, { waitUntil: "load" });
await seed(page);
await page.screenshot({ path: "/tmp/todo-light.png" });

await page.click("#theme");
await page.screenshot({ path: "/tmp/todo-dark.png" });

const mobile = await browser.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true });
await mobile.goto(BASE, { waitUntil: "load" });
await seed(mobile);
await mobile.screenshot({ path: "/tmp/todo-mobile.png" });

await browser.close();
console.log("готово: /tmp/todo-light.png /tmp/todo-dark.png /tmp/todo-mobile.png");
