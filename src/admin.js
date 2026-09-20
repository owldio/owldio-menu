import { buildProgrammePath } from "./domain/routing.js";
import { loadCjkWebFonts } from "./lib/cjk-webfonts.js";
import { canTransitionVisibility, programmeVisibilityLabels } from "./domain/programme.js";
import { ProgrammeRepository } from "./services/programme-repository.js";

function adminTemplate() {
  return `
    <header class="admin-header">
      <a class="admin-brand" href="/" aria-label="回到公開作品索引">
        <span>OWLDIO</span><b>MENU</b>
      </a>
      <p>PROGRAMME CONTROL ROOM</p>
      <div class="admin-account" id="admin-account"></div>
    </header>
    <main class="admin-main" id="admin-main"></main>
  `;
}

function loginTemplate() {
  return `
    <section class="admin-login" aria-labelledby="admin-login-title">
      <div class="admin-login__edition" aria-hidden="true">
        <span>OWLDIO MENU / ADMINISTRATIVE EDITION</span>
        <strong>節目冊<br />管理</strong>
        <i>CONTROL ROOM · 2026</i>
      </div>
      <div class="admin-login__form">
        <p class="admin-kicker">AUTHORISED ACCESS ONLY</p>
        <h1 id="admin-login-title">登入後台</h1>
        <p>管理演出資訊、公開狀態與原始 PDF。這裡不提供公開註冊。</p>
        <form id="admin-login-form">
          <label>
            <span>EMAIL</span>
            <input name="email" type="email" autocomplete="username" required />
          </label>
          <label>
            <span>PASSWORD</span>
            <input name="password" type="password" autocomplete="current-password" required />
          </label>
          <button class="admin-button admin-button--primary" type="submit">登入 <span>→</span></button>
          <p class="admin-form-status" id="admin-login-status" role="status" aria-live="polite"></p>
        </form>
      </div>
    </section>
  `;
}

function setupTemplate() {
  return `
    <section class="admin-setup" aria-labelledby="admin-setup-title">
      <p class="admin-kicker">BACKEND CONNECTION</p>
      <h1 id="admin-setup-title">後台已完成，等待連結資料庫</h1>
      <p>公開閱讀器目前使用內建示範資料；填入 Supabase 專案的公開連線值後，登入、發布與 PDF 上傳就會啟用。</p>
      <dl>
        <div><dt>01</dt><dd>執行 <code>supabase/migrations/202609010001_initial_programme_platform.sql</code></dd></div>
        <div><dt>02</dt><dd>建立第一位 Auth 使用者，將其 UUID 寫入 <code>public.admin_users</code></dd></div>
        <div><dt>03</dt><dd>設定 <code>VITE_SUPABASE_URL</code> 與 <code>VITE_SUPABASE_PUBLISHABLE_KEY</code></dd></div>
      </dl>
    </section>
  `;
}

function dashboardTemplate() {
  return `
    <section class="admin-dashboard">
      <header class="admin-dashboard__heading">
        <div>
          <p class="admin-kicker">DIGITAL PROGRAMMES / OVERVIEW</p>
          <h1>節目冊管理</h1>
        </div>
        <button class="admin-button admin-button--quiet" id="programme-new" type="button">＋ 新增節目冊</button>
      </header>

      <div class="admin-stats" id="admin-stats" aria-label="節目冊狀態摘要"></div>

      <div class="admin-workspace">
        <aside class="admin-library" aria-labelledby="admin-library-title">
          <div class="admin-section-head">
            <h2 id="admin-library-title">全部作品</h2>
            <span id="admin-library-count">0</span>
          </div>
          <div class="admin-programme-list" id="admin-programme-list"></div>
        </aside>

        <section class="admin-editor" aria-labelledby="admin-editor-title">
          <div class="admin-section-head">
            <div>
              <p class="admin-kicker">PROGRAMME RECORD</p>
              <h2 id="admin-editor-title">新增節目冊</h2>
            </div>
            <a id="programme-preview" href="/" target="_blank" rel="noreferrer" hidden>公開預覽 ↗</a>
          </div>

          <form id="programme-form">
            <input name="id" type="hidden" />

            <fieldset>
              <legend><span>01</span> 基本資訊</legend>
              <div class="admin-form-grid">
                <label class="admin-field admin-field--wide">
                  <span>節目名稱 *</span>
                  <input name="title" required maxlength="120" />
                </label>
                <label class="admin-field admin-field--wide">
                  <span>英文名稱</span>
                  <input name="title_en" maxlength="160" />
                </label>
                <label class="admin-field">
                  <span>演出類型</span>
                  <input name="production_type" placeholder="例如：原創音樂劇" maxlength="80" />
                </label>
                <label class="admin-field">
                  <span>場館</span>
                  <input name="venue" maxlength="120" />
                </label>
                <label class="admin-field admin-field--wide">
                  <span>一句介紹</span>
                  <textarea name="summary" rows="3" maxlength="320"></textarea>
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend><span>02</span> 網址與演出</legend>
              <div class="admin-form-grid">
                <label class="admin-field">
                  <span>客戶識別代稱（僅後台）*</span>
                  <input name="client_slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="ours" />
                </label>
                <label class="admin-field">
                  <span>公開網址代稱 *</span>
                  <input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="tide-awake" />
                  <small>發布網址：menu.owldio.art/這個代稱</small>
                </label>
                <label class="admin-field">
                  <span>首場時間</span>
                  <input name="starts_at" type="datetime-local" />
                </label>
                <label class="admin-field">
                  <span>演出長度（分鐘）</span>
                  <input name="duration_minutes" type="number" min="1" max="1440" inputmode="numeric" />
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend><span>03</span> 發布與原始 PDF</legend>
              <div class="admin-form-grid">
                <label class="admin-field">
                  <span>目前狀態</span>
                  <select name="visibility">
                    <option value="draft">草稿｜只有後台可見</option>
                    <option value="unlisted">不列入索引｜網址可讀</option>
                    <option value="published">已發布｜出現在首頁</option>
                    <option value="archived">已封存｜公開撤下</option>
                  </select>
                </label>
                <label class="admin-field admin-upload">
                  <span>上傳／替換 PDF</span>
                  <input name="pdf" type="file" accept="application/pdf,.pdf" />
                  <small id="programme-pdf-current">尚未上傳 · 上限 25 MB</small>
                </label>
              </div>
            </fieldset>

            <div class="admin-form-actions">
              <p class="admin-form-status" id="programme-form-status" role="status" aria-live="polite"></p>
              <button class="admin-button admin-button--primary" type="submit">儲存節目冊 <span>→</span></button>
            </div>
          </form>
        </section>
      </div>
    </section>
  `;
}

function accessDeniedTemplate() {
  return `
    <section class="admin-setup">
      <p class="admin-kicker">ACCESS DENIED</p>
      <h1>這個帳號尚未取得管理權限</h1>
      <p>帳號已成功登入，但不在 <code>public.admin_users</code> 名單中。請由專案擁有者加入後再重新整理。</p>
      <button class="admin-button admin-button--quiet" id="admin-denied-logout" type="button">登出</button>
    </section>
  `;
}

function localDateTimeValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const local = new Date(date.valueOf() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function nullable(value) {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

function formProgramme(form, existing) {
  const formData = new FormData(form);
  const startsAt = formData.get("starts_at");
  const duration = Number(formData.get("duration_minutes"));
  const visibility = String(formData.get("visibility"));

  return {
    client_slug: String(formData.get("client_slug")).trim().toLowerCase(),
    slug: String(formData.get("slug")).trim().toLowerCase(),
    title: String(formData.get("title")).trim(),
    title_en: nullable(formData.get("title_en")),
    summary: nullable(formData.get("summary")),
    production_type: nullable(formData.get("production_type")),
    venue: nullable(formData.get("venue")),
    starts_at: startsAt ? new Date(String(startsAt)).toISOString() : null,
    duration_minutes: Number.isFinite(duration) && duration > 0 ? duration : null,
    visibility,
    cover_theme: existing?.cover_theme || "sage",
    published_at: visibility === "published" ? existing?.published_at || new Date().toISOString() : existing?.published_at || null,
  };
}

function statusNode(message, tone = "neutral") {
  const node = document.createElement("span");
  node.className = `admin-status admin-status--${tone}`;
  node.textContent = message;
  return node;
}

export async function mountAdmin({ root, client }) {
  loadCjkWebFonts();
  root.hidden = false;
  root.innerHTML = adminTemplate();
  const main = root.querySelector("#admin-main");
  const account = root.querySelector("#admin-account");

  if (!client) {
    main.innerHTML = setupTemplate();
    account.append(statusNode("BACKEND NOT CONNECTED", "warning"));
    document.title = "後台設定｜OWLDIO MENU";
    window.__owldioReady = true;
    return;
  }

  const repository = new ProgrammeRepository(client);

  async function signOut() {
    await client.auth.signOut();
    await renderLogin();
  }

  async function renderLogin(errorMessage = "") {
    main.innerHTML = loginTemplate();
    account.replaceChildren(statusNode("SIGNED OUT"));
    document.title = "登入後台｜OWLDIO MENU";

    const form = main.querySelector("#admin-login-form");
    const status = main.querySelector("#admin-login-status");
    status.textContent = errorMessage;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submit = form.querySelector("button[type='submit']");
      const formData = new FormData(form);
      submit.disabled = true;
      status.textContent = "正在驗證帳號…";

      const { data, error } = await client.auth.signInWithPassword({
        email: String(formData.get("email")).trim(),
        password: String(formData.get("password")),
      });

      if (error) {
        status.textContent = "登入失敗，請確認 Email 與密碼。";
        submit.disabled = false;
        return;
      }

      await renderAuthenticated(data.user);
    });
  }

  async function isAdmin(userId) {
    const { data, error } = await client
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return Boolean(data);
  }

  async function renderAuthenticated(user) {
    document.title = "節目冊管理｜OWLDIO MENU";
    account.replaceChildren();
    const identity = document.createElement("span");
    identity.textContent = user.email || "ADMIN";
    const logout = document.createElement("button");
    logout.type = "button";
    logout.textContent = "登出";
    logout.addEventListener("click", signOut);
    account.append(identity, logout);

    let authorised = false;
    try {
      authorised = await isAdmin(user.id);
    } catch (error) {
      console.error("Unable to verify admin membership", error);
      main.innerHTML = setupTemplate();
      main.querySelector("h1").textContent = "後台資料表尚未部署完成";
      return;
    }

    if (!authorised) {
      main.innerHTML = accessDeniedTemplate();
      main.querySelector("#admin-denied-logout").addEventListener("click", signOut);
      return;
    }

    main.innerHTML = dashboardTemplate();
    const list = main.querySelector("#admin-programme-list");
    const count = main.querySelector("#admin-library-count");
    const stats = main.querySelector("#admin-stats");
    const form = main.querySelector("#programme-form");
    const status = main.querySelector("#programme-form-status");
    const heading = main.querySelector("#admin-editor-title");
    const preview = main.querySelector("#programme-preview");
    const pdfCurrent = main.querySelector("#programme-pdf-current");
    let programmes = [];
    let selectedId = null;

    function currentProgramme() {
      return programmes.find((programme) => programme.id === selectedId) || null;
    }

    function renderStats() {
      stats.replaceChildren();
      ["published", "unlisted", "draft", "archived"].forEach((visibility, index) => {
        const item = document.createElement("div");
        const number = document.createElement("strong");
        const label = document.createElement("span");
        const indexLabel = document.createElement("i");
        number.textContent = String(programmes.filter((programme) => programme.visibility === visibility).length).padStart(2, "0");
        label.textContent = programmeVisibilityLabels[visibility];
        indexLabel.textContent = `0${index + 1}`;
        item.append(indexLabel, number, label);
        stats.append(item);
      });
    }

    function renderList() {
      list.replaceChildren();
      count.textContent = String(programmes.length).padStart(2, "0");

      if (!programmes.length) {
        const empty = document.createElement("p");
        empty.className = "admin-library__empty";
        empty.textContent = "還沒有節目冊。從右側建立第一份作品。";
        list.append(empty);
        return;
      }

      programmes.forEach((programme, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `admin-programme${programme.id === selectedId ? " is-selected" : ""}`;
        button.dataset.programmeId = programme.id;

        const no = document.createElement("span");
        no.textContent = String(index + 1).padStart(2, "0");
        const copy = document.createElement("span");
        const title = document.createElement("strong");
        title.textContent = programme.title;
        const path = document.createElement("small");
        path.textContent = `/${programme.slug}`;
        copy.append(title, path);
        const visibility = document.createElement("i");
        visibility.dataset.visibility = programme.visibility;
        visibility.textContent = programmeVisibilityLabels[programme.visibility];
        button.append(no, copy, visibility);
        list.append(button);
      });
    }

    function fillForm(programme) {
      selectedId = programme?.id || null;
      form.reset();
      form.elements.id.value = programme?.id || "";
      form.elements.title.value = programme?.title || "";
      form.elements.title_en.value = programme?.title_en || "";
      form.elements.production_type.value = programme?.production_type || "";
      form.elements.venue.value = programme?.venue || "";
      form.elements.summary.value = programme?.summary || "";
      form.elements.client_slug.value = programme?.client_slug || "";
      form.elements.slug.value = programme?.slug || "";
      form.elements.starts_at.value = localDateTimeValue(programme?.starts_at);
      form.elements.duration_minutes.value = programme?.duration_minutes || "";
      form.elements.visibility.value = programme?.visibility || "draft";
      heading.textContent = programme ? `編輯｜${programme.title}` : "新增節目冊";
      status.textContent = "";

      if (programme?.pdf_filename) {
        const size = programme.pdf_size_bytes ? ` · ${(programme.pdf_size_bytes / 1024 / 1024).toFixed(1)} MB` : "";
        pdfCurrent.textContent = `${programme.pdf_filename}${size}`;
      } else {
        pdfCurrent.textContent = "尚未上傳 · 上限 25 MB";
      }

      if (programme && ["published", "unlisted"].includes(programme.visibility)) {
        preview.href = buildProgrammePath(programme.slug);
        preview.hidden = false;
      } else {
        preview.hidden = true;
      }
      renderList();
    }

    async function refresh(preferredId = selectedId) {
      programmes = await repository.listForAdmin();
      renderStats();
      selectedId = preferredId && programmes.some((item) => item.id === preferredId) ? preferredId : programmes[0]?.id || null;
      fillForm(currentProgramme());
    }

    list.addEventListener("click", (event) => {
      const button = event.target.closest("[data-programme-id]");
      if (button) {
        selectedId = button.dataset.programmeId;
        fillForm(currentProgramme());
      }
    });

    main.querySelector("#programme-new").addEventListener("click", () => fillForm(null));

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;

      const submit = form.querySelector("button[type='submit']");
      const existing = currentProgramme();
      const changes = formProgramme(form, existing);
      const file = form.elements.pdf.files[0];

      if (existing && !canTransitionVisibility(existing.visibility, changes.visibility)) {
        status.textContent = "已封存的節目冊需先改回草稿，才能重新發布。";
        return;
      }

      submit.disabled = true;
      status.textContent = "正在儲存資料…";

      try {
        let saved = existing
          ? await repository.update(existing.id, changes)
          : await repository.create(changes, user.id);

        if (file) {
          status.textContent = "資料已儲存，正在上傳 PDF…";
          saved = await repository.uploadPdf(saved.id, file);
        }

        await refresh(saved.id);
        status.textContent = file ? "節目冊與 PDF 已儲存。" : "節目冊已儲存。";
      } catch (error) {
        console.error("Unable to save programme", error);
        status.textContent = error.message || "儲存失敗，請稍後再試。";
      } finally {
        submit.disabled = false;
      }
    });

    try {
      await refresh();
    } catch (error) {
      console.error("Unable to load admin programmes", error);
      status.textContent = "無法讀取節目冊，請檢查資料庫政策。";
    }
  }

  const { data, error } = await client.auth.getSession();
  if (error || !data.session) {
    await renderLogin(error ? "登入狀態讀取失敗，請重新登入。" : "");
  } else {
    await renderAuthenticated(data.session.user);
  }

  window.__owldioReady = true;
}
