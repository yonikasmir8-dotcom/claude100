/* Barry's Israel — Founders Campaign JS */

// Animated counter for hero stats
function animateCounter(el) {
  const target = parseInt(el.dataset.target, 10);
  const duration = 1800;
  const start = performance.now();

  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(eased * target).toLocaleString();
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

// Intersection observer for stat counters
const counters = document.querySelectorAll('.hero__stat-num[data-target]');
const heroObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCounter(entry.target);
      heroObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

counters.forEach(el => heroObserver.observe(el));

// Scroll reveal for sections
const revealEls = document.querySelectorAll(
  '.about__card, .location-card, .tier-card, .testimonial, .faq__item'
);

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }, (entry.target.dataset.delay || 0) * 1);
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

revealEls.forEach((el, i) => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  el.dataset.delay = (i % 4) * 80;
  revealObserver.observe(el);
});

// Sticky nav shadow on scroll
const nav = document.querySelector('.nav');
window.addEventListener('scroll', () => {
  nav.style.boxShadow = window.scrollY > 10
    ? '0 4px 24px rgba(0,0,0,0.6)'
    : 'none';
}, { passive: true });

// Smooth anchor scroll (polyfill for safari)
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', e => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// Active nav link highlight
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav__links a');

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navLinks.forEach(link => {
        link.style.color = link.getAttribute('href') === `#${entry.target.id}`
          ? '#FFFFFF'
          : '';
      });
    }
  });
}, { threshold: 0.4 });

sections.forEach(s => sectionObserver.observe(s));

// Checkout stub — replace with real payment integration
document.querySelectorAll('a[href="#checkout"]').forEach(btn => {
  btn.addEventListener('click', e => {
    e.preventDefault();
    const tier = btn.closest('.tier-card')?.querySelector('.tier-card__tag')?.textContent;
    const price = btn.closest('.tier-card')?.querySelector('.tier-card__amount')?.textContent;
    alert(`🔴 Checkout coming soon!\n\nYou selected: ${tier}\nPrice: ₪${price}\n\nThis will connect to the payment processor.`);
  });
});
