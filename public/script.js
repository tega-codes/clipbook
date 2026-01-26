let allClips = [];

// Load clips from storage
async function loadClips() {
  try {
    const result = await chrome.storage.local.get(['clips']);
    allClips = result.clips || [];
    renderClips(allClips);
  } catch (error) {
    console.error('Error loading clips:', error);
  }
}

// Save clips to storage
async function saveClips() {
  try {
    await chrome.storage.local.set({ clips: allClips });
  } catch (error) {
    console.error('Error saving clips:', error);
  }
}

// Extract domain from URL
function getDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

// Get favicon URL with fallback
function getFaviconUrl(clip) {
  // If we have a stored favicon URL, use it
  if (clip.favicon) {
    return clip.favicon;
  }
  
  // Fallback: Use Google's favicon service
  try {
    const url = new URL(clip.url);
    return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`;
  } catch {
    return null;
  }
}

// Get favicon letter as fallback
function getFaviconLetter(domain) {
  return domain.charAt(0).toUpperCase();
}

// Format date
function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Render clips
function renderClips(clips) {
  const clipsList = document.getElementById('clipsList');
  const emptyState = document.getElementById('emptyState');

  if (clips.length === 0) {
    clipsList.innerHTML = '';
    emptyState.classList.add('visible');
    return;
  }

  emptyState.classList.remove('visible');
  
  clipsList.innerHTML = clips.map((clip, index) => {
    const faviconUrl = getFaviconUrl(clip);
    const faviconHtml = faviconUrl 
      ? `<img src="${faviconUrl}" alt="${clip.domain}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
         <div class="clip-icon-letter" style="display:none;">${getFaviconLetter(clip.domain)}</div>`
      : `<div class="clip-icon-letter">${getFaviconLetter(clip.domain)}</div>`;
    
    return `
    <div class="clip-card" data-index="${index}">
      <div class="clip-header">
        <div class="clip-icon">${faviconHtml}</div>
        <div class="clip-domain" title="${clip.url}">${clip.domain}</div>
        <div class="clip-date">${formatDate(clip.timestamp)}</div>
      </div>
      <div class="clip-content" contenteditable="true" data-index="${index}">${clip.text}</div>
      <div class="clip-actions">
        <button class="action-btn copy" data-index="${index}" title="Copy to clipboard">
          <img src="icon/copy.png" alt="Copy" class="action-icon"> Copy
        </button>
        <button class="action-btn edit" data-index="${index}" title="Save edit">
          <img src="icon/save.png" alt="Save" class="action-icon"> Save
        </button>
        <button class="action-btn delete" data-index="${index}" title="Delete clip">
          <img src="icon/delete.png" alt="Delete" class="action-icon"> Delete
        </button>
      </div>
    </div>
  `;
  }).join('');

  // Add event listeners
  attachEventListeners();
}

// Attach event listeners to clip actions
function attachEventListeners() {
  // Copy buttons
  document.querySelectorAll('.action-btn.copy').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const index = parseInt(e.currentTarget.dataset.index);
      const clip = allClips[index];
      
      try {
        await navigator.clipboard.writeText(clip.text);
        showToast('Copied to clipboard!');
      } catch (error) {
        console.error('Error copying:', error);
        showToast('Failed to copy');
      }
    });
  });

  // Edit/Save buttons
  document.querySelectorAll('.action-btn.edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.currentTarget.dataset.index);
      const contentDiv = document.querySelector(`.clip-content[data-index="${index}"]`);
      
      allClips[index].text = contentDiv.textContent;
      saveClips();
      showToast('Clip updated!');
    });
  });

  // Delete buttons
  document.querySelectorAll('.action-btn.delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.currentTarget.dataset.index);
      allClips.splice(index, 1);
      saveClips();
      renderClips(allClips);
      showToast('Clip deleted');
    });
  });
}

// Search functionality
function setupSearch() {
  const searchInput = document.getElementById('searchInput');
  
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    
    if (!query) {
      renderClips(allClips);
      return;
    }

    const filtered = allClips.filter(clip => 
      clip.domain.toLowerCase().includes(query) ||
      clip.text.toLowerCase().includes(query)
    );
    
    renderClips(filtered);
  });
}

// Clear all clips
function setupClearAll() {
  const clearBtn = document.getElementById('clearAll');
  
  clearBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to delete all clips?')) {
      allClips = [];
      saveClips();
      renderClips(allClips);
      showToast('All clips cleared');
    }
  });
}

// Show toast notification
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'copied-toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2000);
}

// Listen for new clips from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'clipSaved') {
    loadClips();
  }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadClips();
  setupSearch();
  setupClearAll();
});