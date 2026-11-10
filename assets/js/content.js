/* The Skyn Room - live content
   Everything the studio (studio/) edits comes from Supabase: the treatment
   menu, the shop and product pages, the before & after photos, and the text
   and photos on every page (elements marked data-edit="key").
   Each page keeps a static copy of its content in the HTML: if a request
   fails or takes too long, that copy stays.
   main.js waits for window.__skynContent before it builds the scroll scenes,
   so every pin measures the final content. The curtain covers the wait. */

(() => {
  "use strict";

  const SUPABASE_URL = "https://sbtseghoaxglhaaanirs.supabase.co";
  const SUPABASE_KEY = "sb_publishable_tBmhij1x0ZXi1yUEfkahlA_ZnDrLPFT";
  const BOOKING_URL = "https://www.vagaro.com/theskynroom1/services";
  const TIMEOUT = 3000;
  const TONES = ["tone-sand", "tone-invert", "tone-taupe"];
  // the results page opens with this many photos as a spread deck
  const DECK = 6;

  const page = document.body.dataset.page || "";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  // multi-line text from the studio keeps its line breaks
  const para = (s) => esc(s).replace(/\n+/g, "<br>");
  const safeUrl = (u) => (/^https?:\/\/\S+$/i.test(u || "") || /^assets\/img\/[\w.-]+$/.test(u || "") ? u : "");
  const firstSentence = (s) => (String(s || "").match(/^.*?[.!?](\s|$)/) || [s || ""])[0].trim();

  // page text from the studio: *words* in italics, [text](link) for links,
  // a new line is a line break
  const LINK = /^(https?:\/\/|mailto:|tel:)\S+$|^[\w-]+\.html(#[\w-]+)?$|^#[\w-]+$/i;
  function rich(s) {
    return esc(s)
      .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (m, text, href) => {
        if (!LINK.test(href.replace(/&amp;/g, "&"))) return text;
        const out = /^https?:/i.test(href) ? ' target="_blank" rel="noopener"' : "";
        return `<a href="${href}"${out}>${text}</a>`;
      })
      .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
      .replace(/\n/g, "<br>");
  }

  function get(path, signal) {
    return fetch(SUPABASE_URL + "/rest/v1/" + path, { headers: { apikey: SUPABASE_KEY }, signal }).then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  /* ---------------- Page text and photos (every page) ---------------- */

  function applySite(rows) {
    const values = new Map(rows.map((r) => [r.key, r.value]));
    $$("[data-edit]").forEach((el) => {
      const key = el.dataset.edit;
      if (!values.has(key)) return;
      const v = values.get(key);

      if (el.tagName === "IMG") {
        const src = safeUrl(v);
        if (!src) return;
        el.src = src;
        el.removeAttribute("srcset");
        // a new photo has its own shape; the box around it keeps the layout
        el.removeAttribute("width");
        el.removeAttribute("height");
        if (el.parentElement.tagName === "PICTURE") $$("source", el.parentElement).forEach((s) => s.remove());
        return;
      }
      // a CSS background (the home hero strips): the stylesheet reads --photo
      if (el.hasAttribute("data-edit-bg")) {
        const src = safeUrl(v);
        if (!src) return;
        el.style.setProperty("--photo", `url("${src.replace(/["\\]/g, "")}")`);
        el.classList.add("has-photo");
        return;
      }
      // an emptied text is hidden
      if (!v) {
        el.hidden = true;
        return;
      }
      el.innerHTML = rich(v);
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

  /* ---------------- Before & after ---------------- */

  const resultAlt = (r) => (r.title ? `Before-and-after photos: ${r.title}` : "Before-and-after photos of a client’s skin");

  // home: the photos marked for the home page (up to three)
  function renderHomeResults(rows) {
    const box = $('[data-live="results-home"]');
    rows = rows.filter((r) => safeUrl(r.image_url));
    if (!box || !rows.length) return;
    const marked = rows.filter((r) => r.home);
    const pick = (marked.length ? marked : rows).slice(0, 3);
    box.innerHTML = pick
      .map(
        (r) => `
        <a class="rcard" href="results.html">
          <div class="media" data-img-reveal><img src="${esc(r.image_url)}" alt="${esc(resultAlt(r))}" loading="lazy"></div>
          <span class="label">${esc(r.treatment || "Before & After")}</span>
          ${r.title ? `<h3 class="h-card">${esc(r.title)}</h3>` : ""}
          <span class="label more">(View before &amp; after photos)</span>
        </a>`
      )
      .join("");
  }

  // results page: the first six spread out as the deck, the rest in a grid
  // below it; with fewer than six there is no deck, only the grid
  function renderResults(rows) {
    const deck = $('[data-live="deck"]');
    const more = $('[data-live="results-more"]');
    rows = rows.filter((r) => safeUrl(r.image_url));
    if (!deck || !more || !rows.length) return;
    const spread = rows.length >= DECK ? rows.slice(0, DECK) : [];
    const rest = rows.slice(spread.length);

    const attrs = (r) => {
      const label = r.title ? `Enlarge before-and-after photos: ${r.title}` : "Enlarge before-and-after photos";
      return `type="button" data-full="${esc(r.image_url)}" data-alt="${esc(resultAlt(r))}" aria-label="${esc(label)}"`;
    };
    deck.innerHTML = spread
      .map((r) => `<button class="deck__item" ${attrs(r)}><img src="${esc(r.image_url)}" alt="${esc(resultAlt(r))}"></button>`)
      .join("");
    more.innerHTML = rest
      .map(
        (r, i) => `<button class="ba-grid__item media" ${attrs(r)} data-reveal data-delay="${(i % 3) * 0.08}">
          <img src="${esc(r.image_url)}" alt="${esc(resultAlt(r))}" loading="lazy"></button>`
      )
      .join("");
    deck.closest("section").hidden = !spread.length;
    more.closest("section").hidden = !rest.length;
    more.closest("section").classList.toggle("ba-more--alone", !spread.length);
  }

  /* ---------------- Shop and product pages ---------------- */

  const productUrl = (p) => "product.html?" + (p.slug ? "p=" + encodeURIComponent(p.slug) : "id=" + encodeURIComponent(p.id));

  // the card shows the start of the description; the product page has it all
  function teaser(s) {
    const text = String(s || "").replace(/\s+/g, " ").trim();
    const first = firstSentence(text);
    const pick = first.length <= 160 ? first : text;
    return pick.length > 160 ? pick.slice(0, 160).replace(/\s+\S*$/, "") + "…" : pick;
  }

  function productAction(p) {
    const buy = safeUrl(p.buy_url);
    if (p.sold_out) return `<p class="label pcard__status">Sold out</p>`;
    if (buy) return `<a class="btn" href="${esc(buy)}" target="_blank" rel="noopener" aria-label="Buy ${esc(p.name)}">Buy Now</a>`;
    return `<p class="label pcard__status">Available in the studio</p>`;
  }

  function productMedia(p, cls) {
    const img = safeUrl(p.image_url);
    return img
      ? `<img src="${esc(img)}" alt="${esc(p.name)}"${cls === "pdetail" ? "" : ' loading="lazy"'}>`
      : `<span class="pcard__initial" aria-hidden="true">${esc((p.brand || p.name).trim().charAt(0))}</span>`;
  }

  function productCard(p) {
    const url = productUrl(p);
    return `
      <article class="pcard${p.sold_out ? " is-sold-out" : ""}" data-cat="${esc(p.category || "")}">
        <a class="media pcard__media" href="${url}" tabindex="-1" aria-hidden="true">${productMedia(p)}</a>
        <div class="pcard__body">
          ${p.brand ? `<p class="label pcard__brand">${esc(p.brand)}</p>` : ""}
          <h3 class="h-card"><a href="${url}">${esc(p.name)}</a></h3>
          ${p.price ? `<p class="pcard__price">${esc(p.price)}</p>` : ""}
          ${p.description ? `<p class="pcard__desc">${esc(teaser(p.description))}</p>` : ""}
          <div class="pcard__action">
            <a class="link-arrow" href="${url}" aria-label="View more about ${esc(p.name)}">View More <span class="arr">→</span></a>
            ${p.sold_out ? `<p class="label pcard__status">Sold out</p>` : ""}
          </div>
        </div>
      </article>`;
  }

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

  // product.html?p=<slug>: the whole description, the buy button and a few
  // other products; an unknown product keeps the "not found" note in the HTML
  function renderProduct(products) {
    const box = $('[data-live="product"]');
    if (!box) return;
    const q = new URLSearchParams(location.search);
    const slug = q.get("p");
    const id = q.get("id");
    const p = products.find((x) => (slug && x.slug === slug) || (id && x.id === id));
    if (!p) return;

    const paras = String(p.description || "")
      .split(/\n\s*\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => `<p>${para(s)}</p>`)
      .join("");
    box.innerHTML = `
      <div class="pdetail__media media${p.sold_out ? " is-sold-out" : ""}">${productMedia(p, "pdetail")}</div>
      <div class="pdetail__body">
        ${p.brand ? `<p class="label pdetail__brand">${esc(p.brand)}</p>` : ""}
        <h1 class="h-section pdetail__name">${esc(p.name)}</h1>
        ${p.price ? `<p class="pdetail__price">${esc(p.price)}</p>` : ""}
        ${paras ? `<div class="pdetail__desc">${paras}</div>` : ""}
        <div class="pdetail__action">${productAction(p)}</div>
        ${p.category ? `<p class="label pdetail__cat">${esc(p.category)}</p>` : ""}
      </div>`;

    const title = `${p.name}${p.brand ? " by " + p.brand : ""} | The Skyn Room`;
    const desc = teaser(p.description) || `${p.name}, available from The Skyn Room.`;
    document.title = title;
    const meta = (sel, attr, v) => {
      const el = $(sel);
      if (el) el.setAttribute(attr, v);
    };
    meta('meta[name="description"]', "content", desc);
    meta('meta[property="og:title"]', "content", title);
    meta('meta[property="og:description"]', "content", desc);
    meta('link[rel="canonical"]', "href", new URL(productUrl(p), location.href).href);

    const others = products.filter((x) => x !== p).slice(0, 4);
    const more = $('[data-live="product-more"]');
    if (more && others.length) {
      more.innerHTML = others.map(productCard).join("");
      more.closest("section").hidden = false;
    }
  }

  /* ---------------- Load ---------------- */

  const PRODUCTS = "products?select=*&visible=eq.true&order=sort.asc,created_at.asc";
  const RESULTS = "results?select=*&visible=eq.true&order=sort.asc,created_at.asc";

  function loadMenu(signal) {
    return Promise.all([
      get("categories?select=id,name&visible=eq.true&order=sort.asc,created_at.asc", signal),
      get("treatments?select=*&visible=eq.true&order=sort.asc,created_at.asc", signal),
    ]).then(([c, t]) => groupMenu(c, t));
  }

  // every page loads its text; then what is live on that page
  const jobs = {
    home: [(s) => loadMenu(s).then(renderHome), (s) => get(RESULTS, s).then(renderHomeResults)],
    treatments: [(s) => loadMenu(s).then(renderTreatments)],
    shop: [(s) => get(PRODUCTS, s).then(renderShop)],
    product: [(s) => get(PRODUCTS, s).then(renderProduct)],
    results: [(s) => get(RESULTS, s).then(renderResults)],
  };
  const parts = [(s) => get("site_content?select=key,value", s).then(applySite), ...(jobs[page] || [])];
  if (!window.fetch) return;

  // every part settles (or is aborted) before main.js builds the scenes, so a
  // slow answer can never re-render the page under scenes that already exist
  const ctrl = window.AbortController ? new AbortController() : null;
  const timer = setTimeout(() => ctrl && ctrl.abort(), TIMEOUT);
  window.__skynContent = Promise.all(
    parts.map((job) =>
      job(ctrl && ctrl.signal).catch((err) => {
        if (window.console) console.warn("Live content unavailable, showing the saved copy.", err);
      })
    )
  ).finally(() => clearTimeout(timer));
})();
