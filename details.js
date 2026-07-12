/**
 * AuroConnect - Custom Premium Details Sheet View
 * Redesigned to feature an ultra-modern, glassmorphic, classy sidebar/drawer
 * that perfectly mirrors the upscale design aesthetic of the AuroConnect theme.
 */

(function () {
  // Inject classy, high-end styling
  const style = document.createElement("style");
  style.innerHTML = `
    /* DRAWER OVERLAY with progressive blurring */
    #details-drawer-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        z-index: 2000;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.4s;
    }
    
    #details-drawer-overlay.active {
        opacity: 1;
        visibility: visible;
    }

    /* PREMIUM GLASS SLIDING DRAWER */
    #details-drawer {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        width: 100%;
        max-width: 480px;
        height: 100vh;
        background: rgba(255, 255, 255, 0.85);
        color: #1f1f1f;
        box-shadow: -10px 0 40px rgba(0, 0, 0, 0.08);
        z-index: 2001;
        display: flex;
        flex-direction: column;
        transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
        will-change: transform;
        border-top-left-radius: 24px;
        border-bottom-left-radius: 24px;
        border-left: 1px solid rgba(0, 0, 0, 0.08);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        overflow: hidden;
        transform: translateX(100%);
    }

    @media (prefers-color-scheme: dark) {
        #details-drawer {
            background: rgba(18, 18, 18, 0.85);
            color: #f1f3f4;
            border-left: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: -10px 0 45px rgba(0, 0, 0, 0.5);
        }
    }

    @media (max-width: 480px) {
        #details-drawer {
            border-top-left-radius: 24px;
            border-bottom-left-radius: 0px;
            border-top-right-radius: 24px;
            width: 100%;
            max-width: 100%;
            height: 92vh;
            top: auto;
            bottom: 0;
            transform: translateY(100%);
            border-left: none;
            border-top: 1px solid rgba(0, 0, 0, 0.08);
        }
        @media (prefers-color-scheme: dark) {
            #details-drawer {
                border-top: 1px solid rgba(255, 255, 255, 0.08);
            }
        }
    }

    #details-drawer.active {
        transform: translateX(0) !important;
    }

    @media (max-width: 480px) {
        #details-drawer.active {
            transform: translateY(0) !important;
        }
    }

    /* ELEGANT SCROLLBARS */
    .drawer-content::-webkit-scrollbar {
        width: 6px;
    }
    .drawer-content::-webkit-scrollbar-track {
        background: transparent;
    }
    .drawer-content::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.12);
        border-radius: 99px;
    }
    @media (prefers-color-scheme: dark) {
        .drawer-content::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.12);
        }
    }

    /* DRAG HANDLE BAR (Mobile) */
    .drawer-handle-bar {
        height: 24px;
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: grab;
        flex-shrink: 0;
        user-select: none;
        z-index: 10;
        background: transparent;
    }
    
    .drawer-handle-bar:active {
        cursor: grabbing;
    }

    .drawer-handle {
        width: 38px;
        height: 4px;
        background: rgba(0, 0, 0, 0.15);
        border-radius: 99px;
        transition: background-color 0.25s ease;
    }
    @media (prefers-color-scheme: dark) {
        .drawer-handle {
            background: rgba(255, 255, 255, 0.15);
        }
    }

    .drawer-handle-bar:hover .drawer-handle {
        background: var(--text-secondary);
    }

    /* DRAWER HEADER ROW */
    .drawer-header {
        padding: 4px 24px 20px 24px;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 1px solid var(--border);
        flex-shrink: 0;
    }

    .drawer-header h2 {
        margin: 0;
        font-family: "Plus Jakarta Sans", sans-serif;
        font-size: 1.45rem;
        font-weight: 800;
        color: var(--text);
        letter-spacing: -0.03em;
        line-height: 1.25;
        padding-right: 16px;
    }

    .drawer-close-btn {
        background: var(--bg);
        color: var(--text-secondary);
        border: 1px solid var(--border);
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.25rem;
        cursor: pointer;
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        flex-shrink: 0;
        box-shadow: 0 1px 2px rgba(0,0,0,0.02);
    }

    .drawer-close-btn:hover {
        background: var(--surface-hover);
        color: var(--text);
        transform: scale(1.06) rotate(90deg);
        border-color: var(--text-secondary);
    }

    /* DRAWER CONTENT SCROLL VIEW */
    .drawer-content {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 0 24px 32px 24px;
        line-height: 1.6;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        display: flex;
        flex-direction: column;
        gap: 24px;
    }

    /* PREMIUM CARD OVERVIEW / POSTER PREVIEW */
    .drawer-poster-banner {
        width: 100%;
        border-radius: 20px;
        overflow: hidden;
        margin-top: 18px;
        position: relative;
        aspect-ratio: 16 / 9;
        box-shadow: var(--shadow-lg);
        background: rgba(0,0,0,0.04);
        border: 1px solid var(--border);
        flex-shrink: 0;
    }
    @media (prefers-color-scheme: dark) {
        .drawer-poster-banner {
            background: rgba(255,255,255,0.02);
        }
    }

    .drawer-poster-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        transition: transform 0.4s ease;
    }

    .drawer-poster-banner:hover .drawer-poster-img {
        transform: scale(1.03);
    }

    .drawer-poster-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 80%);
        display: flex;
        align-items: flex-end;
        padding: 16px;
    }

    .drawer-poster-expand-btn {
        background: rgba(255, 255, 255, 0.9);
        color: #1a1a1a;
        padding: 6px 14px;
        border-radius: 99px;
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        border: none;
        cursor: pointer;
    }

    .drawer-poster-expand-btn:hover {
        background: #ffffff;
        transform: translateY(-1px);
    }

    /* CATEGORY AND TYPE BADGES */
    .drawer-meta-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 16px;
    }

    .drawer-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 12px;
        border-radius: 99px;
        font-size: 0.68rem;
        font-weight: 750;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .drawer-badge-category {
        background: var(--accent-light);
        color: var(--accent);
    }

    .drawer-badge-type {
        background: var(--amber-light);
        color: var(--amber-accent);
    }

    /* PREMIUM BENTO GRID (2 columns) */
    .drawer-bento-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        margin-top: 8px;
    }

    @media (max-width: 380px) {
        .drawer-bento-grid {
            grid-template-columns: 1fr;
        }
    }

    .drawer-bento-item {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 16px;
        display: flex;
        gap: 12px;
        align-items: flex-start;
        box-shadow: var(--shadow);
    }

    .drawer-bento-item:hover {
        border-color: var(--border-hover);
        transform: translateY(-1px);
        box-shadow: var(--shadow-lg);
    }

    .drawer-bento-item.full-width {
        grid-column: 1 / -1;
    }

    .drawer-bento-icon {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--accent-light);
        color: var(--accent);
        border: 1px solid var(--border);
        flex-shrink: 0;
    }

    .drawer-bento-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
        flex-grow: 1;
    }
    
    .detail-label {
        font-size: 0.68rem;
        font-weight: 750;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .detail-value {
        font-size: 0.88rem;
        color: var(--text);
        font-weight: 600;
        line-height: 1.4;
        white-space: pre-wrap;
        word-break: break-word;
    }

    /* ABOUT/DESCRIPTION PANEL */
    .detail-desc {
        background: var(--surface);
        border-radius: 20px;
        padding: 20px;
        border: 1px solid var(--border);
        display: flex;
        flex-direction: column;
        gap: 12px;
        box-shadow: var(--shadow);
    }

    .detail-desc-title {
        font-size: 0.75rem;
        font-weight: 800;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .detail-desc-title::after {
        content: '';
        flex-grow: 1;
        height: 1px;
        background: var(--border);
    }

    .detail-desc-text {
        font-size: 0.92rem;
        line-height: 1.7;
        color: var(--text-secondary);
        white-space: pre-wrap;
    }

    /* INTERACTIVE QUICK ACTIONS SECTION */
    .drawer-actions-block {
        display: flex;
        flex-direction: column;
        gap: 16px;
        margin-top: 8px;
    }

    .drawer-actions-title {
        font-size: 0.75rem;
        font-weight: 800;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .drawer-actions-title::after {
        content: '';
        flex-grow: 1;
        height: 1px;
        background: var(--border);
    }

    .drawer-actions-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
    }

    @media (max-width: 380px) {
        .drawer-actions-grid {
            grid-template-columns: 1fr;
        }
    }

    .drawer-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 12px 16px;
        border-radius: 14px;
        font-size: 0.82rem;
        font-weight: 700;
        text-decoration: none;
        cursor: pointer;
        text-align: center;
        border: 1px solid transparent;
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        box-shadow: 0 2px 4px var(--shadow);
    }

    .drawer-btn:hover {
        transform: translateY(-1.5px);
        box-shadow: var(--shadow-lg);
    }

    .btn-calendar {
        background: var(--accent);
        color: var(--surface);
        grid-column: 1 / -1;
    }
    @media (prefers-color-scheme: dark) {
        .btn-calendar {
            color: #000000;
            font-weight: bold;
        }
    }

    .btn-calendar:hover {
        opacity: 0.95;
    }

    .btn-whatsapp {
        background: #25d366;
        color: #ffffff;
    }
    .btn-whatsapp:hover {
        background: #1faf51;
    }

    .btn-email {
        background: var(--accent-light);
        color: var(--accent);
        border-color: var(--border);
    }
    .btn-email:hover {
        background: var(--accent);
        color: var(--surface);
        border-color: transparent;
    }
    @media (prefers-color-scheme: dark) {
        .btn-email:hover {
            color: #000000;
        }
    }

    .btn-website {
        background: var(--surface);
        color: var(--text);
        border-color: var(--border);
    }
    .btn-website:hover {
        background: var(--surface-hover);
        border-color: var(--text-secondary);
    }

    /* DIRECT PRETTY SHARE PILL */
    .drawer-share-pill {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 10px;
        border-radius: 12px;
        font-size: 0.78rem;
        font-weight: 600;
        background: var(--surface);
        border: 1px solid var(--border);
        color: var(--text-secondary);
        cursor: pointer;
        margin-top: 4px;
        transition: all 0.2s;
    }

    .drawer-share-pill:hover {
        background: var(--surface-hover);
        color: var(--text);
        border-color: var(--text-secondary);
    }
  `;
  document.head.appendChild(style);

  // HTML Structure to Inject
  const overlay = document.createElement("div");
  overlay.id = "details-drawer-overlay";
  
  const drawer = document.createElement("div");
  drawer.id = "details-drawer";
  drawer.innerHTML = `
      <div class="drawer-handle-bar" id="drawer-drag-zone">
          <div class="drawer-handle"></div>
      </div>
      <div class="drawer-header">
          <h2 id="drawer-title">Event Details</h2>
          <button class="drawer-close-btn" id="drawer-close" aria-label="Close details">&times;</button>
      </div>
      <div class="drawer-content" id="drawer-body">
          <!-- Content injected dynamically -->
      </div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(drawer);

  // Close Event Bindings
  const closeBtn = document.getElementById("drawer-close");
  const dragZone = document.getElementById("drawer-drag-zone");

  closeBtn.onclick = closeDetails;
  overlay.onclick = closeDetails;

  // Touch Swipe Dismiss Logic (Mobile Only - swipe down to close)
  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  dragZone.addEventListener("touchstart", (e) => {
      startY = e.touches[0].clientY;
      isDragging = true;
      drawer.style.transition = "none";
  }, { passive: true });

  dragZone.addEventListener("touchmove", (e) => {
      if (!isDragging) return;
      const deltaY = e.touches[0].clientY - startY;
      if (deltaY > 0) { // Only drag down to dismiss
          currentY = deltaY;
          if (window.innerWidth <= 480) {
              drawer.style.transform = `translateY(${currentY}px)`;
          } else {
              // On desktop sliding right, we can slide right instead
              drawer.style.transform = `translateX(${currentY}px)`;
          }
      }
  }, { passive: true });

  dragZone.addEventListener("touchend", () => {
      if (!isDragging) return;
      isDragging = false;
      drawer.style.transition = "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)";
      
      if (currentY > 120) { // Swipe limit reached
          closeDetails();
      } else {
          drawer.style.transform = "";
      }
      currentY = 0;
  });

  // Dynamic vector icon map based on attribute key
  function getLabelIcon(label) {
      const l = label.toLowerCase();
      if (l.includes("date") || l.includes("day")) {
          return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>`;
      }
      if (l.includes("time") || l.includes("timing") || l.includes("schedule")) {
          return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
          </svg>`;
      }
      if (l.includes("location") || l.includes("venue") || l.includes("place")) {
          return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
          </svg>`;
      }
      if (l.includes("cost") || l.includes("contribution") || l.includes("price") || l.includes("fee") || l.includes("charge")) {
          return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>`;
      }
      if (l.includes("audience") || l.includes("target") || l.includes("who") || l.includes("key info")) {
          return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>`;
      }
      return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path>
      </svg>`;
  }

  // Toast alert system
  function showToast(message) {
      let toast = document.getElementById("drawer-toast");
      if (!toast) {
          toast = document.createElement("div");
          toast.id = "drawer-toast";
          toast.style.cssText = `
              position: fixed;
              bottom: 24px;
              left: 50%;
              transform: translateX(-50%) translateY(100px);
              background: rgba(0, 0, 0, 0.85);
              color: #ffffff;
              padding: 10px 20px;
              border-radius: 99px;
              font-size: 0.8rem;
              font-weight: 600;
              z-index: 3000;
              opacity: 0;
              box-shadow: 0 10px 25px rgba(0,0,0,0.25);
              transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s;
          `;
          document.body.appendChild(toast);
      }
      toast.textContent = message;
      toast.style.opacity = "1";
      toast.style.transform = "translateX(-50%) translateY(0)";
      
      setTimeout(() => {
          toast.style.opacity = "0";
          toast.style.transform = "translateX(-50%) translateY(100px)";
      }, 3000);
  }

  // Calendar Invite .ICS Generator File Helper
  window.downloadIcsFromDrawer = function (evtDataJsonStr) {
      try {
          const ev = JSON.parse(decodeURIComponent(evtDataJsonStr));
          let title = ev.title || "AuroConnect Event";
          let desc = ev.description || "";
          let location = ev.venue || "";
          
          let startDt = new Date();
          if (ev.dates) {
              const cleaned = ev.dates.split("to")[0].trim();
              const parsed = new Date(cleaned);
              if (!isNaN(parsed.getTime())) {
                  startDt = parsed;
              }
          }
          
          let endDt = new Date(startDt.getTime());
          
          let startHours = 9;
          let startMins = 0;
          let endHours = 10;
          let endMins = 0;
          
          let timeStr = ev.times || "";
          if (timeStr) {
              const parts = timeStr.split(/\s*(?:-|to|–|—)\s*/i);
              const startPart = parts[0] ? parts[0].trim().toLowerCase() : "";
              const endPart = parts[1] ? parts[1].trim().toLowerCase() : "";
              
              function parseTime(str) {
                  const isPm = str.includes("pm");
                  const clean = str.replace("am", "").replace("pm", "").trim();
                  const bits = clean.split(":");
                  let h = parseInt(bits[0], 10);
                  let m = bits[1] ? parseInt(bits[1], 10) : 0;
                  if (!isNaN(h)) {
                      if (isPm && h < 12) h += 12;
                      if (!isPm && h === 12) h = 0;
                      return { h, m };
                  }
                  return null;
              }
              
              const startParsed = parseTime(startPart);
              if (startParsed) {
                  startHours = startParsed.h;
                  startMins = startParsed.m;
                  endHours = (startHours + 1) % 24;
                  endMins = startMins;
              }
              
              if (endPart) {
                  const endParsed = parseTime(endPart);
                  if (endParsed) {
                      endHours = endParsed.h;
                      endMins = endParsed.m;
                  }
              }
          }
          
          startDt.setHours(startHours, startMins, 0, 0);
          endDt.setHours(endHours, endMins, 0, 0);
          if (endDt.getTime() < startDt.getTime()) {
              endDt = new Date(startDt.getTime() + 60 * 60 * 1000);
          }
          
          function formatIcsDate(date) {
              const y = date.getUTCFullYear();
              const m = String(date.getUTCMonth() + 1).padStart(2, '0');
              const d = String(date.getUTCDate()).padStart(2, '0');
              const h = String(date.getUTCHours()).padStart(2, '0');
              const min = String(date.getUTCMinutes()).padStart(2, '0');
              const s = String(date.getUTCSeconds()).padStart(2, '0');
              return `${y}${m}${d}T${h}${min}${s}Z`;
          }
          
          let ics = [
              "BEGIN:VCALENDAR",
              "VERSION:2.0",
              "PRODID:-//AuroConnect//NONSGML Event Calendar//EN",
              "CALSCALE:GREGORIAN",
              "METHOD:PUBLISH",
              "BEGIN:VEVENT",
              `UID:drawer-ev-${Math.random().toString(36).substr(2, 9)}@auroconnect.info`,
              `DTSTAMP:${formatIcsDate(new Date())}`,
              `DTSTART:${formatIcsDate(startDt)}`,
              `DTEND:${formatIcsDate(endDt)}`,
              `SUMMARY:${title.replace(/[,;]/g, '\\$&')}`,
              `DESCRIPTION:${desc.replace(/\n/g, '\\n').replace(/[,;]/g, '\\$&')}`,
              `LOCATION:${location.replace(/[,;]/g, '\\$&')}`,
              "END:VEVENT",
              "END:VCALENDAR"
          ].join("\r\n");
          
          const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, "_")}.ics`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          showToast("Saved Event to your Calendar!");
      } catch (err) {
          console.error("Failed to generate calendar file:", err);
          showToast("Could not generate calendar invitation.");
      }
  };

  // Copy current drawer URL
  window.copyDrawerLink = function () {
      try {
          const url = window.location.origin + window.location.pathname;
          navigator.clipboard.writeText(url).then(() => {
              showToast("Link copied to clipboard!");
          }).catch(() => {
              const input = document.createElement("input");
              input.value = url;
              document.body.appendChild(input);
              input.select();
              document.execCommand("copy");
              document.body.removeChild(input);
              showToast("Link copied to clipboard!");
          });
      } catch (e) {
          showToast("Could not copy link.");
      }
  };

  // Global open helper
  window.openDetails = function (markdownContent) {
      const parsedBody = document.getElementById("drawer-body");
      const parsedTitle = document.getElementById("drawer-title");

      // Extract details content nicely
      let title = "Event Details";
      let bodyText = markdownContent;

      if (markdownContent.startsWith("### ")) {
          const lines = markdownContent.split("\n");
          title = lines[0].replace("### ", "").trim();
          bodyText = lines.slice(1).join("\n").trim();
      }

      parsedTitle.textContent = title;

      // Extract type (e.g. _Workshop_ or _Class_)
      let type = "";
      const typeMatch = bodyText.match(/^_(.*?)_\n/);
      if (typeMatch) {
          type = typeMatch[1].trim();
          bodyText = bodyText.replace(/^_(.*?)_\n/, "").trim();
      }

      // Parse structured key-values
      const data = {
          title: title,
          type: type,
          dates: "",
          times: "",
          venue: "",
          cost: "",
          audience: "",
          contact: "",
          email: "",
          whatsapp: "",
          website: "",
          posterUrl: "",
          description: ""
      };

      // Find posterUrl inside the text
      const posterMatch = bodyText.match(/\[(?:View Image|Poster)\]\((https:\/\/firebasestorage\.googleapis\.com.*?)\)/i) || 
                          bodyText.match(/(https:\/\/firebasestorage\.googleapis\.com[^\s\)]+)/);
      if (posterMatch) {
          data.posterUrl = posterMatch[1].trim();
          // Remove poster link from text body
          bodyText = bodyText.replace(/\[(?:View Image|Poster)\]\((https:\/\/firebasestorage\.googleapis\.com.*?)\)/gi, "");
          bodyText = bodyText.replace(/(https:\/\/firebasestorage\.googleapis\.com[^\s\)]+)/gi, "");
      }

      // Find description
      const descMatch = bodyText.match(/\*\*Description:\*\*([\s\S]*)/i);
      if (descMatch) {
          data.description = descMatch[1].trim();
          bodyText = bodyText.replace(/\*\*Description:\*\*[\s\S]*/i, "").trim();
      }

      // Parse fields like "📅 **Date:** Friday"
      const lines = bodyText.split("\n").map(l => l.trim()).filter(Boolean);
      lines.forEach(line => {
          const match = line.match(/^(?:.*?\s+)?\*\*(.*?):\*\*\s*(.*)$/);
          if (match) {
              const key = match[1].toLowerCase().trim();
              let val = match[2].trim();

              // Strip markdown link if any
              const linkMatch = val.match(/\[(.*?)\]\((.*?)\)/);
              if (linkMatch) {
                  val = linkMatch[2];
              }

              if (key.includes("date") || key.includes("day")) {
                  data.dates = val;
              } else if (key.includes("time") || key.includes("timing")) {
                  data.times = val;
              } else if (key.includes("location") || key.includes("venue")) {
                  data.venue = val;
              } else if (key.includes("cost") || key.includes("contribution") || key.includes("price") || key.includes("fee")) {
                  data.cost = val;
              } else if (key.includes("audience") || key.includes("key info") || key.includes("who")) {
                  data.audience = val;
              } else if (key.includes("contact") || key.includes("phone")) {
                  data.contact = val;
              } else if (key.includes("email")) {
                  data.email = val;
              } else if (key.includes("whatsapp")) {
                  data.whatsapp = val;
              } else if (key.includes("website")) {
                  data.website = val;
              }
          }
      });

      // Construct beautifully structured HTML
      let html = "";

      // 1. Beautiful Poster Banner Image at top
      if (data.posterUrl) {
          html += `
          <div class="drawer-poster-banner">
              <img class="drawer-poster-img" src="${data.posterUrl}" alt="${data.title}" />
              <div class="drawer-poster-overlay">
                  <a href="${data.posterUrl}" target="_blank" class="drawer-poster-expand-btn">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="11" cy="11" r="8"></circle>
                          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                          <line x1="11" y1="8" x2="11" y2="14"></line>
                          <line x1="8" y1="11" x2="14" y2="11"></line>
                      </svg>
                      View Image
                  </a>
              </div>
          </div>`;
      }

      // 2. Classy Badges
      const finalCategory = data.type || "Class / Activity";
      html += `
      <div class="drawer-meta-badges">
          <span class="drawer-badge drawer-badge-category">✨ Activity</span>
          ${data.type ? `<span class="drawer-badge drawer-badge-type">${data.type}</span>` : ""}
      </div>`;

      // 3. Gorgeous Bento Grid
      html += `<div class="drawer-bento-grid">`;

      if (data.dates) {
          html += `
          <div class="drawer-bento-item">
              <div class="drawer-bento-icon">${getLabelIcon("date")}</div>
              <div class="drawer-bento-info">
                  <div class="detail-label">Date / Schedule</div>
                  <div class="detail-value">${data.dates}</div>
              </div>
          </div>`;
      }

      if (data.times) {
          html += `
          <div class="drawer-bento-item">
              <div class="drawer-bento-icon">${getLabelIcon("time")}</div>
              <div class="drawer-bento-info">
                  <div class="detail-label">Timing</div>
                  <div class="detail-value">${data.times}</div>
              </div>
          </div>`;
      }

      if (data.venue) {
          html += `
          <div class="drawer-bento-item full-width">
              <div class="drawer-bento-icon">${getLabelIcon("venue")}</div>
              <div class="drawer-bento-info">
                  <div class="detail-label">Venue / Location</div>
                  <div class="detail-value">${data.venue}</div>
              </div>
          </div>`;
      }

      if (data.cost) {
          html += `
          <div class="drawer-bento-item">
              <div class="drawer-bento-icon">${getLabelIcon("cost")}</div>
              <div class="drawer-bento-info">
                  <div class="detail-label">Contribution / Cost</div>
                  <div class="detail-value">${data.cost}</div>
              </div>
          </div>`;
      }

      if (data.audience) {
          html += `
          <div class="drawer-bento-item">
              <div class="drawer-bento-icon">${getLabelIcon("audience")}</div>
              <div class="drawer-bento-info">
                  <div class="detail-label">Target Audience</div>
                  <div class="detail-value">${data.audience}</div>
              </div>
          </div>`;
      }

      html += `</div>`; // Close bento grid

      // 4. Description Section
      if (data.description) {
          html += `
          <div class="detail-desc">
              <div class="detail-desc-title">About the Event</div>
              <div class="detail-desc-text">${data.description}</div>
          </div>`;
      } else {
          html += `
          <div class="detail-desc">
              <div class="detail-desc-title">About the Event</div>
              <div class="detail-desc-text" style="font-style: italic;">No detailed description provided. Please refer to timing and schedule above.</div>
          </div>`;
      }

      // 5. Beautiful Interactive Actions Block
      const hasWhatsapp = !!data.whatsapp;
      const hasEmail = !!data.email;
      const hasWebsite = !!data.website;
      const hasAnyContact = hasWhatsapp || hasEmail || hasWebsite || !!data.contact;

      if (hasAnyContact || data.dates) {
          const encodedData = encodeURIComponent(JSON.stringify(data));
          
          html += `
          <div class="drawer-actions-block">
              <div class="drawer-actions-title">Interactive Quick Actions</div>`;
              
          if (data.contact) {
              html += `
              <div style="font-size: 0.8rem; color: var(--text-secondary); display: flex; align-items: center; gap: 6px; margin-bottom: -4px;">
                  <span>📞</span> Direct Contact: <strong style="color: var(--text);">${data.contact}</strong>
              </div>`;
          }

          html += `<div class="drawer-actions-grid">`;

          // Add to Calendar Button (Downloads direct ICS file)
          html += `
          <button onclick="downloadIcsFromDrawer('${encodedData}')" class="drawer-btn btn-calendar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              Add to Calendar Invite
          </button>`;

          if (hasWhatsapp) {
              const waNum = data.whatsapp.replace(/\D/g, '');
              const waText = encodeURIComponent(`Hi, I found your event "${data.title}" on AuroConnect and would like more information!`);
              html += `
              <a href="https://wa.me/${waNum}?text=${waText}" target="_blank" class="drawer-btn btn-whatsapp">
                  <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" style="margin-top: 1px;">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.864-9.864.002-2.637-1.023-5.115-2.887-6.979C16.582 1.9 14.101.876 11.469.876c-5.44 0-9.866 4.418-9.87 9.866-.001 1.702.46 3.364 1.336 4.82l-.428 1.564 1.62-.424 1.53.908zm11.365-6.83c-.302-.151-1.787-.882-2.057-.98-.27-.099-.465-.148-.662.151-.197.297-.765.98-.937 1.177-.173.199-.347.223-.649.072-.302-.151-1.274-.469-2.427-1.496-.897-.8-1.502-1.787-1.679-2.088-.177-.302-.018-.465.132-.615.136-.135.302-.351.454-.526.151-.176.202-.302.302-.503.102-.201.051-.376-.025-.526-.076-.151-.662-1.597-.907-2.185-.238-.572-.48-.495-.662-.504-.171-.008-.367-.01-.563-.01-.197 0-.517.073-.787.371-.27.297-1.031 1.008-1.031 2.455s1.053 2.842 1.2 3.042c.148.199 2.073 3.164 5.021 4.439.701.303 1.25.485 1.677.621.705.224 1.345.193 1.851.118.563-.084 1.787-.73 2.039-1.436.252-.706.252-1.313.177-1.436-.076-.123-.27-.197-.573-.348z"/>
                  </svg>
                  WhatsApp Contact
              </a>`;
          }

          if (hasEmail) {
              const emailSubject = encodeURIComponent(`Inquiry: ${data.title}`);
              html += `
              <a href="mailto:${data.email}?subject=${emailSubject}" class="drawer-btn btn-email">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                      <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                  Send Email
              </a>`;
          }

          if (hasWebsite) {
              const siteUrl = data.website.startsWith("http") ? data.website : "https://" + data.website;
              html += `
              <a href="${siteUrl}" target="_blank" class="drawer-btn btn-website">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="2" y1="12" x2="22" y2="12"></line>
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                  </svg>
                  Official Website
              </a>`;
          }

          html += `</div></div>`;
      }

      // 6. Direct share row
      html += `
      <button class="drawer-share-pill" onclick="copyDrawerLink()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
          </svg>
          Share AuroConnect Link
      </button>`;

      parsedBody.innerHTML = html;

      // Trigger sliding animations smoothly
      overlay.classList.add("active");
      drawer.classList.add("active");

      // Push history state to seamlessly integrate with browser Back Button
      if (!history.state || !history.state.detailsOpen) {
          history.pushState({ detailsOpen: true }, "");
      }
  };

  // Close drawer helper
  function closeDetails() {
      overlay.classList.remove("active");
      drawer.classList.remove("active");
      
      // Clean up inline styles for gesture transforms
      setTimeout(() => {
          drawer.style.transform = "";
      }, 450);

      if (history.state && history.state.detailsOpen) {
          history.back();
      }
  }

  // Bind to back button popstate
  window.addEventListener("popstate", () => {
      if (overlay.classList.contains("active")) {
          overlay.classList.remove("active");
          drawer.classList.remove("active");
          setTimeout(() => {
              drawer.style.transform = "";
          }, 450);
      }
  });

  // Make close function globally accessible
  window.closeDetails = closeDetails;
})();
