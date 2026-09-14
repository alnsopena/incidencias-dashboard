// Fetches the "Incidencias & Mejoras Go Live" board from monday.com's own API
// and writes data/raw.json in the exact shape index.html expects.
// Runs inside GitHub Actions on a schedule — never in the browser, so the
// MONDAY_API_TOKEN secret is never exposed to anyone viewing the site.

import { mkdirSync, writeFileSync } from "node:fs";

const TOKEN = process.env.MONDAY_API_TOKEN;
if (!TOKEN) {
  console.error("Falta la variable de entorno MONDAY_API_TOKEN (secret de GitHub Actions).");
  process.exit(1);
}

const BOARD = 18429643827;
const COLS = [
  "color_mm654b11", "dropdown_mm38x45a", "color_mm08qtw9",
  "date_mm0dgr9k", "date_mm151q1k", "date_mm0dfxgk", "date_mm0d57hz", "date_mm1q65r7",
  "text_mm6w60e0", "color_mm73ye9b", "color_mm73myee"
];

async function mondayQuery(query, variables) {
  const res = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": TOKEN },
    body: JSON.stringify({ query, variables })
  });
  const json = await res.json();
  if (json.errors) throw new Error("monday.com API error: " + JSON.stringify(json.errors));
  return json.data;
}

async function fetchAllItems() {
  const items = [];
  let boardName = "";
  let cursor = null;
  let page = 0;
  const MAX_PAGES = 20;
  do {
    const data = await mondayQuery(
      `query ($boardId: [ID!], $cols: [String!], $cursor: String) {
        boards(ids: $boardId) {
          name
          items_page(limit: 500, cursor: $cursor) {
            cursor
            items {
              id
              name
              url
              created_at
              group { id title }
              column_values(ids: $cols) { id text }
            }
          }
        }
      }`,
      { boardId: [String(BOARD)], cols: COLS, cursor }
    );
    const board = data.boards[0];
    if (page === 0) boardName = board.name || "";
    const itemsPage = board.items_page;
    for (const it of itemsPage.items) {
      const columnValues = {};
      for (const c of it.column_values) columnValues[c.id] = c.text;
      items.push({
        id: it.id, name: it.name, url: it.url, created_at: it.created_at,
        group: it.group, column_values: columnValues
      });
    }
    cursor = itemsPage.cursor;
    page++;
  } while (cursor && page < MAX_PAGES);
  return { items, boardName };
}

async function fetchActivityToday(fromISO, toISO, itemIds) {
  if (!itemIds.length) return null;
  const data = await mondayQuery(
    `query ($boardId: [ID!], $from: ISO8601DateTime, $to: ISO8601DateTime, $itemIds: [ID!]) {
      boards(ids: $boardId) {
        activity_logs(from: $from, to: $to, item_ids: $itemIds) {
          created_at
          event
          data
        }
      }
    }`,
    { boardId: [String(BOARD)], from: fromISO, to: toISO, itemIds: itemIds.map(String) }
  );
  return { data: data.boards[0].activity_logs };
}

function limaDate(ms) {
  return new Date(ms - 5 * 3600e3).toISOString().slice(0, 10);
}

async function main() {
  const now = Date.now();
  const hoy = limaDate(now);
  const dayStart = hoy + "T05:00:00Z";
  const nowIso = new Date(now).toISOString();

  const { items, boardName } = await fetchAllItems();

  const changedTodaySet = new Set();
  for (const it of items) {
    const cv = it.column_values;
    if (cv["date_mm151q1k"] === hoy || cv["date_mm0dfxgk"] === hoy || cv["date_mm1q65r7"] === hoy || cv["date_mm0d57hz"] === hoy) {
      changedTodaySet.add(Number(it.id));
    }
  }

  const warnings = [];
  let activityToday = null;
  try {
    activityToday = await fetchActivityToday(dayStart, nowIso, [...changedTodaySet]);
  } catch (e) {
    warnings.push("No se pudo obtener la hora de los movimientos de hoy.");
  }

  const raw = { now, fetchedAt: now, items, boardName, activityToday, warnings };

  mkdirSync("data", { recursive: true });
  writeFileSync("data/raw.json", JSON.stringify(raw));
  console.log("OK:", items.length, "items — tablero:", boardName);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
