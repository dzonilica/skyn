/* The Skyn Room - interactions
   GSAP 3 + ScrollTrigger + SplitText, Lenis smooth scroll.
   Every pinned ("stop scroll") scene runs on desktop and on phones, each
   with its own layout (see the PHONE block at the end of style.css). Pins
   are skipped on very short screens (landscape phones) and entirely when
   the visitor prefers reduced motion.
   Pages with live content (content.js) render it first, behind the curtain,
   so the scenes are built on the final page. */

window.__skynReady = true;

(window.__skynContent || Promise.resolve()).then(() => {
  "use strict";

  const root = document.documentElement;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  const page = document.body.dataset.page || "";
  const BOOKING_URL = "https://www.vagaro.com/theskynroom1/services";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  let menuOpen = false;

  // If GSAP failed to load, show everything and keep the site usable.
  if (!hasGsap) {
    root.classList.remove("js");
    root.classList.add("no-js");
    initMenu(null);
    initForm();
    initLightbox(null);
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  if (window.SplitText) gsap.registerPlugin(SplitText);
  // phones: the browser bar sliding in and out must not re-measure every
  // pin mid-scroll (that is what makes pinned sections jump on iOS)
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* ---------------- Smooth scroll ---------------- */

  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 0.9 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  const scrollToTarget = (target) => {
    if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.4 });
    else target.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  };

  $$('a[href^="#"]').forEach((a) => {
    const id = a.getAttribute("href");
    if (id.length < 2) return;
    a.addEventListener("click", (e) => {
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      scrollToTarget(target);
    });
  });

  /* ---------------- Booking links always open Vagaro ---------------- */

  $$("[data-book]").forEach((a) => {
    a.setAttribute("href", BOOKING_URL);
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener");
  });

  /* ---------------- Header ---------------- */

  const header = $(".site-header");
  if (header) {
    ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate(self) {
        const y = self.scroll();
        header.classList.toggle("is-scrolled", y > 24);
        header.classList.toggle("is-hidden", !menuOpen && self.direction === 1 && y > 320);
      },
    });
  }

  initMenu(lenis);

  /* ---------------- Page curtain + transitions ---------------- */

  const curtain = $(".curtain");

  const leaveTo = (href) => {
    if (!curtain || reduce) {
      window.location.href = href;
      return;
    }
    gsap.fromTo(
      curtain,
      { yPercent: 100 },
      {
        yPercent: 0,
        duration: 0.75,
        ease: "expo.inOut",
        onComplete: () => (window.location.href = href),
      }
    );
  };

  $$("a[href]").forEach((a) => {
    const href = a.getAttribute("href");
    if (!href || href.startsWith("#") || a.target === "_blank" || a.hasAttribute("download")) return;
    if (/^(mailto:|tel:|https?:)/i.test(href)) return;
    a.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      leaveTo(href);
    });
  });

  window.addEventListener("pageshow", (e) => {
    if (e.persisted && curtain) gsap.set(curtain, { yPercent: -100 });
  });

  /* ---------------- Page scenes (pins first, in page order) ---------------- */

  // keep these in sync with the media queries in style.css
  const mm = gsap.matchMedia();
  const DESKTOP = "(min-width: 900px) and (min-height: 520px) and (prefers-reduced-motion: no-preference)";
  const MOBILE = "(max-width: 899px) and (min-height: 500px) and (prefers-reduced-motion: no-preference)";
  const ANY_MOTION = "(prefers-reduced-motion: no-preference)";
  const COND = { desktop: DESKTOP, mobile: MOBILE, motion: ANY_MOTION };
  // shared pin settings: Lenis already smooths desktop, so phones (native
  // touch scroll) get a lighter scrub and anticipatePin against the late
  // first frame of a pin on a compositor-scrolled page
  const pinOpts = (mobile) => ({ pin: true, scrub: mobile ? 0.5 : 1, anticipatePin: 1, invalidateOnRefresh: true });

  const scenes = {
    home: homeScenes,
    treatments: treatmentScenes,
    about: aboutScenes,
    results: resultsScenes,
    contact: () => {},
  };
  (scenes[page] || (() => {}))();

  footerScene();
  rippleScenes();

  /* ---------------- Intro: lift the curtain, then reveal ---------------- */

  const intro = gsap.timeline();
  if (curtain && !reduce) {
    intro.to(curtain, { yPercent: -100, duration: 1.05, ease: "expo.inOut", delay: 0.15 });
    intro.add(initReveals, 0.55);
    if (page === "home") intro.add(heroIntro, 0.5);
  } else {
    if (curtain) gsap.set(curtain, { autoAlpha: 0 });
    initReveals();
  }

  initForm();
  initLightbox(lenis);
  initFaq();

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }
  window.addEventListener("load", () => ScrollTrigger.refresh());

  /* =========================================================
     Generic reveals
     ========================================================= */

  function initReveals() {
    if (reduce) return;

    $$("[data-split]").forEach((el) => {
      const delay = parseFloat(el.dataset.delay || 0);
      if (!window.SplitText) {
        gsap.from(el, { autoAlpha: 0, y: 30, duration: 1, delay });
        return;
      }
      SplitText.create(el, {
        type: "lines",
        mask: "lines",
        linesClass: "split-line",
        autoSplit: true,
        onSplit(self) {
          return gsap.from(self.lines, {
            yPercent: 115,
            duration: 1.3,
            ease: "expo.out",
            stagger: 0.09,
            delay,
            scrollTrigger: { trigger: el, start: "top 92%", once: true },
          });
        },
      });
    });

    $$("[data-reveal]").forEach((el) => {
      gsap.to(el, {
        autoAlpha: 1,
        y: 0,
        duration: 1.2,
        ease: "expo.out",
        delay: parseFloat(el.dataset.delay || 0),
        // the hero is always on screen at load: no trigger, so copy that sits
        // low on a short screen is not left waiting for a scroll
        scrollTrigger: el.closest(".hero") ? null : { trigger: el, start: "top 90%", once: true },
      });
    });

    $$("[data-img-reveal]").forEach((m) => {
      const img = $("img", m);
      const tl = gsap.timeline({ scrollTrigger: { trigger: m, start: "top 88%", once: true } });
      tl.fromTo(
        m,
        { clipPath: "inset(100% 0% 0% 0%)" },
        { clipPath: "inset(0% 0% 0% 0%)", duration: 1.5, ease: "expo.inOut" }
      );
      if (img) tl.fromTo(img, { scale: 1.3 }, { scale: 1, duration: 2, ease: "expo.out" }, 0.15);
    });

    $$("[data-parallax]").forEach((img) => {
      const amt = parseFloat(img.dataset.parallax || 8);
      gsap.fromTo(
        img,
        { yPercent: -amt, scale: 1.18 },
        {
          yPercent: amt,
          scale: 1.18,
          ease: "none",
          scrollTrigger: { trigger: img.parentElement, start: "top bottom", end: "bottom top", scrub: true },
        }
      );
    });

    $$("[data-scrub]").forEach((el) => {
      if (!window.SplitText) return;
      SplitText.create(el, {
        type: "words",
        autoSplit: true,
        onSplit(self) {
          return gsap.fromTo(
            self.words,
            { opacity: 0.16 },
            {
              opacity: 1,
              ease: "none",
              stagger: 0.1,
              scrollTrigger: { trigger: el, start: "top 80%", end: "bottom 45%", scrub: true },
            }
          );
        },
      });
    });

    ScrollTrigger.sort();
    ScrollTrigger.refresh();
  }

  /* =========================================================
     HOME
     ========================================================= */

  // strips rise into their slots, then the two headline lines follow
  function heroIntro() {
    const shifts = $$(".hero__shift");
    if (!shifts.length) return;
    gsap.from(shifts, {
      y: (i, el) => el.parentElement.offsetHeight * 1.04,
      duration: 1.6,
      ease: "expo.out",
      stagger: 0.07,
    });
    // brown h1 and every cream copy share the classes, so they move as one
    gsap.from(".hero__line--a > *", { yPercent: 112, duration: 1.5, ease: "expo.out", delay: 0.2 });
    gsap.from(".hero__line--b > *", { yPercent: 112, duration: 1.5, ease: "expo.out", delay: 0.34 });
  }

  function heroScene({ desktop, mobile }) {
    if (!desktop && !mobile) return;
    const hero = $(".hero");
    const stage = $(".hero__stage");
    const panel = $(".hero__panel");
    const base = panel && $(".hero__slice", panel);
    if (!hero || !stage || !base) return;

    // cut the photo: clone the single strip from the markup
    const n = mobile ? 5 : 7;
    const clones = [];
    for (let i = 1; i < n; i++) {
      const c = base.cloneNode(true);
      c.style.setProperty("--i", i);
      panel.appendChild(c);
      clones.push(c);
    }
    stage.style.setProperty("--n", n);
    const slices = $$(".hero__slice", panel);

    // how far each strip sits out of line, as a share of the panel height
    // (kept short upwards so no strip climbs into the header)
    const offs = [-0.06, 0.09, -0.08, 0.04, 0.12, -0.05, 0.07];
    const ph = () => base.offsetHeight;
    const gap = mobile ? 3 : 5;
    const drift = mobile ? 0.015 : 0.022;
    let onProgress = null;

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: hero,
        start: "top top",
        end: mobile ? "+=85%" : "+=110%",
        ...pinOpts(mobile),
        onUpdate: () => onProgress && onProgress(),
      },
    });
    // the strips settle from the middle outwards, the seams close last
    tl.fromTo(
      slices,
      { y: (i) => offs[i] * ph(), clipPath: `inset(0px ${gap}px 0px 0px)` },
      { y: 0, clipPath: "inset(0px 0px 0px 0px)", ease: "power2.inOut", duration: 1, stagger: { each: 0.05, from: "center" } },
      0
    );
    tl.fromTo(".hero__img", { scale: 1.16 }, { scale: 1, duration: 1.15 }, 0);
    // the two words draw in toward the photo as it comes together
    tl.fromTo(".hero__line--a", { x: 0 }, { x: () => stage.offsetWidth * drift, duration: 1.15 }, 0);
    tl.fromTo(".hero__line--b", { x: 0 }, { x: () => -stage.offsetWidth * drift, duration: 1.15 }, 0);
    tl.fromTo(hero, { "--ripple-scale": 0.55 }, { "--ripple-scale": 1.12, duration: 1.15 }, 0);
    tl.to(".hero__ui > :not(.hero__fig)", { y: mobile ? -14 : -32, duration: 1.15 }, 0);
    // the caption only appears once the picture is whole
    tl.fromTo(".hero__fig", { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.2 }, 0.95);

    // desktop: the strips answer the pointer like loose blinds, less and
    // less as they come back into line
    let off = () => {};
    if (desktop && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      const st = tl.scrollTrigger;
      const setters = slices.map((s) => gsap.quickTo(s, "yPercent", { duration: 1.2, ease: "power3" }));
      let ny = 0;
      const apply = () => {
        const k = 1 - st.progress;
        setters.forEach((set, i) => set(ny * k * (i % 2 ? -1 : 1) * (2 + Math.abs(i - (n - 1) / 2))));
      };
      const move = (e) => {
        ny = e.clientY / window.innerHeight - 0.5;
        apply();
      };
      hero.addEventListener("pointermove", move);
      onProgress = apply;
      off = () => hero.removeEventListener("pointermove", move);
    }

    return () => {
      off();
      clones.forEach((c) => c.remove());
      stage.style.removeProperty("--n");
    };
  }

  function homeScenes() {
    // 1. Hero: the strips of the photo slide back into register while pinned
    mm.add(COND, (ctx) => heroScene(ctx.conditions));

    // 2. Collage: centre image holds while the small frames drift past it
    mm.add(COND, (ctx) => {
      const { desktop, mobile } = ctx.conditions;
      const sec = $(".collage");
      if (!sec || (!desktop && !mobile)) return;
      const tl = gsap.timeline({
        scrollTrigger: { trigger: sec, start: "top top", end: mobile ? "+=125%" : "+=150%", ...pinOpts(mobile) },
      });
      tl.fromTo(sec, { "--ripple-scale": 0.5 }, { "--ripple-scale": 1.15, ease: "none", duration: 1 }, 0);
      tl.fromTo(".collage__center .media", { scale: 0.8 }, { scale: 1, ease: "none", duration: 1 }, 0);
      tl.fromTo(".collage__center img", { scale: 1.25 }, { scale: 1, ease: "none", duration: 1 }, 0);
      tl.from(".collage__caption", { autoAlpha: 0, y: 40, ease: "power2.out", duration: 0.35 }, 0.35);
      $$(".collage__float").forEach((el) => {
        const s = parseFloat(el.dataset.speed || 1);
        tl.fromTo(
          el,
          { y: () => window.innerHeight * 0.55 * s },
          { y: () => -window.innerHeight * 0.75 * s, ease: "none", duration: 1 },
          0
        );
      });
      tl.from(".collage__welcome", { autoAlpha: 0, y: 20, duration: 0.2 }, 0.8);
    });

    // 3. Treatment menu: vertical scroll drives a horizontal track
    mm.add(COND, (ctx) => {
      const { desktop, mobile } = ctx.conditions;
      const sec = $(".hmenu");
      const track = $(".hmenu__track");
      if (!sec || !track || (!desktop && !mobile)) return;
      const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
      const pan = gsap.to(track, {
        x: () => -dist(),
        ease: "none",
        scrollTrigger: { trigger: sec, start: "top top", end: () => "+=" + dist(), ...pinOpts(mobile) },
      });
      gsap.to(".hmenu__progress span", {
        scaleX: 1,
        ease: "none",
        scrollTrigger: { trigger: sec, start: "top top", end: () => "+=" + dist(), scrub: true, invalidateOnRefresh: true },
      });
      $$(".tcard").forEach((card) => {
        const img = $("img", card);
        gsap.fromTo(
          img,
          { xPercent: -7, scale: 1.18 },
          {
            xPercent: 7,
            scale: 1.18,
            ease: "none",
            scrollTrigger: { trigger: card, containerAnimation: pan, start: "left right", end: "right left", scrub: true },
          }
        );
      });
    });

    // 4. Quote: a small frame of the treatment room opens to full screen
    mm.add(COND, (ctx) => {
      const { desktop, mobile } = ctx.conditions;
      const sec = $(".qexpand");
      if (!sec || (!desktop && !mobile)) return;
      const tl = gsap.timeline({
        scrollTrigger: { trigger: sec, start: "top top", end: mobile ? "+=110%" : "+=130%", ...pinOpts(mobile) },
      });
      tl.fromTo(
        ".qexpand__media",
        { clipPath: mobile ? "inset(26% 14% 30% 14%)" : "inset(20% 32% 20% 32%)" },
        { clipPath: "inset(0% 0% 0% 0%)", ease: "none", duration: 1 },
        0
      );
      tl.fromTo(".qexpand__media img", { scale: 1.4 }, { scale: 1, ease: "none", duration: 1 }, 0);
      const quote = $(".qexpand__quote blockquote");
      let words = [quote];
      if (window.SplitText) words = SplitText.create(quote, { type: "words" }).words;
      tl.from(words, { autoAlpha: 0, y: 24, stagger: 0.03, duration: 0.25, ease: "power2.out" }, 0.72);
      tl.from(".qexpand__quote figcaption", { autoAlpha: 0, duration: 0.15 }, 1.05);
    });
  }

  /* =========================================================
     TREATMENTS
     ========================================================= */

  function treatmentScenes() {
    // wide image settles as it scrolls through
    mm.add(ANY_MOTION, () => {
      const img = $(".wide-media img");
      if (!img) return;
      gsap.fromTo(
        img,
        { scale: 1.3 },
        {
          scale: 1,
          ease: "none",
          scrollTrigger: { trigger: ".wide-media", start: "top bottom", end: "bottom top", scrub: true },
        }
      );
    });

    // menu: a row's photo follows the pointer (rows without one hide it)
    mm.add("(hover: hover) and (pointer: fine) and (min-width: 900px)", () => {
      const list = $(".tmenu__groups");
      const box = $(".cursor-img");
      if (!list || !box) return;
      const imgs = $$("img", box);
      gsap.set(box, { xPercent: -50, yPercent: -50 });
      const xTo = gsap.quickTo(box, "x", { duration: 0.7, ease: "power3" });
      const yTo = gsap.quickTo(box, "y", { duration: 0.7, ease: "power3" });
      const rTo = gsap.quickTo(box, "rotation", { duration: 0.8, ease: "power3" });
      let lastX = 0;
      const move = (e) => {
        xTo(e.clientX);
        yTo(e.clientY);
        rTo(gsap.utils.clamp(-8, 8, (e.clientX - lastX) * 0.4));
        lastX = e.clientX;
      };
      gsap.set(box, { x: window.innerWidth / 2, y: window.innerHeight / 2 });
      const enter = (i) => (e) => {
        // rows can become hovered by scrolling alone, so place the image
        // at the pointer before showing it
        if (gsap.getProperty(box, "opacity") < 0.05) {
          xTo(e.clientX, e.clientX);
          yTo(e.clientY, e.clientY);
        }
        imgs.forEach((im, j) => im.classList.toggle("is-active", i === j));
        gsap.to(box, { autoAlpha: 1, scale: 1, duration: 0.45, ease: "power3.out" });
      };
      const leave = () => gsap.to(box, { autoAlpha: 0, scale: 0.85, duration: 0.4, ease: "power3.out" });
      const rows = $$(".tmenu__row", list);
      const handlers = rows.map((row) => {
        const h = row.dataset.cursor ? enter(parseInt(row.dataset.cursor, 10)) : leave;
        row.addEventListener("pointerenter", h);
        return h;
      });
      list.addEventListener("pointermove", move);
      list.addEventListener("pointerleave", leave);
      return () => {
        rows.forEach((row, i) => row.removeEventListener("pointerenter", handlers[i]));
        list.removeEventListener("pointermove", move);
        list.removeEventListener("pointerleave", leave);
      };
    });

    // sticky stack: each card holds at the top, the previous one recedes
    mm.add(COND, (ctx) => {
      const { desktop, mobile } = ctx.conditions;
      if (!desktop && !mobile) return;
      const cards = $$(".tstack__card");
      let unstick = () => {};
      if (mobile) {
        // on a phone a card is taller than the screen: it scrolls to its end
        // before it sticks, so nothing is hidden when the next one slides over
        const stick = () =>
          cards.forEach((c) => c.style.setProperty("--stick", Math.min(0, window.innerHeight - c.offsetHeight) + "px"));
        stick();
        ScrollTrigger.addEventListener("refreshInit", stick);
        unstick = () => {
          ScrollTrigger.removeEventListener("refreshInit", stick);
          cards.forEach((c) => c.style.removeProperty("--stick"));
        };
      }
      cards.forEach((card, i) => {
        const inner = $(".tstack__inner", card);
        const body = $$(".tstack__body > *", card);
        gsap.from(body, {
          autoAlpha: 0,
          y: 36,
          stagger: 0.06,
          duration: 1,
          ease: "expo.out",
          scrollTrigger: { trigger: card, start: "top 55%", toggleActions: "play none none reverse" },
        });
        gsap.fromTo(
          $(".tstack__media img", card),
          { scale: 1.2 },
          { scale: 1, ease: "none", scrollTrigger: { trigger: card, start: "top bottom", end: "top top", scrub: true } }
        );
        if (i === cards.length - 1) return;
        gsap.to(inner, {
          scale: mobile ? 0.93 : 0.9,
          "--dim": 0.55,
          ease: "none",
          scrollTrigger: { trigger: cards[i + 1], start: "top bottom", end: "top top", scrub: true },
        });
      });
      return unstick;
    });
  }

  /* =========================================================
     ABOUT
     ========================================================= */

  // pinned scene where items replace each other in place, one per stretch
  // of scroll, snapping so the visitor never stops between two of them
  function stepScene(pin, items, { mobile, bar, img }) {
    const n = items.length;
    const shift = mobile ? 36 : 60;
    gsap.set(items.slice(1), { autoAlpha: 0, y: shift });
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: pin,
        start: "top top",
        end: "+=" + (n - 1) * (mobile ? 75 : 90) + "%",
        ...pinOpts(mobile),
        // no inertia: a hard flick on a phone must not skip a step
        snap: { snapTo: 1 / (n - 1), inertia: false, delay: 0.05, duration: { min: 0.2, max: 0.6 }, ease: "power2.inOut" },
      },
    });
    if (bar) tl.fromTo(bar, { scaleX: 1 / n }, { scaleX: 1, ease: "none", duration: n - 1 }, 0);
    if (img) tl.fromTo(img, { scale: 1.2 }, { scale: 1, ease: "none", duration: n - 1 }, 0);
    for (let i = 1; i < n; i++) {
      tl.to(items[i - 1], { autoAlpha: 0, y: -shift, duration: 0.4, ease: "power2.in" }, i - 1 + 0.3);
      tl.to(items[i], { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out" }, i - 1 + 0.55);
    }
  }

  function aboutScenes() {
    mm.add(COND, (ctx) => {
      const { desktop, mobile, motion } = ctx.conditions;
      if (!motion) return;
      const grid = $(".story__grid");
      const media = $(".story__media");
      const paras = $$(".story__p");
      const pin = $(".approach__pin");
      const items = $$(".approach__item");

      if (mobile && grid && paras.length > 1) {
        // phone: the photo holds at the top, the paragraphs take turns below it
        stepScene(grid, paras, { mobile, img: media && $("img", media) });
      } else {
        // desktop and short screens: paragraphs light up one by one
        paras.forEach((p) => {
          gsap.fromTo(
            p,
            { opacity: 0.18 },
            { opacity: 1, ease: "none", scrollTrigger: { trigger: p, start: "top 78%", end: "top 42%", scrub: true } }
          );
        });
      }

      // desktop: story image holds (pinned) while the text column scrolls
      if (desktop && grid && media) {
        const top = () => parseFloat(getComputedStyle(root).getPropertyValue("--header-h")) + 32;
        ScrollTrigger.create({
          trigger: grid,
          start: () => "top top+=" + top(),
          end: () => "bottom top+=" + (top() + media.offsetHeight),
          pin: media,
          pinSpacing: false,
          invalidateOnRefresh: true,
        });
        gsap.fromTo(
          $("img", media),
          { scale: 1.25 },
          { scale: 1, ease: "none", scrollTrigger: { trigger: grid, start: "top bottom", end: "bottom bottom", scrub: true } }
        );
      }

      // approach: heading holds, the four principles change in place
      if ((desktop || mobile) && pin && items.length > 1) {
        stepScene(pin, items, { mobile, bar: $(".approach__bar span") });
      }

      return () => gsap.set([...items, ...paras], { clearProps: "all" });
    });
  }

  /* =========================================================
     RESULTS
     ========================================================= */

  function resultsScenes() {
    mm.add(COND, (ctx) => {
      const { desktop, mobile, motion } = ctx.conditions;
      const sec = $(".deck-section");
      const deck = $(".deck");
      const items = $$(".deck__item");
      if (!motion || !sec || !deck || !items.length) return;

      // short screens: no pin, the photos simply rise in
      if (!desktop && !mobile) {
        items.forEach((it, i) => {
          gsap.from(it, {
            autoAlpha: 0,
            y: 40,
            duration: 1,
            ease: "expo.out",
            delay: (i % 2) * 0.08,
            scrollTrigger: { trigger: it, start: "top 92%", once: true },
          });
        });
        return;
      }

      const rot = [-9, 6, -3, 10, -6, 3];
      const cx = (i) => deck.offsetWidth / 2 - (items[i].offsetLeft + items[i].offsetWidth / 2);
      const cy = (i) => deck.offsetHeight / 2 - (items[i].offsetTop + items[i].offsetHeight / 2);
      const tl = gsap.timeline({
        scrollTrigger: { trigger: sec, start: "top top", end: mobile ? "+=120%" : "+=140%", ...pinOpts(mobile) },
      });
      // the rings open out with the cards, as if the deck was dropped into water
      tl.fromTo(sec, { "--ripple-scale": 0.45 }, { "--ripple-scale": 1.1, ease: "power2.inOut", duration: 1.25 }, 0);
      tl.from(
        items,
        {
          x: cx,
          y: cy,
          rotation: (i) => rot[i % rot.length],
          scale: mobile ? 0.86 : 0.74,
          ease: "power2.inOut",
          stagger: 0.05,
          duration: 1,
        },
        0
      );
    });
  }

  /* =========================================================
     FOOTER (all pages)
     ========================================================= */

  function footerScene() {
    mm.add(ANY_MOTION, () => {
      const mark = $(".footer-mark .logo-img");
      if (!mark) return;
      gsap.fromTo(
        mark,
        { yPercent: 35, opacity: 0.15 },
        {
          yPercent: 0,
          opacity: 1,
          ease: "none",
          scrollTrigger: { trigger: ".footer-mark", start: "top bottom", end: "bottom bottom", scrub: true },
        }
      );
    });
  }

  /* =========================================================
     Ripple ornaments: rings widen as their section passes.
     Pinned scenes (hero, collage, results deck) drive their own.
     ========================================================= */

  function rippleScenes() {
    mm.add(COND, (ctx) => {
      const { desktop, mobile, motion } = ctx.conditions;
      if (!motion) return;
      $$(".has-ripple").forEach((sec) => {
        if ((desktop || mobile) && sec.matches(".hero, .collage, .deck-section")) return;
        gsap.fromTo(
          sec,
          { "--ripple-scale": 0.8 },
          {
            "--ripple-scale": 1.12,
            ease: "none",
            scrollTrigger: { trigger: sec, start: "top bottom", end: "bottom top", scrub: true },
          }
        );
      });
    });
  }

  /* =========================================================
     Mobile menu
     ========================================================= */

  function initMenu(lenisRef) {
    const btn = $(".menu-toggle");
    const menu = $(".mobile-menu");
    const close = $(".mobile-menu .menu-close");
    if (!btn || !menu) return;
    const links = $$("nav a", menu);

    const setOpen = (open) => {
      menuOpen = open;
      menu.classList.toggle("is-open", open);
      menu.setAttribute("aria-hidden", String(!open));
      btn.setAttribute("aria-expanded", String(open));
      if (lenisRef) open ? lenisRef.stop() : lenisRef.start();
      document.body.style.overflow = open ? "hidden" : "";
      if (open) {
        if (window.gsap && !reduce) {
          gsap.fromTo(links, { yPercent: 60, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, stagger: 0.06, duration: 0.9, ease: "expo.out", delay: 0.25 });
        }
        (close || links[0]).focus({ preventScroll: true });
      } else {
        btn.focus({ preventScroll: true });
      }
    };

    btn.addEventListener("click", () => setOpen(true));
    if (close) close.addEventListener("click", () => setOpen(false));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menuOpen) setOpen(false);
    });
  }

  /* =========================================================
     Contact form
     ========================================================= */

  function initForm() {
    const form = $("form.form");
    if (!form) return;
    const status = $(".form__status", form);
    const submit = $("button[type=submit]", form);

    const rules = {
      first_name: (v) => (v.trim() ? "" : "Enter your first name."),
      phone: (v) => (/^[+()\d\s.-]{7,}$/.test(v.trim()) ? "" : "Enter a valid phone number."),
      email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? "" : "Enter a valid email address."),
    };

    const check = (input) => {
      const rule = rules[input.name];
      if (!rule) return true;
      const msg = rule(input.value);
      const field = input.closest(".field");
      const err = $(".error", field);
      field.classList.toggle("is-invalid", !!msg);
      input.setAttribute("aria-invalid", msg ? "true" : "false");
      if (err) err.textContent = msg;
      return !msg;
    };

    $$("input, textarea", form).forEach((input) => {
      input.addEventListener("blur", () => check(input));
      input.addEventListener("input", () => {
        if (input.closest(".field").classList.contains("is-invalid")) check(input);
      });
    });

    const setStatus = (msg, ok) => {
      status.textContent = msg;
      status.classList.toggle("is-ok", !!ok);
      status.classList.toggle("is-err", !ok);
    };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const inputs = $$("input, textarea", form);
      const valid = inputs.map(check).every(Boolean);
      if (!valid) {
        const first = $("[aria-invalid=true]", form);
        if (first) first.focus();
        setStatus("Check the highlighted fields and try again.", false);
        return;
      }
      if (form.action.includes("YOUR_FORM_ID")) {
        setStatus("Your message was not sent. This form is currently unavailable. Message @skynbymelissa on Instagram or book through Vagaro.", false);
        return;
      }
      submit.setAttribute("aria-busy", "true");
      submit.querySelector(".btn__label").textContent = "Sending…";
      try {
        const res = await fetch(form.action, {
          method: "POST",
          body: new FormData(form),
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(String(res.status));
        form.reset();
        setStatus("Your message has been sent to The Skyn Room.", true);
      } catch (err) {
        setStatus("Your message could not be sent. Try again or message @skynbymelissa on Instagram.", false);
      } finally {
        submit.removeAttribute("aria-busy");
        submit.querySelector(".btn__label").textContent = "Send Message";
      }
    });
  }

  /* =========================================================
     FAQ accordion (animated <details>)
     ========================================================= */

  function initFaq() {
    $$(".faq__item").forEach((item) => {
      const summary = $("summary", item);
      const answer = $(".faq__answer", item);
      if (!summary || !answer || reduce) return;
      summary.addEventListener("click", (e) => {
        e.preventDefault();
        if (item.open) {
          gsap.to(answer, {
            height: 0,
            duration: 0.5,
            ease: "expo.inOut",
            onComplete: () => {
              item.open = false;
              gsap.set(answer, { clearProps: "height" });
              ScrollTrigger.refresh();
            },
          });
        } else {
          item.open = true;
          gsap.fromTo(
            answer,
            { height: 0 },
            { height: "auto", duration: 0.6, ease: "expo.out", onComplete: () => ScrollTrigger.refresh() }
          );
        }
      });
    });
  }

  /* =========================================================
     Lightbox (results)
     ========================================================= */

  function initLightbox(lenisRef) {
    const dlg = $(".lightbox");
    if (!dlg || typeof dlg.showModal !== "function") return;
    const img = $("img", dlg);
    const closeBtn = $(".lightbox__close", dlg);
    const close = () => dlg.close();

    $$("[data-full]").forEach((el) => {
      el.addEventListener("click", () => {
        img.src = el.dataset.full;
        img.alt = el.dataset.alt || "";
        dlg.showModal();
        if (lenisRef) lenisRef.stop();
        if (window.gsap && !reduce) gsap.fromTo(img, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: "expo.out" });
      });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          el.click();
        }
      });
    });
    closeBtn.addEventListener("click", close);
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg || e.target.classList.contains("lightbox__inner")) close();
    });
    dlg.addEventListener("close", () => {
      if (lenisRef) lenisRef.start();
    });
  }
});
