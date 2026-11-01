/* The Skyn Room - live content
   The treatment menu and the shop come from Supabase, edited on the secret
   studio page (studio/). Each page keeps a static copy of its content in the
   HTML: if the request fails or takes too long, that copy stays.
   main.js waits for window.__skynContent before it builds the scroll scenes,
   so every pin measures the final content. The curtain covers the wait. */

(() => {
  "use strict";

  const SUPABASE_URL = "https://sbtseghoaxglhaaanirs.supabase.co";
  const SUPABASE_KEY = "sb_publishable_tBmhij1x0ZXi1yUEfkahlA_ZnDrLPFT";
  const BOOKING_URL = "https://www.vagaro.com/theskynroom1/services";
  const TIMEOUT = 3000;
  const TONES = ["tone-sand", "tone-invert", "tone-taupe"];

  const page = document.body.dataset.page || "";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  // multi-line text from the studio keeps its line breaks
  const para = (s) => esc(s).replace(/\n+/g, "<br>");
  const safeUrl = (u) => (/^https?:\/\/\S+$/i.test(u || "") || /^assets\/img\/[\w.-]+$/.test(u || "") ? u : "");
  const firstSentence = (s) => (String(s || "").match(/^.*?[.!?](\s|$)/) || [s || ""])[0].trim();

  function get(path, signal) {
    return fetch(SUPABASE_URL + "/rest/v1/" + path, { headers: { apikey: SUPABASE_KEY }, signal }).then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  // categories in order, each with its visible treatments; a treatment in a
  // hidden category is hidden too, one without a category goes last
  function groupMenu(categories, treatments) {
    const groups = categories.map((c) => ({ name: c.name, items: [] }));
    const byId = new Map(categories.map((c, i) => [c.id, groups[i]]));
    const loose = { name: "More treatments", items: [] };
    treatments.forEach((t) => {
      if (!t.category_id) loose.items.push(t);
      else if (byId.has(t.category_id)) byId.get(t.category_id).items.push(t);
    });
    if (loose.items.length) groups.push(loose);
    return groups.filter((g) => g.items.length);
  }

  // a booking link: the service's own Vagaro link, or the menu (main.js
  // points every [data-book] link at the Vagaro menu)
  function bookAttrs(t) {
    const own = safeUrl(t.booking_url);
    return own
      ? `href="${esc(own)}" target="_blank" rel="noopener"`
      : `data-book href="${BOOKING_URL}" target="_blank" rel="noopener"`;
  }

  const hasCard = (t) => t.featured && safeUrl(t.image_url);

  /* ---------------- Treatments page ---------------- */

  function renderTreatments(groups) {
    const menu = $('[data-live="menu"]');
    const cursor = $('[data-live="cursor"]');
    const stack = $('[data-live="stack"]');
    if (!menu || !groups.length) return;

    const all = groups.flatMap((g) => g.items.map((t) => ({ ...t, category: g.name })));
    const withImg = all.filter((t) => safeUrl(t.image_url));

    menu.innerHTML = groups
      .map(
        (g) => `
        <div class="tmenu__group">
          <h3 class="tmenu__cat">${esc(g.name)}</h3>
          <ul class="tmenu__list">${g.items.map(menuRow).join("")}</ul>
        </div>`
      )
      .join("");

    if (cursor) {
      cursor.innerHTML = withImg.map((t) => `<img src="${esc(t.image_url)}" alt="" loading="lazy">`).join("");
    }

    const cards = all.filter(hasCard);
    if (stack) {
      stack.innerHTML = cards.map((t, i) => stackCard(t, i)).join("");
      stack.hidden = !cards.length;
    }

    // data-cursor = the row's photo in the cursor box (main.js shows it on hover)
    function menuRow(t) {
      const img = withImg.findIndex((x) => x.id === t.id);
      const name = hasCard(t) ? `<a href="#${esc(t.slug)}">${esc(t.name)}</a>` : esc(t.name);
      const meta = [t.duration, t.price].filter(Boolean);
      return `
        <li class="tmenu__row"${img > -1 ? ` data-cursor="${img}"` : ""}>
          <div class="tmenu__main">
            ${t.badge ? `<p class="label tmenu__badge">${esc(t.badge)}</p>` : ""}
            <h4 class="tmenu__name">${name}</h4>
            ${t.description ? `<p class="tmenu__desc">${para(t.description)}</p>` : ""}
          </div>
          <div class="tmenu__meta">
            ${t.price ? `<span class="tmenu__price">${esc(t.price)}</span>` : ""}
            ${t.duration ? `<span class="label tmenu__time">${esc(t.duration)}</span>` : ""}
            <a class="link-arrow tmenu__book" ${bookAttrs(t)} aria-label="Book ${esc(t.name)}${meta.length ? ", " + esc(meta.join(", ")) : ""}">Book <span class="arr">→</span></a>
          </div>
        </li>`;
    }
  }

  function stackCard(t, i) {
    const facts = [
      ["Good for", t.good_for],
      ["Time", t.duration],
      ["Price", t.price],
    ].filter((f) => f[1]);
    return `
      <article class="tstack__card" id="${esc(t.slug)}">
        <div class="tstack__inner ${TONES[i % TONES.length]}">
          <div class="tstack__media"><img src="${esc(t.image_url)}" alt="${esc(t.name)}" loading="lazy"></div>
          <div class="tstack__body">
            <p class="label">${esc(t.badge || t.category)}</p>
            <h2 class="h-section">${esc(t.name)}</h2>
            ${t.description ? `<p class="body-serif">${para(t.description)}</p>` : ""}
            ${facts.length ? `<dl class="tstack__good">${facts.map((f) => `<dt>${f[0]}</dt><dd>${esc(f[1])}</dd>`).join("")}</dl>` : ""}
            <div class="tstack__actions">
              <a class="btn" ${bookAttrs(t)}>Book Online</a>
              <a class="link-arrow" href="contact.html">Ask a Question <span class="arr">→</span></a>
            </div>
          </div>
        </div>
      </article>`;
  }

  /* ---------------- Home: horizontal treatment cards ---------------- */

  function renderHome(groups) {
    const box = $('[data-live="cards"]');
    if (!box) return;
    const all = groups.flatMap((g) => g.items);
    let cards = all.filter(hasCard);
    if (!cards.length) cards = all.filter((t) => safeUrl(t.image_url));
    if (!cards.length) return;
    box.innerHTML = cards
      .map((t) => {
        const meta = [t.duration, t.price].filter(Boolean).join(" · ");
        const href = hasCard(t) ? `treatments.html#${esc(t.slug)}` : "treatments.html#menu";
        return `
          <article class="tcard">
            <a class="media" href="${href}" aria-label="${esc(t.name)} details"><img src="${esc(t.image_url)}" alt="" loading="lazy"></a>
            <h3 class="h-card">${esc(t.name)}</h3>
            <p>${esc(t.short || firstSentence(t.description))}</p>
            ${meta ? `<p class="label tcard__meta">${esc(meta)}</p>` : ""}
            <a class="link-arrow" ${bookAttrs(t)}>Book Online <span class="arr">→</span></a>
          </article>`;
      })
      .join("");
  }

  /* ---------------- Shop ---------------- */

  function renderShop(products) {
    const grid = $('[data-live="shop"]');
    const filters = $('[data-live="shop-filters"]');
    const empty = $(".shop__empty");
    if (!grid) return;

    grid.innerHTML = products.map(productCard).join("");
    grid.hidden = !products.length;
    if (empty) empty.hidden = !!products.length;

    const cats = [...new Set(products.map((p) => p.category).filter(Boolean))];
    if (!filters || cats.length < 2) return;
    filters.innerHTML = ["All", ...cats]
      .map((c, i) => `<button class="chip" type="button" aria-pressed="${i === 0}" data-cat="${i ? esc(c) : ""}">${esc(c)}</button>`)
      .join("");
    filters.hidden = false;
    filters.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-cat]");
      if (!btn) return;
      $$("button", filters).forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      $$(".pcard", grid).forEach((card) => {
        card.hidden = !!btn.dataset.cat && card.dataset.cat !== btn.dataset.cat;
      });
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    });
  }

  function productCard(p) {
    const img = safeUrl(p.image_url);
    const buy = safeUrl(p.buy_url);
    let action;
    if (p.sold_out) action = `<p class="label pcard__status">Sold out</p>`;
    else if (buy) action = `<a class="btn btn--sm" href="${esc(buy)}" target="_blank" rel="noopener" aria-label="Buy ${esc(p.name)}">Buy Now</a>`;
    else action = `<p class="label pcard__status">Available in the studio</p>`;
    return `
      <article class="pcard${p.sold_out ? " is-sold-out" : ""}" data-cat="${esc(p.category || "")}">
        <div class="media pcard__media">${
          img
            ? `<img src="${esc(img)}" alt="${esc(p.name)}" loading="lazy">`
            : `<span class="pcard__initial" aria-hidden="true">${esc((p.brand || p.name).trim().charAt(0))}</span>`
        }</div>
        <div class="pcard__body">
          ${p.brand ? `<p class="label pcard__brand">${esc(p.brand)}</p>` : ""}
          <h3 class="h-card">${esc(p.name)}</h3>
          ${p.price ? `<p class="pcard__price">${esc(p.price)}</p>` : ""}
          ${p.description ? `<p class="pcard__desc">${para(p.description)}</p>` : ""}
          <div class="pcard__action">${action}</div>
        </div>
      </article>`;
  }

  /* ---------------- Load ---------------- */

  const jobs = {
    home: (signal) => loadMenu(signal).then(renderHome),
    treatments: (signal) => loadMenu(signal).then(renderTreatments),
    shop: (signal) =>
      get("products?select=*&visible=eq.true&order=sort.asc,created_at.asc", signal).then(renderShop),
  };

  function loadMenu(signal) {
    return Promise.all([
      get("categories?select=id,name&visible=eq.true&order=sort.asc,created_at.asc", signal),
      get("treatments?select=*&visible=eq.true&order=sort.asc,created_at.asc", signal),
    ]).then(([c, t]) => groupMenu(c, t));
  }

  const job = jobs[page];
  if (!job || !window.fetch) return;

  // a slow answer is dropped (aborted), so it can never re-render the page
  // under scenes that were already built
  const ctrl = window.AbortController ? new AbortController() : null;
  const timer = setTimeout(() => ctrl && ctrl.abort(), TIMEOUT);
  window.__skynContent = job(ctrl && ctrl.signal)
    .catch((err) => {
      if (window.console) console.warn("Live content unavailable, showing the saved copy.", err);
    })
    .finally(() => clearTimeout(timer));
})();
