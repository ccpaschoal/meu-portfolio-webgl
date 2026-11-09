"""Copy only portfolio carousel images referenced by the original site's HTML."""
from html.parser import HTMLParser
from pathlib import Path
import json
import shutil
import re
from html import unescape

SOURCE = Path(r"C:\Users\paschoal\Desktop\1 - CAMILLA PASCHOAL\6 - MEU SITE")
PROJECT = Path(__file__).resolve().parents[1]


class PortfolioParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.projects = []
        self.current = None
        self.article_depth = 0
        self.capture = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "article":
            if self.current:
                self.article_depth += 1
            elif "deck-item" in attrs.get("class", "").split():
                self.current = {"title": "", "tag": "", "photos": [], "thumb": ""}
                self.article_depth = 1
        if not self.current:
            return
        if tag == "h3":
            self.capture = "title"
        elif tag == "p" and "carousel-meta" in attrs.get("class", "").split():
            self.capture = "tag"
        elif tag == "img":
            thumbnail = attrs.get("src", "")
            original = attrs.get("data-full", thumbnail)
            if original.startswith("assets/carrosseis/"):
                self.current["photos"].append("/" + original)
                if not self.current["thumb"]:
                    self.current["thumb"] = "/" + thumbnail

    def handle_data(self, data):
        if self.current and self.capture:
            self.current[self.capture] += data

    def handle_endtag(self, tag):
        if tag in ("h3", "p"):
            self.capture = None
        if tag == "article" and self.current:
            self.article_depth -= 1
            if self.article_depth == 0:
                if self.current["photos"]:
                    self.current["title"] = self.current["title"].strip()
                    self.current["tag"] = self.current["tag"].strip().split(" · ")[0]
                    self.current["id"] = self.current["photos"][0].split("/")[3]
                    self.projects.append(self.current)
                self.current = None


parser = PortfolioParser()
source_html = (SOURCE / "index.html").read_text(encoding="utf-8")
parser.feed(source_html)
if not parser.projects:
    raise RuntimeError("No carousel projects found in the source portfolio.")

copied = set()
for project in parser.projects:
    for asset in [project["thumb"], *project["photos"]]:
        relative = Path(asset.lstrip("/"))
        source = (SOURCE / relative).resolve()
        if not source.is_relative_to(SOURCE.resolve()) or source.suffix.lower() not in {".webp", ".jpg", ".jpeg", ".png"}:
            raise ValueError(f"Invalid image path: {asset}")
        destination = PROJECT / "public" / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        copied.add(asset)

for asset in ("assets/logo-cp-96.webp", "assets/fonts/montserrat-latin.woff2", "assets/avatar-real.jpg"):
    source = SOURCE / asset
    if source.is_file():
        destination = PROJECT / "public" / asset
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)

data_dir = PROJECT / "src" / "data"
data_dir.mkdir(parents=True, exist_ok=True)
(data_dir / "projects.js").write_text(
    "// Generated from the original portfolio by scripts/sync-portfolio.py.\n"
    "export const projectsData = " + json.dumps(parser.projects, ensure_ascii=False, indent=2) + ";\n",
    encoding="utf-8",
)
sites = []
for body in re.findall(r'<article class="site-card">(.*?)</article>', source_html, re.S):
    title = unescape(re.search(r'<h4>(.*?)</h4>', body, re.S).group(1))
    thumbnail = re.search(r'<img[^>]+src="([^"]+)"', body).group(1)
    href = re.search(r'href="([^"]+)"', body).group(1)
    srcset = re.search(r'srcset="([^"]+)"', body)
    original = srcset.group(1).split(',')[-1].strip().split()[0] if srcset else thumbnail
    for filename in {thumbnail, original}:
        source = (SOURCE / filename).resolve()
        if not source.is_relative_to(SOURCE.resolve()) or source.suffix.lower() not in {".webp", ".jpg", ".jpeg", ".png"}:
            raise ValueError(f"Invalid site image: {filename}")
        destination = PROJECT / "public" / filename
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
    sites.append({"title": title, "thumb": "/" + thumbnail, "image": "/" + original, "href": href})
(data_dir / "sites.js").write_text("export const sitesData = " + json.dumps(sites, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")

contacts = []
definitions = [("linkedin", "LinkedIn", chr(0x25B6)), ("github", "GitHub", chr(0x25A0)), ("instagram", "Instagram", chr(0x25C0) * 2), ("gmail", "E-mail", chr(0x25B6) * 2), ("whatsapp", "WhatsApp", chr(0x25B2))]
for key, label, symbol in definitions:
    for match in re.finditer(r'<a\b([^>]+)>(.*?)</a>', source_html, re.S):
        if "social-expand-btn--" + key not in match.group(1):
            continue
        href = re.search(r'href="([^"]+)"', match.group(1)).group(1)
        icon = re.search(r'<svg\b.*?</svg>', match.group(2), re.S).group(0)
        icon = re.sub(r'class="[^"]*"', 'class="social-icon"', icon)
        contacts.append({"key": key, "label": label, "symbol": symbol, "href": href, "icon": icon})
        break
if len(contacts) != len(definitions):
    raise RuntimeError("Could not find all original portfolio contacts.")
(data_dir / "contacts.js").write_text("export const contacts = " + json.dumps(contacts, ensure_ascii=True, indent=2) + ";\n", encoding="utf-8")
print(f"Imported {len(parser.projects)} carousels, {len(sites)} websites, {len(contacts)} contacts and {len(copied)} carousel images.")
