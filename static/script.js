// Global application state
let allReleases = [];
let currentCategoryFilter = 'All';
let currentSearchQuery = '';
let currentSortOrder = 'newest';
let selectedNoteForTweet = null;

// DOM Elements
const themeToggleBtn = document.getElementById('theme-toggle');
const refreshBtn = document.getElementById('refresh-button');
const refreshIcon = document.getElementById('refresh-icon');
const syncText = document.getElementById('sync-text');
const searchInput = document.getElementById('search-input');
const searchClearBtn = document.getElementById('search-clear-btn');
const categoryPills = document.getElementById('category-pills');
const sortSelect = document.getElementById('sort-select');
const releaseList = document.getElementById('release-list');
const skeletonLoader = document.getElementById('skeleton-loader');
const emptyState = document.getElementById('empty-state');
const resetFiltersBtn = document.getElementById('reset-filters-btn');

// Stats DOM Elements
const statTotal = document.getElementById('stat-total');
const statFeatures = document.getElementById('stat-features');
const statChanges = document.getElementById('stat-changes');
const statIssues = document.getElementById('stat-issues');
const statAnnouncements = document.getElementById('stat-announcements');

// Modal DOM Elements
const tweetModal = document.getElementById('tweet-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalTweetBtn = document.getElementById('modal-tweet-btn');
const modalReferenceCard = document.getElementById('modal-reference-card');
const tweetTextarea = document.getElementById('tweet-textarea');
const charCounter = document.getElementById('char-counter');
const charProgressFill = document.getElementById('char-progress-fill');
const toastNotification = document.getElementById('toast-notification');
const toastMessage = document.getElementById('toast-message');

// --- Helper Functions ---

// Strip HTML tags to get clean plain text
function stripHtml(html) {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
}

// Show Toast Notification
function showToast(message, type = 'success') {
    toastMessage.textContent = message;
    toastNotification.className = `toast active ${type}`;
    
    setTimeout(() => {
        toastNotification.classList.remove('active');
    }, 3500);
}

// Format Date string to a prettier reading format (if needed, otherwise use raw date)
function formatRelativeTime(dateIso) {
    try {
        const date = new Date(dateIso);
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) {
        return dateIso;
    }
}

// Generate a smart, length-compliant Twitter/X draft
function generateTweetDraft(note) {
    const rawText = stripHtml(note.description);
    const cleanText = rawText.replace(/\s+/g, ' ').trim();
    
    // Construct tweet pieces
    const prefix = `BigQuery ${note.category} (${note.date}): `;
    const suffix = ` #BigQuery #GCP`;
    
    // Limit is 280. Calculate how much space we have for the actual text snippet
    const maxSnippetLength = 280 - prefix.length - suffix.length - 4; // 4 chars for "..." and spacing
    
    let textSnippet = cleanText;
    if (cleanText.length > maxSnippetLength) {
        textSnippet = cleanText.substring(0, maxSnippetLength) + "...";
    }
    
    return `${prefix}${textSnippet}${suffix}`;
}

// --- API Interactions ---

// Fetch BigQuery Release Notes from Flask Backend
async function fetchReleases(forceRefresh = false) {
    // Show loading state
    skeletonLoader.style.display = 'block';
    releaseList.style.display = 'none';
    emptyState.style.display = 'none';
    
    refreshBtn.disabled = true;
    refreshIcon.classList.add('spin');
    
    syncText.textContent = "Syncing with Google Cloud...";
    const dot = document.querySelector('.status-dot');
    dot.className = 'status-dot loading';
    
    try {
        const url = `/api/releases?refresh=${forceRefresh}`;
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.status === 'success') {
            allReleases = result.data;
            
            // Update Sync Status Text
            const lastFetchedDate = new Date(result.last_fetched);
            const formattedTime = lastFetchedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            syncText.textContent = `Synced at ${formattedTime}`;
            
            updateStatsCounters();
            filterAndRenderReleases();
            
            if (forceRefresh) {
                showToast("Successfully refreshed release notes feed!", "success");
            }
        } else {
            throw new Error(result.message || "Failed to load release notes");
        }
    } catch (error) {
        console.error("Error fetching release notes:", error);
        showToast("Error updating feed. Using local cache.", "error");
        syncText.textContent = "Offline/Sync error";
        
        // Render whatever is in memory or show empty state
        if (allReleases.length > 0) {
            filterAndRenderReleases();
        } else {
            skeletonLoader.style.display = 'none';
            emptyState.style.display = 'block';
        }
    } finally {
        refreshBtn.disabled = false;
        refreshIcon.classList.remove('spin');
        dot.className = 'status-dot green';
        skeletonLoader.style.display = 'none';
    }
}

// --- Stats and rendering logic ---

// Count category items to populate dashboard counters
function updateStatsCounters() {
    statTotal.textContent = allReleases.length;
    
    const count = (cat) => allReleases.filter(item => {
        const itemCat = item.category.toLowerCase();
        if (cat === 'feature') return itemCat === 'feature';
        if (cat === 'change') return itemCat === 'change';
        if (cat === 'issue') return itemCat === 'issue' || itemCat === 'fix';
        if (cat === 'announcement') return itemCat === 'announcement';
        return false;
    }).length;
    
    statFeatures.textContent = count('feature');
    statChanges.textContent = count('change');
    statIssues.textContent = count('issue');
    statAnnouncements.textContent = count('announcement');
}

// Render filtered and sorted list of release notes
function filterAndRenderReleases() {
    let filtered = [...allReleases];
    
    // 1. Category Filter
    if (currentCategoryFilter !== 'All') {
        const filterLower = currentCategoryFilter.toLowerCase();
        filtered = filtered.filter(item => {
            const catLower = item.category.toLowerCase();
            if (filterLower === 'issue') {
                return catLower === 'issue' || catLower === 'fix';
            }
            if (filterLower === 'deprecation') {
                return catLower === 'deprecation' || catLower === 'breaking';
            }
            return catLower === filterLower;
        });
    }
    
    // 2. Keyword Search Filter
    if (currentSearchQuery.trim() !== '') {
        const query = currentSearchQuery.toLowerCase().trim();
        filtered = filtered.filter(item => {
            const plainText = stripHtml(item.description).toLowerCase();
            const dateStr = item.date.toLowerCase();
            const catStr = item.category.toLowerCase();
            return plainText.includes(query) || dateStr.includes(query) || catStr.includes(query);
        });
    }
    
    // 3. Sort Order
    filtered.sort((a, b) => {
        const dateA = new Date(a.updated_raw);
        const dateB = new Date(b.updated_raw);
        return currentSortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
    
    // 4. Render output
    releaseList.innerHTML = '';
    
    if (filtered.length === 0) {
        releaseList.style.display = 'none';
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';
        releaseList.style.display = 'grid';
        
        filtered.forEach(note => {
            const card = createNoteCard(note);
            releaseList.appendChild(card);
        });
    }
}

// Create Card DOM element for a single release update
function createNoteCard(note) {
    const card = document.createElement('article');
    
    // Clean and normalize category css classes
    const catClass = note.category.toLowerCase().replace(/\s+/g, '-');
    card.className = `note-card cat-${catClass}`;
    card.setAttribute('data-id', note.id);
    
    card.innerHTML = `
        <div class="note-header">
            <div class="note-meta">
                <span class="category-badge">${note.category}</span>
                <time class="note-date" datetime="${note.updated_raw}">${note.date}</time>
            </div>
            <button class="btn-tweet-action" aria-label="Tweet this specific update">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                <span>Tweet</span>
            </button>
        </div>
        <div class="note-content">
            ${note.description}
        </div>
    `;
    
    // Add Event Listener to Tweet Button
    const tweetBtn = card.querySelector('.btn-tweet-action');
    tweetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openTweetModal(note);
    });
    
    return card;
}

// --- Tweet Modal Logic ---

function openTweetModal(note) {
    selectedNoteForTweet = note;
    
    // Set up reference card in Modal
    const catClass = note.category.toLowerCase().replace(/\s+/g, '-');
    modalReferenceCard.className = `reference-card cat-${catClass}`;
    modalReferenceCard.innerHTML = `
        <strong>[${note.category}] - ${note.date}</strong>
        <div>${note.description}</div>
    `;
    
    // Auto-generate suggested draft text
    const defaultDraft = generateTweetDraft(note);
    tweetTextarea.value = defaultDraft;
    
    // Update character limit counter
    updateCharCounter();
    
    // Display Modal
    tweetModal.classList.add('active');
    tweetModal.setAttribute('aria-hidden', 'false');
    tweetTextarea.focus();
    
    // Prevent background scrolling
    document.body.style.overflow = 'hidden';
}

function closeTweetModal() {
    tweetModal.classList.remove('active');
    tweetModal.setAttribute('aria-hidden', 'true');
    selectedNoteForTweet = null;
    
    // Restore scrolling
    document.body.style.overflow = '';
}

function updateCharCounter() {
    const textLength = tweetTextarea.value.length;
    charCounter.textContent = `${textLength} / 280`;
    
    // Fill percent
    const percent = (textLength / 280) * 100;
    charProgressFill.style.width = `${percent}%`;
    
    // Style adjustments based on limits
    if (textLength >= 280) {
        charProgressFill.className = 'char-progress-fill danger';
        charCounter.style.color = 'var(--color-deprecation)';
        modalTweetBtn.disabled = true;
    } else if (textLength >= 250) {
        charProgressFill.className = 'char-progress-fill warning';
        charCounter.style.color = 'var(--color-issue)';
        modalTweetBtn.disabled = false;
    } else {
        charProgressFill.className = 'char-progress-fill';
        charCounter.style.color = 'var(--text-secondary)';
        modalTweetBtn.disabled = false;
    }
}

// Handle sending Tweet (opens X Web Intent)
function handlePostTweet() {
    const tweetText = tweetTextarea.value.trim();
    if (tweetText === '') return;
    
    if (tweetText.length > 280) {
        showToast("Tweet exceeds the 280 character limit!", "error");
        return;
    }
    
    const xIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(xIntentUrl, '_blank', 'noopener,noreferrer');
    
    closeTweetModal();
    showToast("Opened Twitter composer in a new tab!", "success");
}

// --- Event Listeners and Initializers ---

// Theme Toggle logic
function initTheme() {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'light') {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
}

themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const theme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
    localStorage.setItem('theme', theme);
});

// Search input bindings
searchInput.addEventListener('input', (e) => {
    currentSearchQuery = e.target.value;
    searchClearBtn.style.display = currentSearchQuery.length > 0 ? 'block' : 'none';
    filterAndRenderReleases();
});

searchClearBtn.addEventListener('click', () => {
    searchInput.value = '';
    currentSearchQuery = '';
    searchClearBtn.style.display = 'none';
    filterAndRenderReleases();
    searchInput.focus();
});

// Category pills filters
categoryPills.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;
    
    // De-activate previous active pill
    categoryPills.querySelector('.pill.active').classList.remove('active');
    
    // Activate clicked pill
    button.classList.add('active');
    currentCategoryFilter = button.getAttribute('data-filter');
    filterAndRenderReleases();
});

// Stats Cards clicks to trigger category filters
document.querySelectorAll('.stat-card').forEach(card => {
    card.addEventListener('click', () => {
        const filter = card.getAttribute('data-category');
        const pill = categoryPills.querySelector(`[data-filter="${filter}"]`);
        if (pill) {
            pill.click();
        }
    });
});

// Sort select dropdown
sortSelect.addEventListener('change', (e) => {
    currentSortOrder = e.target.value;
    filterAndRenderReleases();
});

// Reset filters button (empty states)
resetFiltersBtn.addEventListener('click', () => {
    searchInput.value = '';
    currentSearchQuery = '';
    searchClearBtn.style.display = 'none';
    
    // Reset to "All" pill
    categoryPills.querySelector('[data-filter="All"]').click();
});

// Refresh button trigger
refreshBtn.addEventListener('click', () => {
    fetchReleases(true);
});

// Modal Events
closeModalBtn.addEventListener('click', closeTweetModal);
modalCancelBtn.addEventListener('click', closeTweetModal);
modalTweetBtn.addEventListener('click', handlePostTweet);

// Click outside modal card to close
tweetModal.addEventListener('click', (e) => {
    if (e.target === tweetModal) {
        closeTweetModal();
    }
});

// Textarea input watcher
tweetTextarea.addEventListener('input', updateCharCounter);

// Add quick hashtag buttons
document.querySelectorAll('.btn-suggestion').forEach(button => {
    button.addEventListener('click', () => {
        const tag = button.getAttribute('data-tag');
        const currentText = tweetTextarea.value;
        
        // Append tag elegantly
        if (!currentText.includes(tag)) {
            const separator = currentText.endsWith(' ') || currentText === '' ? '' : ' ';
            tweetTextarea.value = currentText + separator + tag;
            updateCharCounter();
            tweetTextarea.focus();
        }
    });
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && tweetModal.classList.contains('active')) {
        closeTweetModal();
    }
});

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    fetchReleases(false); // Fetch on load, use cache if available
});
