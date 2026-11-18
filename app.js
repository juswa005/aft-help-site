if (!Object.hasOwn(HTMLElement.prototype, 'popover')) {
  import('https://unpkg.com/@oddbird/popover-polyfill@latest/dist/popover.min.js').catch(() => {});
}

document.addEventListener('DOMContentLoaded', () => {
  initResponsiveNavbar();
  initScrollspy();
  initCommandActions();
  initOsTabs();
  initPasswordBuilder();
  initGuideSearch();
});

function initResponsiveNavbar() {
  const header = document.querySelector('.site-header');
  const inner = header?.querySelector('.header-inner');
  const menu = document.getElementById('site-menu');
  if (!header || !inner || !menu) return;

  let prevWidth = header.getBoundingClientRect().width;

  const measure = () => {
    const wasOpen = menu.matches(':popover-open') || menu.classList.contains(':popover-open');
    header.classList.add('is-measuring', 'is-wide');
    menu.removeAttribute('popover');

    const fits = inner.scrollWidth <= inner.clientWidth;

    if (!fits) {
      header.classList.remove('is-wide');
      menu.setAttribute('popover', 'auto');
      if (wasOpen && typeof menu.showPopover === 'function') {
        try {
          menu.showPopover();
        } catch {
          // Ignore if popover API is mid-transition
        }
      }
    }

    requestAnimationFrame(() => {
      header.classList.remove('is-measuring');
    });
  };

  measure();

  const ro = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect.width ?? header.getBoundingClientRect().width;
    const isWide = header.classList.contains('is-wide');
    if (isWide || width > prevWidth) {
      measure();
    }
    prevWidth = width;
  });

  ro.observe(header);
  ro.observe(menu);

  // Close mobile popover menu after selecting a section link
  menu.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    if (!header.classList.contains('is-wide') && typeof menu.hidePopover === 'function') {
      try {
        menu.hidePopover();
      } catch {
        // Ignore if already closed
      }
    }
  });
}

function initScrollspy() {
  const navLinks = Array.from(document.querySelectorAll('#site-menu a[href^="#"]'));
  if (!navLinks.length) return;

  if (CSS.supports('scroll-target-group: auto')) {
    const syncAriaCurrent = () => {
      const currentLink = document.querySelector('#site-menu a:target-current');
      navLinks.forEach((link) => {
        link.setAttribute('aria-current', link === currentLink ? 'true' : 'false');
      });
    };
    syncAriaCurrent();
    document.addEventListener('scrollend', syncAriaCurrent);
  } else {
    const sections = navLinks
      .map((link) => document.getElementById(link.getAttribute('href').slice(1)))
      .filter(Boolean);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.getAttribute('id');
          navLinks.forEach((link) => {
            const isActive = link.getAttribute('href') === `#${id}`;
            link.classList.toggle('target-current', isActive);
            link.setAttribute('aria-current', isActive ? 'true' : 'false');
          });
        });
      },
      { rootMargin: '-35% 0px -55% 0px', threshold: 0 }
    );

    sections.forEach((section) => observer.observe(section));
  }
}

function initCommandActions() {
  const timers = new WeakMap();
  let lastMessage = '';

  function legacyCopy(text) {
    const field = Object.assign(document.createElement('textarea'), { value: text });
    field.setAttribute('readonly', '');
    field.style.cssText = 'position:fixed;inset-block-start:0;opacity:0';
    document.body.append(field);
    field.select();
    try {
      return document.execCommand('copy');
    } finally {
      field.remove();
    }
  }

  function report(button, ok) {
    const tip = button.nextElementSibling;
    if (!tip) return;
    clearTimeout(timers.get(button));
    button.removeAttribute('data-copied');
    button.removeAttribute('data-failed');

    let message = ok ? 'Copied' : 'Copy failed';
    if (message === lastMessage) message += '\u00A0';
    lastMessage = message;

    tip.textContent = '';
    void button.offsetWidth;
    button.setAttribute(ok ? 'data-copied' : 'data-failed', '');
    requestAnimationFrame(() => {
      tip.textContent = message;
    });

    timers.set(
      button,
      setTimeout(() => {
        button.removeAttribute('data-copied');
        button.removeAttribute('data-failed');
        tip.textContent = '';
      }, 2200)
    );
  }

  async function copyFromTarget(button, target) {
    const text = target.matches('input, textarea') ? target.value : target.innerText.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      report(button, true);
    } catch {
      if (legacyCopy(text)) {
        report(button, true);
      } else {
        report(button, false);
      }
    }
  }

  function toggleAllAccordions(button, container) {
    const expand = button.getAttribute('aria-expanded') !== 'true';
    for (const details of container.querySelectorAll('details.nb-details')) {
      details.open = expand;
    }
    button.setAttribute('aria-expanded', String(expand));
  }

  if ('CommandEvent' in window) {
    document.addEventListener(
      'command',
      (event) => {
        if (event.command === '--copy' && event.target) {
          copyFromTarget(event.source, event.target);
        } else if (event.command === '--toggle-all' && event.target) {
          toggleAllAccordions(event.source, event.target);
        }
      },
      true
    );
  } else {
    document.addEventListener('click', (event) => {
      const btn = event.target.closest('button[command]');
      if (!btn) return;
      const command = btn.getAttribute('command');
      const targetId = btn.getAttribute('commandfor');
      const target = targetId ? document.getElementById(targetId) : null;
      if (!target) return;

      if (command === '--copy') {
        copyFromTarget(btn, target);
      } else if (command === '--toggle-all') {
        toggleAllAccordions(btn, target);
      }
    });
  }

  // Keep Expand/Collapse All button synced when individual FAQ items are toggled
  document.addEventListener(
    'toggle',
    (event) => {
      const details = event.target;
      if (!details.matches('#faq-accordion details.nb-details')) return;
      const accordion = document.getElementById('faq-accordion');
      const button = document.querySelector('[command="--toggle-all"][commandfor="faq-accordion"]');
      if (!accordion || !button) return;
      const items = accordion.querySelectorAll('details.nb-details');
      const allOpen = Array.prototype.every.call(items, (el) => el.open);
      button.setAttribute('aria-expanded', String(allOpen));
    },
    { capture: true }
  );
}

function initOsTabs() {
  const tablists = document.querySelectorAll('[role="tablist"]');
  tablists.forEach((tablist) => {
    const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));

    const activate = (tab) => {
      tabs.forEach((t) => {
        const selected = t === tab;
        t.setAttribute('aria-selected', String(selected));
        t.setAttribute('tabindex', selected ? '0' : '-1');
        const panelId = t.getAttribute('aria-controls');
        const panel = panelId ? document.getElementById(panelId) : null;
        if (panel) panel.hidden = !selected;
      });
    };

    tabs.forEach((tab, idx) => {
      tab.addEventListener('click', () => activate(tab));
      tab.addEventListener('keydown', (event) => {
        let nextIdx = null;
        if (event.key === 'ArrowRight') nextIdx = (idx + 1) % tabs.length;
        if (event.key === 'ArrowLeft') nextIdx = (idx - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') nextIdx = 0;
        if (event.key === 'End') nextIdx = tabs.length - 1;
        if (nextIdx !== null) {
          event.preventDefault();
          tabs[nextIdx].focus();
          activate(tabs[nextIdx]);
        }
      });
    });
  });
}

function initPasswordBuilder() {
  const passInput = document.getElementById('reset-pass-input');
  const toggleBtn = document.getElementById('toggle-pass-visibility');
  const userSelect = document.getElementById('reset-user-select');
  const customUserWrap = document.getElementById('custom-user-wrap');
  const customUserInput = document.getElementById('reset-custom-user');
  const envSelect = document.getElementById('reset-env-select');
  const cmdOutput = document.getElementById('reset-cmd-output');
  const warnBox = document.getElementById('reset-builder-warning');
  const expectedMsg = document.getElementById('expected-reset-msg');

  if (!passInput || !userSelect || !envSelect || !cmdOutput) return;

  const updateCommand = () => {
    const rawPass = passInput.value || 'YourNewPassword';
    const env = envSelect.value;

    let username = userSelect.value;
    if (username === 'custom') {
      if (customUserWrap) customUserWrap.hidden = false;
      username = (customUserInput?.value || 'admin').trim() || 'admin';
    } else if (customUserWrap) {
      customUserWrap.hidden = true;
    }

    const safeUsername = username.replace(/["'\\]/g, '');
    if (expectedMsg) {
      expectedMsg.textContent = `Updated password for: ${safeUsername}`;
    }
    let warning = '';

    if (env === 'running-cmd') {
      if (/["%\\]/.test(rawPass)) {
        warning = 'Tip: Avoid ", %, or \\ inside Windows CMD passwords—letters, numbers, and !@# work best.';
      }
      const cleanPass = rawPass.replace(/"/g, '\\"');
      cmdOutput.textContent =
        `docker exec -e NEW_PASS="${cleanPass}" aft_backend node -e "const bcrypt=require(\\"bcrypt\\"),{PrismaClient}=require(\\"@prisma/client\\"),p=new PrismaClient();bcrypt.hash(process.env.NEW_PASS,10).then(h=>p.user.update({where:{username:\\"${safeUsername}\\"},data:{passwordHash:h}})).then(u=>console.log(\\"Updated password for:\\",u.username)).finally(()=>p.$disconnect())"`;
    } else if (env === 'stopped-compose') {
      if (rawPass.includes("'")) {
        warning = "Tip: Avoid single quote (') characters in the password so the terminal command stays valid.";
      }
      const cleanPass = rawPass.replace(/'/g, "'\\''");
      cmdOutput.textContent =
        `docker compose run --rm -e NEW_PASS='${cleanPass}' backend node -e 'const bcrypt=require("bcrypt"),{PrismaClient}=require("@prisma/client"),p=new PrismaClient();(async()=>{for(let i=0;i<15;i++){try{const h=await bcrypt.hash(process.env.NEW_PASS,10);const u=await p.user.update({where:{username:"${safeUsername}"},data:{passwordHash:h}});console.log("Updated password for:",u.username);return}catch(e){if(e.code==="P2025")throw e;await new Promise(r=>setTimeout(r,1000))}}throw new Error("DB unreachable")})().finally(()=>p.$disconnect())'`;
    } else {
      if (rawPass.includes("'")) {
        warning = "Tip: Avoid single quote (') characters in the password so the terminal command stays valid.";
      }
      const cleanPass = rawPass.replace(/'/g, "'\\''");
      cmdOutput.textContent =
        `docker exec -e NEW_PASS='${cleanPass}' aft_backend node -e 'const bcrypt=require("bcrypt"),{PrismaClient}=require("@prisma/client"),p=new PrismaClient();bcrypt.hash(process.env.NEW_PASS,10).then(h=>p.user.update({where:{username:"${safeUsername}"},data:{passwordHash:h}})).then(u=>console.log("Updated password for:",u.username)).finally(()=>p.$disconnect())'`;
    }

    if (warnBox) {
      warnBox.textContent = warning;
      warnBox.hidden = !warning;
    }
  };

  toggleBtn?.addEventListener('click', () => {
    const isHidden = passInput.type === 'password';
    passInput.type = isHidden ? 'text' : 'password';
    toggleBtn.textContent = isHidden ? 'Hide' : 'Show';
    toggleBtn.setAttribute('aria-pressed', String(isHidden));
  });

  passInput.addEventListener('input', updateCommand);
  userSelect.addEventListener('change', updateCommand);
  customUserInput?.addEventListener('input', updateCommand);
  envSelect.addEventListener('change', updateCommand);
  updateCommand();
}

function initGuideSearch() {
  const input = document.getElementById('guide-search-input');
  const clearBtn = document.getElementById('guide-search-clear');
  const status = document.getElementById('guide-search-status');
  const searchableCards = Array.from(document.querySelectorAll('[data-searchable]'));
  if (!input || !searchableCards.length) return;

  const applyFilter = () => {
    const query = input.value.trim().toLowerCase();
    if (!query) {
      searchableCards.forEach((el) => {
        el.classList.remove('is-dimmed', 'is-highlighted');
      });
      if (status) status.textContent = '';
      return;
    }

    let matchCount = 0;
    searchableCards.forEach((el) => {
      const matches = (el.textContent || '').toLowerCase().includes(query);
      el.classList.toggle('is-dimmed', !matches);
      el.classList.toggle('is-highlighted', matches);
      if (matches) {
        matchCount += 1;
        if (el.tagName === 'DETAILS') el.open = true;
      }
    });

    if (status) {
      status.textContent =
        matchCount === 0
          ? `No direct matches for "${input.value.trim()}". Try keywords like "password", "slow", "docker", "receipt", or "pdf".`
          : `Highlighted ${matchCount} matching help ${matchCount === 1 ? 'section' : 'sections'}.`;
    }
  };

  input.addEventListener('input', applyFilter);
  clearBtn?.addEventListener('click', () => {
    input.value = '';
    applyFilter();
    input.focus();
  });
}
