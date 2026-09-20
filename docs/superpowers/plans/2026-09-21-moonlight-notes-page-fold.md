# 樂曲解說：軟翻頁與連續封面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `/moonlight-promise` 的橫向滑動帶換成真正的軟翻頁，並讓封面的畫在畫面上連續，不再是印刷面板疊在一層畫出來的背景上。

**Architecture:** 摺頁幾何移植自 StPageFlip 的 `FlipCalculation`（MIT），拆成兩個純函式模組放在 `src/domain/`：`geometry-2d.js` 提供平面幾何原語，`page-fold.js` 用它們構造摺頁。DOM 層 `notes-book-fold.js` 把幾何寫成 `clip-path` 與 `transform`，並擁有翻頁動畫迴圈。尺寸、手勢、縮放、重新分頁全部留在既有模組裡，不引進新的 npm 相依。

**Tech Stack:** 原生 ES modules、Vite 8、Vitest 4。無框架、無新相依。

## Global Constraints

規格來源：[docs/superpowers/specs/2026-09-21-moonlight-notes-page-fold-design.md](../specs/2026-09-21-moonlight-notes-page-fold-design.md)

- **不安裝任何新的 npm 套件。** 只移植幾何程式碼。
- `src/domain/` 底下一律是純函式：無 DOM、無計時器、無模組層級可變狀態。
- 不可變：不就地修改傳入的物件或陣列，一律回傳新值。
- 檔案 200–400 行為常態，800 行為上限；函式 50 行以內。
- 測試框架 vitest。每個任務結束時 `npm test` 必須全綠。
- 文字必須維持為活的 HTML：可選取、可搜尋。不得改用 canvas 渲染頁面。
- 頁面等於螢幕；文字以真實 CSS 尺寸排版，不得為了排版縮放文字。
- 縮放狀態（`zoom > ZOOMED`，即 1.01）下不翻頁。
- `prefers-reduced-motion` 時，摺頁改為淡入淡出。
- 路由 `/moonlight-promise` 不變（已印在三折頁 QR 上）。
- 授權：`README.md` 的第三方段落必須標註 StPageFlip（MIT，作者 Nodlik）。
- Commit 格式 `<type>: <description>`，型別取自 feat / fix / refactor / docs / test / chore / perf / ci。**不加任何 attribution 行。**

## 與規格的兩處差異

寫計畫時發現規格有兩點需要修正，這裡先記下，實作時以本計畫為準：

- **不需要背面副本。** 規格的效能段寫「背面副本在翻動開始時 clone、翻動結束即丟」。軟翻頁是把**同一個元素**用兩塊裁切多邊形切開，翻動頁與底頁各拿一塊，不存在第二份 DOM —— StPageFlip 的 HTML 模式也是如此。比原本設想的更省，但規格那一句要跟著改（Task 8 一併處理）。
- **末頁仍置中，不是右半留空。** 規格說尾頁落在跨頁左半時右半留為夜色。既有的 `pageOffset` 對單張頁面的處理是**置中**（`spreadLength === 1` 分支），那是更好的版面，本計畫不改它。規格那一句同樣在 Task 8 一併改掉。

---

## File Structure

| 檔案 | 責任 |
| --- | --- |
| `src/domain/geometry-2d.js` | 平面幾何原語：旋轉、距離、兩線交點、圓內限制、兩線夾角 |
| `src/domain/page-fold.js` | 摺頁構造：由指標位置得出裁切多邊形、角度、位移、陰影、進度 |
| `src/notes-book-fold.js` | DOM 層：把摺頁幾何寫成 `clip-path` / `transform`；翻頁動畫迴圈 |
| `dev/fold-prototype.html` | 單一葉片的實驗台，供質感檢查點使用。不進生產建置 |
| `src/domain/reader-gestures.js` | 既有；新增抓角判定 |
| `src/notes-book-gestures.js` | 既有；拖曳改為回報指標座標 |
| `src/notes-book.js` | 既有；`layoutPages` 改為擺放葉片，翻頁委派給 fold 模組 |
| `src/domain/notes-flow.js` | 既有；封面原子標上 `spansSpread` |
| `src/domain/notes-pagination.js` | 既有；封面在跨頁時排成兩頁；`buildSpreads` 依序配對 |
| `src/notes-book-render.js` | 既有；封面改為橫式主視覺的左／右半裁切 |
| `styles.css` | 既有；頁背、摺影、書溝；刪除滑動帶規則 |

---

### Task 1: 平面幾何原語

**Files:**
- Create: `src/domain/geometry-2d.js`
- Test: `tests/geometry-2d.test.js`

**Interfaces:**
- Consumes: 無。
- Produces: `rotatePoint(point, origin, angle)`、`distance(first, second)`、`angleBetween(first, second)`、`intersectLines(first, second)`、`intersectWithin(bounds, first, second)`、`limitToCircle(centre, radius, point)`。`Point` 是 `{ x, y }`；`Segment` 是 `[Point, Point]`；`bounds` 是 `{ left, top, width, height }`。交點函式在無交點時回傳 `null`，不丟例外。

移植自 StPageFlip 的 `Helper`（MIT）。兩處刻意偏離原作，見 Step 3 的註解：交點共線時回傳 `null` 而非丟例外；`limitToCircle` 修掉原作在點正對圓心正上方時的除以零。

- [ ] **Step 1: Write the failing test**

建立 `tests/geometry-2d.test.js`：

```js
import { describe, expect, it } from "vitest";

import {
  angleBetween,
  distance,
  intersectLines,
  intersectWithin,
  limitToCircle,
  rotatePoint,
} from "../src/domain/geometry-2d.js";

describe("rotatePoint", () => {
  it("only moves a point by the origin when the angle is zero", () => {
    expect(rotatePoint({ x: 3, y: 4 }, { x: 10, y: 20 }, 0)).toEqual({ x: 13, y: 24 });
  });

  it("turns a quarter circle, with y running down the screen", () => {
    const turned = rotatePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, Math.PI / 2);

    expect(turned.x).toBeCloseTo(0);
    expect(turned.y).toBeCloseTo(-10);
  });
});

describe("distance", () => {
  it("measures the straight line between two points", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("is infinite when a point is missing, so a caller never picks it by accident", () => {
    expect(distance(null, { x: 3, y: 4 })).toBe(Infinity);
  });
});

describe("angleBetween", () => {
  it("measures a right angle between a vertical and a horizontal line", () => {
    const angle = angleBetween(
      [{ x: 0, y: 0 }, { x: 0, y: 10 }],
      [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    );

    expect(angle).toBeCloseTo(Math.PI / 2);
  });
});

describe("intersectLines", () => {
  it("finds where two lines cross", () => {
    const point = intersectLines(
      [{ x: 0, y: 0 }, { x: 10, y: 10 }],
      [{ x: 0, y: 10 }, { x: 10, y: 0 }],
    );

    expect(point.x).toBeCloseTo(5);
    expect(point.y).toBeCloseTo(5);
  });

  it("returns null for parallel lines", () => {
    expect(
      intersectLines([{ x: 0, y: 0 }, { x: 10, y: 0 }], [{ x: 0, y: 5 }, { x: 10, y: 5 }]),
    ).toBeNull();
  });

  it("returns null for lines lying on each other, rather than throwing", () => {
    expect(
      intersectLines([{ x: 0, y: 0 }, { x: 10, y: 0 }], [{ x: 2, y: 0 }, { x: 5, y: 0 }]),
    ).toBeNull();
  });
});

describe("intersectWithin", () => {
  const bounds = { left: -1, top: -1, width: 12, height: 12 };

  it("keeps a crossing that falls inside the bounds", () => {
    const point = intersectWithin(
      bounds,
      [{ x: 0, y: 0 }, { x: 10, y: 10 }],
      [{ x: 0, y: 10 }, { x: 10, y: 0 }],
    );

    expect(point).not.toBeNull();
  });

  it("drops a crossing that falls outside them", () => {
    const point = intersectWithin(
      bounds,
      [{ x: 0, y: 0 }, { x: 100, y: 100 }],
      [{ x: 0, y: 200 }, { x: 200, y: 0 }],
    );

    expect(point).toBeNull();
  });
});

describe("limitToCircle", () => {
  it("leaves a point that is already inside the circle where it is", () => {
    const point = { x: 3, y: 4 };

    expect(limitToCircle({ x: 0, y: 0 }, 10, point)).toEqual(point);
  });

  it("pulls a point back onto the circle along the line to the centre", () => {
    const point = limitToCircle({ x: 0, y: 0 }, 10, { x: 30, y: 40 });

    expect(point.x).toBeCloseTo(6);
    expect(point.y).toBeCloseTo(8);
  });

  it("pulls back a point on the far side of the centre too", () => {
    const point = limitToCircle({ x: 0, y: 0 }, 10, { x: -30, y: 40 });

    expect(point.x).toBeCloseTo(-6);
    expect(point.y).toBeCloseTo(8);
  });

  it("handles a point straight above the centre, where the original divided by zero", () => {
    const point = limitToCircle({ x: 0, y: 0 }, 10, { x: 0, y: 40 });

    expect(point.x).toBeCloseTo(0);
    expect(point.y).toBeCloseTo(10);
  });

  it("handles a point straight below a centre that is not at the origin", () => {
    const point = limitToCircle({ x: 0, y: 600 }, 400, { x: 0, y: -900 });

    expect(point.x).toBeCloseTo(0);
    expect(point.y).toBeCloseTo(200);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/geometry-2d.test.js`
Expected: FAIL — `Failed to resolve import "../src/domain/geometry-2d.js"`.

- [ ] **Step 3: Write the implementation**

建立 `src/domain/geometry-2d.js`：

```js
/**
 * Plane geometry for the page fold: where a leaf's edges cross the page, and
 * how far a dragged corner may travel before its hinge reins it in.
 *
 * Ported from StPageFlip's Helper (MIT, Nodlik), with two deliberate changes,
 * each marked below.
 */

/** A point rotated about `origin` by `angle` radians, y running down the screen. */
export function rotatePoint(point, origin, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return {
    x: point.x * cos + point.y * sin + origin.x,
    y: point.y * cos - point.x * sin + origin.y,
  };
}

/** Infinite when either point is missing, so a caller never picks a gap by accident. */
export function distance(first, second) {
  if (!first || !second) return Infinity;
  return Math.hypot(second.x - first.x, second.y - first.y);
}

/** The angle between two lines, in radians, always in [0, pi]. */
export function angleBetween(first, second) {
  const a1 = first[0].y - first[1].y;
  const a2 = second[0].y - second[1].y;
  const b1 = first[1].x - first[0].x;
  const b2 = second[1].x - second[0].x;

  const lengths = Math.hypot(a1, b1) * Math.hypot(a2, b2);
  if (lengths === 0) return 0;

  return Math.acos((a1 * a2 + b1 * b2) / lengths);
}

/**
 * Where two infinite lines cross, or null when they are parallel or lie on
 * each other. The original threw for the second case; a pure function that a
 * render loop calls sixty times a second should not.
 */
export function intersectLines(first, second) {
  const a1 = first[0].y - first[1].y;
  const a2 = second[0].y - second[1].y;
  const b1 = first[1].x - first[0].x;
  const b2 = second[1].x - second[0].x;
  const c1 = first[0].x * first[1].y - first[1].x * first[0].y;
  const c2 = second[0].x * second[1].y - second[1].x * second[0].y;

  const denominator = a1 * b2 - a2 * b1;
  const x = -((c1 * b2 - c2 * b1) / denominator);
  const y = -((a1 * c2 - a2 * c1) / denominator);

  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function withinBounds(bounds, point) {
  if (!point) return null;

  const inside =
    point.x >= bounds.left &&
    point.x <= bounds.left + bounds.width &&
    point.y >= bounds.top &&
    point.y <= bounds.top + bounds.height;

  return inside ? point : null;
}

/** As `intersectLines`, but null unless the crossing lies inside `bounds`. */
export function intersectWithin(bounds, first, second) {
  return withinBounds(bounds, intersectLines(first, second));
}

/**
 * `point` pulled back onto the circle when it strays outside it, along the
 * line from `centre`. The original divided by zero whenever the point stood
 * straight above or below the centre — the very case a corner dragged along
 * the spine produces — so that line is handled on its own here.
 */
export function limitToCircle(centre, radius, point) {
  if (distance(centre, point) <= radius) return point;

  if (centre.x === point.x) {
    return { x: centre.x, y: centre.y + Math.sign(point.y - centre.y) * radius };
  }

  const run = centre.x - point.x;
  const rise = centre.y - point.y;
  const reach = Math.sqrt((radius * radius * run * run) / (run * run + rise * rise));
  const x = centre.x + (point.x < centre.x ? -reach : reach);

  return { x, y: ((x - centre.x) * rise) / run + centre.y };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/geometry-2d.test.js`
Expected: PASS — 14 tests.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS — 既有測試不受影響。

- [ ] **Step 6: Commit**

```bash
git add src/domain/geometry-2d.js tests/geometry-2d.test.js
git commit -m "feat(notes): add the plane geometry a page fold needs"
```

---

### Task 2: 摺頁構造

**Files:**
- Create: `src/domain/page-fold.js`
- Test: `tests/page-fold.test.js`

**Interfaces:**
- Consumes: Task 1 的 `angleBetween`、`distance`、`intersectWithin`、`limitToCircle`、`rotatePoint`。
- Produces:
  - `FOLD_CORNERS = { top: "top", bottom: "bottom" }`
  - `FOLD_DIRECTIONS = { forward: "forward", back: "back" }`
  - `foldFrom({ corner, direction, pointer, pageWidth, pageHeight })` → `null`（退化，呼叫端沿用上一個成立的摺頁）或
    `{ position, angle, progress, flippingClip, bottomClip, bottomPosition, shadow }`
    - `position` `{ x, y }`：被拉住的角落最後落點，頁座標
    - `angle` number：翻動葉片的旋轉角，弧度，已含方向正負號
    - `progress` number：0 至 1
    - `flippingClip` `Point[]`：翻動葉片的裁切多邊形，頁座標，已濾掉空值
    - `bottomClip` `Point[]`：底頁的裁切多邊形，頁座標，已濾掉空值
    - `bottomPosition` `{ x, y }`：底頁的位移
    - `shadow` `{ start, angle } | null`

構造：**摺線是被拉住的角與指標連線的垂直平分線**，葉片繞它翻過去；葉片四角與頁面四邊求交點，得到兩個裁切多邊形。

- [ ] **Step 1: Write the failing test**

建立 `tests/page-fold.test.js`：

```js
import { describe, expect, it } from "vitest";

import { FOLD_CORNERS, FOLD_DIRECTIONS, foldFrom } from "../src/domain/page-fold.js";

const PAGE = { pageWidth: 400, pageHeight: 600 };

function fold(pointer, overrides = {}) {
  return foldFrom({
    corner: FOLD_CORNERS.bottom,
    direction: FOLD_DIRECTIONS.forward,
    pointer,
    ...PAGE,
    ...overrides,
  });
}

function everyPointIsFinite(points) {
  return points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

describe("foldFrom progress", () => {
  it("has barely begun while the corner is still at rest", () => {
    expect(fold({ x: 400, y: 600 }).progress).toBeCloseTo(0);
  });

  it("is halfway when the corner reaches the spine", () => {
    expect(fold({ x: 0, y: 600 }).progress).toBeCloseTo(0.5);
  });

  it("is complete once the corner is dragged past the spine and reined in", () => {
    expect(fold({ x: -900, y: 600 }).progress).toBeCloseTo(1);
  });
});

describe("foldFrom geometry", () => {
  it("reins a corner dragged far past the spine back onto its hinge circle", () => {
    const { position } = fold({ x: -900, y: 600 });

    expect(Math.hypot(position.x - 0, position.y - 600)).toBeCloseTo(400);
  });

  it("keeps the leaf flat when the corner is pulled straight along its own edge", () => {
    expect(Math.abs(fold({ x: 200, y: 600 }).angle)).toBeCloseTo(0);
  });

  it("opens the fold wider as the corner is lifted further off that edge", () => {
    const shallow = Math.abs(fold({ x: 300, y: 500 }).angle);
    const deeper = Math.abs(fold({ x: 300, y: 400 }).angle);

    expect(deeper).toBeGreaterThan(shallow);
  });

  it("turns the leaf the opposite way when the fold runs backwards", () => {
    const forward = fold({ x: 300, y: 500 }, { direction: FOLD_DIRECTIONS.forward });
    const back = fold({ x: 300, y: 500 }, { direction: FOLD_DIRECTIONS.back });

    expect(Math.sign(forward.angle)).toBe(-Math.sign(back.angle));
  });

  it("gives up rather than guessing when the pointer sits on the hinge itself", () => {
    expect(fold({ x: 400, y: 0 }, { corner: FOLD_CORNERS.top })).toBeNull();
  });
});

describe("foldFrom clip areas", () => {
  const quadrants = [
    { corner: FOLD_CORNERS.top, direction: FOLD_DIRECTIONS.forward, pointer: { x: 300, y: 100 } },
    { corner: FOLD_CORNERS.top, direction: FOLD_DIRECTIONS.back, pointer: { x: 300, y: 100 } },
    { corner: FOLD_CORNERS.bottom, direction: FOLD_DIRECTIONS.forward, pointer: { x: 300, y: 500 } },
    { corner: FOLD_CORNERS.bottom, direction: FOLD_DIRECTIONS.back, pointer: { x: 300, y: 500 } },
  ];

  it("draws a real polygon for both leaves, from either corner and either direction", () => {
    for (const quadrant of quadrants) {
      const result = fold(quadrant.pointer, quadrant);

      expect(result).not.toBeNull();
      expect(result.flippingClip.length).toBeGreaterThanOrEqual(3);
      expect(result.bottomClip.length).toBeGreaterThanOrEqual(3);
      expect(everyPointIsFinite(result.flippingClip)).toBe(true);
      expect(everyPointIsFinite(result.bottomClip)).toBe(true);
    }
  });

  it("starts the shadow on the page's own edge", () => {
    const { shadow } = fold({ x: 300, y: 500 });

    expect(shadow).not.toBeNull();
    expect(shadow.start.x).toBeGreaterThanOrEqual(-1);
    expect(shadow.start.x).toBeLessThanOrEqual(PAGE.pageWidth + 1);
    expect(shadow.start.y).toBeGreaterThanOrEqual(-1);
    expect(shadow.start.y).toBeLessThanOrEqual(PAGE.pageHeight + 1);
    expect(Number.isFinite(shadow.angle)).toBe(true);
  });
});
```

說明：不逐點比對裁切多邊形的頂點座標。那些座標是構造的實作細節，寫死會讓任何合理的重構變成紅燈；改以「四種角落與方向的組合都畫得出有限、非退化的多邊形」守住規格要求的各象限正確性。

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/page-fold.test.js`
Expected: FAIL — `Failed to resolve import "../src/domain/page-fold.js"`.

- [ ] **Step 3: Write the implementation**

建立 `src/domain/page-fold.js`：

```js
/**
 * The fold a dragged corner makes. The fold line is the perpendicular
 * bisector of the line from the corner to the finger; the leaf turns about it,
 * and where the turned leaf crosses the page gives both clip areas.
 *
 * Ported from StPageFlip's FlipCalculation (MIT, Nodlik). It threw for the
 * degenerate cases; a pure function called from a render loop returns null
 * instead, and the caller keeps the last fold that stood.
 */
import {
  angleBetween,
  distance,
  intersectWithin,
  limitToCircle,
  rotatePoint,
} from "./geometry-2d.js";

export const FOLD_CORNERS = { top: "top", bottom: "bottom" };
export const FOLD_DIRECTIONS = { forward: "forward", back: "back" };

/** Below this the leaf is flat against the spine and its angle stops meaning anything. */
const FLAT_SLACK = 0.003;

/** Two crossings closer than this are the same point as far as a polygon is concerned. */
const SAME_POINT = 10;

function foldAngle({ pointer, corner, pageWidth, pageHeight }) {
  const left = pageWidth - pointer.x + 1;
  const top = corner === FOLD_CORNERS.bottom ? pageHeight - pointer.y : pointer.y;

  let angle = 2 * Math.acos(left / Math.hypot(top, left));
  if (top < 0) angle = -angle;

  if (!Number.isFinite(angle)) return null;
  const toFlat = Math.PI - angle;
  if (toFlat >= 0 && toFlat < FLAT_SLACK) return null;

  return corner === FOLD_CORNERS.bottom ? -angle : angle;
}

/** The turned leaf's four corners, in page coordinates. */
function leafRect({ angle, pointer, corner, pageWidth, pageHeight }) {
  const base =
    corner === FOLD_CORNERS.top
      ? [
          { x: 0, y: 0 },
          { x: pageWidth, y: 0 },
          { x: 0, y: pageHeight },
          { x: pageWidth, y: pageHeight },
        ]
      : [
          { x: 0, y: -pageHeight },
          { x: pageWidth, y: -pageHeight },
          { x: 0, y: 0 },
          { x: pageWidth, y: 0 },
        ];

  const [topLeft, topRight, bottomLeft, bottomRight] = base.map((point) =>
    rotatePoint(point, pointer, angle),
  );

  return { topLeft, topRight, bottomLeft, bottomRight };
}

/**
 * A corner cannot leave its hinge, and a leaf cannot fold past the far hinge.
 * Both limits move the corner, which changes the angle, so each is applied and
 * the geometry rebuilt.
 */
function settle({ pointer, corner, pageWidth, pageHeight }) {
  const hinge = corner === FOLD_CORNERS.top ? { x: 0, y: 0 } : { x: 0, y: pageHeight };
  const farHinge = corner === FOLD_CORNERS.top ? { x: 0, y: pageHeight } : { x: 0, y: 0 };

  let position = limitToCircle(hinge, pageWidth, pointer);
  let angle = foldAngle({ pointer: position, corner, pageWidth, pageHeight });
  if (angle === null) return null;
  let rect = leafRect({ angle, pointer: position, corner, pageWidth, pageHeight });

  const leading = corner === FOLD_CORNERS.top ? rect.bottomRight : rect.topRight;
  const trailing = corner === FOLD_CORNERS.top ? rect.topLeft : rect.bottomLeft;

  if (leading.x <= 0) {
    position = limitToCircle(farHinge, Math.hypot(pageWidth, pageHeight), trailing);
    angle = foldAngle({ pointer: position, corner, pageWidth, pageHeight });
    if (angle === null) return null;
    rect = leafRect({ angle, pointer: position, corner, pageWidth, pageHeight });
  }

  // The corner resting exactly on its own hinge is not a fold, it is a closed book.
  if (Math.abs(position.x - pageWidth) < 1 && Math.abs(position.y) < 1) return null;

  return { position, angle, rect };
}

function crossings({ position, rect, corner, pageWidth, pageHeight }) {
  const bounds = { left: -1, top: -1, width: pageWidth + 2, height: pageHeight + 2 };
  const topEdge = [{ x: 0, y: 0 }, { x: pageWidth, y: 0 }];
  const sideEdge = [{ x: pageWidth, y: 0 }, { x: pageWidth, y: pageHeight }];
  const bottomEdge = [{ x: 0, y: pageHeight }, { x: pageWidth, y: pageHeight }];

  const fromTop = corner === FOLD_CORNERS.top;

  return {
    top: fromTop
      ? intersectWithin(bounds, [position, rect.topRight], topEdge)
      : intersectWithin(bounds, [rect.topLeft, rect.topRight], topEdge),
    side: fromTop
      ? intersectWithin(bounds, [position, rect.bottomLeft], sideEdge)
      : intersectWithin(bounds, [position, rect.topLeft], sideEdge),
    bottom: intersectWithin(bounds, [rect.bottomLeft, rect.bottomRight], bottomEdge),
  };
}

function flippingClip({ rect, corner, top, side, bottom }) {
  const points = [rect.topLeft, top];
  let closeAtBottom = false;

  if (side === null) {
    closeAtBottom = true;
  } else {
    points.push(side);
    if (bottom === null) closeAtBottom = false;
  }

  points.push(bottom);
  if (closeAtBottom || corner === FOLD_CORNERS.bottom) points.push(rect.bottomLeft);

  return points.filter(Boolean);
}

function bottomClip({ corner, pageWidth, pageHeight, top, side, bottom }) {
  const points = [top];

  if (corner === FOLD_CORNERS.top) {
    points.push({ x: pageWidth, y: 0 });
  } else {
    if (top !== null) points.push({ x: pageWidth, y: 0 });
    points.push({ x: pageWidth, y: pageHeight });
  }

  if (side !== null) {
    if (distance(side, top) >= SAME_POINT) points.push(side);
  } else if (corner === FOLD_CORNERS.top) {
    points.push({ x: pageWidth, y: pageHeight });
  }

  points.push(bottom, top);

  return points.filter(Boolean);
}

function foldShadow({ corner, direction, pageWidth, top, side, bottom }) {
  const start = corner === FOLD_CORNERS.top ? top : side ?? top;
  const end = start !== side && side !== null ? side : bottom;
  if (!start || !end) return null;

  const angle = angleBetween([start, end], [{ x: 0, y: 0 }, { x: pageWidth, y: 0 }]);

  return {
    start,
    angle: direction === FOLD_DIRECTIONS.forward ? angle : Math.PI - angle,
  };
}

/**
 * The whole fold for one pointer position, or null when the pointer leaves no
 * fold to draw — on the hinge itself, or flat against the spine.
 */
export function foldFrom({ corner, direction, pointer, pageWidth, pageHeight }) {
  if (!(pageWidth > 0) || !(pageHeight > 0)) return null;

  const settled = settle({ pointer, corner, pageWidth, pageHeight });
  if (settled === null) return null;

  const { position, angle, rect } = settled;
  const { top, side, bottom } = crossings({ position, rect, corner, pageWidth, pageHeight });

  return {
    position,
    angle: direction === FOLD_DIRECTIONS.forward ? -angle : angle,
    progress: Math.min(1, Math.abs((position.x - pageWidth) / (2 * pageWidth))),
    flippingClip: flippingClip({ rect, corner, top, side, bottom }),
    bottomClip: bottomClip({ corner, pageWidth, pageHeight, top, side, bottom }),
    bottomPosition: direction === FOLD_DIRECTIONS.back ? { x: pageWidth, y: 0 } : { x: 0, y: 0 },
    shadow: foldShadow({ corner, direction, pageWidth, top, side, bottom }),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/page-fold.test.js`
Expected: PASS — 11 tests.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add src/domain/page-fold.js tests/page-fold.test.js
git commit -m "feat(notes): construct the fold a dragged corner makes"
```

---

### Task 3: 摺頁 DOM 層與質感檢查點

**Files:**
- Create: `src/notes-book-fold.js`
- Create: `dev/fold-prototype.html`
- Modify: `styles.css`
- Modify: `README.md`

**Interfaces:**
- Consumes: Task 2 的 `foldFrom`、`FOLD_DIRECTIONS`；Task 1 的 `rotatePoint`。
- Produces: `createFold({ pageWidth, pageHeight })` → `{ resize({ pageWidth, pageHeight }), draw({ leaf, under, corner, direction, pointer }), clear({ leaf, under }), run({ leaf, under, corner, direction, from, to, duration, onDone }) }`。
  - `draw` 畫一格，回傳該格的 `progress`，或在摺頁不成立時回傳 `null` 且不改動任何樣式。
  - `run` 以 `requestAnimationFrame` 把指標從 `from` 補間到 `to`，每格呼叫 `draw`，結束時呼叫 `onDone`，回傳一個可取消的函式。

**這是質感檢查點。** Step 7 之後停下來，截圖給人看過再繼續。

- [ ] **Step 1: Write the fold renderer**

建立 `src/notes-book-fold.js`：

```js
/**
 * The fold, drawn. The geometry arrives in page coordinates; a leaf is clipped
 * in its own, so every point is carried back into the leaf's frame before it
 * becomes a polygon.
 */
import { FOLD_DIRECTIONS, foldFrom } from "./domain/page-fold.js";
import { rotatePoint } from "./domain/geometry-2d.js";

/** The gold along the fold: what makes a turning leaf visible on a night page. */
const FOLD_EDGE = "rgb(213 177 105 / 0.72)";

function polygonFor(points, { position, angle, mirrored }) {
  const local = points.map((point) => {
    const shifted = mirrored
      ? { x: -point.x + position.x, y: point.y - position.y }
      : { x: point.x - position.x, y: point.y - position.y };
    return rotatePoint(shifted, { x: 0, y: 0 }, angle);
  });

  return `polygon(${local.map((point) => `${point.x}px ${point.y}px`).join(", ")})`;
}

function shadowFor({ shadow, progress, pageWidth }) {
  if (!shadow) return "none";

  // Three stops: the gold of the fold itself, the leaf's own shade, and the
  // shade it casts on the leaf below, thrown further as the turn opens.
  const depth = Math.min(1, progress * 2);
  const width = Math.max(12, pageWidth * 0.14 * depth);

  return (
    `linear-gradient(${shadow.angle}rad, ${FOLD_EDGE} 0, rgb(6 12 24 / 0.55) ${width * 0.18}px, ` +
    `rgb(6 12 24 / 0.22) ${width * 0.6}px, rgb(6 12 24 / 0) ${width}px)`
  );
}

export function createFold({ pageWidth, pageHeight }) {
  let size = { pageWidth, pageHeight };

  function resize(next) {
    size = { pageWidth: next.pageWidth, pageHeight: next.pageHeight };
  }

  function draw({ leaf, under, corner, direction, pointer }) {
    const fold = foldFrom({ corner, direction, pointer, ...size });
    if (!fold) return null;

    const mirrored = direction === FOLD_DIRECTIONS.back;

    leaf.dataset.folding = "true";
    leaf.style.transformOrigin = "0 0";
    leaf.style.transform =
      `translate3d(${fold.position.x}px, ${fold.position.y}px, 0) rotate(${fold.angle}rad)`;
    leaf.style.clipPath = polygonFor(fold.flippingClip, { ...fold, mirrored });
    leaf.style.setProperty("--fold-shadow", shadowFor({ ...fold, pageWidth: size.pageWidth }));

    if (under) {
      under.dataset.folding = "under";
      under.style.transformOrigin = "0 0";
      under.style.transform =
        `translate3d(${fold.bottomPosition.x}px, ${fold.bottomPosition.y}px, 0)`;
      under.style.clipPath = polygonFor(fold.bottomClip, {
        position: fold.bottomPosition,
        angle: 0,
        mirrored: false,
      });
    }

    return fold.progress;
  }

  function clear({ leaf, under }) {
    for (const element of [leaf, under]) {
      if (!element) continue;
      delete element.dataset.folding;
      delete element.dataset.face;
      element.style.removeProperty("transform-origin");
      element.style.removeProperty("transform");
      element.style.removeProperty("clip-path");
      element.style.removeProperty("--fold-shadow");
    }
  }

  function run({ leaf, under, corner, direction, from, to, duration, onDone }) {
    const started = performance.now();
    let frame = 0;

    function step(now) {
      const ratio = duration > 0 ? Math.min(1, (now - started) / duration) : 1;
      // Ease out: a leaf falls fastest as it leaves the hand and lands softly.
      const eased = 1 - (1 - ratio) ** 3;

      draw({
        leaf,
        under,
        corner,
        direction,
        pointer: {
          x: from.x + (to.x - from.x) * eased,
          y: from.y + (to.y - from.y) * eased,
        },
      });

      if (ratio < 1) {
        frame = requestAnimationFrame(step);
        return;
      }
      onDone?.();
    }

    frame = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frame);
  }

  return { resize, draw, clear, run };
}
```

- [ ] **Step 2: Add the fold's own styling**

在 `styles.css` 的 `.note-page` 規則之後加入：

```css
/*
 * A turning leaf draws its own shadow and gives up the page's resting one: a
 * box-shadow repainted with the clip path every frame costs more than it is
 * worth, and the fold's gold edge is what makes a turn read on a night page.
 */
.note-page[data-folding] {
  z-index: 6;
  box-shadow: none;
  will-change: transform, clip-path;
}

.note-page[data-folding="true"]::before {
  position: absolute;
  inset: 0;
  z-index: 3;
  background: var(--fold-shadow, none);
  content: "";
  pointer-events: none;
}

.note-page[data-folding="under"] {
  z-index: 5;
}
```

- [ ] **Step 3: Build the prototype bench**

建立 `dev/fold-prototype.html`。Vite 在開發時會直接提供這個檔案；`vite build` 預設只打包 `index.html`，所以它不會進生產建置。

```html
<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>摺頁實驗台</title>
    <style>
      body {
        display: grid;
        place-items: center;
        min-height: 100vh;
        margin: 0;
        background: #05080f;
        font-family: system-ui, sans-serif;
      }
      #stage {
        position: relative;
        width: 400px;
        height: 600px;
        touch-action: none;
      }
      .leaf {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        background: #0d1f34;
        color: #d5b169;
        font-size: 48px;
      }
      #under {
        background: #0a1728;
      }
      #leaf::before {
        position: absolute;
        inset: 0;
        z-index: 3;
        background: var(--fold-shadow, none);
        content: "";
        pointer-events: none;
      }
      #readout {
        position: fixed;
        top: 12px;
        left: 12px;
        color: #88aaaa;
        font: 12px ui-monospace, monospace;
      }
    </style>
  </head>
  <body>
    <div id="stage">
      <div class="leaf" id="under">2</div>
      <div class="leaf" id="leaf">1</div>
    </div>
    <p id="readout">按住右下角拖曳</p>
    <script type="module">
      import { createFold } from "/src/notes-book-fold.js";
      import { FOLD_CORNERS, FOLD_DIRECTIONS } from "/src/domain/page-fold.js";

      const stage = document.querySelector("#stage");
      const leaf = document.querySelector("#leaf");
      const under = document.querySelector("#under");
      const readout = document.querySelector("#readout");
      const fold = createFold({ pageWidth: 400, pageHeight: 600 });

      let corner = FOLD_CORNERS.bottom;

      function pointOf(event) {
        const rect = stage.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
      }

      stage.addEventListener("pointerdown", (event) => {
        corner = pointOf(event).y >= 300 ? FOLD_CORNERS.bottom : FOLD_CORNERS.top;
        stage.setPointerCapture(event.pointerId);
      });

      stage.addEventListener("pointermove", (event) => {
        if (!stage.hasPointerCapture(event.pointerId)) return;
        const progress = fold.draw({
          leaf,
          under,
          corner,
          direction: FOLD_DIRECTIONS.forward,
          pointer: pointOf(event),
        });
        readout.textContent = progress === null ? "—" : `progress ${progress.toFixed(3)}`;
      });

      stage.addEventListener("pointerup", () => {
        fold.clear({ leaf, under });
        readout.textContent = "按住右下角拖曳";
      });
    </script>
  </body>
</html>
```

- [ ] **Step 4: Record the third-party attribution**

在 `README.md` 末尾加入：

```markdown
## 第三方程式碼

`src/domain/geometry-2d.js` 與 `src/domain/page-fold.js` 的摺頁幾何移植自
[StPageFlip](https://github.com/Nodlik/StPageFlip)（MIT，作者 Nodlik），並依本專案需要改寫：
退化情形回傳 `null` 而非丟例外，並修正圓內限制在垂直線上的除以零。
```

- [ ] **Step 5: Run the dev server and open the bench**

Run: 用 preview 工具啟動 `menu-dev`，開啟 `http://127.0.0.1:5199/dev/fold-prototype.html`
Expected: 兩張深藍葉片疊著；按住右下角拖曳，上層葉片捲起、露出下層、摺線上有金邊。

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS — 本任務沒有動到既有模組。

- [ ] **Step 7: Commit, then STOP for the quality checkpoint**

```bash
git add src/notes-book-fold.js dev/fold-prototype.html styles.css README.md
git commit -m "feat(notes): draw the fold, and a bench to judge it on"
```

**停在這裡。** 截幾張拖曳過程中的圖（約 25%、50%、80% 進度），交給人看過。前一份 spec 曾以「深色頁翻起來只是閃爍」否決 3D；那個顧慮要在這裡被實際畫面否證，才繼續往下接。若質感不成立，掉頭的成本只有這一個模組。

---

### Task 4: 抓角判定

**Files:**
- Modify: `src/domain/reader-gestures.js`
- Modify: `src/notes-book-gestures.js`
- Modify: `src/notes-book.js`
- Test: `tests/reader-gestures.test.js`

**Interfaces:**
- Consumes: 無新相依。
- Produces:
  - `cornerFor({ y, height, towards })` → `{ corner: "top" | "bottom", direction: "forward" | "back" }`。`towards` 為拖曳的水平位移，負值（手指往左）向前翻。
  - `hoverCorner({ x, y, width, height })` → 同上形狀，或 `null`。只給桌機滑鼠懸停的翹角提示用。
  - `bindNotesGestures` 的 `onDragStart(origin)` 與 `onDrag({ offset, point })` 改為帶座標；`origin` 與 `point` 都是相對 stage 左上角的 `{ x, y }`。`onDragEnd` 形狀不變。

手機上讀者在頁面任何地方橫滑都要能翻頁，所以翻頁的角落由**拖曳方向**決定，不是由按下去的 x 決定；按下去的 y 只決定抓上角還是下角。懸停翹角是桌機獨有的可發現性提示，才看 x。

- [ ] **Step 1: Write the failing test**

在 `tests/reader-gestures.test.js` 檔案頂端的 import 清單加入 `cornerFor` 與 `hoverCorner`，並在末尾加入：

```js
describe("cornerFor", () => {
  it("takes the bottom corner when the hand starts low on the page", () => {
    expect(cornerFor({ y: 700, height: 800, towards: -1 })).toEqual({
      corner: "bottom",
      direction: "forward",
    });
  });

  it("takes the top corner when the hand starts high on the page", () => {
    expect(cornerFor({ y: 100, height: 800, towards: -1 })).toEqual({
      corner: "top",
      direction: "forward",
    });
  });

  it("turns back when the hand travels the other way", () => {
    expect(cornerFor({ y: 700, height: 800, towards: 1 }).direction).toBe("back");
  });
});

describe("hoverCorner", () => {
  it("offers the forward corner under a pointer resting near the outer edge", () => {
    expect(hoverCorner({ x: 780, y: 700, width: 800, height: 900 })).toEqual({
      corner: "bottom",
      direction: "forward",
    });
  });

  it("offers the back corner near the inner edge", () => {
    expect(hoverCorner({ x: 20, y: 100, width: 800, height: 900 })).toEqual({
      corner: "top",
      direction: "back",
    });
  });

  it("offers nothing in the middle of the page, which is for reading", () => {
    expect(hoverCorner({ x: 400, y: 450, width: 800, height: 900 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/reader-gestures.test.js`
Expected: FAIL — `cornerFor is not a function`.

- [ ] **Step 3: Write the implementation**

在 `src/domain/reader-gestures.js` 的 `tapZone` 之後加入：

```js
/** How near an edge a resting pointer must be before the leaf offers its corner. */
const CORNER_ZONE = 0.12;

/**
 * Which corner a turn takes hold of. A reader swipes anywhere on a phone, so
 * the corner follows the direction of travel; only the height of the hand
 * decides whether the leaf lifts from the top or from the bottom.
 */
export function cornerFor({ y, height, towards }) {
  return {
    corner: height > 0 && y >= height / 2 ? "bottom" : "top",
    direction: towards < 0 ? "forward" : "back",
  };
}

/**
 * The corner a resting mouse pointer offers to lift. A hint for wide screens
 * only: on a phone there is no pointer to rest, and the middle of the page
 * belongs to reading.
 */
export function hoverCorner({ x, y, width, height }) {
  if (!(width > 0) || !(height > 0)) return null;

  if (x >= width * (1 - CORNER_ZONE)) return cornerFor({ y, height, towards: -1 });
  if (x <= width * CORNER_ZONE) return cornerFor({ y, height, towards: 1 });

  return null;
}
```

- [ ] **Step 4: Carry the pointer through the gesture binder**

在 `src/notes-book-gestures.js` 中，把開始拖曳的那一行改為帶上按下點（`focalFrom` 已存在於該檔案，回傳相對 stage 的座標；`start` 是該處已有的起點事件記錄）：

```js
      mode = "dragging";
      controller.onDragStart(focalFrom(start.x, start.y));
```

並把拖曳中的回報改為：

```js
    if (mode === "dragging") {
      controller.onDrag({
        offset: deltaX,
        point: focalFrom(event.clientX, event.clientY),
      });
```

- [ ] **Step 5: Keep the book's handler in step**

在 `src/notes-book.js` 中，把 `onDrag(offset)` 的簽章改為解構，行為暫時不變（Task 5 才換成摺頁）：

```js
    onDrag({ offset }) {
      dragOffset = resistEdge(offset, { canPrevious: canPrevious(), canNext: canNext() });
      layoutPages();
    },
```

`onDragStart` 暫時忽略傳入的座標。

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS — 6 個新測試通過，既有測試不變。

- [ ] **Step 7: Commit**

```bash
git add src/domain/reader-gestures.js src/notes-book-gestures.js src/notes-book.js tests/reader-gestures.test.js
git commit -m "feat(notes): let a drag say which corner it takes hold of"
```

---

### Task 5: 把摺頁接上整本書

**Files:**
- Modify: `src/notes-book.js`
- Modify: `src/domain/notes-geometry.js`
- Test: `tests/notes-geometry.test.js`

**Interfaces:**
- Consumes: Task 3 的 `createFold`、Task 4 的 `cornerFor`。
- Produces: `notes-book.js` 對外 API 不變。`SPREAD_GAP` 自 `notes-geometry.js` 移除；`pageOffset` 的簽章不變，只是不再留縫。

葉片改為靜止擺放：目前跨頁的兩頁各就各位，其餘頁面停在自己那一側之外。翻頁時只有一張葉片被摺，底下一張被裁切。

- [ ] **Step 1: Write the failing test**

在 `tests/notes-geometry.test.js` 中刪除 `SPREAD_GAP` 的 import 與所有引用它的斷言，並加入：

```js
describe("pageOffset without a sliding strip", () => {
  it("puts the two pages of the open spread side by side", () => {
    const left = pageOffset({ spreadDelta: 0, slot: 0, spreadLength: 2, twoUp: true, pageWidth: 500 });
    const right = pageOffset({ spreadDelta: 0, slot: 1, spreadLength: 2, twoUp: true, pageWidth: 500 });

    expect(left).toBe(0);
    expect(right).toBe(500 + SPREAD_GUTTER);
  });

  it("parks a spread that is not open clear of the one that is, with no gap to glimpse", () => {
    const next = pageOffset({ spreadDelta: 1, slot: 0, spreadLength: 2, twoUp: true, pageWidth: 500 });

    expect(next).toBe(spreadWidth({ twoUp: true, pageWidth: 500 }));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/notes-geometry.test.js`
Expected: FAIL — `parks a spread…` 收到 `1020`（含 `SPREAD_GAP` 的 18），期待 `1002`。

- [ ] **Step 3: Remove the strip gap**

在 `src/domain/notes-geometry.js` 中刪除 `SPREAD_GAP` 常數與其註解，並把 `pageOffset` 的 `base` 改為：

```js
  const base = spreadDelta * spread;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/notes-geometry.test.js`
Expected: PASS。

- [ ] **Step 5: Bring the fold into the book**

在 `src/notes-book.js` 的 import 區加入：

```js
import { createFold } from "./notes-book-fold.js";
```

並把既有那一行 `./domain/reader-gestures.js` 的 import 加入 `cornerFor`。

於常數區加入：

```js
/** How long a tapped turn takes to fall. A dragged one follows the hand instead. */
const TURN_DURATION = 620;
```

在狀態宣告區把 `let dragOffset = 0;` 換成：

```js
  let turning = null;
  let cancelTurn = null;
```

在 `const chrome = createChromeController(root);` 之後加入：

```js
  const fold = createFold({ pageWidth: 1, pageHeight: 1 });
```

在 `applyBookTransform` 的末尾（`if (zoomLabel) …` 之後）加入：

```js
    fold.resize({ pageWidth: layout.width, pageHeight: layout.height });
```

- [ ] **Step 6: Place the leaves instead of sliding the strip**

把 `layoutPages` 整個換成：

```js
  /**
   * Every leaf has a resting place: the open spread side by side, the rest
   * parked clear of it. A turn is a fold drawn on top of this, not a move of it.
   */
  function layoutPages({ animate = false } = {}) {
    book.dataset.turn = animate && !prefersReducedMotion() ? "settle" : "none";

    pageElements.forEach((element, index) => {
      const placement = placements[index];
      if (!placement) return;
      const spreadDelta = placement.spread - spreadIndex;
      const x = pageOffset({
        spreadDelta,
        slot: placement.slot,
        spreadLength: placement.length,
        twoUp,
        pageWidth: layout.width,
      });

      element.style.transform = `translate3d(${x}px, 0, 0)`;
      element.dataset.slot = placement.length === 1 ? "single" : placement.slot === 0 ? "left" : "right";
      element.dataset.near = Math.abs(spreadDelta) <= 1 ? "true" : "false";
    });
  }
```

並在其後加入翻頁的五個函式：

```js
  /** The leaf a turn lifts, and the one it uncovers. */
  function leavesFor(direction) {
    const current = currentSpread();
    const target = spreads[spreadIndex + (direction === "forward" ? 1 : -1)];
    if (!target) return null;

    const leaf = pageElements[direction === "forward" ? current.at(-1) : current[0]];
    const under = pageElements[direction === "forward" ? target[0] : target.at(-1)];
    if (!leaf || !under) return null;

    return { leaf, under };
  }

  /** Where a corner rests before a turn, and where it lands once the leaf is over. */
  function restingPointer(corner) {
    return { x: layout.width, y: corner === "bottom" ? layout.height : 0 };
  }

  function landedPointer(corner) {
    return { x: -layout.width, y: corner === "bottom" ? layout.height : 0 };
  }

  function beginTurn({ corner, direction }) {
    const leaves = leavesFor(direction);
    if (!leaves) return null;
    fold.resize({ pageWidth: layout.width, pageHeight: layout.height });
    turning = { ...leaves, corner, direction };
    return turning;
  }

  function endTurn({ turned }) {
    if (!turning) return;
    const { direction } = turning;
    fold.clear(turning);
    turning = null;
    if (turned) goToSpread(spreadIndex + (direction === "forward" ? 1 : -1), { animate: false });
    else layoutPages({ animate: true });
  }
```

- [ ] **Step 7: Turn by folding when a reader taps**

把 `move(direction)` 換成：

```js
  function move(step) {
    if (step > 0 ? !canNext() : !canPrevious()) return;

    if (prefersReducedMotion()) {
      goToSpread(spreadIndex + step, { animate: true });
      return;
    }

    const corner = "bottom";
    const direction = step > 0 ? "forward" : "back";
    if (!beginTurn({ corner, direction })) return;

    cancelTurn?.();
    cancelTurn = fold.run({
      ...turning,
      from: restingPointer(corner),
      to: landedPointer(corner),
      duration: TURN_DURATION,
      onDone: () => endTurn({ turned: true }),
    });
  }
```

- [ ] **Step 8: Fold under the finger while dragging**

把手勢控制器的三個拖曳處理換成：

```js
    onDragStart() {
      overlays.dismissHint();
      chrome.hide();
      book.dataset.dragging = "true";
      cancelTurn?.();
      turning = null;
    },

    onDrag({ offset, point }) {
      if (!turning) {
        if (Math.abs(offset) < 1) return;
        const grabbed = cornerFor({ y: point.y, height: layout.height, towards: offset });
        if (grabbed.direction === "forward" ? !canNext() : !canPrevious()) return;
        if (!beginTurn(grabbed)) return;
      }
      fold.draw({ ...turning, pointer: point });
    },

    onDragEnd({ offset, velocity, width }) {
      book.dataset.dragging = "false";
      const step = resolveSwipe({
        offset,
        velocity,
        width,
        canPrevious: canPrevious(),
        canNext: canNext(),
      });

      if (!turning) {
        if (step) goToSpread(spreadIndex + step, { animate: true });
        return;
      }

      const { corner, direction } = turning;
      const turned = step !== 0 && (step > 0 ? direction === "forward" : direction === "back");

      cancelTurn?.();
      cancelTurn = fold.run({
        ...turning,
        from: restingPointer(corner),
        to: turned ? landedPointer(corner) : restingPointer(corner),
        duration: turned ? TURN_DURATION / 2 : TURN_DURATION / 3,
        onDone: () => endTurn({ turned }),
      });
    },
```

並刪除 `goToSpread` 中 `dragOffset = 0;` 那一行，以及 `resistEdge` 的 import（不再使用）。

- [ ] **Step 9: Offer the corner to a resting mouse**

在 `src/notes-book.js` 的 `reader-gestures.js` import 中再加入 `hoverCorner`，於狀態宣告區加入 `let hinting = null;`，並於常數區加入：

```js
/** How far a resting mouse lifts a corner: enough to find, not enough to read past. */
const HOVER_PEEL = 48;
```

在 `endTurn` 之後加入：

```js
  /** A resting mouse lifts the corner a little, so a wide screen shows where a turn starts. */
  function dropHint() {
    if (!hinting) return;
    fold.clear(hinting);
    hinting = null;
  }

  function bindCornerHint() {
    stage.addEventListener("pointermove", (event) => {
      if (event.pointerType !== "mouse" || turning || zoom > ZOOMED) return;

      const rect = stage.getBoundingClientRect();
      const hinted = hoverCorner({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        width: rect.width,
        height: rect.height,
      });

      if (!hinted || (hinted.direction === "forward" ? !canNext() : !canPrevious())) {
        dropHint();
        return;
      }

      const leaves = leavesFor(hinted.direction);
      if (!leaves) {
        dropHint();
        return;
      }

      hinting = { ...leaves, ...hinted };
      fold.draw({
        ...hinting,
        pointer: {
          x: layout.width - HOVER_PEEL,
          y: hinted.corner === "bottom" ? layout.height - HOVER_PEEL : HOVER_PEEL,
        },
      });
    });

    stage.addEventListener("pointerleave", dropHint);
  }
```

在 `onDragStart` 的 `turning = null;` 之前加入 `dropHint();`，並在 `createNotesBook` 綁定手勢的那一處之後呼叫一次 `bindCornerHint();`。

- [ ] **Step 10: Run the whole suite**

Run: `npm test`
Expected: PASS。

- [ ] **Step 11: Check it in the browser**

Run: 啟動 `menu-dev`，開 `http://127.0.0.1:5199/moonlight-promise`
Expected: 點右側翻頁時葉片捲起落下；在頁面上橫拖時摺頁跟手，放開後翻過去或彈回；縮放後拖曳只平移不翻頁；目錄點擊仍是淡入跳頁。

- [ ] **Step 12: Commit**

```bash
git add src/notes-book.js src/domain/notes-geometry.js tests/notes-geometry.test.js
git commit -m "feat(notes): turn the leaves by folding them, not by sliding a strip"
```

---

### Task 6: 封面佔滿一個跨頁

**Files:**
- Modify: `src/domain/notes-flow.js`
- Modify: `src/domain/notes-pagination.js`
- Modify: `src/notes-book.js`
- Test: `tests/notes-pagination.test.js`

**Interfaces:**
- Consumes: 無新相依。
- Produces: `cover` 原子的 payload 多一個 `spansSpread: true`。`packAtoms` 的選項多一個 `twoUp`；為真時把 `spansSpread` 的整頁原子排成兩頁，payload 各帶 `half: "left"` 與 `half: "right"`，兩頁的 `kind` 都是 `"cover"`。`buildSpreads(total, twoUp)` 在 `twoUp` 為真時回傳 `[[0,1],[2,3],…]`。

- [ ] **Step 1: Write the failing test for the pairing**

在 `tests/notes-pagination.test.js` 末尾加入：

```js
describe("a cover that spans the spread", () => {
  it("pairs every page from the first when the cover takes both leaves", () => {
    expect(buildSpreads(6, true)).toEqual([[0, 1], [2, 3], [4, 5]]);
  });

  it("leaves the last leaf alone rather than inventing a page for it", () => {
    expect(buildSpreads(5, true)).toEqual([[0, 1], [2, 3], [4]]);
  });

  it("still gives each page a spread of its own on a phone", () => {
    expect(buildSpreads(3, false)).toEqual([[0], [1], [2]]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/notes-pagination.test.js`
Expected: FAIL — 收到 `[[0], [1, 2], [3, 4], [5]]`。

- [ ] **Step 3: Pair the spreads from the first page**

把 `src/domain/notes-pagination.js` 的 `buildSpreads` 換成：

```js
/**
 * A wide cover takes both leaves, so the pairing runs from the first page and
 * every later spread falls where it did before.
 */
export function buildSpreads(total, twoUp) {
  if (total <= 0) return [];
  if (!twoUp) return Array.from({ length: total }, (_, index) => [index]);

  const spreads = [];
  for (let index = 0; index < total; index += 2) {
    spreads.push(index + 1 < total ? [index, index + 1] : [index]);
  }
  return spreads;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/notes-pagination.test.js`
Expected: PASS。

- [ ] **Step 5: Write the failing test for the split cover**

在同一檔案加入。沿用該檔案頂端已有的 `options`、`fullPage` 與 `banner`：

```js
describe("packing a cover that spans the spread", () => {
  const wideCover = { ...fullPage("cover"), payload: { spansSpread: true } };

  it("lays the cover on two leaves when the book is open two up", () => {
    const pages = packAtoms([wideCover, banner("note-a")], { ...options, twoUp: true });

    expect(pages[0].kind).toBe("cover");
    expect(pages[1].kind).toBe("cover");
    expect(pages[0].atoms[0].payload.half).toBe("left");
    expect(pages[1].atoms[0].payload.half).toBe("right");
  });

  it("keeps the cover on one leaf on a phone", () => {
    const pages = packAtoms([wideCover, banner("note-a")], { ...options, twoUp: false });

    expect(pages[0].kind).toBe("cover");
    expect(pages[1].kind).not.toBe("cover");
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run tests/notes-pagination.test.js`
Expected: FAIL — `pages[1].kind` 不是 `"cover"`。

- [ ] **Step 7: Split the cover atom in the packer**

在 `src/domain/notes-pagination.js` 的 `FULL_PAGE_KINDS` 常數之後加入：

```js
/** A cover drawn across both leaves arrives as one atom and leaves as two pages. */
function fullPagesFor(atom, twoUp) {
  if (!(twoUp && atom.payload?.spansSpread)) return [atom];

  return ["left", "right"].map((half) => ({
    ...atom,
    id: `${atom.id}-${half}`,
    payload: { ...atom.payload, half },
  }));
}
```

把 `packAtoms` 的簽章由 `packAtoms(atoms, { capacity, lineHeight, measure, splitParagraph })` 改為 `packAtoms(atoms, { capacity, lineHeight, measure, splitParagraph, twoUp = false })`，並在處理整頁原子（`FULL_PAGE_KINDS`）的那一處，改為對 `fullPagesFor(atom, twoUp)` 的每個元素各推出一頁。

在 `src/domain/notes-flow.js` 的 `atom("cover", …)` payload 中加入 `spansSpread: true`。

在 `src/notes-book.js` 呼叫 `packAtoms` 的地方傳入 `twoUp`（該變數在該作用域已存在）。

- [ ] **Step 8: Run the whole suite**

Run: `npm test`
Expected: PASS — 特別確認分頁引擎的內容守恆不變式仍綠。

- [ ] **Step 9: Commit**

```bash
git add src/domain/notes-flow.js src/domain/notes-pagination.js src/notes-book.js tests/notes-pagination.test.js
git commit -m "feat(notes): give the cover both leaves of the open book"
```

---

### Task 7: 封面素材與硬頁

**Files:**
- Create: `assets/cover-moonlight-promise-wide.webp`
- Modify: `assets/cover-moonlight-promise.webp`
- Modify: `src/data/moonlight-promise-people.js`
- Modify: `src/notes-book-render.js`
- Modify: `src/notes-book-fold.js`
- Modify: `styles.css`

**Interfaces:**
- Consumes: Task 6 的 `payload.half`。
- Produces: `moonlightPromiseCoverArtwork` 多一個 `wide: { url, width, height }`。`printedPage(image, { half })` 依 `half` 取橫式圖的左半或右半。封面與尾頁標上 `data-density="hard"`，`notes-book-fold.js` 對硬頁改走繞脊旋轉。

- [ ] **Step 1: Restore the clean printed panel**

```bash
git show cbdc5d5:assets/cover-moonlight-promise.webp > assets/cover-moonlight-promise.webp
```

確認尺寸：

```bash
node -e "const b=require('fs').readFileSync('assets/cover-moonlight-promise.webp');const o=b.indexOf(Buffer.from([0x9d,0x01,0x2a]));console.log((b.readUInt16LE(o+3)&0x3fff)+'x'+(b.readUInt16LE(o+5)&0x3fff))"
```

Expected: `960x2028`

- [ ] **Step 2: Add the wide artwork**

把委託人提供的橫式主視覺（1672×941）存成 `assets/cover-moonlight-promise-wide.webp`。

- [ ] **Step 3: Describe both in the data**

在 `src/data/moonlight-promise-people.js` 頂端，比照既有 `coverUrl` 的寫法加入：

```js
import coverWideUrl from "../../assets/cover-moonlight-promise-wide.webp";
```

並把封面宣告換成：

```js
/**
 * The book opens on the sheet's own artwork. Two leaves wide, it is the
 * designer's landscape composition carried whole across the gutter; one leaf
 * wide, it is the printed panel as it stands. Neither is painted out at the
 * edge: a page only ever trims the picture.
 */
export const moonlightPromiseCoverArtwork = {
  url: coverUrl,
  width: 960,
  height: 2028,
  wide: { url: coverWideUrl, width: 1672, height: 941 },
  alt: "月光下的約定：2026 年 9 月 25 日（五）19:30，國家兩廳院演奏廳",
};
```

- [ ] **Step 4: Render the half a leaf carries**

把 `src/notes-book-render.js` 的 `printedPage` 換成：

```js
/**
 * A printed leaf. When the sheet is wider than the leaf, the leaf carries its
 * own half of it — the picture runs on across the gutter rather than stopping
 * at a painted edge.
 */
function printedPage(image, { half } = {}) {
  const node = createElement("section", "note-printed");
  const source = half && image.wide ? image.wide : image;

  const picture = createElement("img");
  picture.src = source.url;
  picture.width = source.width;
  picture.height = source.height;
  picture.alt = image.alt || "";
  picture.decoding = "async";
  if (half) node.dataset.half = half;

  node.append(picture);
  return node;
}
```

並把 `renderCover` 的第一行換成：

```js
  if (payload.artwork?.url) return printedPage(payload.artwork, { half: payload.half });
```

- [ ] **Step 5: Mark the cover leaves hard**

在 `src/notes-book-render.js:517`（`article.dataset.pageKind = page.kind;`）之後加入：

```js
  // A cover is card, not paper: it turns about the spine and does not curl.
  if (page.kind === "cover" || page.kind === "back-cover") article.dataset.density = "hard";
```

- [ ] **Step 6: Turn a hard leaf about the spine**

在 `src/notes-book-fold.js` 的 `draw` 函式最前面，`const fold = …` 之前加入：

```js
    if (leaf.dataset.density === "hard") {
      const swung = Math.min(1, Math.abs(pointer.x - size.pageWidth) / (2 * size.pageWidth));
      const away = direction === FOLD_DIRECTIONS.back ? 1 : -1;

      leaf.dataset.folding = "true";
      // Past halfway the card is edge on and what follows is its inside.
      leaf.dataset.face = swung > 0.5 ? "back" : "front";
      leaf.style.transformOrigin = direction === FOLD_DIRECTIONS.back ? "100% 50%" : "0% 50%";
      leaf.style.transform = `rotateY(${swung * 180 * away}deg)`;
      leaf.style.setProperty("--fold-shadow", "none");
      return swung;
    }
```

- [ ] **Step 7: Style the halves, the hard leaf and the depth it turns in**

在 `styles.css` 中，把 `.note-page[data-page-kind="cover"]` 的既有兩條規則換成：

```css
/*
 * The cover is the sheet's own artwork. Across two leaves it is the landscape
 * composition, each leaf carrying its half; on one leaf it is the printed
 * panel. Either way the picture fills the leaf and a page edge only trims it.
 */
.note-page[data-page-kind="cover"] {
  background-color: #070d1c;
}

.note-page[data-page-kind="cover"] .note-printed img {
  object-fit: cover;
}

.note-printed[data-half] img {
  width: 200%;
}

.note-printed[data-half="left"] img {
  margin-left: 0;
}

.note-printed[data-half="right"] img {
  margin-left: -100%;
}

/* Card does not curl: a hard leaf turns whole, about the spine. */
.note-page[data-density="hard"][data-folding] {
  clip-path: none;
}

/* The inside of the cover is night, and carries no type. */
.note-page[data-density="hard"][data-face="back"] {
  background-image: none;
  background-color: #070d1c;
}

.note-page[data-density="hard"][data-face="back"] > * {
  visibility: hidden;
}
```

並在 `.notes-book` 規則中加入 `perspective: 2400px;`，硬頁的旋轉才有深度。

- [ ] **Step 8: Run the whole suite**

Run: `npm test`
Expected: PASS。

- [ ] **Step 9: Check it in the browser at both sizes**

Run: 啟動 `menu-dev`，以 1440×900 與 390×844 兩個視窗尺寸開 `/moonlight-promise`
Expected: 桌機上封面的畫橫跨整個畫面、中間只有書溝細線、左右沒有平色帶；手機上封面滿版。翻第一頁時封面繞書脊轉開，不捲角。

- [ ] **Step 10: Commit**

```bash
git add assets/cover-moonlight-promise.webp assets/cover-moonlight-promise-wide.webp src/data/moonlight-promise-people.js src/notes-book-render.js src/notes-book-fold.js styles.css
git commit -m "feat(notes): carry the sheet's own picture across both leaves"
```

---

### Task 8: 清掉滑動帶，並更新前一份 spec

**Files:**
- Modify: `styles.css`
- Modify: `docs/superpowers/specs/2026-09-18-moonlight-notes-book-design.md`
- Modify: `docs/superpowers/specs/2026-09-21-moonlight-notes-page-fold-design.md`

**Interfaces:**
- Consumes: 無。
- Produces: 無新介面。

- [ ] **Step 1: Retire the strip transition**

在 `styles.css` 中把

```css
.notes-book[data-turn="slide"] .note-page {
  transition: transform 360ms cubic-bezier(0.22, 0.8, 0.2, 1);
}
```

換成

```css
/* Leaves ease back into place after a turn; the turn itself is the fold. */
.notes-book[data-turn="settle"] .note-page:not([data-folding]) {
  transition: transform 360ms cubic-bezier(0.22, 0.8, 0.2, 1);
}
```

- [ ] **Step 2: Confirm nothing still names the old machinery**

Run: `grep -rn 'data-turn="slide"\|SPREAD_GAP\|resistEdge' src styles.css tests`
Expected: 只剩 `src/domain/reader-gestures.js` 中 `resistEdge` 的定義與其既有測試；`src/notes-book.js` 與 `styles.css` 無輸出。

- [ ] **Step 3: Rewrite the superseded decision**

在 `docs/superpowers/specs/2026-09-18-moonlight-notes-book-design.md` 中，把「不做 3D `rotateY` —— 在低對比的深色頁面上，翻轉的中間影格讀起來只是閃爍。」那一句換成：

```markdown
翻頁是真的軟翻頁：書角掀起、頁背可見。深色頁面翻轉會讀成閃爍的顧慮確實存在，靠摺線上的金色亮邊與三層陰影解決；詳見 [2026-09-21-moonlight-notes-page-fold-design.md](2026-09-21-moonlight-notes-page-fold-design.md)。
```

- [ ] **Step 4: Correct the two places the spec got ahead of the build**

在 `docs/superpowers/specs/2026-09-21-moonlight-notes-page-fold-design.md` 中：

把效能段的「**背面副本在翻動開始時 clone、翻動結束即丟**，不常駐 48 份。」換成：

```markdown
軟翻頁把**同一個元素**用兩塊裁切多邊形切開，翻動頁與底頁各拿一塊，不需要第二份 DOM。
```

把跨頁配對段的「尾頁（贊助商頁）若落在跨頁的左半，右半留空為純夜色 —— 與現行單頁尾頁的處理相同，不特別補頁。」換成：

```markdown
尾頁若獨自落在最後一個跨頁，沿用 `pageOffset` 既有的處理：置中於跨頁，不特別補頁。
```

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS。

- [ ] **Step 6: Check the production build**

Run: `npm run build`
Expected: 成功。

Run: `ls dist | grep -i prototype`
Expected: 無輸出 —— 實驗台不進生產建置。

- [ ] **Step 7: Commit**

```bash
git add styles.css docs/superpowers/specs/2026-09-18-moonlight-notes-book-design.md docs/superpowers/specs/2026-09-21-moonlight-notes-page-fold-design.md
git commit -m "refactor(notes): retire the sliding strip and record why 3D returned"
```

---

## 手動驗證（全部任務完成後）

在 320 / 375 / 768 / 1024 / 1440 寬度各截一次圖，並確認：

- 桌機跨頁：封面的畫橫跨整個畫面，左右沒有平色帶，只有中間一道書溝。
- 手機單頁：封面滿版；翻頁摺痕上有金邊。
- 拖曳翻頁跟手；放開後翻過去或彈回。
- 縮放至 400% 後拖曳只平移，不翻頁；文字仍銳利、可選取。
- 開啟 `prefers-reduced-motion` 後翻頁改為淡入淡出。
- 目錄點擊、縮圖、底部捲軸跳頁仍是淡入，不是連續翻頁。
- 每首曲仍從新的一頁開始，沒有兩首曲共用一頁。
