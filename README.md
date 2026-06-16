# BigQuery Release Notes Explorer

A premium, interactive Single Page Application (SPA) dashboard for exploring, filtering, and sharing Google Cloud BigQuery release notes. This project fetches Google's Atom feed, parses it on the server into individual structured updates, and displays them via a modern, responsive web interface.

---

## 🚀 Key Features

* **Granular Feed Parsing**: Daily consolidated updates from Google's Atom feed are parsed and split into individual cards categorized as **Features**, **Changes**, **Issues / Fixes**, **Deprecations**, or **Announcements**.
* **Smart Caching Layer**: Utilizes a 10-minute server-side in-memory cache to prevent upstream rate-limiting and ensure lightning-fast client page load times.
* **Instant Client-Side Filtering**: Supports quick keyword searches and category filtering directly within the browser without repeated server round-trips.
* **X/Twitter Integration**: An interactive tweet composer modal with character progression indicators, suggested hashtags (`#BigQuery`, `#GCP`), and automatic summaries that can be published via Twitter Web Intents.
* **Premium Theme Engine**: Dynamic light/dark theme toggle, using smooth transition animations and persisted state using `localStorage`.

---

## 📂 File Structure

* [app.py](file:///home/mluser/agy-cli-projects/app.py): The main entry point containing the Flask server, caching logic, Atom feed retrieval, and HTML parsing/restructuring.
* [templates/index.html](file:///home/mluser/agy-cli-projects/templates/index.html): The main SPA structure containing the controls panel, skeleton loaders, and tweet composer modal.
* [static/script.js](file:///home/mluser/agy-cli-projects/static/script.js): Frontend application controller handling theme management, search/filter logic, API polling, stats counters, and modal interactions.
* [static/style.css](file:///home/mluser/agy-cli-projects/static/style.css): Custom stylesheet providing dark/light CSS variables, layout positioning, animations, and responsive media queries.
* [requirements.txt](file:///home/mluser/agy-cli-projects/requirements.txt): Lists external Python dependencies (`Flask`, `requests`).

---

## 🛠️ Getting Started

### Prerequisites
* Python 3.8 or higher installed on your system.

### Installation & Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/spgithu/antigravity-event-talks-app.git
   cd antigravity-event-talks-app
   ```

2. **Create a Virtual Environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the Application**:
   ```bash
   python app.py
   ```

5. **Access the Dashboard**:
   Open your browser and navigate to `http://localhost:5000`.

---

## 🔌 API Documentation

### Get Release Notes
Returns the list of parsed release notes.

* **Endpoint**: `/api/releases`
* **Method**: `GET`
* **Query Parameters**:
  * `refresh` (optional): Set to `true` to force a cache clear and pull fresh updates from the upstream Google Cloud feed. Default is `false`.
* **Example JSON Response**:
  ```json
  {
    "status": "success",
    "count": 1,
    "fetched_new": true,
    "last_fetched": "2026-06-16T12:53:00.123456",
    "data": [
      {
        "id": "tag:google-release-note-id_0",
        "date": "June 15, 2026",
        "updated_raw": "2026-06-15T00:00:00Z",
        "category": "Feature",
        "description": "<p>You can now write GoogleSQL queries using new JSON functions...</p>"
      }
    ]
  }
  ```
