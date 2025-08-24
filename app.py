import os
import base64
from flask import Flask, render_template, send_from_directory, abort
from mutagen.mp3 import MP3
from mutagen.id3 import ID3, APIC

app = Flask(__name__)

# --- IMPORTANT ---
# Set this to the full path of your music directory.
# Windows example: r"C:\Users\Isaac\Music"
# macOS/Linux example: "/home/isaac/Music"
MUSIC_DIR = r"C:\Users\Manni\Plex\Music\GoodMusic"

# --- Caching ---
# A cache to store folder art paths to avoid repeated disk searches
folder_art_cache = {}

def find_folder_art(directory):
    """Searches a directory for common folder art filenames."""
    if directory in folder_art_cache:
        return folder_art_cache[directory]

    common_filenames = ['folder.jpg', 'cover.jpg', 'albumart.jpg', 'front.jpg']
    for filename in common_filenames:
        filepath = os.path.join(directory, filename)
        if os.path.exists(filepath):
            folder_art_cache[directory] = filepath
            return filepath
    
    folder_art_cache[directory] = None
    return None

def get_album_art(file_path):
    """
    Extracts album art. First checks for embedded art, then falls back to folder art.
    This function is 100% local and does not connect to the internet.
    """
    # 1. Try to get embedded artwork first by checking the tag's data type
    try:
        audio = MP3(file_path, ID3=ID3)
        for tag in audio.tags.values():
            if isinstance(tag, APIC):
                return {
                    "data": base64.b64encode(tag.data).decode('utf-8'),
                    "mime": tag.mime
                }
    except Exception as e:
        print(f"  -> ERROR reading embedded art from {file_path}: {e}")

    # 2. If no embedded art, look for folder.jpg, cover.jpg, etc.
    directory = os.path.dirname(file_path)
    folder_art_path = find_folder_art(directory)
    if folder_art_path:
        try:
            with open(folder_art_path, 'rb') as f:
                return {
                    "data": base64.b64encode(f.read()).decode('utf-8'),
                    "mime": 'image/jpeg' # Assume jpeg for folder art
                }
        except Exception as e:
            print(f"  -> ERROR reading folder art {folder_art_path}: {e}")

    return None

def get_music_files(directory):
    """
    Scans a given directory recursively for MP3 files,
    extracts metadata, and gets album art.
    """
    music_list = []
    song_id_counter = 0
    for root, _, files in os.walk(directory):
        for file in files:
            if file.lower().endswith('.mp3'):
                file_path = os.path.join(root, file)
                try:
                    title = os.path.basename(file_path)
                    artist = 'Unknown Artist'
                    album = 'Unknown Album'

                    audio = MP3(file_path, ID3=ID3)
                    title = audio.get('TIT2', [title])[0]
                    artist = audio.get('TPE1', [artist])[0]
                    album = audio.get('TALB', [album])[0]
                    
                    relative_path = os.path.relpath(file_path, directory).replace("\\", "/")
                    
                    music_list.append({
                        'id': song_id_counter,
                        'title': title,
                        'artist': artist,
                        'album': album,
                        'file': relative_path,
                        'artwork': get_album_art(file_path)
                    })
                    song_id_counter += 1
                except Exception as e:
                    print(f"Error processing file {file_path}: {e}")
    return music_list

@app.route('/')
def index():
    music_files = get_music_files(MUSIC_DIR)
    return render_template('index.html', music_files=music_files)

@app.route('/music/<path:filename>')
def serve_music(filename):
    try:
        return send_from_directory(MUSIC_DIR, filename, as_attachment=False)
    except FileNotFoundError:
        abort(404)

if __name__ == '__main__':
    if MUSIC_DIR == r"C:\Path\To\Your\Music" or MUSIC_DIR == "/path/to/your/music":
        print("--- IMPORTANT ---")
        print("Please edit the MUSIC_DIR variable in this script to point to your music folder.")
    elif os.path.isdir(MUSIC_DIR):
        print(f"Serving music from: {MUSIC_DIR}")
        print(f"Access the player at http://127.0.0.1:5000")
        app.run(host='127.0.0.1', port=5000, debug=False)
    else:
        print(f"Error: The directory '{MUSIC_DIR}' does not exist.")
        print("Please check the MUSIC_DIR variable in this script.")
