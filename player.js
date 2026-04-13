const AUDIO_MIME_TYPES = [
    'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg',
    'audio/opus', 'audio/wav', 'audio/flac', 'audio/aac'
];

function setStatus(msg, type = '') {
    const el = document.getElementById('status');
    el.textContent = msg;
    el.className = 'status ' + type;
}

function formatSize(bytes) {
    if (!bytes) return '';
    const mb = bytes / 1024 / 1024;
    return mb >= 1 ? mb.toFixed(1) + ' MB' : (bytes / 1024).toFixed(0) + ' KB';
}

async function loadFiles() {
    const lines = document.getElementById('config').value.trim().split('\n').map(l => l.trim()).filter(Boolean);
    const apiKey = lines[0] || '';
    const folderId = lines[1] || '';

    if (!apiKey) { setStatus('Введи API Key (первая строка)', 'error'); return; }
    if (!folderId) { setStatus('Введи Folder ID (вторая строка)', 'error'); return; }

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
      <div class="file-name">${file.name}</div>
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

    document.getElementById('nowPlayingTitle').textContent = file.name;
    document.getElementById('player').classList.add('visible');
    setStatus('');

    audio.onerror = () => {
        setStatus('Ошибка воспроизведения — возможно, Google Drive блокирует прямой стриминг для этого файла', 'error');
    };
}