const STORAGE_KEY = 'drive-player-config';

window.addEventListener('DOMContentLoaded', () => {
    const audio = document.getElementById('audioPlayer');
    audio.loop = true;
    const loopBtn = document.getElementById('loopBtn');
    loopBtn.textContent = '⟳ ON';
    loopBtn.classList.add('active');

    // Progress bar
    const progressBar = document.getElementById('progressBar');
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', updateProgress);
    audio.addEventListener('ended', () => {
        document.getElementById('playBtn').textContent = '▶';
    });
    audio.addEventListener('play', () => {
        document.getElementById('playBtn').textContent = '▐▐';
    });
    audio.addEventListener('pause', () => {
        document.getElementById('playBtn').textContent = '▶';
    });

    progressBar.addEventListener('click', (e) => {
        const rect = progressBar.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        if (audio.duration) audio.currentTime = pct * audio.duration;
    });

    // Drag support
    let dragging = false;
    progressBar.addEventListener('mousedown', () => dragging = true);
    window.addEventListener('mouseup', () => dragging = false);
    window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const rect = progressBar.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        if (audio.duration) audio.currentTime = pct * audio.duration;
    });

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        document.getElementById('config').value = saved;
        loadFiles(true);
    }
});

function updateProgress() {
    const audio = document.getElementById('audioPlayer');
    const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    document.getElementById('progressFill').style.width = pct + '%';
    document.getElementById('progressThumb').style.left = pct + '%';
    document.getElementById('timeCurrent').textContent = formatTime(audio.currentTime);
    document.getElementById('timeTotal').textContent = formatTime(audio.duration || 0);
}

function formatTime(s) {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
}

function togglePlay() {
    const audio = document.getElementById('audioPlayer');
    audio.paused ? audio.play() : audio.pause();
}


const AUDIO_MIME_TYPES = [
    'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg',
    'audio/opus', 'audio/wav', 'audio/flac', 'audio/aac'
];

function toggleLoop() {
    const audio = document.getElementById('audioPlayer');
    const btn = document.getElementById('loopBtn');
    audio.loop = !audio.loop;
    btn.textContent = audio.loop ? '⟳ ON' : '⟳ OFF';
    btn.classList.toggle('active', audio.loop);
}

function setStatus(msg, type = '') {
    const el = document.getElementById('status');
    el.textContent = msg;
    el.className = 'status ' + type;
}

function formatSize(bytes) {
    if (!bytes) return '';
    const mb = bytes / 1024 / 1024;
    return mb >= 1 ? Math.round(mb) + ' MB' : Math.round(bytes / 1024) + ' KB';
}

async function loadFiles(fromStorage = false) {
    const lines = document.getElementById('config').value.trim().split('\n').map(l => l.trim()).filter(Boolean);
    const apiKey = lines[0] || '';
    const folderId = lines[1] || '';

    if (!apiKey) { setStatus('Введи API Key (первая строка)', 'error'); return; }
    if (!folderId) { setStatus('Введи Folder ID (вторая строка)', 'error'); return; }

    localStorage.setItem(STORAGE_KEY, document.getElementById('config').value);

    setStatus('Загружаю список файлов...');
    document.getElementById('fileList').innerHTML = '<div class="empty">Загрузка...</div>';

    try {
        const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&fields=files(id,name,mimeType,size)&key=${apiKey}&pageSize=100`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.error) {
            setStatus('Ошибка: ' + data.error.message, 'error');
            document.getElementById('fileList').innerHTML = '<div class="empty">Ошибка загрузки</div>';
            return;
        }

        const files = (data.files || []).filter(f =>
            AUDIO_MIME_TYPES.some(m => f.mimeType.startsWith(m.split('/')[0] + '/')) ||
            f.name.match(/\.(webm|mp3|m4a|opus|ogg|wav|flac|aac)$/i)
        );

        if (!files.length) {
            document.getElementById('fileList').innerHTML = '<div class="empty">Аудиофайлов не найдено</div>';
            setStatus('');
            return;
        }

        renderFiles(files, apiKey);
        setStatus(`Найдено файлов: ${files.length}`, 'ok');
        document.getElementById('inputSection').style.display = 'none';

    } catch (e) {
        setStatus('Ошибка сети: ' + e.message, 'error');
    }
}

function renderFiles(files, apiKey) {
    const list = document.getElementById('fileList');
    list.innerHTML = '';

    files.forEach((file) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.dataset.id = file.id;
        item.innerHTML = `
      <div class="playing-indicator"></div>
      <div class="file-icon">▶</div>
      <div class="file-name">${file.name.replace(/\.[^.]+$/, '')}</div>
      <div class="file-size">${formatSize(file.size)}</div>
    `;
        item.onclick = () => playFile(file, apiKey, item);
        list.appendChild(item);
    });
}

function playFile(file, apiKey, itemEl) {
    document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
    itemEl.classList.add('active');

    const directUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${apiKey}`;

    const audio = document.getElementById('audioPlayer');
    audio.src = directUrl;
    audio.play().catch(e => {
        setStatus('Не удалось воспроизвести: ' + e.message, 'error');
    });

    document.getElementById('nowPlayingTitle').textContent = file.name.replace(/\.[^.]+$/, '');
    document.getElementById('player').classList.add('visible');
    setStatus('');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    audio.onerror = () => {
        setStatus('Ошибка воспроизведения — возможно, Google Drive блокирует прямой стриминг для этого файла', 'error');
    };
}