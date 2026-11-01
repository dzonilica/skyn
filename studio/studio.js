/* The Skyn Room - studio
   Edits the treatment menu and the shop on the live website.
   The key after # in the studio link is the password: it is kept on this
   device and sent with every request to the `admin` Edge Function, which
   checks it before it changes anything. */

(() => {
  "use strict";

  const API = "https://sbtseghoaxglhaaanirs.supabase.co/functions/v1/admin";
  const STORE_KEY = "skyn-studio-key";
  const STORE_TAB = "skyn-studio-tab";
  const SITE = new URL("../", location.href).href;

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const store = {
    get: (k) => {
      try {
        return localStorage.getItem(k);
      } catch (e) {
        return null;
      }
    },
    set: (k, v) => {
      try {
        localStorage.setItem(k, v);
      } catch (e) {}
    },
  };
  // photos saved with the site are relative (assets/img/...), uploads are full URLs
  const imgSrc = (u) => (!u ? "" : /^https?:/i.test(u) ? u : SITE + u);

  /* ---------------- Key ---------------- */

  let key = location.hash.replace(/^#(k=)?/, "").replace(/[^\w-]/g, "");
  if (key) store.set(STORE_KEY, key);
  else key = store.get(STORE_KEY) || "";
  const studioLink = () => location.href.split("#")[0] + "#" + key;

  /* ---------------- API ---------------- */

  class Unauthorized extends Error {}

  async function call(init) {
    let res;
    try {
      res = await fetch(API, { method: "POST", ...init, headers: { "x-admin-key": key, ...(init.headers || {}) } });
    } catch (e) {
      throw new Error("No connection. Check your internet and try again.");
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      showGate("This link no longer works. Use your newest studio link.");
      throw new Unauthorized(data.error);
    }
    if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
    return data;
  }

  const api = (action, payload = {}) =>
    call({ headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...payload }) });

  async function uploadPhoto(file, folder) {
    const blob = await shrink(file);
    const form = new FormData();
    form.append("file", blob, blob.type === "image/webp" ? "photo.webp" : "photo.jpg");
    form.append("folder", folder);
    return (await call({ body: form })).url;
  }

  // longest side 1600px; WebP where the browser can write it, JPEG otherwise
  async function shrink(file) {
    if (!/^image\//.test(file.type) && !/\.(heic|heif)$/i.test(file.name)) throw new Error("Choose a photo file.");
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, fail) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = () => fail(new Error("This photo can't be opened here. Try a JPG or PNG."));
        i.src = url;
      });
      const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      const encode = (type, q) => new Promise((ok) => canvas.toBlob(ok, type, q));
      let blob = await encode("image/webp", 0.84);
      if (!blob || blob.type !== "image/webp") blob = await encode("image/jpeg", 0.86);
      if (!blob) throw new Error("This photo couldn't be prepared. Try another one.");
      return blob;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /* ---------------- State ---------------- */

  const state = { categories: [], treatments: [], products: [] };
  const bySort = (a, b) => a.sort - b.sort || String(a.created_at).localeCompare(String(b.created_at));
  const catIds = () => new Set(state.categories.map((c) => c.id));

  // the rows that share an order with this one (treatments are ordered per category)
  function siblings(table, row) {
    if (table !== "treatments") return [...state[table]].sort(bySort);
    const ids = catIds();
    const groupOf = (t) => (t.category_id && ids.has(t.category_id) ? t.category_id : null);
    return state.treatments.filter((t) => groupOf(t) === groupOf(row)).sort(bySort);
  }

  function put(table, row) {
    const list = state[table];
    const i = list.findIndex((r) => r.id === row.id);
    if (i > -1) list[i] = row;
    else list.push(row);
  }

  /* ---------------- Toast ---------------- */

  let toastTimer;
  function toast(msg, error) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.toggle("is-error", !!error);
    el.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-on"), error ? 5000 : 3200);
  }

  /* ---------------- Lists ---------------- */

  function moveButtons(table, id, index, count, name) {
    return `<span class="move">
      <button type="button" data-move="${table}" data-id="${id}" data-dir="-1" aria-label="Move ${esc(name)} up"${index === 0 ? " disabled" : ""}>↑</button>
      <button type="button" data-move="${table}" data-id="${id}" data-dir="1" aria-label="Move ${esc(name)} down"${index === count - 1 ? " disabled" : ""}>↓</button>
    </span>`;
  }

  function row(table, r, index, count, meta, tags) {
    const src = imgSrc(r.image_url);
    return `<li class="row${r.visible ? "" : " is-hidden"}">
      <button class="row__open" type="button" data-edit="${table}" data-id="${r.id}">
        <span class="thumb">${src ? `<img src="${esc(src)}" alt="" loading="lazy">` : ""}</span>
        <span class="row__text">
          <span class="row__name">${esc(r.name)}</span>
          <span class="row__meta">${esc(meta)}</span>
          ${tags.length ? `<span class="row__tags">${tags.join("")}</span>` : ""}
        </span>
      </button>
      ${moveButtons(table, r.id, index, count, r.name)}
    </li>`;
  }

  function renderMenu() {
    const box = $("#menu-list");
    const cats = [...state.categories].sort(bySort);
    const groups = cats.map((c) => ({ cat: c, items: siblings("treatments", { category_id: c.id }) }));
    const loose = siblings("treatments", { category_id: null });
    if (loose.length) groups.push({ cat: null, items: loose });

    if (!groups.length) {
      box.innerHTML = `<p class="empty">Your menu is empty. Start with <strong>+ Category</strong> (for example “Facials”), then add treatments to it.</p>`;
      return;
    }

    box.innerHTML = groups
      .map((g, gi) => {
        const c = g.cat;
        const head = c
          ? `<button class="group__name" type="button" data-edit="categories" data-id="${c.id}">${esc(c.name)} <span class="edit">Edit</span></button>
             ${c.visible ? "" : `<span class="tag">Hidden</span>`}
             ${moveButtons("categories", c.id, gi, cats.length, c.name)}`
          : `<h2 class="group__name">No category</h2>`;
        const rows = g.items
          .map((t, i) => {
            const meta = [t.duration, t.price].filter(Boolean).join(" · ") || "No time or price yet";
            const tags = [];
            if (t.featured && t.image_url) tags.push(`<span class="tag tag--solid">Photo card</span>`);
            if (!t.visible) tags.push(`<span class="tag">Hidden</span>`);
            return row("treatments", t, i, g.items.length, meta, tags);
          })
          .join("");
        return `<section class="group${c && !c.visible ? " is-hidden" : ""}">
          <header class="group__head">${head}</header>
          ${rows ? `<ul class="rows">${rows}</ul>` : `<p class="hint">No treatments in this category yet.</p>`}
          ${c ? `<button class="add-in" type="button" data-new="treatments" data-category="${c.id}">+ Add to ${esc(c.name)}</button>` : ""}
        </section>`;
      })
      .join("");
  }

  function renderShop() {
    const box = $("#shop-list");
    const items = siblings("products");
    if (!items.length) {
      box.innerHTML = `<p class="empty">No products yet. Tap <strong>+ Product</strong> to add the first one.</p>`;
      return;
    }
    box.innerHTML = `<ul class="rows">${items
      .map((p, i) => {
        const meta = [p.brand, p.price].filter(Boolean).join(" · ") || "No brand or price yet";
        const tags = [];
        if (p.sold_out) tags.push(`<span class="tag tag--solid">Sold out</span>`);
        if (p.buy_url) tags.push(`<span class="tag">Buy online</span>`);
        if (p.category) tags.push(`<span class="tag">${esc(p.category)}</span>`);
        if (!p.visible) tags.push(`<span class="tag">Hidden</span>`);
        return row("products", p, i, items.length, meta, tags);
      })
      .join("")}</ul>`;
  }

  const render = () => {
    renderMenu();
    renderShop();
  };

  async function move(table, id, dir) {
    const r = state[table].find((x) => x.id === id);
    if (!r) return;
    const list = siblings(table, r);
    const i = list.indexOf(r);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    list.forEach((x, n) => (x.sort = n));
    render();
    const btn = $(`[data-move="${table}"][data-id="${id}"][data-dir="${dir}"]`);
    if (btn && !btn.disabled) btn.focus();
    else {
      const other = $(`[data-move="${table}"][data-id="${id}"][data-dir="${-dir}"]`);
      if (other) other.focus();
    }
    try {
      await api("reorder", { table, ids: list.map((x) => x.id) });
    } catch (e) {
      if (e instanceof Unauthorized) return;
      toast(e.message, true);
      load();
    }
  }

  /* ---------------- Editor ---------------- */

  const FORMS = {
    treatments: {
      noun: "treatment",
      sections: [
        {
          fields: [
            { name: "name", label: "Name", type: "text", max: 120, required: true, placeholder: "e.g. Signature Custom Facial" },
            { name: "category_id", label: "Category", type: "category" },
            {
              row: [
                { name: "price", label: "Price", type: "text", max: 40, placeholder: "e.g. $150" },
                { name: "duration", label: "Time", type: "text", max: 40, placeholder: "e.g. 60 min" },
              ],
            },
            { name: "description", label: "Description", type: "textarea", max: 2000, hint: "Shown on the menu and on the photo card." },
            { name: "visible", label: "Show on website", type: "switch", hint: "Switch off to hide it without deleting it." },
          ],
        },
        {
          legend: "Photo card",
          hint: "Large cards on the Treatments page and in the Home page slider.",
          fields: [
            { name: "image_url", label: "Photo", type: "photo", folder: "treatments" },
            { name: "featured", label: "Show as a photo card", type: "switch", hint: "Needs a photo." },
            { name: "short", label: "Short line", type: "text", max: 160, hint: "One line under the photo on the Home page.", placeholder: "e.g. Hydrating facial for dry, dull skin." },
            { name: "good_for", label: "Good for", type: "text", max: 160, placeholder: "e.g. Breakouts, oily skin" },
            { name: "badge", label: "Small label", type: "text", max: 60, hint: "Shown above the name, for example “New clients start here”." },
          ],
        },
        {
          legend: "Booking",
          fields: [
            {
              name: "booking_url",
              label: "Booking link",
              type: "url",
              max: 500,
              hint: "Optional. Paste this service's link from Vagaro. Leave empty to open your Vagaro menu.",
              placeholder: "https://www.vagaro.com/…",
            },
          ],
        },
      ],
      defaults: { visible: true, featured: false },
      check: (r) =>
        r.featured && !r.image_url ? "Add a photo to show it as a photo card, or switch off “Show as a photo card”." : "",
    },
    products: {
      noun: "product",
      sections: [
        {
          fields: [
            { name: "name", label: "Name", type: "text", max: 120, required: true, placeholder: "e.g. Gentle Hydrating Cleanser" },
            { name: "brand", label: "Brand", type: "text", max: 80 },
            {
              row: [
                { name: "price", label: "Price", type: "text", max: 40, placeholder: "e.g. $48" },
                { name: "category", label: "Category", type: "text", max: 60, list: "product-cats", placeholder: "e.g. Serums" },
              ],
            },
            { name: "description", label: "Description", type: "textarea", max: 2000, hint: "What it does and who it suits." },
            { name: "image_url", label: "Photo", type: "photo", folder: "products" },
          ],
        },
        {
          legend: "Buying",
          fields: [
            {
              name: "buy_url",
              label: "Buy link",
              type: "url",
              max: 500,
              hint: "Optional. A link where clients can buy it online. Leave empty to show “Available in the studio”.",
              placeholder: "https://…",
            },
            { name: "sold_out", label: "Sold out", type: "switch", hint: "Stays on the page, marked as sold out." },
            { name: "visible", label: "Show on website", type: "switch", hint: "Switch off to hide it without deleting it." },
          ],
        },
      ],
      defaults: { visible: true, sold_out: false },
      check: () => "",
    },
    categories: {
      noun: "category",
      sections: [
        {
          fields: [
            { name: "name", label: "Category name", type: "text", max: 80, required: true, placeholder: "e.g. Facials" },
            { name: "visible", label: "Show on website", type: "switch", hint: "Hiding a category hides all of its treatments." },
          ],
        },
      ],
      defaults: { visible: true },
      check: () => "",
    },
  };

  const dialog = $("#editor");
  const form = $("#editor-form");
  const body = $("#editor-body");
  const errorEl = $("#editor-error");
  let editing = null; // { table, row, start }

  function fieldHtml(f, r) {
    const id = "f-" + f.name;
    const v = r[f.name];
    const hint = f.hint ? `<p class="hint" id="${id}-hint">${esc(f.hint)}</p>` : "";
    const described = f.hint ? ` aria-describedby="${id}-hint"` : "";
    const label = `<label class="label" for="${id}">${esc(f.label)}${f.required ? ' <span class="req">(required)</span>' : ""}</label>`;

    switch (f.type) {
      case "switch":
        return `<label class="switch">
          <span class="switch__text"><span class="label">${esc(f.label)}</span>${hint}</span>
          <input type="checkbox" role="switch" name="${f.name}" id="${id}"${v ? " checked" : ""}${described}>
        </label>`;
      case "textarea":
        return `<div class="field">${label}${hint}
          <textarea class="input" name="${f.name}" id="${id}" maxlength="${f.max}" rows="5"${described}>${esc(v)}</textarea></div>`;
      case "category": {
        const opts = [...state.categories]
          .sort(bySort)
          .map((c) => `<option value="${c.id}"${c.id === v ? " selected" : ""}>${esc(c.name)}${c.visible ? "" : " (hidden)"}</option>`)
          .join("");
        return `<div class="field">${label}
          <select class="input" name="${f.name}" id="${id}">
            ${opts}
            <option value=""${!v ? " selected" : ""}>No category</option>
            <option value="__new">+ New category…</option>
          </select></div>`;
      }
      case "photo": {
        const src = imgSrc(v);
        return `<div class="field">
          <span class="label">${esc(f.label)}</span>
          <div class="photo">
            <div class="photo__preview">${src ? `<img src="${esc(src)}" alt="">` : "No photo"}</div>
            <div class="photo__actions">
              <input class="photo__file" type="file" accept="image/*" id="${id}" data-folder="${f.folder}">
              <label class="btn btn--ghost" for="${id}">${src ? "Change photo" : "Choose photo"}</label>
              <button class="btn btn--danger" type="button" data-remove-photo${src ? "" : " hidden"}>Remove photo</button>
            </div>
          </div>
          <input type="hidden" name="${f.name}" value="${esc(v)}"></div>`;
      }
      default: {
        const type = f.type === "url" ? "url" : "text";
        const list = f.list ? ` list="${f.list}"` : "";
        const extra = f.list
          ? `<datalist id="${f.list}">${[...new Set(state.products.map((p) => p.category).filter(Boolean))]
              .map((c) => `<option value="${esc(c)}">`)
              .join("")}</datalist>`
          : "";
        return `<div class="field">${label}${hint}
          <input class="input" type="${type}" name="${f.name}" id="${id}" value="${esc(v)}" maxlength="${f.max}"${
            f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ""
          }${f.type === "url" ? ' inputmode="url" autocapitalize="off" spellcheck="false"' : ""}${list}${described}>${extra}</div>`;
      }
    }
  }

  function readForm(table) {
    const out = {};
    FORMS[table].sections.forEach((s) =>
      s.fields
        .flatMap((f) => f.row || [f])
        .forEach((f) => {
          const el = form.elements[f.name];
          if (!el) return;
          out[f.name] = f.type === "switch" ? el.checked : el.value.trim();
        })
    );
    return out;
  }

  function openEditor(table, r) {
    const spec = FORMS[table];
    const isNew = !r.id;
    editing = { table, row: r };
    $("#editor-title").textContent = (isNew ? "New " : "Edit ") + spec.noun;
    body.innerHTML = spec.sections
      .map(
        (s) => `<fieldset class="fieldset">
          ${s.legend ? `<legend>${esc(s.legend)}</legend>` : ""}
          ${s.hint ? `<p class="hint">${esc(s.hint)}</p>` : ""}
          ${s.fields.map((f) => (f.row ? `<div class="field__row">${f.row.map((x) => fieldHtml(x, r)).join("")}</div>` : fieldHtml(f, r))).join("")}
        </fieldset>`
      )
      .join("");
    $("[data-delete]", form).hidden = isNew;
    errorEl.textContent = "";
    editing.start = JSON.stringify(readForm(table));
    dialog.showModal();
    body.scrollTop = 0;
    if (isNew) {
      const first = $("input.input, textarea.input", body);
      if (first) first.focus();
    }
  }

  const isDirty = () => editing && JSON.stringify(readForm(editing.table)) !== editing.start;

  function closeEditor(force) {
    if (!force && isDirty() && !confirm("Close without saving your changes?")) return;
    editing = null;
    dialog.close();
  }

  function setBusy(busy) {
    $$(".editor__buttons button", form).forEach((b) => (b.disabled = busy));
    $("[data-save]", form).setAttribute("aria-busy", String(busy));
    $("[data-save]", form).textContent = busy ? "Saving…" : "Save";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!editing) return;
    const { table, row: r } = editing;
    const values = readForm(table);
    const missing = FORMS[table].sections
      .flatMap((s) => s.fields.flatMap((f) => f.row || [f]))
      .find((f) => f.required && !values[f.name]);
    const problem = missing ? `Add the ${missing.label.toLowerCase()}.` : FORMS[table].check(values);
    if (problem) {
      errorEl.textContent = problem;
      return;
    }
    errorEl.textContent = "";
    setBusy(true);
    try {
      const saved = await api("save", { table, row: r.id ? { id: r.id, ...values } : values });
      put(table, saved);
      render();
      closeEditor(true);
      toast("Saved. It's live on the website.");
    } catch (err) {
      if (!(err instanceof Unauthorized)) errorEl.textContent = err.message;
    } finally {
      setBusy(false);
    }
  });

  form.addEventListener("click", async (e) => {
    if (e.target.closest("[data-cancel]")) {
      closeEditor(false);
      return;
    }
    if (e.target.closest("[data-remove-photo]")) {
      form.elements.image_url.value = "";
      $(".photo__preview", form).textContent = "No photo";
      $(".photo__actions label", form).textContent = "Choose photo";
      e.target.closest("[data-remove-photo]").hidden = true;
      return;
    }
    if (e.target.closest("[data-delete]") && editing) {
      const { table, row: r } = editing;
      let msg = `Delete “${r.name}”? This can't be undone.`;
      if (table === "categories") {
        const n = state.treatments.filter((t) => t.category_id === r.id).length;
        if (n) msg = `Delete the category “${r.name}”? Its ${n} treatment${n > 1 ? "s" : ""} will move to “No category”.`;
      }
      if (!confirm(msg)) return;
      setBusy(true);
      try {
        await api("delete", { table, id: r.id });
        state[table] = state[table].filter((x) => x.id !== r.id);
        if (table === "categories") state.treatments.forEach((t) => t.category_id === r.id && (t.category_id = null));
        render();
        closeEditor(true);
        toast("Deleted.");
      } catch (err) {
        if (!(err instanceof Unauthorized)) errorEl.textContent = err.message;
      } finally {
        setBusy(false);
      }
    }
  });

  form.addEventListener("change", async (e) => {
    const el = e.target;

    // photo picked: shrink, upload, preview
    if (el.matches(".photo__file") && el.files && el.files[0]) {
      const preview = $(".photo__preview", form);
      const pick = $(".photo__actions label", form);
      const save = $("[data-save]", form);
      preview.textContent = "Uploading…";
      save.disabled = true;
      errorEl.textContent = "";
      try {
        const url = await uploadPhoto(el.files[0], el.dataset.folder);
        form.elements.image_url.value = url;
        preview.innerHTML = `<img src="${esc(url)}" alt="">`;
        pick.textContent = "Change photo";
        $("[data-remove-photo]", form).hidden = false;
      } catch (err) {
        const old = form.elements.image_url.value;
        preview.innerHTML = old ? `<img src="${esc(imgSrc(old))}" alt="">` : "No photo";
        if (!(err instanceof Unauthorized)) errorEl.textContent = err.message;
      } finally {
        save.disabled = false;
        el.value = "";
      }
      return;
    }

    // "+ New category…" in the category list
    if (el.name === "category_id" && el.value === "__new") {
      const name = (prompt("Name of the new category (for example “Add-ons”)") || "").trim();
      if (!name) {
        el.value = editing.row.category_id || "";
        return;
      }
      try {
        const cat = await api("save", { table: "categories", row: { name, visible: true } });
        state.categories.push(cat);
        render();
        el.insertBefore(new Option(cat.name, cat.id), el.querySelector('option[value=""]'));
        el.value = cat.id;
      } catch (err) {
        el.value = editing.row.category_id || "";
        if (!(err instanceof Unauthorized)) errorEl.textContent = err.message;
      }
    }
  });

  // Escape closes the dialog: ask first if something changed
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeEditor(false);
  });

  /* ---------------- Page actions ---------------- */

  document.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t || t.closest("#editor")) return;

    if (t.dataset.tab) return showTab(t.dataset.tab);
    if (t.dataset.move) return move(t.dataset.move, t.dataset.id, parseInt(t.dataset.dir, 10));
    if (t.dataset.edit) {
      const r = state[t.dataset.edit].find((x) => x.id === t.dataset.id);
      if (r) openEditor(t.dataset.edit, { ...r });
      return;
    }
    if (t.dataset.new) {
      const table = t.dataset.new;
      const r = { ...FORMS[table].defaults };
      if (table === "treatments") {
        const first = [...state.categories].sort(bySort)[0];
        r.category_id = t.dataset.category || (first ? first.id : null);
      }
      openEditor(table, r);
    }
  });

  /* ---------------- Tabs ---------------- */

  const TABS = ["menu", "shop", "help"];
  let currentTab = "menu";
  function showTab(name) {
    if (!TABS.includes(name)) name = "menu";
    currentTab = name;
    TABS.forEach((t) => {
      const on = t === name;
      const tab = $("#tab-" + t);
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      $("#panel-" + t).hidden = !on;
    });
    store.set(STORE_TAB, name);
  }
  $(".tabs").addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = TABS.indexOf(currentTab);
    const next = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
    showTab(next);
    $("#tab-" + next).focus();
  });

  /* ---------------- Secret link ---------------- */

  function showLink() {
    $("#studio-link").value = studioLink();
  }

  $("#copy-link").addEventListener("click", async () => {
    const input = $("#studio-link");
    try {
      await navigator.clipboard.writeText(input.value);
    } catch (e) {
      input.select();
      document.execCommand("copy");
    }
    toast("Link copied.");
  });

  $("#rotate-link").addEventListener("click", async (e) => {
    if (!confirm("Make a new secret link? The current link will stop working on every device.")) return;
    const btn = e.currentTarget;
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const next = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    btn.setAttribute("aria-busy", "true");
    try {
      await api("rotate", { newKey: next });
      key = next;
      store.set(STORE_KEY, key);
      history.replaceState(null, "", "#" + key);
      showLink();
      toast("New link ready. Copy it and keep it somewhere safe.");
    } catch (err) {
      if (!(err instanceof Unauthorized)) toast(err.message, true);
    } finally {
      btn.removeAttribute("aria-busy");
    }
  });

  /* ---------------- Start ---------------- */

  function showGate(text) {
    $("#loading").hidden = true;
    $(".tabs").hidden = true;
    TABS.forEach((t) => ($("#panel-" + t).hidden = true));
    if (dialog.open) dialog.close();
    $("#gate").hidden = false;
    if (text) $("#gate-text").textContent = text;
  }

  async function load() {
    const data = await api("load");
    state.categories = data.categories || [];
    state.treatments = data.treatments || [];
    state.products = data.products || [];
    render();
  }

  async function start() {
    if (!key) return showGate();
    try {
      await load();
    } catch (e) {
      if (e instanceof Unauthorized) return;
      $("#loading").textContent = e.message;
      return;
    }
    $("#loading").hidden = true;
    $(".tabs").hidden = false;
    showLink();
    showTab(store.get(STORE_TAB) || "menu");
  }

  start();
})();
