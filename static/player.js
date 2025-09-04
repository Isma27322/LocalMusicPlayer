document.addEventListener('DOMContentLoaded', () => {
    // --- Parse Song Data from HTML ---
    const songDataElement = document.getElementById('song-data');
    const allSongs = JSON.parse(songDataElement.textContent);

    // --- DOM Element References ---
    const audioPlayer = document.getElementById('audio-player');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const shuffleBtn = document.getElementById('shuffle-btn');
    const repeatBtn = document.getElementById('repeat-btn');
    const progressBar = document.getElementById('progress-bar');
    const currentTimeEl = document.getElementById('current-time');
    const durationEl = document.getElementById('duration');
    const playerArt = document.querySelector('.player-artwork');
    const playerTitle = document.querySelector('.player-title');
    const playerArtist = document.querySelector('.player-artist');
    const queueBtn = document.getElementById('queue-btn');
    const queueModal = document.getElementById('queue-modal');
    const closeQueueBtn = document.getElementById('close-queue-btn');
    const queueList = document.getElementById('queue-list');
    const searchBar = document.getElementById('search-bar');
    const musicCards = document.querySelectorAll('.music-card');

    // --- Player State ---
    let playQueue = [];
    let originalQueue = []; // For unshuffling
    let currentIndex = -1;
    let isPlaying = false;
    let isShuffled = false;
    let isRepeat = false;

    // --- SVG Icons ---
    const playIcon = `<svg xmlns="http://www.w.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>`;
    const pauseIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg>`;
    playPauseBtn.innerHTML = playIcon;

    // --- Core Player Functions ---
    function loadSong(song) {
        if (!song) return;
        playerTitle.textContent = song.title;
        playerArtist.textContent = song.artist;
        if (song.artwork && song.artwork.data) {
            playerArt.innerHTML = `<img src="data:${song.artwork.mime};base64,${song.artwork.data}" alt="Album Art">`;
        } else {
            playerArt.innerHTML = `<div class="no-art-player"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></div>`;
        }
        audioPlayer.src = `/music/${song.file}`;
        updateQueueUI();
        updateMediaSession(song);
    }

    function playSong() {
        if (currentIndex === -1) return;
        isPlaying = true;
        audioPlayer.play().catch(e => console.error("Error playing audio:", e));
        playPauseBtn.innerHTML = pauseIcon;
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = "playing";
        }
    }

    function pauseSong() {
        isPlaying = false;
        audioPlayer.pause();
        playPauseBtn.innerHTML = playIcon;
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = "paused";
        }
    }

    function playNext() {
        if (playQueue.length === 0) return;
        currentIndex++;
        if (currentIndex >= playQueue.length) {
            currentIndex = 0;
        }
        loadSong(playQueue[currentIndex]);
        playSong();
    }

    function playPrev() {
        if (playQueue.length === 0) return;
        currentIndex--;
        if (currentIndex < 0) {
            currentIndex = playQueue.length - 1;
        }
        loadSong(playQueue[currentIndex]);
        playSong();
    }
    
    // --- Event Listeners ---
    playPauseBtn.addEventListener('click', () => {
        if (currentIndex === -1 && playQueue.length > 0) {
            currentIndex = 0;
            loadSong(playQueue[0]);
            playSong();
        } else {
            isPlaying ? pauseSong() : playSong();
        }
    });
    
    nextBtn.addEventListener('click', playNext);
    prevBtn.addEventListener('click', playPrev);
    audioPlayer.addEventListener('ended', () => {
        if (isRepeat) {
            audioPlayer.currentTime = 0;
            playSong();
        } else {
            playNext();
        }
    });

    // --- Progress Bar ---
    audioPlayer.addEventListener('timeupdate', () => {
        const { duration, currentTime } = audioPlayer;
        if (duration) {
            progressBar.value = (currentTime / duration) * 100;
            currentTimeEl.textContent = formatTime(currentTime);
        }
    });

    audioPlayer.addEventListener('loadedmetadata', () => {
        durationEl.textContent = formatTime(audioPlayer.duration);
    });
    
    progressBar.addEventListener('input', () => {
        if (currentIndex === -1) return;
        audioPlayer.currentTime = (progressBar.value / 100) * audioPlayer.duration;
    });

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // --- Music Card Interactions ---
    document.querySelectorAll('.music-card').forEach(card => {
        const songId = parseInt(card.dataset.songId, 10);
        const song = allSongs.find(s => s.id === songId);

        card.querySelector('.play-button').addEventListener('click', (e) => {
            e.stopPropagation();
            playQueue = [song, ...allSongs.filter(s => s.id !== songId)];
            originalQueue = [...playQueue];
            if (isShuffled) {
                isShuffled = false;
                shuffleBtn.classList.remove('active');
            }
            currentIndex = 0;
            loadSong(song);
            playSong();
        });

        card.querySelector('.add-queue-button').addEventListener('click', (e) => {
            e.stopPropagation();
            
            // If nothing is playing, add it to the queue and load it
            if (currentIndex === -1) {
                playQueue.push(song);
                originalQueue.push(song);
                currentIndex = 0; // Set it as the current song
                loadSong(song); // Load it, but don't play
            } else {
                // If the song is already in the queue, remove its old instance first
                const existingIndex = playQueue.findIndex(s => s.id === song.id);
                if (existingIndex > -1) {
                    playQueue.splice(existingIndex, 1);
                }

                // Add the song right after the currently playing one
                playQueue.splice(currentIndex + 1, 0, song);
                
                // If the song we moved was before the current one, the index shifts
                if (existingIndex > -1 && existingIndex < currentIndex) {
                    currentIndex--;
                }
            }
            
            // Also update the original queue if not shuffled
            if (!isShuffled) {
                originalQueue = [...playQueue];
            }

            updateQueueUI();
            const btn = e.currentTarget;
            btn.style.transform = 'scale(1.2)';
            setTimeout(() => btn.style.transform = 'scale(1)', 200);
        });
    });

    // --- Shuffle & Repeat ---
    shuffleBtn.addEventListener('click', () => {
        isShuffled = !isShuffled;
        shuffleBtn.classList.toggle('active', isShuffled);
        
        if (playQueue.length === 0) return;

        const currentSong = playQueue[currentIndex];
        
        if (isShuffled) {
            originalQueue = [...playQueue];
            // Shuffle the queue but keep the current song at the top
            const otherSongs = playQueue.filter(s => s.id !== currentSong.id);
            for (let i = otherSongs.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [otherSongs[i], otherSongs[j]] = [otherSongs[j], otherSongs[i]];
            }
            playQueue = [currentSong, ...otherSongs];
        } else {
            // Restore the original order
            playQueue = [...originalQueue];
        }
        // Find the new index of the current song
        currentIndex = playQueue.findIndex(s => s.id === currentSong.id);
        updateQueueUI();
    });

    repeatBtn.addEventListener('click', () => {
        isRepeat = !isRepeat;
        repeatBtn.classList.toggle('active', isRepeat);
    });

    // --- Queue Modal ---
    queueBtn.addEventListener('click', () => queueModal.style.display = 'block');
    closeQueueBtn.addEventListener('click', () => queueModal.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target === queueModal) {
            queueModal.style.display = 'none';
        }
    });

    function updateQueueUI() {
        queueList.innerHTML = '';
        playQueue.forEach((song, index) => {
            const item = document.createElement('li');
            item.className = 'queue-item';
            item.dataset.songId = song.id;
            item.draggable = true;
            // Correctly highlight the current song even in shuffle mode
            if (song.id === playQueue[currentIndex]?.id) {
                item.classList.add('playing');
            }

            const artworkHtml = (song.artwork && song.artwork.data)
                ? `<img src="data:${song.artwork.mime};base64,${song.artwork.data}" alt="">`
                : `<div class="no-art-queue"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></div>`;

            item.innerHTML = `
                ${artworkHtml}
                <div class="queue-item-info">
                    <div class="title">${song.title}</div>
                    <div class="artist">${song.artist}</div>
                </div>
            `;
            queueList.appendChild(item);
        });
    }

    // --- Drag and Drop for Queue ---
    let draggedItem = null;

    queueList.addEventListener('dragstart', (e) => {
        draggedItem = e.target.closest('.queue-item');
        setTimeout(() => {
            if (draggedItem) draggedItem.style.display = 'none';
        }, 0);
    });

    queueList.addEventListener('dragend', (e) => {
        setTimeout(() => {
            if (draggedItem) draggedItem.style.display = '';
            draggedItem = null;
            
            const newIdOrder = [...queueList.querySelectorAll('.queue-item')].map(li => parseInt(li.dataset.songId, 10));
            const currentPlayingId = playQueue[currentIndex]?.id;
            
            playQueue = newIdOrder.map(id => allSongs.find(s => s.id === id));
            
            if (!isShuffled) {
                originalQueue = [...playQueue];
            }

            currentIndex = playQueue.findIndex(s => s.id === currentPlayingId);
            updateQueueUI();
        }, 0);
    });

    queueList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(queueList, e.clientY);
        if (afterElement == null) {
            queueList.appendChild(draggedItem);
        } else {
            queueList.insertBefore(draggedItem, afterElement);
        }
    });

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.queue-item:not([style*="display: none"])')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // --- Media Session API ---
    function updateMediaSession(song) {
        if ('mediaSession' in navigator) {
            const artworkDetails = (song.artwork && song.artwork.data) ? 
                [{ src: `data:${song.artwork.mime};base64,${song.artwork.data}`, sizes: '512x512', type: song.artwork.mime }] : 
                [];

            navigator.mediaSession.metadata = new MediaMetadata({
                title: song.title,
                artist: song.artist,
                album: song.album,
                artwork: artworkDetails
            });
        }
    }

    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', playSong);
        navigator.mediaSession.setActionHandler('pause', pauseSong);
        navigator.mediaSession.setActionHandler('previoustrack', playPrev);
        navigator.mediaSession.setActionHandler('nexttrack', playNext);
    }
    
    // --- Keyboard Shortcuts ---
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;

        switch (e.key) {
            case ' ':
                e.preventDefault();
                playPauseBtn.click();
                break;
            case 'ArrowRight':
                playNext();
                break;
            case 'ArrowLeft':
                playPrev();
                break;
        }
    });
    
    // --- Live Search ---
    searchBar.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        
        musicCards.forEach(card => {
            const title = card.querySelector('.title').textContent.toLowerCase();
            const artist = card.querySelector('.artist').textContent.toLowerCase();
            
            if (title.includes(searchTerm) || artist.includes(searchTerm)) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    });
});
