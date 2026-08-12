(async function() {
  // Inject Google Font (Inter) for enhanced text clarity & weight matching ChatGPT
  if (!document.getElementById("inter-font-link")) {
    const fontLink = document.createElement("link");
    fontLink.id = "inter-font-link";
    fontLink.rel = "stylesheet";
    fontLink.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
    document.head.appendChild(fontLink);
  }

  // Inject dynamic favicon with the official AuroConnect logo
  const logoUrl = "https://firebasestorage.googleapis.com/v0/b/auro-connect.firebasestorage.app/o/Auroconnect_logo.png?alt=media&token=6defdb8f-f913-48b2-aa71-c0cccb82d642";
  if (!document.querySelector("link[rel='icon']")) {
    const favicon = document.createElement("link");
    favicon.rel = "icon";
    favicon.type = "image/png";
    favicon.href = logoUrl;
    document.head.appendChild(favicon);
  }
  if (!document.querySelector("link[rel='apple-touch-icon']")) {
    const appleIcon = document.createElement("link");
    appleIcon.rel = "apple-touch-icon";
    appleIcon.href = logoUrl;
    document.head.appendChild(appleIcon);
  }

  // Inject CSS styles for the common header, typography, dropdown, and footer disclaimer
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    /* Earthy Auroville Global Color Palette & Variables */
    :root { 
        --accent: #C85A32; 
        --bg: #F5F0EB; 
        --surface: #FFFFFF;
        --text: #3D2314;
        --text-secondary: #6E5D4F;
        --border: #E6DDD5;
        --user-msg-bg: #EEF2ED;
        --input-border: #D8CEC4;
        --shadow: rgba(61, 35, 20, 0.08);
    }

    @media (prefers-color-scheme: dark) {
        :root {
            --bg: #1A1715; 
            --surface: #24201D; 
            --text: #F5E8DF; 
            --text-secondary: #C4B5A5; 
            --border: #3A342E;
            --user-msg-bg: #232B25; 
            --accent: #E07A5F; 
            --input-border: #483F37;
            --shadow: rgba(0,0,0,0.4);
        }
    }

    /* Global ChatGPT-Style Crisp Typography & Font Weight Enhancement */
    body {
        font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        -webkit-font-smoothing: antialiased !important;
        -moz-osx-font-smoothing: grayscale !important;
        text-rendering: optimizeLegibility !important;
        letter-spacing: -0.011em !important;
        background-color: var(--bg) !important;
        color: var(--text) !important;
    }

    /* Common Header Styles to ensure identical layout on all pages */
    .header { 
        background: var(--surface) !important; 
        padding: 1rem 1.875rem !important; 
        border-bottom: 0.0625rem solid var(--border) !important; 
        display: flex !important; 
        justify-content: space-between !important; 
        align-items: center !important; 
        box-sizing: border-box !important;
        width: 100% !important;
        text-align: left !important;
        position: relative !important;
    }
    
    .header-title-group {
        display: flex !important;
        flex-direction: column !important;
        gap: 0.4rem !important;
    }

    .header h1 { 
        margin: 0 !important; 
        font-size: 1.375rem !important; 
        color: var(--text) !important; 
        line-height: 1 !important; 
        font-family: inherit !important;
    }

    .header-logo-link {
        text-decoration: none !important;
        color: inherit !important;
        display: flex !important;
        align-items: center !important;
        gap: 0.65rem !important;
    }

    .header-logo-img {
        width: 38px !important;
        height: 38px !important;
        border-radius: 50% !important;
        object-fit: cover !important;
        border: 1.5px solid var(--border) !important;
        box-shadow: 0 1px 4px var(--shadow) !important;
        transition: transform 0.2s ease !important;
        cursor: pointer !important;
    }

    .header-logo-link:hover .header-logo-img {
        transform: scale(1.05) !important;
    }

    /* Premium High-Visibility Buy Me a Coffee Button */
    .coffee-btn {
        background: linear-gradient(135deg, #FFDD00 0%, #FFBE00 100%) !important;
        color: #111111 !important;
        padding: 0.5rem 1.1rem !important;
        border-radius: 50px !important;
        text-decoration: none !important;
        font-weight: 700 !important;
        font-size: 0.85rem !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 0.45rem !important;
        box-shadow: 0 3px 10px rgba(255, 221, 0, 0.25) !important;
        transition: all 0.2s ease-in-out !important;
        white-space: nowrap !important;
        border: 1px solid rgba(255, 255, 255, 0.3) !important;
        cursor: pointer !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    }
    .coffee-btn:hover {
        transform: translateY(-1.5px) !important;
        box-shadow: 0 5px 15px rgba(255, 221, 0, 0.45) !important;
        background: linear-gradient(135deg, #FFE53B 0%, #FFBE00 100%) !important;
    }
    .coffee-btn:active {
        transform: translateY(0) !important;
        box-shadow: 0 2px 5px rgba(255, 221, 0, 0.2) !important;
    }

    .coffee-icon {
        display: inline-block !important;
        font-size: 1rem !important;
    }

    .coffee-text {
        display: inline !important;
    }

    /* Responsive adjustments for narrow screens */
    @media (max-width: 520px) {
        .header {
            padding: 0.75rem 1rem !important;
        }
        .coffee-btn {
            padding: 0.45rem 0.85rem !important;
            font-size: 0.8rem !important;
        }
    }
    @media (max-width: 440px) {
        .coffee-btn {
            padding: 0 !important;
            width: 36px !important;
            height: 36px !important;
            border-radius: 50% !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
        }
        .coffee-text {
            display: none !important;
        }
        .coffee-icon {
            font-size: 1.15rem !important;
            margin: 0 !important;
        }
    }

    .dropdown { position: relative; display: inline-block; }
    .three-dots { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text); padding: 0 0.5rem; }
    .dropdown-content { display: none; position: absolute; right: 0; background-color: var(--surface); min-width: 160px; box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.1); border: 1px solid var(--border); border-radius: 8px; z-index: 1000; padding: 0.5rem 0; }
    .dropdown-content a, .dropdown-content button { color: var(--text); padding: 0.5rem 1rem; text-decoration: none; display: block; background: none; border: none; width: 100%; text-align: left; font-family: inherit; font-size: 0.9rem; cursor: pointer; }
    .dropdown-content a:hover, .dropdown-content button:hover { background-color: var(--bg); }
    .show-menu { display: block; }
    .dropdown-user-info { padding: 0.5rem 1rem; border-bottom: 1px solid var(--border); font-size: 0.8rem; color: var(--text-secondary); word-break: break-all; }
    .disclaimer {
        text-align: center;
        padding: 0.6rem 0.5rem;
        font-size: 0.72rem;
        color: var(--text-secondary);
        font-family: inherit !important;
        border-top: 1px solid var(--border) !important;
        margin-top: auto !important;
        width: 100%;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.3rem;
    }
    .disclaimer-note {
        font-size: clamp(0.52rem, 2.35vw, 0.7rem);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
        text-align: center;
        line-height: 1.25;
        letter-spacing: -0.015em;
    }
    .disclaimer-links {
        display: flex;
        gap: 0.35rem 0.6rem;
        justify-content: center;
        align-items: center;
        flex-wrap: wrap;
        font-size: 0.68rem;
    }
    .disclaimer-links a {
        color: var(--text-secondary);
        text-decoration: underline;
        font-weight: 500;
        font-size: 0.68rem;
        transition: color 0.2s ease;
    }
    .disclaimer-links a:hover {
        color: var(--text);
    }
    .disclaimer-links span {
        font-size: 0.6rem;
        opacity: 0.7;
    }
    @media (max-width: 480px) {
        .disclaimer {
            padding: 0.45rem 0.2rem;
            gap: 0.25rem;
        }
        .disclaimer-note {
            font-size: clamp(0.5rem, 2.3vw, 0.65rem);
        }
        .disclaimer-links {
            gap: 0.25rem 0.4rem;
            font-size: 0.62rem;
        }
        .disclaimer-links a {
            font-size: 0.62rem;
        }
    }
  `;
  document.head.appendChild(styleEl);

  const firebaseConfig = {
    apiKey: "AIzaSyDZ87VkavGphOCIOfD3a-nhOSxI2wcpuMg",
    authDomain: "auro-connect.firebaseapp.com",
    projectId: "auro-connect",
    storageBucket: "auro-connect.firebasestorage.app",
    messagingSenderId: "913005987760",
    appId: "1:913005987760:web:57d4210ef370a817e33875",
    measurementId: "G-S4L4Z530CS"
  };

  let firebaseApp, firebaseAuth, authInstance = null;
  let savedLightboxScrollPositions = [];
  try {
    firebaseApp = await import("https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js");
    firebaseAuth = await import("https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js");
    
    const apps = firebaseApp.getApps();
    const app = apps.length > 0 ? apps[0] : firebaseApp.initializeApp(firebaseConfig);
    authInstance = firebaseAuth.getAuth(app);
  } catch (err) {
    console.error("Failed to initialize Firebase Auth in common.js", err);
  }

  function renderHeader(user = null) {
    let headerEl = document.querySelector(".header");
    if (!headerEl) {
      headerEl = document.createElement("div");
      headerEl.className = "header";
      document.body.insertBefore(headerEl, document.body.firstChild);
    }
    
    const pathname = window.location.pathname;
    const isIndex = pathname === "/" || pathname.endsWith("index.html");
    const isAbout = pathname.endsWith("about.html");
    const isSubmit = pathname.endsWith("submit.html");
    const isDashboard = pathname.endsWith("dashboard.html");
    const isContact = pathname.endsWith("contact.html");
    const isPrivacy = pathname.endsWith("privacy.html");
    const isTerms = pathname.endsWith("terms.html");
    
    let menuHtml = "";
    if (user) {
      menuHtml += `<div class="dropdown-user-info">Logged in as:<br><strong>${user.email}</strong></div>`;
    }
    
    menuHtml += `
      <a href="#" id="common-menu-new-session" style="${isIndex ? "font-weight: bold;" : ""}">New Session</a>
      <a href="/about.html" style="${isAbout ? "font-weight: bold;" : ""}">About</a>
      <a href="/submit.html" style="${isSubmit ? "font-weight: bold;" : ""}">Submit</a>
      <a href="/dashboard.html" style="${isDashboard ? "font-weight: bold;" : ""}">Dashboard</a>
      <a href="/contact.html" style="${isContact ? "font-weight: bold;" : ""}">Contact</a>
    `;
    
    if (user) {
      menuHtml += '<button id="common-menu-auth-btn" style="color: #dc2626 !important; font-weight: 500;">Sign Out</button>';
    } else {
      menuHtml += '<button id="common-menu-auth-btn" style="color: var(--accent) !important; font-weight: 500;">Sign In</button>';
    }
    
    headerEl.innerHTML = `
      <div class="header-title-group">
          <a href="/" class="header-logo-link">
              <img src="https://firebasestorage.googleapis.com/v0/b/auro-connect.firebasestorage.app/o/Auroconnect_logo.png?alt=media&token=6defdb8f-f913-48b2-aa71-c0cccb82d642" onerror="this.onerror=null;this.src='/assets/logo.png';" alt="AuroConnect Logo" class="header-logo-img" />
              <h1>AuroConnect</h1>
          </a>
      </div>
      <div style="display: flex; align-items: center; gap: 0.75rem;">
          <a href="https://rzp.io/rzp/AuroConnect" target="_blank" class="coffee-btn">
              <span class="coffee-icon">☕</span>
              <span class="coffee-text">Buy me a coffee</span>
          </a>
          <div class="dropdown">
              <button id="common-three-dots" class="three-dots">⋮</button>
              <div id="common-dropdown-content" class="dropdown-content">
                  ${menuHtml}
              </div>
          </div>
      </div>
    `;
    
    let disclaimerEl = document.querySelector(".disclaimer");
    if (!disclaimerEl) {
      disclaimerEl = document.createElement("div");
      disclaimerEl.className = "disclaimer";
      document.body.appendChild(disclaimerEl);
    }
    disclaimerEl.innerHTML = `
      <div class="disclaimer-note">“AuroConnect is not affiliated with the Auroville Foundation or any Auroville unit.”</div>
      <div class="disclaimer-links">
        <a href="/privacy.html" style="${isPrivacy ? "font-weight: bold;" : ""}">Privacy Policy</a>
        <span>•</span>
        <a href="/terms.html" style="${isTerms ? "font-weight: bold;" : ""}">Terms & Conditions</a>
        <span>•</span>
        <a href="/contact.html" style="${isContact ? "font-weight: bold;" : ""}">Contact Us</a>
      </div>
    `;
    
    const threeDots = document.getElementById("common-three-dots");
    const dropdownContent = document.getElementById("common-dropdown-content");
    if (threeDots && dropdownContent) {
      threeDots.onclick = function(e) {
        e.stopPropagation();
        dropdownContent.classList.toggle("show-menu");
      };
    }
    
    const logoImg = headerEl.querySelector(".header-logo-img");
    if (logoImg) {
      logoImg.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        openLogoLightbox();
      };
    }
    
    const newSessionBtn = document.getElementById("common-menu-new-session");
    if (newSessionBtn) {
      newSessionBtn.onclick = function(e) {
        e.preventDefault();
        dropdownContent.classList.remove("show-menu");
        if (isIndex) {
          if (typeof window.startNewSession === "function") {
            window.startNewSession();
          } else {
            localStorage.removeItem("auro_session_id");
            window.location.href = "/?new_session=true&t=" + Date.now();
          }
        } else {
          window.location.href = "/?new_session=true&t=" + Date.now();
        }
      };
    }
    
    const authBtn = document.getElementById("common-menu-auth-btn");
    if (authBtn) {
      authBtn.onclick = async function(e) {
        e.preventDefault();
        dropdownContent.classList.remove("show-menu");
        if (user) {
          if (typeof window.signOutUser === "function") {
            window.signOutUser();
          } else if (authInstance) {
            try {
              await firebaseAuth.signOut(authInstance);
              if (isSubmit || isDashboard) {
                location.reload();
              }
            } catch (err) {
              console.error("Sign-out failed:", err);
            }
          }
        } else {
          if (isSubmit || isDashboard) {
            const googleLoginBtn = document.getElementById("google-login");
            if (googleLoginBtn) {
              googleLoginBtn.click();
            } else if (authInstance) {
              await triggerSignIn();
            }
          } else {
            if (authInstance) {
              await triggerSignIn();
            } else {
              window.location.href = "/dashboard.html";
            }
          }
        }
      };
    }
  }

  async function triggerSignIn() {
    if (!authInstance || !firebaseAuth) return;
    try {
      const provider = new firebaseAuth.GoogleAuthProvider();
      await firebaseAuth.signInWithPopup(authInstance, provider);
      const pathname = window.location.pathname;
      if (pathname !== "/" && !pathname.endsWith("index.html")) {
        location.reload();
      }
    } catch (err) {
      console.error("Direct google sign-in failed:", err);
      alert("Sign in failed: " + err.message);
    }
  }

  function openLogoLightbox() {
    // 1. Capture scroll positions
    savedLightboxScrollPositions = [];
    
    // Capture window scroll
    savedLightboxScrollPositions.push({
      element: window,
      top: window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0,
      left: window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0
    });
    
    // Capture scroll of all elements with active scrolling
    document.querySelectorAll('#chat-window, .presets-bar, body, html, [style*="overflow"], [class*="scroll"]').forEach(el => {
      savedLightboxScrollPositions.push({
        element: el,
        top: el.scrollTop,
        left: el.scrollLeft
      });
    });

    let overlay = document.getElementById("logo-lightbox-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "logo-lightbox-overlay";
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 100000;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease;
      `;
      
      const img = document.createElement("img");
      img.id = "logo-lightbox-img";
      img.src = "https://firebasestorage.googleapis.com/v0/b/auro-connect.firebasestorage.app/o/Auroconnect_logo.png?alt=media&token=6defdb8f-f913-48b2-aa71-c0cccb82d642";
      img.style.cssText = `
        max-width: 85vw;
        max-height: 70vh;
        border-radius: 50%;
        border: 4px solid #FFFFFF;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
        transform: scale(0.8);
        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        cursor: pointer;
      `;
      
      const closeBtn = document.createElement("button");
      closeBtn.innerHTML = "&times;";
      closeBtn.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
        background: none;
        border: none;
        color: #FFFFFF;
        font-size: 2.5rem;
        cursor: pointer;
        opacity: 0.8;
        transition: opacity 0.2s;
        padding: 10px;
        line-height: 1;
      `;
      closeBtn.onmouseenter = () => closeBtn.style.opacity = "1";
      closeBtn.onmouseleave = () => closeBtn.style.opacity = "0.8";

      overlay.appendChild(closeBtn);
      overlay.appendChild(img);
      
      document.body.appendChild(overlay);

      const restoreScrolls = () => {
        if (savedLightboxScrollPositions && savedLightboxScrollPositions.length > 0) {
          savedLightboxScrollPositions.forEach(item => {
            try {
              if (item.element === window) {
                window.scrollTo({
                  top: item.top,
                  left: item.left,
                  behavior: 'auto'
                });
              } else if (item.element) {
                item.element.scrollTop = item.top;
                item.element.scrollLeft = item.left;
              }
            } catch (err) {
              console.warn("Failed to restore scroll position:", err);
            }
          });
        }
      };

      const closeLightbox = (shouldGoBack = true) => {
        overlay.style.opacity = "0";
        overlay.style.pointerEvents = "none";
        img.style.transform = "scale(0.8)";
        
        if (shouldGoBack && history.state && history.state.lightbox === "logo") {
          history.back();
        }

        // Restore scrolls immediately and across multiple ticks to override async browser popstate scroll jumps
        restoreScrolls();
        setTimeout(restoreScrolls, 0);
        setTimeout(restoreScrolls, 10);
        setTimeout(restoreScrolls, 30);
        setTimeout(restoreScrolls, 50);
        setTimeout(restoreScrolls, 100);
      };

      overlay.onclick = () => closeLightbox(true);
      closeBtn.onclick = () => closeLightbox(true);
      img.onclick = (e) => e.stopPropagation();

      window.addEventListener("popstate", (e) => {
        if (overlay.style.opacity === "1") {
          closeLightbox(false);
          restoreScrolls();
          setTimeout(restoreScrolls, 0);
          setTimeout(restoreScrolls, 20);
        }
      });
    }

    overlay.style.display = "flex";
    overlay.style.pointerEvents = "auto";
    
    try {
      history.pushState({ lightbox: "logo" }, "");
    } catch (e) {
      console.warn("Could not push state to history:", e);
    }
    
    setTimeout(() => {
      overlay.style.opacity = "1";
      const img = document.getElementById("logo-lightbox-img");
      if (img) img.style.transform = "scale(1)";
    }, 10);
  }

  window.addEventListener("click", function(e) {
    const dropdownContent = document.getElementById("common-dropdown-content");
    if (dropdownContent && dropdownContent.classList.contains("show-menu")) {
      if (!e.target.matches(".three-dots") && !e.target.closest(".dropdown-content")) {
        dropdownContent.classList.remove("show-menu");
      }
    }
  });

  renderHeader(null);
  
  if (authInstance && firebaseAuth) {
    firebaseAuth.onAuthStateChanged(authInstance, (user) => {
      renderHeader(user);
    });
  }
})();
