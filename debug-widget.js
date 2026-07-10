// Shared debug button + panel for every prototype. Include as the first
// element inside <body>, before the prototype's own scripts:
//   <script src="../../debug-widget.js" data-name="My Proto" data-version="1"></script>
// Prototype-specific controls placed in <template id="debug-extras"> are
// adopted into the panel between the version line and the menu link.
(function () {
    const script = document.currentScript;
    const name = (script && script.dataset.name) || document.title;
    const version = (script && script.dataset.version) || '1';

    const style = document.createElement('style');
    style.textContent = `
#debug-btn {
    position: fixed;
    top: 20px;
    right: 20px;
    width: 50px;
    height: 50px;
    border: none;
    border-radius: 50%;
    background: white;
    font-size: 24px;
    cursor: pointer;
    box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
    z-index: 1000;
    transition: transform 0.2s;
    -webkit-tap-highlight-color: transparent;
}

#debug-btn:hover {
    transform: scale(1.1);
}

#debug-btn:active {
    transform: scale(0.95);
}

#debug-overlay {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    color: #333;
    padding: 30px;
    border-radius: 10px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    z-index: 1001;
    width: min(340px, 90vw);
    max-height: 80vh;
    overflow-y: auto;
    font-family: Arial, sans-serif;
    font-size: 15px;
    text-align: left;
    touch-action: auto;
}

#debug-overlay.hidden {
    display: none;
}

#debug-overlay h3 {
    margin: 0 0 20px 0;
    color: #333;
    padding-right: 30px;
}

#debug-close-btn {
    position: absolute;
    top: 10px;
    right: 10px;
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #999;
}

#debug-close-btn:hover {
    color: #333;
}

#debug-overlay .debug-section {
    margin-bottom: 15px;
    padding-bottom: 15px;
    border-bottom: 1px solid #eee;
}

#debug-overlay .debug-section:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
}

#debug-menu-link {
    color: #333;
    font-weight: bold;
    text-decoration: none;
}

#debug-menu-link:hover {
    text-decoration: underline;
}
`;
    document.head.appendChild(style);

    const btn = document.createElement('button');
    btn.id = 'debug-btn';
    btn.title = 'Debug';
    btn.textContent = '🐛';

    const overlay = document.createElement('div');
    overlay.id = 'debug-overlay';
    overlay.className = 'hidden';

    const title = document.createElement('h3');
    title.textContent = name;

    const closeBtn = document.createElement('button');
    closeBtn.id = 'debug-close-btn';
    closeBtn.textContent = '✕';

    const versionSection = document.createElement('div');
    versionSection.className = 'debug-section';
    const versionLine = document.createElement('p');
    const versionLabel = document.createElement('strong');
    versionLabel.textContent = 'Version: ';
    const versionValue = document.createElement('span');
    versionValue.id = 'version-display';
    versionValue.textContent = version;
    versionLine.appendChild(versionLabel);
    versionLine.appendChild(versionValue);
    versionSection.appendChild(versionLine);

    const extrasSlot = document.createElement('div');
    extrasSlot.id = 'debug-extras-slot';

    const menuSection = document.createElement('div');
    menuSection.className = 'debug-section';
    const menuLink = document.createElement('a');
    menuLink.id = 'debug-menu-link';
    menuLink.href = '../../Prototypes.html';
    menuLink.textContent = '← Back to Menu';
    menuSection.appendChild(menuLink);

    overlay.appendChild(title);
    overlay.appendChild(closeBtn);
    overlay.appendChild(versionSection);
    overlay.appendChild(extrasSlot);
    overlay.appendChild(menuSection);

    btn.addEventListener('click', () => overlay.classList.toggle('hidden'));
    closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));

    document.body.appendChild(btn);
    document.body.appendChild(overlay);

    function adoptExtras() {
        const extras = document.getElementById('debug-extras');
        if (extras && extras.content) {
            extrasSlot.appendChild(extras.content);
        }
    }

    // The extras template sits later in <body>, so adopt it once the DOM is
    // parsed. This listener registers before any prototype script's, so the
    // controls exist by the time prototype init handlers look them up.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', adoptExtras);
    } else {
        adoptExtras();
    }
})();
