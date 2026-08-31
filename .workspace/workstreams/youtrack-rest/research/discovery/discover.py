"""Inventory public JetBrains documentation; never contact a YouTrack instance."""
import concurrent.futures
from datetime import datetime, timezone
import hashlib
import html
import json
import re
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import urlopen

BASE = "https://www.jetbrains.com/help/youtrack/devportal/"
ROOT = Path(__file__).parent

def fetch(name):
    with urlopen(urljoin(BASE, name), timeout=30) as response:
        return response.read().decode("utf-8")

def clean(value):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", value))).strip()

def inspect_page(name):
    raw = fetch(name)
    rows = re.findall(r"<tr\b[^>]*>(.*?)</tr>", raw, re.S)
    table = {}
    for row in rows:
        cells = re.findall(r"<t[dh]\b[^>]*>(.*?)</t[dh]>", row, re.S)
        if len(cells) >= 2:
            key = clean(cells[0])
            if key in ("Resource", "Supported methods"):
                table[key] = cells[1]
    methods = []
    for verb, anchor, title in re.findall(r"<code[^>]*>(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)</code>\s*:\s*<a[^>]*href=\"([^\"]+)\"[^>]*>(.*?)</a>", table.get("Supported methods", ""), re.S):
        methods.append({"method": verb, "title": clean(title), "source": urljoin(BASE + name, html.unescape(anchor))})
    syntax = []
    for match in re.finditer(r"\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(/api/[^<\s]+)", html.unescape(raw)):
        verb, path = match.groups()
        pair = {"method": verb, "path": path.split("?")[0]}
        if pair not in syntax:
            syntax.append(pair)
    links = sorted(set(re.findall(r'href="((?:resource|operations)-api-[^"#]+\.html)', raw)))
    title = re.search(r"<h1[^>]*>(.*?)</h1>", raw, re.S)
    return {"page": name, "source": BASE + name, "title": clean(title.group(1)) if title else name,
            "resource": clean(table.get("Resource", "")), "methods": methods, "requestSyntax": syntax,
            "resourceLinks": links, "sha256": hashlib.sha256(raw.encode()).hexdigest()}

def main():
    raw = fetch("api-resources.html")
    links = sorted(set(re.findall(r'href="((?:resource|operations)-api-[^"#]+\.html)', raw)))
    print("Indexed resources:", len(links), flush=True)
    pages = []
    errors = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(inspect_page, name): name for name in links}
        for future in concurrent.futures.as_completed(futures):
            try:
                pages.append(future.result())
            except Exception as error:
                errors.append({"page": futures[future], "error": type(error).__name__ + ": " + str(error)})
    pages.sort(key=lambda page: page["page"])
    operations = []
    for page in pages:
        for method in page["methods"]:
            operations.append({"id": method["method"] + " " + page["resource"], "method": method["method"],
                               "path": page["resource"], "title": method["title"], "source": method["source"], "page": page["page"]})
    ids = [operation["id"] for operation in operations]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate METHOD PATH identities")
    if any(not operation["path"].startswith("/api/") for operation in operations):
        raise ValueError("Invalid resource path")
    syntax_differences = []
    for page in pages:
        declared = {(method["method"], page["resource"]) for method in page["methods"]}
        syntax = {(method["method"], method["path"]) for method in page["requestSyntax"]}
        if declared != syntax:
            syntax_differences.append({"page": page["page"],
                                      "tableOnly": sorted(" ".join(pair) for pair in declared - syntax),
                                      "syntaxOnly": sorted(" ".join(pair) for pair in syntax - declared)})
    found_links = set(link for page in pages for link in page["resourceLinks"])
    report = {"retrieved": datetime.now(timezone.utc).isoformat(), "index": BASE + "api-resources.html", "indexSha256": hashlib.sha256(raw.encode()).hexdigest(),
              "indexedPages": links, "pages": pages, "operations": operations,
              "nonIndexedResourceLinks": sorted(found_links - set(links)), "errors": errors,
              "validation": {"uniqueOperationIdentities": len(set(ids)),
                             "methodBearingPages": sum(bool(page["methods"]) for page in pages),
                             "metadataOnlyPages": [page["page"] for page in pages if not page["methods"]],
                             "syntaxDifferences": syntax_differences}}
    ROOT.joinpath("discovery.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"indexed": len(links), "fetched": len(pages), "operations": len(operations),
                      "emptyMethodPages": [p["page"] for p in pages if not p["methods"]],
                      "extraLinks": report["nonIndexedResourceLinks"], "errors": errors}, indent=2), flush=True)

if __name__ == "__main__":
    main()
