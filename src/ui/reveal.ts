// Sections below the hero fade up once scrolled into view, so the first screen stays calm.
// index.html sets .js on <html> before first paint; without JS, or with reduced motion (CSS), everything shows at once.

const io = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.classList.add("in");
    entry.target.dispatchEvent(new Event("reveal")); // byte-strip.ts waits for this before animating
    io.unobserve(entry.target); // once shown, stays shown
  }
}, { rootMargin: "0px 0px -15% 0px" }); // "scroll down just a bit": reveal once the top is past the bottom 15% of the screen

// Nothing shows until the visitor scrolls a little (tall screens would otherwise show "How it works" at once).
// A nav click, a #link or a reload mid-page all scroll, so they count too.
const start = () => { for (const section of document.querySelectorAll(".scene")) io.observe(section); };
const scrolled = () => window.scrollY > 40;
if (scrolled()) start();
else window.addEventListener("scroll", function once() {
  if (!scrolled()) return;
  window.removeEventListener("scroll", once);
  start();
}, { passive: true });
