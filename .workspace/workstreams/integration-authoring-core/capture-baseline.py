from pathlib import Path
import hashlib, json, subprocess, sys

REVISION = "b5762f242ff1ea074e33a1c1739190ac4d0ee523"
GIT = r"C:\Program Files\Git\cmd\git.exe"
ROOT = Path(__file__).resolve().parents[3]

def git(*args):
    return subprocess.check_output([GIT, "-C", str(ROOT), *args])

def sha(data):
    return hashlib.sha256(data).hexdigest()

entries=[]
for raw in git("ls-tree", "-r", "-z", REVISION, "packages", "integrations").split(b"\0"):
    if not raw: continue
    meta,path=raw.split(b"\t",1)
    mode,kind,oid=meta.decode().split()
    if kind=="blob": entries.append((path.decode(),oid))
ids=list(dict.fromkeys(oid for _,oid in entries))
raw=subprocess.check_output([GIT,"-C",str(ROOT),"cat-file","--batch"],input=("\n".join(ids)+"\n").encode())
blobs={};offset=0
for oid in ids:
    end=raw.index(b"\n",offset); header=raw[offset:end].decode().split();size=int(header[2])
    offset=end+1;blobs[oid]=raw[offset:offset+size];offset+=size+1
by_path={path:(oid,blobs[oid]) for path,oid in entries}
workspaces={}
for path,(oid,data) in by_path.items():
    if path.count("/")==2 and path.endswith("/package.json"):
        package=json.loads(data)
        workspaces[path.rsplit("/",1)[0]]={"package":package["name"],"package_json_blob":oid,"source":0,"tests_support":0,"proof":0,"other_typescript":0,"typescript_files":0,"all_included_files":0}
files=[];excluded=[]
for path,oid in entries:
    owner=next((name for name in workspaces if path.startswith(name+"/")),None)
    if owner is None: continue
    parts=Path(path).parts
    if any(part in {"generated","dist","node_modules","coverage",".workspace"} for part in parts):
        excluded.append({"path":path,"git_blob":oid,"reason":"generated/output/dependency/workstream surface"});continue
    data=blobs[oid];is_ts=Path(path).suffix in {".ts",".tsx",".mts",".cts"}
    relative=path[len(owner)+1:]
    category="source" if relative.startswith("src/") else "proof" if relative.startswith("integration-tests/") else "tests_support" if relative.startswith(("tests/","test/")) else "other_typescript"
    row={"path":path,"workspace":owner,"git_blob":oid,"sha256":sha(data),"bytes":len(data),"category":category if is_ts else "non_typescript","nonblank_lines":None}
    if is_ts:
        normalized=data.decode("utf-8-sig").replace("\r\n","\n")
        row.update(nonblank_lines=sum(bool(line.strip()) for line in normalized.splitlines()),lf_utf8_bytes=len(normalized.encode()),lf_utf16_characters=len(normalized.encode("utf-16-le"))//2)
        workspaces[owner][category]+=row["nonblank_lines"];workspaces[owner]["typescript_files"]+=1
    workspaces[owner]["all_included_files"]+=1;files.append(row)

specs=[
("tc-list","integrations/teamcity/src/cli.ts","List projects","command"),
("tc-detail","integrations/teamcity/src/cli.ts","Show one project","command"),
("tc-mutation","integrations/teamcity/src/cli.ts","Queue a new build for a job","command"),
("yt-list","integrations/youtrack/src/cli.ts","Search one page of issues","command"),
("yt-detail","integrations/youtrack/src/cli.ts","Show an issue by database","command"),
("yt-mutation","integrations/youtrack/src/cli.ts","Update summary and/or description","command"),
("tc-fixture","integrations/teamcity/tests/support.ts","export async function createTestRuntime","excerpt"),
("yt-fixture","integrations/youtrack/tests/cli-fixture.ts","export async function fixture","excerpt"),
("tc-proof","integrations/teamcity/integration-tests/profile-proof.ts",None,"excerpt"),
("yt-proof","integrations/youtrack/integration-tests/profile-proof.ts",None,"excerpt"),
("tc-download","integrations/teamcity/src/downloads.ts","export async function saveDownload","excerpt"),
("yt-download","integrations/youtrack/src/attachment-download.ts","export async function downloadIssueAttachment","excerpt"),
("tc-wrapper","integrations/teamcity/src/command-support.ts","export type ClientLeaf","excerpt"),
("yt-parsers","integrations/youtrack/src/cli-support.ts","export function parseBody","excerpt"),
("existing-random-proof","integrations/random-common/src/proof.ts","export function runProof","excerpt"),
]
samples=[]
for label,path,anchor,kind in specs:
    oid,data=by_path[path];lines=data.decode("utf-8-sig").replace("\r\n","\n").splitlines()
    at=next(i for i,line in enumerate(lines) if anchor in line) if anchor else 0
    start=at;end=min(len(lines),at+12)
    if kind=="command":
        start=next(i for i in range(at,-1,-1) if lines[i].strip()=="command(")
        indent=len(lines[start])-len(lines[start].lstrip())
        end=next(i+1 for i in range(at+1,len(lines)) if lines[i]==" "*indent+"),")
    selected="\n".join(lines[start:end])+"\n"
    samples.append({"id":label,"path":path,"git_blob":oid,"start_line":start+1,"end_line":end,"span_kind":"complete declaration" if kind=="command" else "context excerpt; full file counted above","span_sha256_lf":sha(selected.encode()),"nonblank_lines":sum(bool(x.strip()) for x in lines[start:end]),"excerpt":lines[start:min(end,start+8)]})
source=lambda prefix:"\n".join(data.decode("utf-8-sig") for path,(oid,data) in by_path.items() if path.startswith(prefix) and path.endswith(".ts") and "/generated/" not in path)
leads={"tc_text_args":len(__import__('re').findall(r"text\(args,",source("integrations/teamcity/src/"))),"yt_read_options":source("integrations/youtrack/src/").count("readOptions(options)"),"yt_connection_await":source("integrations/youtrack/src/").count("await connection(context)"),"integration_setupServer_calls":len(__import__('re').findall(r"setupServer\(",source("integrations/teamcity/tests/")+source("integrations/youtrack/tests/")))}
totals={key:sum(w[key] for w in workspaces.values()) for key in ["source","tests_support","proof","other_typescript","typescript_files","all_included_files"]}
result={"schema":"integration-authoring-core-baseline-v1","revision":REVISION,"tree":git("rev-parse",REVISION+"^{tree}").decode().strip(),"method":"Native git ls-tree and cat-file --batch at fixed revision. Blob bytes/hashes never depend on checkout line endings. Nonblank handwritten TypeScript including comments; optional .tsx/.mts/.cts included if present. LF/BOM-normalized character metrics are supplementary. Generated directories/dist/dependencies/workstreams excluded. Every current workspace retained; src/proof.ts remains production by path, not double-counted. Non-TypeScript setup/config/fixture files are hash/byte manifested separately, not mixed into TS LOC.","workspaces":workspaces,"totals":totals,"files":files,"excluded":excluded,"samples":samples,"occurrence_leads_not_savings":leads}
output=json.dumps(result,ensure_ascii=False,indent=2)+"\n"
if "--stdout" in sys.argv: print(output,end="")
else: Path(__file__).with_name("baseline.json").write_text(output,encoding="utf-8",newline="\n");print(json.dumps({"totals":totals,"workspaces":workspaces,"excluded_files":len(excluded),"samples":len(samples),"occurrence_leads":leads}))
