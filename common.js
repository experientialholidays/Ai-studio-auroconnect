(async function() {
  // Inject Google Font (Inter) for enhanced text clarity & weight matching ChatGPT
  if (!document.getElementById("inter-font-link")) {
    const fontLink = document.createElement("link");
    fontLink.id = "inter-font-link";
    fontLink.rel = "stylesheet";
    fontLink.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
    document.head.appendChild(fontLink);
  }

  // Inject CSS styles for the common header, typography, dropdown, and footer disclaimer
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    /* Global ChatGPT-Style Crisp Typography & Font Weight Enhancement */
    body {
        font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        -webkit-font-smoothing: antialiased !important;
        -moz-osx-font-smoothing: grayscale !important;
        text-rendering: optimizeLegibility !important;
        letter-spacing: -0.011em !important;
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
        padding: 1rem;
        font-size: 0.8rem;
        color: var(--text-secondary);
        font-family: inherit !important;
        border-top: 1px solid var(--border) !important;
        margin-top: auto !important;
        width: 100%;
        box-sizing: border-box;
    }
    .disclaimer-links {
        display: flex;
        gap: 0.75rem;
        justify-content: center;
        align-items: center;
        margin-top: 0.5rem;
        flex-wrap: wrap;
    }
    .disclaimer-links a {
        color: var(--accent);
        text-decoration: none;
        font-weight: 500;
    }
    .disclaimer-links a:hover {
        text-decoration: underline;
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
              <h1>🤖 AuroConnect</h1>
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
      <div>“AuroConnect is not affiliated with the Auroville Foundation or any Auroville unit.”</div>
      <div class="disclaimer-links">
        <a href="/about.html" style="${isAbout ? "font-weight: bold;" : ""}">About Us</a>
        <span>•</span>
        <a href="/privacy.html" style="${isPrivacy ? "font-weight: bold;" : ""}">Privacy Policy</a>
        <span>•</span>
        <a href="/terms.html" style="${isTerms ? "font-weight: bold;" : ""}">Terms & Conditions</a>
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
            location.reload();
          }
        } else {
          window.location.href = "/?new_session=true";
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
