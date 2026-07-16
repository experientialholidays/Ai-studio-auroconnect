// Unified Common Header & Footer with Live Auth for AuroConnect

(async function () {
  // 1. Dynamic CSS Injection to ensure pixel-perfect visual alignment
  const style = document.createElement("style");
  style.textContent = `
    /* CSS Variables matching index.html perfectly */
    :root { 
        --accent: #0b57d0; 
        --bg: #f8f9fa; 
        --surface: #ffffff;
        --text: #1f1f1f;
        --text-secondary: #444444;
        --border: #ddd;
        --input-border: #dfe1e5;
        --shadow: rgba(0,0,0,0.05);
    }

    @media (prefers-color-scheme: dark) {
        :root {
            --bg: #000000; 
            --surface: #1e1e1e; 
            --text: #f1f3f4; 
            --text-secondary: #bdc1c6; 
            --border: #3c4043;
            --accent: #8ab4f8; 
            --input-border: #5f6368;
            --shadow: rgba(0,0,0,0.5);
        }
    }

    /* Common Header Reset & Layout */
    .header { 
        background: var(--surface) !important; 
        padding: 1rem 1.875rem !important; 
        border-bottom: 0.0625rem solid var(--border) !important; 
        display: flex !important; 
        justify-content: space-between !important; 
        align-items: center !important; 
        width: 100% !important;
        box-sizing: border-box !important;
        margin: 0 !important;
        z-index: 100 !important;
    }
    
    .header-title-group {
        display: flex !important;
        flex-direction: column !important;
        gap: 0.4rem !important;
        align-items: flex-start !important;
    }

    .header-logo-link {
        text-decoration: none !important;
        color: var(--text) !important;
        display: inline-flex !important;
        align-items: center !important;
    }

    .header h1 { 
        margin: 0 !important; 
        font-size: 1.375rem !important; 
        color: var(--text) !important; 
        line-height: 1 !important; 
        font-family: 'Segoe UI', Roboto, sans-serif !important;
        font-weight: bold !important;
    }

    .coffee-link {
        color: var(--accent) !important;
        text-decoration: underline !important;
        text-underline-offset: 4px !important;
        font-weight: 500 !important;
        font-size: 0.9rem !important;
        display: inline-block !important;
        font-family: 'Segoe UI', Roboto, sans-serif !important;
    }

    /* Dropdown UI */
    .dropdown {
        position: relative !important;
        display: inline-block !important;
    }
    
    .dropdown-content {
        display: none;
        position: absolute !important;
        right: 0 !important;
        top: 100% !important;
        background-color: var(--surface) !important;
        min-width: 200px !important;
        box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2) !important;
        z-index: 1000 !important;
        border-radius: 8px !important;
        overflow: hidden !important;
        border: 1px solid var(--border) !important;
        margin-top: 5px !important;
    }
    
    .dropdown-content a, .dropdown-content button {
        color: var(--text) !important;
        padding: 12px 16px !important;
        text-decoration: none !important;
        display: block !important;
        font-size: 0.9rem !important;
        text-align: left !important;
        border: none !important;
        background: none !important;
        width: 100% !important;
        box-sizing: border-box !important;
        cursor: pointer !important;
        font-family: 'Segoe UI', Roboto, sans-serif !important;
        transition: background-color 0.2s !important;
    }
    
    .dropdown-content a:hover, .dropdown-content button:hover {
        background-color: var(--bg) !important;
    }
    
    .dropdown-user-info {
        padding: 12px 16px !important;
        font-size: 0.8rem !important;
        color: var(--text-secondary) !important;
        border-bottom: 1px solid var(--border) !important;
        word-break: break-all !important;
        background-color: rgba(0,0,0,0.02) !important;
        font-family: 'Segoe UI', Roboto, sans-serif !important;
        line-height: 1.4 !important;
    }
    
    .three-dots {
        background: none !important;
        border: none !important;
        font-size: 1.5rem !important;
        cursor: pointer !important;
        color: var(--text) !important;
        padding: 0 10px !important;
        outline: none !important;
    }

    .show-menu {
        display: block !important;
    }

    /* Common Footer (Disclaimer) Styling */
    .disclaimer {
        font-size: 0.65rem !important; 
        color: var(--text-secondary) !important; 
        text-align: center !important;
        padding: 0.2rem 1rem 0.8rem 1rem !important; 
        background: var(--bg) !important;
        line-height: 1.2 !important;
        width: 100% !important;
        box-sizing: border-box !important;
        font-family: 'Segoe UI', Roboto, sans-serif !important;
        border-top: 1px solid var(--border) !important;
        margin-top: auto !important;
    }
  `;
  document.head.appendChild(style);

  // 2. Default hardcoded Firebase config
  let firebaseConfig = {
    projectId: "auro-connect",
    appId: "1:913005987760:web:57d4210ef370a817e33875",
    apiKey: "AIzaSyDZ87VkavGphOCIOfD3a-nhOSxI2wcpuMg",
    authDomain: "auro-connect.firebaseapp.com",
    storageBucket: "auro-connect.firebasestorage.app",
    messagingSenderId: "913005987760",
    firestoreDatabaseId: "(default)"
  };

  // 3. Dynamic config fetch helper
  try {
    const configRes = await fetch("/api/firebase_config");
    if (configRes.ok) {
      const fetchedConfig = await configRes.json();
      firebaseConfig = { ...firebaseConfig, ...fetchedConfig };
    }
  } catch (err) {
    console.warn("Could not load dynamic Firebase config inside common.js, using defaults:", err);
  }

  // 4. Initialize Firebase App & Auth dynamically
  let firebaseAppModule, firebaseAuthModule;
  let commonAuth = null;

  try {
    firebaseAppModule = await import("https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js");
    firebaseAuthModule = await import("https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js");

    const apps = firebaseAppModule.getApps();
    const app = apps.length > 0 ? apps[0] : firebaseAppModule.initializeApp(firebaseConfig);
    commonAuth = firebaseAuthModule.getAuth(app);
  } catch (e) {
    console.error("Failed to initialize Firebase Auth in common.js", e);
  }

  // 5. Build/Inject Header & Footer Elements
  function renderHeaderFooter(user = null) {
    // Inject or update Header
    let headerEl = document.querySelector(".header");
    if (!headerEl) {
      // Find where to prepend header (usually at the very top of body)
      headerEl = document.createElement("div");
      headerEl.className = "header";
      document.body.insertBefore(headerEl, document.body.firstChild);
    }

    // Clean up current page active classes
    const currentPath = window.location.pathname;
    const isHome = currentPath === "/" || currentPath.endsWith("index.html");
    const isSubmit = currentPath.endsWith("submit.html");
    const isDashboard = currentPath.endsWith("dashboard.html");
    const isContact = currentPath.endsWith("contact.html");

    // Dynamic dropdown menu HTML
    let menuHtml = "";
    if (user) {
      menuHtml += `<div class="dropdown-user-info">Logged in as:<br><strong>${user.email}</strong></div>`;
    }

    // Navigation links
    menuHtml += `
      <a href="#" id="common-menu-new-session" style="${isHome ? 'font-weight: bold;' : ''}">New Session</a>
      <a href="/submit.html" style="${isSubmit ? 'font-weight: bold;' : ''}">Submit</a>
      <a href="/dashboard.html" style="${isDashboard ? 'font-weight: bold;' : ''}">Dashboard</a>
      <a href="/contact.html" style="${isContact ? 'font-weight: bold;' : ''}">Contact</a>
    `;

    // Sign out / Sign in
    if (user) {
      menuHtml += `<button id="common-menu-auth-btn" style="color: #dc2626 !important; font-weight: 500;">Sign Out</button>`;
    } else {
      menuHtml += `<button id="common-menu-auth-btn" style="color: var(--accent) !important; font-weight: 500;">Sign In</button>`;
    }

    // Full Header structure
    headerEl.innerHTML = `
      <div class="header-title-group">
          <a href="/" class="header-logo-link">
              <h1>🤖 AuroConnect</h1>
          </a>
          <a href="https://rzp.io/rzp/AuroConnect" target="_blank" class="coffee-link">☕ Buy me a coffee</a>
      </div>
      <div style="display: flex; align-items: center; gap: 0.5rem;">
          <div class="dropdown">
              <button id="common-three-dots" class="three-dots">⋮</button>
              <div id="common-dropdown-content" class="dropdown-content">
                  ${menuHtml}
              </div>
          </div>
      </div>
    `;

    // Inject or update Footer/Disclaimer
    let footerEl = document.querySelector(".disclaimer");
    if (!footerEl) {
      footerEl = document.createElement("div");
      footerEl.className = "disclaimer";
      document.body.appendChild(footerEl);
    }
    footerEl.innerHTML = `“AuroConnect is not affiliated with the Auroville Foundation or any Auroville unit.”`;

    // 6. Setup Interactivity listeners
    const threeDotsBtn = document.getElementById("common-three-dots");
    const dropdownContent = document.getElementById("common-dropdown-content");

    if (threeDotsBtn && dropdownContent) {
      threeDotsBtn.onclick = function (e) {
        e.stopPropagation();
        dropdownContent.classList.toggle("show-menu");
      };
    }

    // New Session handler
    const newSessionBtn = document.getElementById("common-menu-new-session");
    if (newSessionBtn) {
      newSessionBtn.onclick = function (e) {
        e.preventDefault();
        dropdownContent.classList.remove("show-menu");
        if (isHome) {
          if (typeof window.startNewSession === "function") {
            window.startNewSession();
          } else {
            localStorage.removeItem("auro_session_id");
            location.reload();
          }
        } else {
          window.location.href = "/?new_session=true";
        }
      };
    }

    // Auth Button handler (Sign In or Sign Out)
    const authBtn = document.getElementById("common-menu-auth-btn");
    if (authBtn) {
      authBtn.onclick = async function (e) {
        e.preventDefault();
        dropdownContent.classList.remove("show-menu");
        if (user) {
          // Sign Out action
          if (typeof window.signOutUser === "function") {
            window.signOutUser();
          } else if (commonAuth) {
            try {
              await firebaseAuthModule.signOut(commonAuth);
              if (isSubmit || isDashboard) {
                // For submit or dashboard pages, let them reload to refresh view state
                location.reload();
              }
            } catch (err) {
              console.error("Sign-out failed:", err);
            }
          }
        } else {
          // Sign In action
          if (isSubmit || isDashboard) {
            // If we are on these pages, trigger the local custom sign-in buttons directly if possible
            const localBtn = document.getElementById("google-login");
            if (localBtn) {
              localBtn.click();
            } else if (commonAuth) {
              await triggerGoogleSignIn();
            }
          } else {
            // Otherwise, we can redirect them to the Dashboard/Login page so they can sign in or handle popup directly here!
            if (commonAuth) {
              await triggerGoogleSignIn();
            } else {
              window.location.href = "/dashboard.html";
            }
          }
        }
      };
    }
  }

  // Helper function to trigger Google Auth directly from any page
  async function triggerGoogleSignIn() {
    if (!commonAuth || !firebaseAuthModule) return;
    try {
      const provider = new firebaseAuthModule.GoogleAuthProvider();
      await firebaseAuthModule.signInWithPopup(commonAuth, provider);
      // Reload on auth success if not on home page to refresh dashboard states
      if (window.location.pathname !== "/" && !window.location.pathname.endsWith("index.html")) {
        location.reload();
      }
    } catch (err) {
      console.error("Direct google sign-in failed:", err);
      alert("Sign in failed: " + err.message);
    }
  }

  // Click outside to close dropdown
  window.addEventListener("click", function (event) {
    const dropdownContent = document.getElementById("common-dropdown-content");
    if (dropdownContent && dropdownContent.classList.contains("show-menu")) {
      if (!event.target.matches(".three-dots") && !event.target.closest(".dropdown-content")) {
        dropdownContent.classList.remove("show-menu");
      }
    }
  });

  // Render initial clean layout immediately
  renderHeaderFooter(null);

  // Bind to Auth state change if available
  if (commonAuth && firebaseAuthModule) {
    firebaseAuthModule.onAuthStateChanged(commonAuth, (user) => {
      renderHeaderFooter(user);
    });
  }
})();
