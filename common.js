(async function() {
  // Inject CSS styles for the common header, dropdown, and footer disclaimer
  const styleEl = document.createElement("style");
  styleEl.textContent = `
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
        font-family: 'Segoe UI', Roboto, sans-serif !important;
        border-top: 1px solid var(--border) !important;
        margin-top: auto !important;
    }
  `;
  document.head.appendChild(styleEl);

  let firebaseConfig = {
    projectId: "auro-connect",
    appId: "1:913005987760:web:57d4210ef370a817e33875",
    apiKey: "AIzaSyDZ87VkavGphOCIOfD3a-nhOSxI2wcpuMg",
    authDomain: "auro-connect.firebaseapp.com",
    storageBucket: "auro-connect.firebasestorage.app",
    messagingSenderId: "913005987760",
    firestoreDatabaseId: "(default)"
  };

  try {
    const response = await fetch("/api/firebase_config");
    if (response.ok) {
      const configOverride = await response.json();
      firebaseConfig = { ...firebaseConfig, ...configOverride };
    }
  } catch (err) {
    console.warn("Could not load dynamic Firebase config inside common.js, using defaults:", err);
  }

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
    const isSubmit = pathname.endsWith("submit.html");
    const isDashboard = pathname.endsWith("dashboard.html");
    const isContact = pathname.endsWith("contact.html");
    
    let menuHtml = "";
    if (user) {
      menuHtml += `<div class="dropdown-user-info">Logged in as:<br><strong>${user.email}</strong></div>`;
    }
    
    menuHtml += `
      <a href="#" id="common-menu-new-session" style="${isIndex ? "font-weight: bold;" : ""}">New Session</a>
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
    
    let disclaimerEl = document.querySelector(".disclaimer");
    if (!disclaimerEl) {
      disclaimerEl = document.createElement("div");
      disclaimerEl.className = "disclaimer";
      document.body.appendChild(disclaimerEl);
    }
    disclaimerEl.innerHTML = "“AuroConnect is not affiliated with the Auroville Foundation or any Auroville unit.”";
    
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
