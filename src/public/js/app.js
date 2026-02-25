// src/public/js/app.js
let currentFiles = [];
let currentView = 'grid';
let currentFilter = 'all';
let nextOffsetId = 0;
let isLoading = false;
let currentPreviewFile = null;
let deleteTarget = null;
let searchTimeout = null;

// Initialize
(async function init() {
  const token = getToken();
  if (!token) {
    window.location.href = '/';
    return;
  }

  try {
    const data = await apiCall('/api/auth/me');
    if (!data.success) {
      window.location.href = '/';
      return;
    }

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('user-name').textContent =
      user.firstName || user.phone || 'User';
    document.getElementById('bot-name').textContent =
      data.bot ? `@${data.bot.username}` : '@bot';

    await loadFiles();
  } catch (err) {
    console.error('Init error:', err);
    window.location.href = '/';
  }
})();

async function loadFiles(append = false) {
  if (isLoading) return;
  isLoading = true;

  if (!append) {
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('files-grid').style.display = 'none';
    document.getElementById('files-list').style.display = 'none';
    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('load-more').style.display = 'none';
  }

  try {
    const params = new URLSearchParams({
      limit: '50',
      offsetId: append ? nextOffsetId : 0,
    });

    const data = await apiCall(`/api/files?${params}`);

    if (data.success) {
      if (append) {
        currentFiles = [...currentFiles, ...data.files];
      } else {
        currentFiles = data.files;
      }
      nextOffsetId = data.nextOffsetId;

      renderFiles();
      updateStats();

      if (data.files.length >= 50 && data.nextOffsetId > 0) {
        document.getElementById('load-more').style.display = 'flex';
      } else {
        document.getElementById('load-more').style.display = 'none';
      }
    }
  } catch (err) {
    console.error('Load files error:', err);
    showToast('Failed to load files', 'error');
  } finally {
    isLoading = false;
    document.getElementById('loading').style.display = 'none';
  }
}

function renderFiles() {
  let files = getFilteredFiles();

  const gridContainer = document.getElementById('files-grid');
  const listContainer = document.getElementById('files-list');
  const emptyState = document.getElementById('empty-state');

  if (files.length === 0) {
    gridContainer.style.display = 'none';
    listContainer.style.display = 'none';
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';

  if (currentView === 'grid') {
    gridContainer.innerHTML = files.map(f => createGridCard(f)).join('');
    gridContainer.style.display = 'grid';
    listContainer.style.display = 'none';
  } else {
    listContainer.innerHTML = files.map(f => createListRow(f)).join('');
    listContainer.style.display = 'flex';
    gridContainer.style.display = 'none';
  }
}

function createGridCard(file) {
  const thumbUrl = file.thumbnail
    ? `/api/files/thumbnail/${file.messageId}?token=${getToken()}`
    : '';

  const thumbnailHTML = thumbUrl
    ? `<img src="${thumbUrl}" alt="${file.fileName}" loading="lazy" onerror="this.parentElement.innerHTML='<span class=\\'file-icon\\'>${getFileIcon(file.type)}</span>'">`
    : `<span class="file-icon">${getFileIcon(file.type)}</span>`;

  const durationBadge = file.duration
    ? `<span class="duration-badge">${formatDuration(file.duration)}</span>`
    : '';

  return `
    <div class="file-card" onclick="openPreview('${file.id}')">
      <div class="thumbnail">
        <span class="type-badge">${file.type}</span>
        ${thumbnailHTML}
        ${durationBadge}
      </div>
      <div class="file-info">
        <div class="file-name" title="${file.fileName}">${file.fileName}</div>
        <div class="file-meta">
          <span>${formatBytes(file.fileSize)}</span>
          <span>${formatDate(file.date)}</span>
        </div>
      </div>
      <div class="file-actions" onclick="event.stopPropagation()">
        <button class="btn btn-icon" onclick="downloadFile(${file.messageId}, '${file.fileName}')" title="Download">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </button>
        <button class="btn btn-icon delete" onclick="showDeleteModal(${file.messageId}, '${file.fileName}')" title="Delete">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  `;
}

function createListRow(file) {
  const thumbUrl = file.thumbnail
    ? `/api/files/thumbnail/${file.messageId}?token=${getToken()}`
    : '';

  const iconHTML = thumbUrl
    ? `<img src="${thumbUrl}" alt="" onerror="this.parentElement.innerHTML='${getFileIcon(file.type)}'">`
    : getFileIcon(file.type);

  return `
    <div class="file-row" onclick="openPreview('${file.id}')">
      <div class="row-icon">${iconHTML}</div>
      <div class="row-name" title="${file.fileName}">${file.fileName}</div>
      <div class="row-type">${file.type}</div>
      <div class="row-size">${formatBytes(file.fileSize)}</div>
      <div class="row-date">${formatDate(file.date)}</div>
      <div class="row-actions" onclick="event.stopPropagation()">
        <button class="btn btn-icon" onclick="downloadFile(${file.messageId}, '${file.fileName}')" title="Download">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </button>
        <button class="btn btn-icon delete" onclick="showDeleteModal(${file.messageId}, '${file.fileName}')" title="Delete">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  `;
}

function getFilteredFiles() {
  if (currentFilter === 'all') return currentFiles;
  return currentFiles.filter(f => f.type === currentFilter);
}

function updateStats() {
  const files = getFilteredFiles();
  document.getElementById('file-count').textContent = `${files.length} files`;
  const totalSize = files.reduce((sum, f) => sum + (f.fileSize || 0), 0);
  document.getElementById('total-size').textContent = `Total: ${formatBytes(totalSize)}`;
}

function setView(view) {
  currentView = view;
  document.getElementById('btn-grid').classList.toggle('active', view === 'grid');
  document.getElementById('btn-list').classList.toggle('active', view === 'list');
  renderFiles();
}

function filterFiles() {
  currentFilter = document.getElementById('filter-type').value;
  renderFiles();
  updateStats();
}

function refreshFiles() {
  nextOffsetId = 0;
  loadFiles();
  showToast('Files refreshed', 'success');
}

function loadMore() {
  loadFiles(true);
}

// Search
function debounceSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(performSearch, 400);
}

async function performSearch() {
  const query = document.getElementById('search-input').value.trim();

  if (!query) {
    await loadFiles();
    return;
  }

  isLoading = true;
  document.getElementById('loading').style.display = 'flex';
  document.getElementById('files-grid').style.display = 'none';
  document.getElementById('files-list').style.display = 'none';

  try {
    const data = await apiCall(`/api/files/search?q=${encodeURIComponent(query)}`);
    if (data.success) {
      currentFiles = data.files;
      renderFiles();
      updateStats();
    }
  } catch (err) {
    showToast('Search failed', 'error');
  } finally {
    isLoading = false;
    document.getElementById('loading').style.display = 'none';
  }
}

// Download
function downloadFile(messageId, fileName) {
  showToast('Starting download...', 'info');
  const link = document.createElement('a');
  link.href = `/api/files/download/${messageId}?token=${getToken()}`;
  link.download = fileName;
  link.click();
}

// Preview
function openPreview(fileId) {
  const file = currentFiles.find(f => f.id === fileId);
  if (!file) return;

  currentPreviewFile = file;
  const modal = document.getElementById('preview-modal');
  const title = document.getElementById('preview-title');
  const body = document.getElementById('preview-body');
  const details = document.getElementById('preview-details');

  title.textContent = file.fileName;

  // Preview content
  const thumbUrl = `/api/files/thumbnail/${file.messageId}?token=${getToken()}`;
  const downloadUrl = `/api/files/download/${file.messageId}?token=${getToken()}`;

  if (file.type === 'photo') {
    body.innerHTML = `<img src="${downloadUrl}" alt="${file.fileName}" style="max-width:100%;max-height:60vh;">`;
  } else if (file.type === 'video' || file.type === 'animation') {
    body.innerHTML = `
      <video controls style="max-width:100%;max-height:60vh;">
        <source src="${downloadUrl}" type="${file.mimeType}">
        Your browser does not support video.
      </video>`;
  } else if (file.type === 'audio' || file.type === 'voice') {
    body.innerHTML = `
      <div style="text-align:center;padding:40px;">
        <div style="font-size:64px;margin-bottom:20px;">${getFileIcon(file.type)}</div>
        <audio controls style="width:100%;">
          <source src="${downloadUrl}" type="${file.mimeType}">
        </audio>
      </div>`;
  } else if (file.thumbnail) {
    body.innerHTML = `
      <div style="text-align:center;">
        <img src="${thumbUrl}" alt="${file.fileName}" style="max-width:100%;max-height:40vh;border-radius:8px;">
        <p style="margin-top:12px;color:var(--text-light);">Preview only - Download for full file</p>
      </div>`;
  } else {
    body.innerHTML = `
      <div style="text-align:center;padding:40px;">
        <div style="font-size:80px;">${getFileIcon(file.type)}</div>
        <p style="margin-top:12px;font-size:16px;">${file.fileName}</p>
        <p style="color:var(--text-light);">${file.mimeType}</p>
      </div>`;
  }

  // Details
  details.innerHTML = `
    <span>📦 ${formatBytes(file.fileSize)}</span>
    <span>📅 ${new Date(file.date * 1000).toLocaleString()}</span>
    ${file.duration ? `<span>⏱️ ${formatDuration(file.duration)}</span>` : ''}
    ${file.width ? `<span>📐 ${file.width}×${file.height}</span>` : ''}
    ${file.caption ? `<span>💬 ${file.caption}</span>` : ''}
  `;

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closePreview() {
  document.getElementById('preview-modal').style.display = 'none';
  document.body.style.overflow = '';
  currentPreviewFile = null;
}

function downloadFromPreview() {
  if (currentPreviewFile) {
    downloadFile(currentPreviewFile.messageId, currentPreviewFile.fileName);
  }
}

function deleteFromPreview() {
  if (currentPreviewFile) {
    closePreview();
    showDeleteModal(currentPreviewFile.messageId, currentPreviewFile.fileName);
  }
}

// Delete
function showDeleteModal(messageId, fileName) {
  deleteTarget = { messageId, fileName };
  document.getElementById('delete-filename').textContent = fileName;
  document.getElementById('delete-modal').style.display = 'flex';
}

function closeDeleteModal() {
  document.getElementById('delete-modal').style.display = 'none';
  deleteTarget = null;
}

async function confirmDelete() {
  if (!deleteTarget) return;

  const btn = document.getElementById('btn-confirm-delete');
  btn.disabled = true;
  btn.textContent = 'Deleting...';

  try {
    const data = await apiCall(`/api/files/${deleteTarget.messageId}`, {
      method: 'DELETE',
    });

    if (data.success) {
      currentFiles = currentFiles.filter(
        f => f.messageId !== deleteTarget.messageId
      );
      renderFiles();
      updateStats();
      showToast('File deleted successfully', 'success');
    } else {
      showToast('Failed to delete file', 'error');
    }
  } catch (err) {
    showToast('Delete failed', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Delete';
    closeDeleteModal();
  }
}

// Logout
async function logout() {
  try {
    await apiCall('/api/auth/logout', { method: 'POST' });
  } catch (e) {}
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/';
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closePreview();
    closeDeleteModal();
  }
});