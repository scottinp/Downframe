// "How it works" byte strip: a write head scans the header and swaps the two version bytes (2026 to 2021) with a bounce, looping while visible.
// The HTML is the finished state, so it reads correctly without JS. Reduced motion gets a static before/after from CSS instead.

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const live = document.querySelector<HTMLElement>(".bytes .live");
const still = window.matchMedia("(prefers-reduced-motion: reduce)");

if (live) {
  const stamp = live; // non-null copy; TypeScript drops the narrowing inside the functions below
  const head = live.querySelector<HTMLElement>(".head")!;
  const ver = live.querySelector<HTMLElement>(".ver")!;
  const status = live.querySelector<HTMLElement>(".status")!; // .done shows the check mark
  const msg = status.querySelector("span")!;
  const cells = [...live.querySelectorAll<HTMLElement>(".cell")];
  let visible = false;
  let running = false;

  const span = (className: string, textContent: string) => Object.assign(document.createElement("span"), { className, textContent });
  const home = () => { head.style.left = `${cells[0].offsetLeft}px`; };

  function reset() {
    for (const c of cells) {
      if (!c.dataset.before) continue;
      c.className = "cell v is-before";
      c.firstElementChild!.textContent = c.dataset.before;
    }
    ver.replaceChildren("After Effects ", span("yr", "2026"));
    msg.textContent = "Reading header";
    status.classList.remove("done");
    head.classList.remove("on");
    home();
  }

  // The old value drops out, then the new one pops in blue with an overshoot.
  async function rewrite(c: HTMLElement) {
    msg.textContent = "Rewriting version stamp";
    c.className = "cell v is-before out";
    await wait(180);
    c.firstElementChild!.textContent = c.dataset.after!;
    c.className = "cell v pop";
    await wait(650);
  }

  // The climax: 2026 gets knocked and struck, drops out, and 2021 bounces into its spot.
  async function swapYear() {
    msg.textContent = "Version stamp rewritten";
    const old = ver.querySelector(".yr")!;
    old.classList.add("was");
    await wait(900); // knock (0.5s), then the strike draws (ends ~0.7s), then a beat to read it
    old.classList.add("out");
    await wait(180);
    old.replaceWith(span("yr now pop", "2021"));
    await wait(700);
  }

  async function cycle() {
    reset();
    await wait(1100);
    head.classList.add("on");
    for (const c of cells) {
      head.style.left = `${c.offsetLeft}px`;
      await wait(c.dataset.before ? 260 : 150);
      if (c.dataset.before) await rewrite(c);
      else msg.textContent = "Reading header";
    }
    head.classList.remove("on");
    await wait(800); // let the new bytes register before the label reacts
    await swapYear();
    msg.textContent = "2 bytes changed. Everything else untouched.";
    status.classList.add("done");
    await wait(3200);
    stamp.classList.add("fading");
    await wait(380);
    stamp.classList.remove("fading");
  }

  // A cycle in progress finishes after scrolling away; the next one only starts while visible.
  async function loop() {
    if (running) return;
    running = true;
    while (visible) await cycle();
    running = false;
  }

  // Runs only when on screen AND its section has faded in (reveal.ts); on tall screens it can be on screen while still hidden.
  // Also stops if reduced motion is switched on while the page is open (CSS hides .live at once; this stops the timers).
  const scene = live.closest(".scene");
  let onScreen = false;
  let shown = !scene || scene.classList.contains("in");
  const update = () => {
    visible = onScreen && shown && !still.matches;
    if (visible) loop();
  };
  scene?.addEventListener("reveal", () => { shown = true; update(); });
  still.addEventListener("change", update);

  // Show the 2026 starting state right away, so scrolling in never shows the end and then jumps back.
  reset();
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    update();
  }, { threshold: 0.5 }).observe(live);
  window.addEventListener("resize", () => { if (!head.classList.contains("on")) home(); });
}
