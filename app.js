/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   OBJECTIF ZONARD â€” Portfolio SPA Engine
   Hash-based routing, page transitions, lazy loading, lightbox
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

(function () {
  'use strict';

  // â”€â”€â”€ DATA â”€â”€â”€
  const DATA = window.PHOTO_DATA || { works: [] };
  const works = DATA.works || [];

  // â”€â”€â”€ DOM REFS â”€â”€â”€
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  const viewLanding = $('#view-landing');
  const viewGallery = $('#view-gallery');
  const viewProject = $('#view-project');
  const galleryGrid = $('#gallery-grid');
  const projectTitle = $('#project-title');
  const projectMeta = $('#project-meta');
  const projectImages = $('#project-images');
  const projectPrevTop = $('#project-prev-top');
  const projectNextTop = $('#project-next-top');
  const projectPrev = $('#project-prev');
  const projectNext = $('#project-next');
  const galleryCount = $('#gallery-count');
  const menuOverlay = $('#menu-overlay');
  const menuToggle = $('#menu-toggle');
  const menuClose = $('#menu-close');
  const menuList = $('#menu-works-list');
  const lightbox = $('#lightbox');
  const lightboxImg = $('#lightbox-img');
  const lightboxClose = $('#lightbox-close');
  const lightboxPrev = $('#lightbox-prev');
  const lightboxNext = $('#lightbox-next');
  const lightboxCounter = $('#lightbox-counter');
  const cursorDot = $('#cursor-dot');
  const heroImg = $('#landing-hero-img');
  const instagramUrl = 'https://www.instagram.com/objectif_zonard/';

  // â”€â”€â”€ STATE â”€â”€â”€
  let currentView = 'landing';
  let currentWorkIndex = -1;
  let lightboxImages = [];
  let lightboxIndex = 0;
  let isTransitioning = false;

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ROUTER
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  function getRoute() {
    const hash = window.location.hash || '#/gallery'; // Default to gallery
    if (hash === '#/' || hash === '#' || hash === '') return { view: 'gallery' };
    if (hash === '#/gallery') return { view: 'gallery' };
    const workMatch = hash.match(/^#\/work\/(.+)$/);
    if (workMatch) return { view: 'project', workId: workMatch[1] };
    return { view: 'gallery' };
  }

  function navigate(route) {
    if (isTransitioning) return;

    const targetView = route.view;
    if (targetView === currentView && targetView !== 'project') return;

    isTransitioning = true;

    // Get section elements
    const views = { landing: viewLanding, gallery: viewGallery, project: viewProject };
    const currentEl = views[currentView];
    const targetEl = views[targetView];

    // Close menu if open
    closeMenu();

    // Animate out current
    if (currentEl) {
      currentEl.classList.add('view--leaving');
    }

    setTimeout(() => {
      // Hide current
      if (currentEl) {
        currentEl.classList.remove('view--active', 'view--visible', 'view--leaving');
      }

      // Prepare target
      if (targetView === 'gallery') renderGallery();
      if (targetView === 'project') renderProject(route.workId);

      // Show target
      targetEl.classList.add('view--active');
      window.scrollTo(0, 0);

      requestAnimationFrame(() => {
        targetEl.classList.add('view--visible', 'view--entering');
        setTimeout(() => {
          targetEl.classList.remove('view--entering');
          isTransitioning = false;

          // Trigger lazy load and scroll animations
          observeImages();
          observeScrollReveal();
        }, 900);
      });

      currentView = targetView;
    }, currentView === 'landing' ? 100 : 500); // Faster from landing
  }

  window.addEventListener('hashchange', () => navigate(getRoute()));

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // LANDING (Bypassed)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  function initLanding() {
    // Keep logic for potential future use or hidden hero
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // GALLERY
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  function renderGallery() {
    galleryGrid.innerHTML = '';
    galleryCount.textContent = `${works.length} projets`;

    works.forEach((work, i) => {
      const item = document.createElement('a');
      item.href = `#/work/${work.id}`;
      item.className = 'gallery__item';
      item.innerHTML = `
        <div class="gallery__item-inner">
          <img class="gallery__item-img"
               data-src="${work.cover}"
               alt="${work.title}"
               loading="lazy">
        </div>
        <div class="gallery__item-caption">
          <span class="gallery__item-title">${work.title}</span>
          <span class="gallery__item-cta" aria-hidden="true">Voir le projet &rarr;</span>
        </div>
      `;
      galleryGrid.appendChild(item);
    });
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PROJECT
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  function renderProject(workId) {
    const workIndex = works.findIndex(w => w.id === workId);
    if (workIndex === -1) {
      window.location.hash = '#/gallery';
      return;
    }

    currentWorkIndex = workIndex;
    const work = works[workIndex];

    projectTitle.textContent = work.title;
    projectMeta.innerHTML = `
      ${work.count} photographie${work.count > 1 ? 's' : ''}
      <span class="project__meta-sep" aria-hidden="true">&mdash;</span>
      <a class="project__meta-instagram" href="${instagramUrl}" target="_blank" rel="noopener" aria-label="Instagram @objectif_zonard">
        <span>@objectif_zonard</span>
        <svg class="project__meta-instagram-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" ry="5"></rect>
          <circle cx="12" cy="12" r="4.2"></circle>
          <circle cx="17.3" cy="6.7" r="1.1"></circle>
        </svg>
      </a>
    `;

    // Render images
    projectImages.innerHTML = '';
    lightboxImages = [];

    work.images.forEach((imgPath, i) => {
      lightboxImages.push(imgPath);
      const wrapper = document.createElement('div');
      wrapper.className = 'project__img-wrapper';
      wrapper.innerHTML = `<img data-src="${imgPath}" alt="${work.title} - ${i + 1}" loading="lazy">`;
      wrapper.addEventListener('click', () => openLightbox(i));
      projectImages.appendChild(wrapper);
    });

    // Prev/Next navigation
    const prevIndex = (workIndex - 1 + works.length) % works.length;
    const nextIndex = (workIndex + 1) % works.length;

    const prevLabel = `\u2190 ${works[prevIndex].title}`;
    const nextLabel = `${works[nextIndex].title} \u2192`;

    projectPrev.href = `#/work/${works[prevIndex].id}`;
    projectPrev.textContent = prevLabel;

    if (projectPrevTop) {
      projectPrevTop.href = projectPrev.href;
      projectPrevTop.textContent = prevLabel;
      projectPrevTop.setAttribute('aria-label', `Projet precedent : ${works[prevIndex].title}`);
    }

    projectNext.href = `#/work/${works[nextIndex].id}`;
    projectNext.textContent = nextLabel;

    if (projectNextTop) {
      projectNextTop.href = projectNext.href;
      projectNextTop.textContent = nextLabel;
      projectNextTop.setAttribute('aria-label', `Projet suivant : ${works[nextIndex].title}`);
    }
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // LAZY LOADING + SCROLL REVEAL
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  let lazyObserver, revealObserver;

  function observeImages() {
    if (lazyObserver) lazyObserver.disconnect();

    lazyObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            img.onload = () => img.classList.add('lazy-loaded');
            lazyObserver.unobserve(img);
          }
        }
      });
    }, { rootMargin: '200px 0px', threshold: 0.01 });

    $$('img[data-src]').forEach(img => lazyObserver.observe(img));
  }

  function observeScrollReveal() {
    if (revealObserver) revealObserver.disconnect();

    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -60px 0px', threshold: 0.05 });

    $$('.gallery__item, .project__img-wrapper').forEach(el => {
      if (!el.classList.contains('in-view')) {
        revealObserver.observe(el);
      }
    });
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // LIGHTBOX
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  function openLightbox(index) {
    lightboxIndex = index;
    updateLightbox();
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function updateLightbox() {
    lightboxImg.style.opacity = '0';
    setTimeout(() => {
      lightboxImg.src = lightboxImages[lightboxIndex];
      lightboxImg.onload = () => { lightboxImg.style.opacity = '1'; };
      lightboxCounter.textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`;
    }, 150);
  }

  function lightboxPrevFn() {
    lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
    updateLightbox();
  }

  function lightboxNextFn() {
    lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
    updateLightbox();
  }

  lightboxClose.addEventListener('click', closeLightbox);
  lightboxPrev.addEventListener('click', (e) => { e.stopPropagation(); lightboxPrevFn(); });
  lightboxNext.addEventListener('click', (e) => { e.stopPropagation(); lightboxNextFn(); });
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') lightboxPrevFn();
    if (e.key === 'ArrowRight') lightboxNextFn();
  });

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // MENU
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  function openMenu() {
    menuOverlay.classList.add('is-open');
    menuOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Stagger animation
    const items = $$('.menu-list li', menuOverlay);
    items.forEach((li, i) => {
      li.style.animationDelay = `${0.05 + i * 0.03}s`;
    });
  }

  function closeMenu() {
    menuOverlay.classList.remove('is-open');
    menuOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  menuToggle.addEventListener('click', openMenu);
  menuClose.addEventListener('click', closeMenu);

  function buildMenu() {
    menuList.innerHTML = '';
    works.forEach((work) => {
      const li = document.createElement('li');
      li.innerHTML = `<a href="#/work/${work.id}">${work.title}</a>`;
      li.querySelector('a').addEventListener('click', () => {
        setTimeout(closeMenu, 100);
      });
      menuList.appendChild(li);
    });
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // CUSTOM CURSOR
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  function initCursor() {
    if (window.matchMedia('(max-width: 900px)').matches) return;
    if (!cursorDot) return;

    let mouseX = 0, mouseY = 0;
    let curX = 0, curY = 0;

    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    function updateCursor() {
      const dx = mouseX - curX;
      const dy = mouseY - curY;
      curX += dx * 0.15;
      curY += dy * 0.15;
      cursorDot.style.left = curX + 'px';
      cursorDot.style.top = curY + 'px';
      requestAnimationFrame(updateCursor);
    }
    updateCursor();

    // Hover state for interactive elements
    const hoverTargets = 'a, button, .gallery__item, .project__img-wrapper';
    document.addEventListener('mouseover', (e) => {
      if (e.target.closest(hoverTargets)) {
        cursorDot.classList.add('cursor-hover');
      }
    });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest(hoverTargets)) {
        cursorDot.classList.remove('cursor-hover');
      }
    });
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // SMOOTH SCROLL (kinetic feel)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  function initSmoothScroll() {
    // Use native smooth scroll + add slight inertia via CSS
    // For a full kinetic scroll we'd wrap content, but keep it simple and performant
    document.documentElement.style.scrollBehavior = 'smooth';
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // KEYBOARD NAVIGATION
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  document.addEventListener('keydown', (e) => {
    if (lightbox.classList.contains('is-open')) return;

    if (e.key === 'Escape' && menuOverlay.classList.contains('is-open')) {
      closeMenu();
    }
  });

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // INIT
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  function init() {
    initLanding();
    buildMenu();
    initCursor();
    initSmoothScroll();

    // Initial route
    const route = getRoute();

    // Default entry: skip landing if no specific work Hash
    if (route.view === 'landing' || !window.location.hash) {
      currentView = 'gallery';
      viewGallery.classList.add('view--active', 'view--visible');
      renderGallery();
      window.location.hash = '#/gallery';
    } else {
      currentView = route.view;
      const views = { gallery: viewGallery, project: viewProject };
      if (views[route.view]) {
        views[route.view].classList.add('view--active', 'view--visible');
        if (route.view === 'gallery') renderGallery();
        if (route.view === 'project') renderProject(route.workId);
      }
    }

    // Trigger initial observations
    setTimeout(() => {
      observeImages();
      observeScrollReveal();
    }, 100);
  }

  // Wait for DOM + data
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
