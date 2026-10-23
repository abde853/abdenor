const $ = (s) => document.querySelector(s);

/* ================= الإعدادات والألوان ================= */
const THEMES = {
    dark:  { name: 'ليلي',   bg: '#0a0f1d', text: '#f8fafc', accent: '#d4af37' },
    black: { name: 'أسود',   bg: '#000000', text: '#e8e8e8', accent: '#d4af37' },
    light: { name: 'فاتح',   bg: '#f7f5ef', text: '#1b1b1b', accent: '#8a6d1d' },
    sepia: { name: 'ورقي',   bg: '#f1e5c8', text: '#3b2a14', accent: '#8b5a1b' },
    green: { name: 'أخضر',   bg: '#0c2a22', text: '#eafaf1', accent: '#e0c15a' },
    blue:  { name: 'أزرق',   bg: '#0b1e3a', text: '#eaf2ff', accent: '#7cc4ff' }
};

const DEFAULTS = {
    theme: 'dark', bg: null, text: null, accent: null,
    font: 'Amiri', size: 28, reciter: 'ar.alafasy'
};

function loadSettings() {
    try {
        return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem('quran-settings')) || {});
    } catch { return { ...DEFAULTS }; }
}
function saveSettings() {
    try { localStorage.setItem('quran-settings', JSON.stringify(settings)); } catch {}
}

let settings = loadSettings();

function currentColors() {
    const t = THEMES[settings.theme] || THEMES.dark;
    return {
        bg: settings.bg || t.bg,
        text: settings.text || t.text,
        accent: settings.accent || t.accent
    };
}

function applySettings() {
    const c = currentColors();
    const root = document.documentElement.style;
    root.setProperty('--bg', c.bg);
    root.setProperty('--text', c.text);
    root.setProperty('--accent', c.accent);
    root.setProperty('--quran-font', `'${settings.font}', 'Amiri', serif`);
    root.setProperty('--quran-size', settings.size + 'px');

    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', c.bg);

    $('#c-bg').value = c.bg;
    $('#c-text').value = c.text;
    $('#c-accent').value = c.accent;
    $('#font-select').value = settings.font;
    $('#reciter').value = settings.reciter;

    document.querySelectorAll('.swatch').forEach((el) => {
        el.classList.toggle('active', el.dataset.theme === settings.theme && !settings.bg && !settings.text && !settings.accent);
    });
}

function buildSwatches() {
    const box = $('#theme-swatches');
    box.innerHTML = '';
    Object.entries(THEMES).forEach(([key, t]) => {
        const b = document.createElement('button');
        b.className = 'swatch';
        b.dataset.theme = key;
        b.textContent = t.name;
        b.style.background = t.bg;
        b.style.color = t.text;
        b.onclick = () => {
            settings.theme = key;
            settings.bg = settings.text = settings.accent = null;
            saveSettings(); applySettings();
        };
        box.appendChild(b);
    });
}

function openSettings() { $('#settings').hidden = false; $('#settings-backdrop').hidden = false; }
function closeSettings() { $('#settings').hidden = true; $('#settings-backdrop').hidden = true; }

/* ================= الحالة ================= */
let surahs = [];
let current = null;          // السورة المفتوحة
let homeScroll = 0;
const textCache = new Map();
const toArabic = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
const normalize = (s) => s
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[ٱأإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();

/* ================= قائمة السور ================= */
async function fetchSurahs() {
    const container = $('#surahs-container');
    try {
        const res = await fetch('https://api.alquran.cloud/v1/surah');
        const data = await res.json();
        surahs = data.data;
        renderList('');
        // إن كان الرابط يحتوي على سورة، افتحها
        handleRoute();
    } catch (e) {
        container.innerHTML = '<p class="status-text">تعذر تحميل قائمة السور، تأكد من الاتصال بالإنترنت.</p>';
    }
}

function renderList(filter) {
    const container = $('#surahs-container');
    const q = normalize(filter);
    const list = surahs.filter((s) =>
        !q || normalize(s.name).includes(q) || String(s.number) === q || normalize(s.englishName).toLowerCase().includes(q.toLowerCase())
    );
    container.innerHTML = '';
    if (!list.length) {
        container.innerHTML = '<p class="status-text">لا توجد نتائج.</p>';
        return;
    }
    list.forEach((s) => {
        const card = document.createElement('div');
        card.className = 'surah-card';
        card.innerHTML = `
            <div class="surah-num">${toArabic(s.number)}</div>
            <div class="surah-info">
                <h3>${s.name.replace('سُورَةُ ', '')}</h3>
                <p>${s.revelationType === 'Meccan' ? 'مكية' : 'مدنية'} • ${toArabic(s.numberOfAyahs)} آية</p>
            </div>`;
        card.onclick = () => openSurah(s.number, true);
        container.appendChild(card);
    });
}

/* ================= فتح / إغلاق السورة ================= */
function showView(name) {
    $('#home-view').hidden = name !== 'home';
    $('#surah-view').hidden = name !== 'surah';
}

async function openSurah(number, push) {
    const s = surahs.find((x) => x.number === number);
    if (!s) return;

    if ($('#surah-view').hidden) homeScroll = window.scrollY;
    current = s;

    if (push) history.pushState({ surah: number }, '', '#surah-' + number);

    showView('surah');
    window.scrollTo(0, 0);
    setMode('read');

    const name = s.name.replace('سُورَةُ ', '');
    $('#surah-title').textContent = 'سورة ' + name;
    $('#listen-title').textContent = 'سورة ' + name;
    $('#surah-meta').textContent =
        `${s.revelationType === 'Meccan' ? 'مكية' : 'مدنية'} • ${toArabic(s.numberOfAyahs)} آية`;

    $('#prev-surah').disabled = number <= 1;
    $('#next-surah').disabled = number >= 114;

    // تجهيز الصوت (بدون تشغيل تلقائي)
    const audio = $('#quran-audio');
    audio.pause();
    audio.src = audioUrl(number);
    audio.playbackRate = currentSpeed;
    $('#audio-msg').textContent = '';

    await loadText(number);
}

function closeSurah() {
    const audio = $('#quran-audio');
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    current = null;
    showView('home');
    window.scrollTo(0, homeScroll);
}

// زر الرجوع في التطبيق
function goBack() {
    if (history.state && history.state.surah) history.back();
    else { history.replaceState(null, '', location.pathname); closeSurah(); }
}

function handleRoute() {
    const m = location.hash.match(/^#surah-(\d+)$/);
    if (m && surahs.length) openSurah(parseInt(m[1], 10), false);
    else if (!$('#surah-view').hidden) closeSurah();
}

window.addEventListener('popstate', handleRoute);

/* ================= النص القرآني ================= */
async function loadText(number) {
    const box = $('#quran-text');
    box.innerHTML = '<p class="status-text">جاري تحميل الآيات...</p>';
    try {
        let ayahs = textCache.get(number);
        if (!ayahs) {
            const res = await fetch(`https://api.alquran.cloud/v1/surah/${number}/quran-uthmani`);
            const data = await res.json();
            ayahs = data.data.ayahs;
            textCache.set(number, ayahs);
        }
        if (!current || current.number !== number) return;

        let html = '';
        // البسملة تُعرض وحدها (ما عدا الفاتحة والتوبة)
        const hasBasmalaLine = number !== 1 && number !== 9;
        if (hasBasmalaLine) html += '<p class="basmala">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</p>';

        ayahs.forEach((a) => {
            let t = a.text;
            if (hasBasmalaLine && a.numberInSurah === 1) {
                t = t.split(' ').slice(4).join(' ');
            }
            html += `${t} <span class="ayah-number">﴿${toArabic(a.numberInSurah)}﴾</span> `;
        });
        box.innerHTML = html;
    } catch (e) {
        box.innerHTML = '<p class="status-text">تعذر جلب الآيات، يرجى التأكد من الاتصال بالإنترنت.</p>';
    }
}

/* ================= الوضعان: قراءة / استماع ================= */
function setMode(mode) {
    const read = mode === 'read';
    $('#read-panel').hidden = !read;
    $('#listen-panel').hidden = read;
    $('#tab-read').classList.toggle('active', read);
    $('#tab-listen').classList.toggle('active', !read);
    window.scrollTo(0, 0);
}

/* ================= الصوت ================= */
let currentSpeed = 1;
const audioUrl = (n) => `https://cdn.islamic.network/quran/audio-surah/128/${settings.reciter}/${n}.mp3`;

$('#reciter').addEventListener('change', (e) => {
    settings.reciter = e.target.value;
    saveSettings();
    if (!current) return;
    const audio = $('#quran-audio');
    const wasPlaying = !audio.paused;
    audio.src = audioUrl(current.number);
    audio.playbackRate = currentSpeed;
    $('#audio-msg').textContent = '';
    if (wasPlaying) audio.play().catch(() => {});
});

$('#quran-audio').addEventListener('error', () => {
    if ($('#quran-audio').getAttribute('src'))
        $('#audio-msg').textContent = 'تعذر تشغيل التلاوة. جرّب قارئاً آخر أو تأكد من الإنترنت.';
});
$('#quran-audio').addEventListener('playing', () => { $('#audio-msg').textContent = ''; });

document.querySelectorAll('.speed-btn').forEach((b) => {
    b.addEventListener('click', () => {
        currentSpeed = parseFloat(b.dataset.speed);
        $('#quran-audio').playbackRate = currentSpeed;
        document.querySelectorAll('.speed-btn').forEach((x) => x.classList.toggle('active', x === b));
    });
});

/* ================= التكبير والتصغير ================= */
function setSize(px) {
    settings.size = Math.max(18, Math.min(64, px));
    document.documentElement.style.setProperty('--quran-size', settings.size + 'px');
    saveSettings();
}
$('#zoom-in').addEventListener('click', () => setSize(settings.size + 2));
$('#zoom-out').addEventListener('click', () => setSize(settings.size - 2));

// إخفاء الشريط العلوي عند النزول، وإظهاره عند الصعود (شاشة قراءة نظيفة)
let lastY = 0;
window.addEventListener('scroll', () => {
    const bar = document.querySelector('#surah-view .topbar');
    const y = window.scrollY;
    if (y > lastY && y > 80) bar.classList.add('hide');
    else if (y < lastY) bar.classList.remove('hide');
    lastY = y;
}, { passive: true });

// أزرار الزوم تظهر في وضع القراءة فقط
const _setMode = setMode;
setMode = function (mode) {
    _setMode(mode);
    $('#zoom-float').hidden = mode !== 'read';
    document.querySelector('#surah-view .topbar').classList.remove('hide');
};

/* ================= الأزرار والأحداث ================= */
$('#back-btn').addEventListener('click', goBack);
$('#tab-read').addEventListener('click', () => setMode('read'));
$('#tab-listen').addEventListener('click', () => setMode('listen'));
$('#prev-surah').addEventListener('click', () => current && openSurah(current.number - 1, true));
$('#next-surah').addEventListener('click', () => current && openSurah(current.number + 1, true));
$('#search').addEventListener('input', (e) => renderList(e.target.value));

$('#open-settings-home').addEventListener('click', openSettings);
$('#open-settings-surah').addEventListener('click', openSettings);
$('#close-settings').addEventListener('click', closeSettings);
$('#settings-backdrop').addEventListener('click', closeSettings);

$('#c-bg').addEventListener('input', (e) => { settings.bg = e.target.value; saveSettings(); applySettings(); });
$('#c-text').addEventListener('input', (e) => { settings.text = e.target.value; saveSettings(); applySettings(); });
$('#c-accent').addEventListener('input', (e) => { settings.accent = e.target.value; saveSettings(); applySettings(); });
$('#font-select').addEventListener('change', (e) => { settings.font = e.target.value; saveSettings(); applySettings(); });
$('#reset-settings').addEventListener('click', () => {
    settings = { ...DEFAULTS };
    saveSettings(); applySettings();
});

/* ================= البدء ================= */
buildSwatches();
applySettings();
fetchSurahs();