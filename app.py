import os
import re
import requests
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template, request
from datetime import datetime

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache for feed content to prevent rate-limiting and improve speed
cache = {
    "data": None,
    "last_fetched": None
}

def parse_xml_feed(xml_content):
    """
    Parses the Atom XML feed. Splits feed entries (which are per day)
    into individual release items using <h3> headers as delimiters.
    """
    root = ET.fromstring(xml_content)
    # The XML namespace for Atom feeds
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    
    entries = root.findall("atom:entry", ns)
    parsed_updates = []
    
    for entry in entries:
        entry_id_el = entry.find("atom:id", ns)
        entry_id = entry_id_el.text if entry_id_el is not None else "tag:google-release-note"
        
        updated_el = entry.find("atom:updated", ns)
        updated_raw = updated_el.text if updated_el is not None else datetime.now().isoformat()
        
        # Title of the entry in this feed is typically the release date, e.g. "June 15, 2026"
        title_el = entry.find("atom:title", ns)
        date_str = title_el.text if title_el is not None else "Unknown Date"
        
        content_el = entry.find("atom:content", ns)
        content_html = content_el.text if content_el is not None else ""
        
        # Split HTML content by <h3>...</h3> tags
        parts = re.split(r'<h3>(.*?)</h3>', content_html)
        
        if len(parts) < 3:
            # Fallback if no <h3> tags are found
            parsed_updates.append({
                "id": f"{entry_id}_0",
                "date": date_str,
                "updated_raw": updated_raw,
                "category": "Update",
                "description": content_html.strip()
            })
        else:
            sub_index = 0
            for i in range(1, len(parts), 2):
                category = parts[i].strip()
                description = parts[i+1].strip() if i+1 < len(parts) else ""
                parsed_updates.append({
                    "id": f"{entry_id}_{sub_index}",
                    "date": date_str,
                    "updated_raw": updated_raw,
                    "category": category,
                    "description": description
                })
                sub_index += 1
                
    return parsed_updates

def fetch_releases(force_refresh=False):
    """
    Fetches release notes, using the in-memory cache if valid and force_refresh is false.
    """
    global cache
    now = datetime.now()
    
    # Return cached data if not forced and cache is younger than 10 minutes (600 seconds)
    if not force_refresh and cache["data"] is not None and cache["last_fetched"] is not None:
        diff = (now - cache["last_fetched"]).total_seconds()
        if diff < 600:
            return cache["data"], False
            
    try:
        response = requests.get(FEED_URL, timeout=15)
        response.raise_for_status()
        updates = parse_xml_feed(response.content)
        cache["data"] = updates
        cache["last_fetched"] = now
        return updates, True
    except Exception as e:
        print(f"Error fetching BigQuery releases: {e}")
        # Return cache if available as a fallback in case of errors
        if cache["data"] is not None:
            return cache["data"], False
        raise e

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    try:
        releases, fetched_new = fetch_releases(force_refresh=force_refresh)
        return jsonify({
            "status": "success",
            "count": len(releases),
            "fetched_new": fetched_new,
            "last_fetched": cache["last_fetched"].isoformat() if cache["last_fetched"] else None,
            "data": releases
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

if __name__ == '__main__':
    # Use port 5000 by default or check env variables
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
