// ==UserScript==
// @name         Arras.io Mod Menu
// @namespace    http://tampermonkey.net
// @version      2.1.0
// @description  A Mod Menu with many features included.
// @author       Mocen
// @match        *://arras.io/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    let opaqueMode = true;
    let zoomFactor = 1.0;
    let menuOpen = false;
    let afkPrevention = true;
    let crosshairEnabled = true;
    let crosshairAttrObserver = null;
    let crosshairBodyObserver = null;
    let timerEnabled = true;
    let timerInterval = null;
    let sessionSeconds = 0;
    let deathDetected = false;
    let deathRestartTimeout = null;

    // --- Session Timer Box ---
    const timerBox = document.createElement('div');
    Object.assign(timerBox.style, {
        position: 'fixed',
        bottom: '10px',
        right: '220px',
        padding: '8px 14px',
        background: 'rgba(6, 6, 8, 0.88)',
        borderRadius: '10px',
        color: '#fff',
        fontFamily: 'Ubuntu, sans-serif',
        zIndex: '2147483645',
        display: 'block',
        cursor: 'grab',
        userSelect: 'none',
        boxShadow: '0 4px 30px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)'
    });
    timerBox.style.backdropFilter = 'blur(20px)';
    timerBox.style['-webkit-backdrop-filter'] = 'blur(20px)';
    timerBox.style.border = '1px solid rgba(176, 184, 193, 0.15)';

    const timerLabel = document.createElement('div');
    Object.assign(timerLabel.style, {
        fontSize: '8px', fontWeight: '700', color: 'rgba(176,184,193,0.5)',
        letterSpacing: '2.5px', textTransform: 'uppercase',
        marginBottom: '4px', textAlign: 'center'
    });
    timerLabel.innerText = 'TIME SPENT';

    const timerDisplay = document.createElement('div');
    Object.assign(timerDisplay.style, {
        fontSize: '19px', fontWeight: '900', color: '#f0f2f4',
        letterSpacing: '2px', textAlign: 'center'
    });
    timerDisplay.innerText = '00:00:00';

    timerBox.appendChild(timerLabel);
    timerBox.appendChild(timerDisplay);
    (document.body || document.documentElement).appendChild(timerBox);

    function formatTime(secs) {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }

    function startTimer() {
        if (timerInterval) clearInterval(timerInterval);
        sessionSeconds = 0;
        timerDisplay.innerText = formatTime(0);
        timerInterval = setInterval(() => {
            sessionSeconds++;
            timerDisplay.innerText = formatTime(sessionSeconds);
        }, 1000);
    }

    function stopTimer() {
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        if (deathRestartTimeout) { clearTimeout(deathRestartTimeout); deathRestartTimeout = null; }
        sessionSeconds = 0;
        timerDisplay.innerText = '00:00:00';
        deathDetected = false;
    }

    function resetTimer() {
        // Stop the interval and hold at 00:00:00
        // Timer will restart after a short delay once the death screen clears
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        if (deathRestartTimeout) { clearTimeout(deathRestartTimeout); deathRestartTimeout = null; }
        sessionSeconds = 0;
        timerDisplay.innerText = '00:00:00';
    }

    startTimer();

    // --- Dragging logic ---
    let dragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    timerBox.addEventListener('mousedown', (e) => {
        dragging = true;
        dragOffsetX = e.clientX - timerBox.getBoundingClientRect().left;
        dragOffsetY = e.clientY - timerBox.getBoundingClientRect().top;
        timerBox.style.cursor = 'grabbing';
        timerBox.style.bottom = 'auto';
        timerBox.style.right = 'auto';
        timerBox.style.top = timerBox.getBoundingClientRect().top + 'px';
        timerBox.style.left = timerBox.getBoundingClientRect().left + 'px';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        timerBox.style.left = (e.clientX - dragOffsetX) + 'px';
        timerBox.style.top  = (e.clientY - dragOffsetY) + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (dragging) { dragging = false; timerBox.style.cursor = 'grab'; }
    });

    // --- Crosshair ---
    function enableCrosshair() {
        const canvas = document.querySelector('#canvas');
        if (!canvas) {
            crosshairBodyObserver = new MutationObserver((mutations, obs) => {
                const c = document.querySelector('#canvas');
                if (c) { obs.disconnect(); applyCrosshair(c); }
            });
            crosshairBodyObserver.observe(document.body || document.documentElement, {
                childList: true, subtree: true
            });
        } else {
            applyCrosshair(canvas);
        }
    }

    function applyCrosshair(canvas) {
        canvas.style.setProperty('cursor', 'crosshair', 'important');
        crosshairAttrObserver = new MutationObserver(() => {
            canvas.style.setProperty('cursor', 'crosshair', 'important');
        });
        crosshairAttrObserver.observe(canvas, { attributes: true, attributeFilter: ['style'] });
    }

    function disableCrosshair() {
        if (crosshairAttrObserver) { crosshairAttrObserver.disconnect(); crosshairAttrObserver = null; }
        if (crosshairBodyObserver) { crosshairBodyObserver.disconnect(); crosshairBodyObserver = null; }
        const canvas = document.querySelector('#canvas');
        if (canvas) canvas.style.removeProperty('cursor');
    }

    enableCrosshair();

    // --- THE 2D NATIVE ARROW BUTTON (unchanged) ---
    const tab = document.createElement('div');
    Object.assign(tab.style, {
        position: 'fixed',
        top: '45px',
        left: '0.47px',
        width: '11px',
        height: '19.3px',
        backgroundColor: '#b0b8c1',
        borderRadius: '0 2.5px 2.2px 0',
        zIndex: '2147483647',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '2.5px solid #484848',
        transition: 'background-color 0.1s'
    });

    tab.innerHTML = `<div id="zenith-arrow" style="
        width: 0;
        height: 0;
        border-top: 4px solid transparent;
        border-bottom: 4px solid transparent;
        border-left: 6px solid white;
        transition: 0.2s;
        margin-left: 1px;
    "></div>`;
    (document.body || document.documentElement).appendChild(tab);

    // --- Interaction ---
    tab.onclick = () => {
        menuOpen = !menuOpen;
        menu.style.left = menuOpen ? '16px' : '-280px';
        const arrow = document.getElementById('zenith-arrow');
        arrow.style.transform = menuOpen ? 'rotate(180deg)' : 'rotate(0deg)';
        arrow.style.marginLeft = menuOpen ? '-2px' : '1px';
        tab.style.backgroundColor = menuOpen ? '#ff4444' : '#b0b8c1';
    };

    // --- Mod Menu ---
    const menu = document.createElement('div');
    Object.assign(menu.style, {
        position: 'fixed',
        top: '120px',
        left: '-280px',
        width: '235px',
        padding: '0',
        background: 'rgba(6, 6, 8, 0.92)',
        borderRadius: '12px',
        zIndex: '2147483646',
        userSelect: 'none',
        boxShadow: '0 16px 48px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.04)',
        transition: 'left 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        color: '#fff',
        fontFamily: 'Ubuntu, sans-serif',
        overflow: 'hidden'
    });
    menu.style.backdropFilter = 'blur(24px)';
    menu.style['-webkit-backdrop-filter'] = 'blur(24px)';
    menu.style.border = '1px solid rgba(176, 184, 193, 0.12)';

    // --- Header ---
    const header = document.createElement('div');
    Object.assign(header.style, {
        padding: '13px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.02)'
    });

    const headerLeft = document.createElement('div');
    Object.assign(headerLeft.style, {
        display: 'flex', alignItems: 'center', gap: '9px'
    });

    const headerAccent = document.createElement('div');
    Object.assign(headerAccent.style, {
        width: '2px',
        height: '13px',
        borderRadius: '2px',
        background: 'rgba(176,184,193,0.7)'
    });

    const headerTitle = document.createElement('div');
    Object.assign(headerTitle.style, {
        fontSize: '10px',
        fontWeight: '900',
        color: 'rgba(200,208,217,0.9)',
        letterSpacing: '3px',
        textTransform: 'uppercase'
    });
    headerTitle.innerText = 'MOD MENU';

    const headerVersion = document.createElement('div');
    Object.assign(headerVersion.style, {
        fontSize: '9px',
        color: 'rgba(176,184,193,0.25)',
        fontWeight: '500',
        letterSpacing: '0.5px'
    });
    headerVersion.innerText = 'v2.1';

    headerLeft.appendChild(headerAccent);
    headerLeft.appendChild(headerTitle);
    header.appendChild(headerLeft);
    header.appendChild(headerVersion);

    // --- Inner content wrapper ---
    const inner = document.createElement('div');
    Object.assign(inner.style, { padding: '6px 12px 14px 12px' });

    function createSection(label) {
        const sec = document.createElement('div');
        Object.assign(sec.style, {
            fontSize: '7.5px',
            fontWeight: '700',
            color: 'rgba(176,184,193,0.3)',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            marginBottom: '4px',
            marginTop: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        });
        sec.innerHTML = `<span>${label}</span><div style="flex:1;height:1px;background:rgba(255,255,255,0.05)"></div>`;
        return sec;
    }

    function createRow(title, sub) {
        const row = document.createElement('div');
        Object.assign(row.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '2px',
            padding: '8px 10px',
            borderRadius: '8px',
            background: 'transparent',
            transition: 'background 0.15s'
        });
        row.innerHTML = `<div>
            <div style="font-size:12px; font-weight:600; color:rgba(220,225,232,0.9);">${title}</div>
            <div style="font-size:8.5px; color:rgba(255,255,255,0.18); margin-top:2px; letter-spacing:0.3px">${sub}</div>
        </div>`;
        row.onmouseenter = () => { row.style.background = 'rgba(255,255,255,0.04)'; };
        row.onmouseleave = () => { row.style.background = 'transparent'; };
        return row;
    }

    function createToggle(initialState, onToggle) {
        const toggle = document.createElement('div');
        Object.assign(toggle.style, {
            width: '36px',
            height: '20px',
            background: initialState ? 'rgba(176,184,193,0.85)' : 'rgba(255,255,255,0.07)',
            borderRadius: '20px',
            position: 'relative',
            cursor: 'pointer',
            transition: 'background 0.2s',
            flexShrink: '0',
            border: '1px solid ' + (initialState ? 'rgba(176,184,193,0.4)' : 'rgba(255,255,255,0.08)')
        });
        const knob = document.createElement('div');
        Object.assign(knob.style, {
            width: '14px',
            height: '14px',
            background: initialState ? '#fff' : 'rgba(255,255,255,0.3)',
            borderRadius: '50%',
            position: 'absolute',
            top: '2px',
            left: initialState ? '18px' : '2px',
            transition: 'left 0.18s ease, background 0.18s ease',
            boxShadow: '0 1px 4px rgba(0,0,0,0.5)'
        });
        toggle.appendChild(knob);
        let state = initialState;
        const setState = (val) => {
            state = val;
            knob.style.left = state ? '18px' : '2px';
            knob.style.background = state ? '#fff' : 'rgba(255,255,255,0.3)';
            toggle.style.background = state ? 'rgba(176,184,193,0.85)' : 'rgba(255,255,255,0.07)';
            toggle.style.border = '1px solid ' + (state ? 'rgba(176,184,193,0.4)' : 'rgba(255,255,255,0.08)');
            onToggle(state);
        };
        toggle.onclick = () => setState(!state);
        return { element: toggle, setState };
    }

    // --- Rows ---
    const opacRow = createRow('Opaque Mode', 'Tanks [O]');
    const opacToggle = createToggle(true, (val) => { opaqueMode = val; });
    opacRow.appendChild(opacToggle.element);

    const fovRow = createRow('Zoom', 'Scroll / [ / ]');
    const fovVal = document.createElement('div');
    Object.assign(fovVal.style, {
        fontSize: '12px', color: 'rgba(176,184,193,0.8)', fontWeight: '700', flexShrink: '0'
    });
    fovVal.innerText = '100%';
    fovRow.appendChild(fovVal);

    const afkRow = createRow('AFK Prevention', 'Auto-ping [M]');
    const afkToggle = createToggle(true, (val) => { afkPrevention = val; });
    afkRow.appendChild(afkToggle.element);

    const chRow = createRow('Custom Crosshair', 'Cursor [C]');
    const chToggle = createToggle(true, (val) => {
        crosshairEnabled = val;
        if (val) enableCrosshair();
        else disableCrosshair();
    });
    chRow.appendChild(chToggle.element);

    const timerRow = createRow('Session Timer', 'Display [T]');
    const timerToggle = createToggle(true, (val) => {
        timerEnabled = val;
        timerBox.style.display = val ? 'block' : 'none';
        if (val) startTimer();
        else stopTimer();
    });
    timerRow.appendChild(timerToggle.element);

    // --- Build menu ---
    inner.appendChild(createSection('General'));
    inner.appendChild(opacRow);
    inner.appendChild(fovRow);
    inner.appendChild(afkRow);
    inner.appendChild(chRow);
    inner.appendChild(timerRow);
    menu.appendChild(header);
    menu.appendChild(inner);
    (document.body || document.documentElement).appendChild(menu);

    const updateUI = () => {
        fovVal.innerText = `${Math.round(100 * zoomFactor)}%`;
    };
    updateUI();

    // --- Controls ---
    window.addEventListener('keydown', (e) => {
        if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
        if (e.key.toLowerCase() === 'o') opacToggle.setState(!opaqueMode);
        if (e.key.toLowerCase() === 'm') afkToggle.setState(!afkPrevention);
        if (e.key.toLowerCase() === 'c') chToggle.setState(!crosshairEnabled);
        if (e.key.toLowerCase() === 't') timerToggle.setState(!timerEnabled);
        if (e.key === ']') { zoomFactor = Math.min(4, zoomFactor * 1.05); updateUI(); }
        if (e.key === '[') { zoomFactor = Math.max(0.25, zoomFactor / 1.05); updateUI(); }
    });

    window.addEventListener('wheel', (e) => {
        if (e.deltaY > 0) zoomFactor = Math.min(4, zoomFactor * 1.05);
        else zoomFactor = Math.max(0.25, zoomFactor / 1.05);
        updateUI();
    }, { passive: true });

    // --- AFK Prevention ---
    setInterval(() => {
        if (!afkPrevention) return;
        const canvas = document.querySelector('canvas');
        if (canvas) {
            const rect = canvas.getBoundingClientRect();
            canvas.dispatchEvent(new MouseEvent('mousemove', {
                clientX: rect.left + rect.width / 2 + (Math.random() * 4 - 2),
                clientY: rect.top + rect.height / 2 + (Math.random() * 4 - 2),
                bubbles: true
            }));
        }
    }, 20000);

    // --- Rendering Hooks ---
    const originalDrawElements = WebGLRenderingContext.prototype.drawElements;
    WebGLRenderingContext.prototype.drawElements = function(mode, count, type, offset) {
        const isTank = opaqueMode && count > 50 && count < 600;
        if (isTank) this.disable(this.BLEND);
        const result = originalDrawElements.call(this, mode, count, type, offset);
        if (isTank) this.enable(this.BLEND);
        return result;
    };

    const proto = CanvasRenderingContext2D.prototype;
    const globalAlphaDesc = Object.getOwnPropertyDescriptor(proto, 'globalAlpha');
    const originalStrokeText = proto.strokeText;

    const DEATH_STRINGS = ['you were killed', 'you have died', 'killer', 'survived for', 'final score'];

    proto.strokeText = function(text, x, y) {
        if (timerEnabled && typeof text === 'string') {
            const lower = text.toLowerCase();
            const isDeath = DEATH_STRINGS.some(s => lower.includes(s));

            if (isDeath && !deathDetected) {
                // Death screen just appeared — reset and hold at 00:00:00
                deathDetected = true;
                if (deathRestartTimeout) { clearTimeout(deathRestartTimeout); deathRestartTimeout = null; }
                resetTimer();
            } else if (!isDeath && deathDetected) {
                // Non-death text appeared — wait 2 seconds before restarting
                // to avoid restarting on a single non-death frame mid death screen
                if (!deathRestartTimeout) {
                    deathRestartTimeout = setTimeout(() => {
                        deathDetected = false;
                        deathRestartTimeout = null;
                        if (timerEnabled) startTimer();
                    }, 2000);
                }
            }
        }
        return originalStrokeText.apply(this, arguments);
    };

    Object.defineProperty(proto, 'globalAlpha', {
        set(val) {
            if (opaqueMode && val > 0.15 && val < 0.95) val = 1;
            globalAlphaDesc.set.call(this, val);
        },
        get: globalAlphaDesc.get,
        configurable: true
    });

})();
