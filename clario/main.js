(() => {
  const root = document.documentElement;
  root.classList.remove("no-js");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Header: transparent over the hero, frosted once the page scrolls
  const header = document.querySelector("[data-header]");
  const hero = document.querySelector(".hero");
  const mobileCta = document.querySelector("[data-mobile-cta]");
  const book = document.getElementById("book");
  const onScroll = () => {
    const past = window.scrollY > (hero ? hero.offsetHeight - 120 : 40);
    header.classList.toggle("is-solid", window.scrollY > 40);
    const nearBook = book && book.getBoundingClientRect().top < window.innerHeight * 0.8;
    mobileCta?.classList.toggle("is-visible", past && !nearBook);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // Mobile navigation
  const toggle = document.querySelector("[data-nav-toggle]");
  const nav = document.getElementById("nav");
  const setMenu = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
    header.classList.toggle("menu-open", open);
  };
  toggle?.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
  nav?.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

  // Hero video: respect reduced motion, pause when off screen
  const video = document.querySelector("[data-hero-video]");
  if (video) {
    if (reduceMotion) {
      video.removeAttribute("autoplay");
      video.pause();
    } else if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      }, { threshold: 0.05 }).observe(video);
    }
  }

  // Reveal on scroll
  const items = document.querySelectorAll(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-in"));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const siblings = [...el.parentElement.children].filter((c) => c.classList.contains("reveal"));
        el.style.transitionDelay = `${Math.min(siblings.indexOf(el), 5) * 70}ms`;
        el.classList.add("is-in");
        io.unobserve(el);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    items.forEach((el) => io.observe(el));
  }

  // Booking request (front-end only — connect to the clinic's booking system)
  const form = document.querySelector("[data-book-form]");
  if (form) {
    const error = form.querySelector("[data-form-error]");
    const done = form.querySelector("[data-form-done]");
    const body = form.querySelector(".form-body");
    form.addEventListener("input", (e) => {
      const field = e.target.type === "checkbox" ? e.target.closest(".check") : e.target;
      if (e.target.checkValidity()) field.classList.remove("is-invalid");
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      let firstBad = null;
      form.querySelectorAll("input, select, textarea").forEach((el) => {
        const ok = el.checkValidity();
        const target = el.type === "checkbox" ? el.closest(".check") : el;
        target.classList.toggle("is-invalid", !ok);
        if (!ok && !firstBad) firstBad = el;
      });
      if (firstBad) {
        error.hidden = false;
        firstBad.focus();
        return;
      }
      error.hidden = true;
      body.hidden = true;
      done.hidden = false;
      done.focus();
    });
  }

  document.querySelectorAll("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
