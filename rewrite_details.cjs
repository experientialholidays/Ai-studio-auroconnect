const fs = require('fs');

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Event Details | AuroConnect</title>
    <style>
    :root { 
        --accent: #0b57d0; 
        --bg: #f8f9fa; 
        --surface: #ffffff;
        --text: #1f1f1f;
        --text-secondary: #444444;
        --border: #ddd;
        --user-msg-bg: #e9eef6;
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
            --user-msg-bg: #1a73e8; 
            --accent: #8ab4f8; 
            --input-border: #5f6368;
            --shadow: rgba(0,0,0,0.5);
        }
    }

    html { font-size: 100%; }

    body { 
        margin: 0; 
        font-family: 'Segoe UI', Roboto, sans-serif; 
        background: var(--bg); 
        color: var(--text);
        display: flex; 
        flex-direction: column; 
        height: 100vh;
        -webkit-text-size-adjust: 100%;
        touch-action: pan-y;
        overscroll-behavior: none;
    }

    .header-title-group {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }
    .header h1 { margin: 0; font-size: 1.375rem; color: var(--text); line-height: 1; }
    .coffee-link {
        color: var(--accent);
        text-decoration: underline;
        text-underline-offset: 4px;
        font-weight: 500; 
        font-size: 0.9rem; 
        display: inline-block;
    }

    #main-content {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        display: flex;
        justify-content: center;
        padding: 1.25rem 5%;
        box-sizing: border-box;
    }

    .details-container {
        width: 100%;
        max-width: 50rem;
    }

    .event-card {
        color: var(--text);
        font-size: 0.95rem;
        display: block;
        width: 100%;
        box-sizing: border-box;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 20px 24px;
        margin: 8px 0;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        line-height: 1.5;
        position: relative;
    }

    .ec-topbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        font-size: 0.85rem;
    }
    
    .ec-type {
        color: #64748b;
        font-weight: 500;
    }
    
    .ec-date {
        font-weight: 600;
        text-transform: uppercase;
        font-size: 0.8rem;
        letter-spacing: 0.05em;
        color: #64748b;
    }

    .event-title {
        font-size: 1.25rem;
        color: var(--accent);
        display: block;
        margin-bottom: 16px;
        line-height: 1.3;
        font-weight: 600;
    }

    .detail-row {
        margin-bottom: 8px;
    }

    .detail-label {
        font-weight: 600;
        color: var(--text);
        display: inline-block;
        margin-right: 4px;
    }

    .poster-img {
        width: 100%;
        max-height: 400px;
        object-fit: cover;
        border-radius: 8px;
        margin-bottom: 16px;
    }

    a {
        color: var(--accent);
        text-decoration: none;
    }

    a:hover {
        text-decoration: underline;
    }

    .description {
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid var(--border);
        white-space: pre-wrap;
    }

    .action-buttons {
        display: flex;
        gap: 12px;
        margin-top: 20px;
        padding-top: 16px;
        border-top: 1px solid var(--border);
    }

    .action-btn {
        background: var(--surface);
        border: 1px solid var(--border);
        color: var(--text);
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 500;
    }

    .action-btn:hover {
        background: var(--bg);
    }
    
    .back-btn-container {
        margin-bottom: 16px;
    }
    
    .back-btn {
        color: var(--text-secondary);
        text-decoration: none;
        font-size: 0.95rem;
        font-weight: 500;
    }

    .back-btn:hover {
        color: var(--text);
        text-decoration: underline;
    }

    .disclaimer {
        text-align: center;
        font-size: 0.8rem;
        color: var(--text-secondary);
        padding: 1rem;
        background: var(--surface);
        border-top: 0.0625rem solid var(--border);
    }

    @media (max-width: 600px) {
        #main-content {
            padding: 1rem 4%;
        }
        .event-card {
            border-radius: 8px;
            padding: 16px;
            margin: 6px 0;
        }
    }
    </style>
</head>
<body>

<div class="header"></div>

<div id="main-content">
    <div class="details-container">
        <div class="back-btn-container">
            <a href="javascript:history.back()" class="back-btn">← Back</a>
        </div>
        <div id="event-content"></div>
    </div>
</div>

<div class="disclaimer"></div>

<script>
    const event = {{EVENT_DATA}};
    
    function render() {
        const container = document.getElementById("event-content");
        
        let html = \`<div class="event-card">\`;
        
        if (event.posterUrl) {
            html += \`<img class="poster-img" src="\${event.posterUrl}" alt="\${event.title}">\`;
        }
        
        if (event.type || event.dates) {
            html += \`<div class="ec-topbar">
                <span class="ec-type">\${event.type || ''}</span>
                <span class="ec-date">\${event.dates || ''}</span>
            </div>\`;
        }
        
        html += \`<div class="event-title">\${event.title || 'Event Details'}</div>\`;
        
        if (event.times) {
            html += \`<div class="detail-row"><span class="detail-label">Time:</span> \${event.times}</div>\`;
        }
        if (event.venue) {
            html += \`<div class="detail-row"><span class="detail-label">Location:</span> \${event.venue}</div>\`;
        }
        if (event.cost) {
            html += \`<div class="detail-row"><span class="detail-label">Cost/Contribution:</span> \${event.cost}</div>\`;
        }
        if (event.audience) {
            html += \`<div class="detail-row"><span class="detail-label">Key info:</span> \${event.audience}</div>\`;
        }
        if (event.contact) {
            html += \`<div class="detail-row"><span class="detail-label">Phone:</span> \${event.contact}</div>\`;
        }
        if (event.email) {
            html += \`<div class="detail-row"><span class="detail-label">Email:</span> \${event.email}</div>\`;
        }
        if (event.whatsapp) {
            const waNumber = event.whatsapp.replace(/[^0-9]/g, '');
            html += \`<div class="detail-row"><span class="detail-label">WhatsApp:</span> <a href="https://wa.me/\${waNumber}" target="_blank">Message</a></div>\`;
        }
        if (event.website) {
            const url = event.website.startsWith('http') ? event.website : 'https://' + event.website;
            html += \`<div class="detail-row"><span class="detail-label">Website:</span> <a href="\${url}" target="_blank">Visit</a></div>\`;
        }
        
        if (event.description) {
            html += \`<div class="description">\${event.description}</div>\`;
        }
        
        html += \`<div class="action-buttons">
            <button class="action-btn" onclick="copyEventLink()">Copy Link</button>
            <button class="action-btn" onclick="shareEvent()">Share</button>
        </div>\`;
        
        html += \`</div>\`;
        
        container.innerHTML = html;
    }
    
    function copyEventLink() {
        navigator.clipboard.writeText(window.location.href).then(() => {
            alert("Link copied!");
        }).catch(() => {
            alert("Failed to copy.");
        });
    }

    function shareEvent() {
        if (navigator.share) {
            navigator.share({
                title: event.title,
                url: window.location.href
            }).catch(() => copyEventLink());
        } else {
            copyEventLink();
        }
    }

    render();
</script>
<script src="/common.js" type="module"></script>
</body>
</html>
`;

fs.writeFileSync('event_details.html', htmlContent);
console.log('Done replacing event_details.html');
