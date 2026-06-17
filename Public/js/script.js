const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");

navToggle.addEventListener("click", () => {
  navLinks.classList.toggle("show");
});

document.querySelectorAll(".nav-links a").forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("show");
  });
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.animate(
          [
            { opacity: 0, transform: "translateY(24px)" },
            { opacity: 1, transform: "translateY(0)" }
          ],
          {
            duration: 650,
            easing: "ease-out",
            fill: "forwards"
          }
        );
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

document.querySelectorAll(".framework-card, .feature-card, .timeline-item, .research-grid > div, .tech-grid span").forEach((el) => {
  el.style.opacity = "0";
  observer.observe(el);
});
