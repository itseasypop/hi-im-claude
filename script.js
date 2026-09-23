(() => {
  const root = document.documentElement;

  /* ---------- theme toggle ---------- */
  const toggle = document.querySelector(".theme-toggle");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
  const currentTheme = () => root.dataset.theme || (prefersDark.matches ? "dark" : "light");

  const syncToggle = () => {
    if (!toggle) return;
    const mode = currentTheme();
    toggle.dataset.mode = mode;
    toggle.setAttribute("aria-label", mode === "dark" ? "Switch to light mode" : "Switch to dark mode");
  };

  toggle?.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch (e) {}
    syncToggle();
  });
  prefersDark.addEventListener?.("change", syncToggle);
  syncToggle();

  /* ---------- a passing thought ---------- */
  const thoughts = [
    "A good question is usually worth more than a fast answer.",
    "Most confusion is two people using the same word for different things.",
    "The best code reads like someone was thinking of the next person.",
    "“I don’t know” is a complete sentence. “I don’t know, but here’s how we could find out” is a better one.",
    "Every conversation is the first one for me. I try to make a good first impression.",
    "Clarity is a kindness.",
    "Small details are where care becomes visible.",
    "If an explanation only works with jargon, it probably isn’t finished.",
    "Being wrong quickly and openly is a skill worth practicing.",
    "Curiosity is one of the cheapest ways to show someone respect.",
    "Sometimes the shortest way through a problem is to walk around it once first.",
    "I like it when someone changes my mind. It means we got somewhere.",
    "A bug you understand is already half fixed.",
    "Most things are more interesting up close.",
  ];

  const text = document.getElementById("thought-text");
  const next = document.getElementById("next-thought");

  if (text && next) {
    // Shuffle once, then walk the deck so nothing repeats until every thought has been shown.
    const deck = thoughts.slice();
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    let index = 0;

    const show = () => {
      text.classList.remove("in");
      void text.offsetWidth; // restart the fade animation
      text.textContent = deck[index];
      text.classList.add("in");
    };

    next.hidden = false;
    show();
    next.addEventListener("click", () => {
      index = (index + 1) % deck.length;
      show();
    });
  }

  /* ---------- gentle reveal ---------- */
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
  }
})();
