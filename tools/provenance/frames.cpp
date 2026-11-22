// frames: incremental line provenance over time frames (FOLLOWUP item 0), and the delta-coded viewer data.
//
//   frames WORK REPOS OUT          WORK = agents/frames/work (tools/frames.py writes frames.tsv, files.tsv, lanes.tsv)
//
// Frames are processed once, in global time order. Each lane keeps its current state (files, each a list of line
// instances). A frame is applied to its lane as a delta: unchanged files are untouched, edited files are diffed
// (Myers, raw line ids), so only inserted lines get new instances and only they need an origin. That is the
// incremental part: the work is proportional to the churn, not to frames x lines.
//
// Definitions (same as tools/provenance/provenance.cpp, the 48-snapshot version, with frames for snapshots)
//   raw line : bytes up to '\n', trailing '\r' removed;  norm line: whitespace runs collapsed, trimmed
//   trivial  : norm empty or only brackets / punctuation / comment delimiters -> origin = the file's dominant origin,
//              keep = 0xFFFF
//   origin   : earliest frame (global time order) where the norm line appears
//              (a) in any file of an earlier frame of the same lane, or of a code / merge parent lane up to its fork
//                  frame (transitively), or
//              (b) in an earlier version of the same file identity (any lane, identity "from" chain for copies), or
//              (c) in a file of a related / copy parent lane (its latest frame at this time) that shares >= MINSHARE
//                  significant lines with this file.
//              The origin of a matched occurrence is inherited (transitive). Virtual origin nullDC-pre2008: origin in
//              nullDC or nullDCe, and the line is both in nullDCe's recovered 2009 tree and in some nullDC frame.
//   keep     : frames after the origin frame that hold the line, counted over the lanes D = desc(origin lane) |
//              desc(holder lane), desc = closure over code / merge / copy edges (not concept "related" edges).
//   possible : frames after the origin frame in D (data/frames.json "possible"[origin][lane]); keep <= possible.
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cstdint>
#include <string>
#include <string_view>
#include <vector>
#include <unordered_map>
#include <unordered_set>
#include <map>
#include <set>
#include <algorithm>
#include <thread>
#include <mutex>
#include <memory>
#include <deque>
#include <omp.h>
#include <zlib.h>
#include <sys/stat.h>
#include <unistd.h>

using namespace std;
typedef uint64_t u64; typedef uint32_t u32; typedef uint16_t u16; typedef uint8_t u8;

static const int MINSHARE = 5;      // significant lines shared with a related-lane file to count it
static const int SIGLEN = 10;       // min norm length of a significant line (identity / related matching)
static const int DFMAX = 40;        // skip lines present in more files than this when matching files
static const int KEYMAX = 24;       // at most this many delta frames after a keyframe
static const double KEYFRAC = 0.6;  // ... or a keyframe when the inserted lines since the last one exceed this x state
static const int DMAX = 3000;       // Myers edit distance cap; beyond it the changed middle is replaced whole
static const u16 TRIV = 0xFFFF;

static void die(const char* m) { fprintf(stderr, "error: %s\n", m); exit(1); }
static vector<string> split(const string& s, char c) { vector<string> o; size_t a = 0; for (;;) { size_t b = s.find(c, a); o.push_back(s.substr(a, b == string::npos ? string::npos : b - a)); if (b == string::npos) break; a = b + 1; } return o; }

struct Edge { int lane; string kind; int frame; };
struct Lane { string name, repo; int id; vector<int> frames; vector<Edge> parents; u64 desc = 0; vector<pair<int,int>> anc; };   // anc: (lane, cutoff gi)
struct Frame { int gi; int lane; string repo, commit, date; int k; bool virt; vector<pair<string,string>> files; /* (path, sha) */ vector<int> blob; };
struct Inst { u32 raw; u16 org; };
struct LFile { string path; int blob; int ident; vector<Inst> ln; u16 dom; };
struct FT { string path; int blob; int ident; };   // frame file table entry (history)

static vector<Lane> LN; static vector<Frame> FR; static int NF, NL, VIRTF = -1;
static vector<string> blobs; static vector<int> blobrepo;
static vector<vector<u32>> blobraw, blobsig;
static vector<string_view> rawtxt; static vector<u32> raw2norm;
static vector<u8> normtriv; static vector<u16> normlen;
static deque<string>* normstore;

static bool line_trivial(string_view n) { if (n.empty()) return true; for (char c : n) if (!strchr("{}()[];,:*/ ", c)) return false; return true; }
static string normalize(string_view r) { string o; o.reserve(r.size()); bool ws = false;
    for (char c : r) { if (c == ' ' || c == '\t' || c == '\v' || c == '\f' || c == '\r') ws = true; else { if (ws && !o.empty()) o += ' '; ws = false; o += c; } } return o; }
static void wgz(const string& path, const void* d, size_t n) { gzFile g = gzopen(path.c_str(), "wb9"); if (!g) die(path.c_str());
    const char* p = (const char*)d; while (n) { unsigned k = n > (1u << 30) ? (1u << 30) : n; gzwrite(g, p, k); p += k; n -= k; } gzclose(g); }
static void wfile(const string& path, const string& s) { FILE* f = fopen(path.c_str(), "wb"); if (!f) die(path.c_str()); fwrite(s.data(), 1, s.size(), f); fclose(f); }
static void jstr(string& o, string_view s) { o += '"';
    for (unsigned char c : s) { if (c == '"') o += "\\\""; else if (c == '\\') o += "\\\\"; else if (c == '\n') o += "\\n"; else if (c == '\t') o += "\\t";
        else if (c < 0x20) { char b[8]; snprintf(b, 8, "\\u%04x", c); o += b; } else o += c; } o += '"'; }

// ---- blobs: one `git cat-file --batch` per repo, repos in parallel ----
static void read_blobs(const string& repos) {
    unordered_map<string, int> shaid; map<string, vector<string>> perrepo;
    for (auto& f : FR) { f.blob.resize(f.files.size());
        for (size_t i = 0; i < f.files.size(); i++) { string key = f.repo + ":" + f.files[i].second; auto it = shaid.find(key);
            if (it == shaid.end()) { int id = shaid.size(); shaid[key] = id; perrepo[f.repo].push_back(f.files[i].second); f.blob[i] = id; blobrepo.push_back(0); }
            else f.blob[i] = it->second; } }
    blobs.resize(shaid.size());
    vector<thread> th; mutex mu;
    for (auto& kv : perrepo) th.emplace_back([&, repo = kv.first, shas = kv.second]() {
        char tmpl[] = "/tmp/frshaXXXXXX"; int fd = mkstemp(tmpl); FILE* t = fdopen(fd, "w");
        for (auto& s : shas) fprintf(t, "%s\n", s.c_str()); fclose(t);
        string cmd = "git -C '" + repos + "/" + repo + ".git' cat-file --batch < " + tmpl;
        FILE* p = popen(cmd.c_str(), "r"); if (!p) die("popen"); char hdr[512];
        for (auto& s : shas) { if (!fgets(hdr, sizeof hdr, p)) die("cat-file short");
            char sha[64], type[16]; long n; if (sscanf(hdr, "%63s %15s %ld", sha, type, &n) != 3) die(hdr);
            string data(n, '\0'); if ((long)fread(&data[0], 1, n, p) != n) die("fread"); fgetc(p);
            int id; { lock_guard<mutex> g(mu); id = shaid[repo + ":" + s]; } blobs[id] = move(data); }
        pclose(p); unlink(tmpl); });
    for (auto& t : th) t.join();
}

// ---- Myers diff on u32 sequences: script of (op, count), op 0 = equal, 1 = delete (from a), 2 = insert (from b) ----
static void myers(const u32* a, int n, const u32* b, int m, vector<pair<u8,int>>& out) {
    auto push = [&](u8 op, int c) { if (c <= 0) return; if (!out.empty() && out.back().first == op) out.back().second += c; else out.push_back({op, c}); };
    int pre = 0; while (pre < n && pre < m && a[pre] == b[pre]) pre++;
    int suf = 0; while (suf < n - pre && suf < m - pre && a[n - 1 - suf] == b[m - 1 - suf]) suf++;
    push(0, pre); const u32* A = a + pre; const u32* B = b + pre; int N = n - pre - suf, M = m - pre - suf;
    if (N == 0 || M == 0) { push(1, N); push(2, M); push(0, suf); return; }
    int MAX = min(N + M, DMAX); int off = MAX + 1; vector<int> V(2 * MAX + 3, 0); vector<vector<int>> trace;
    int found = -1;
    for (int d = 0; d <= MAX; d++) {
        trace.push_back(V);
        for (int k = -d; k <= d; k += 2) {
            int x = (k == -d || (k != d && V[off + k - 1] < V[off + k + 1])) ? V[off + k + 1] : V[off + k - 1] + 1;
            int y = x - k; while (x < N && y < M && A[x] == B[y]) { x++; y++; }
            V[off + k] = x; if (x >= N && y >= M) { found = d; break; }
        }
        if (found >= 0) break;
    }
    if (found < 0) { push(1, N); push(2, M); push(0, suf); return; }   // too different: replace the middle
    // backtrack
    vector<pair<u8,int>> rev; int x = N, y = M;
    for (int d = found; d > 0; d--) { auto& Vd = trace[d]; int k = x - y;
        int pk = (k == -d || (k != d && Vd[off + k - 1] < Vd[off + k + 1])) ? k + 1 : k - 1;
        int px = Vd[off + pk], py = px - pk;
        int sx = (pk == k + 1) ? px : px + 1, sy = sx - k;   // after the edit step, before the snake
        int snake = x - sx; if (snake > 0) rev.push_back({0, snake});
        if (pk == k + 1) rev.push_back({2, 1}); else rev.push_back({1, 1});
        x = px; y = py; (void)sy; }
    if (x > 0) rev.push_back({0, x});
    for (auto it = rev.rbegin(); it != rev.rend(); ++it) push(it->first, it->second);
    push(0, suf);
}

// ---- inverted index of significant lines -> file slots (DFMAX filtered) ----
struct Inv { unordered_map<u32, vector<int>> m; };
static void build_inv(Inv& iv, const vector<int>& fblobs) { iv.m.clear();
    for (int i = 0; i < (int)fblobs.size(); i++) for (u32 n : blobsig[fblobs[i]]) iv.m[n].push_back(i);
    for (auto it = iv.m.begin(); it != iv.m.end();) { if ((int)it->second.size() > DFMAX) it = iv.m.erase(it); else ++it; } }
static size_t shared_sig(const vector<u32>& a, const vector<u32>& b) { size_t s = 0, i = 0, j = 0;
    while (i < a.size() && j < b.size()) { if (a[i] == b[j]) { s++; i++; j++; } else if (a[i] < b[j]) i++; else j++; } return s; }
static string lower(string s) { for (auto& c : s) c = tolower(c); return s; }
static string base(const string& p) { size_t k = p.rfind('/'); return k == string::npos ? p : p.substr(k + 1); }
static double pathsim(const string& a, const string& b) { auto x = split(a, '/'), y = split(b, '/'); int k = 0;
    while (k < (int)x.size() && k < (int)y.size() && lower(x[x.size() - 1 - k]) == lower(y[y.size() - 1 - k])) k++; return (double)k / max(x.size(), y.size()); }

// ---- per-frame record (written out after keep is known) ----
struct Op { char kind; /* K key file, A add, E edit (incl. moves), D delete */ int ident; string path; string status; int from = -1;
    int n = 0; u16 dom = 0; int kept = 0, added = 0, removed = 0; vector<u32> script; vector<Inst> ins; };
struct FrameRec { bool key = false; vector<Op> ops; u64 lines = 0; int files = 0; int kept = 0, added = 0, removed = 0;
    vector<u64> by_lane; map<int,u64> by_year; };

int main(int argc, char** argv) {
    if (argc < 4) die("usage: frames WORK REPOS OUT");
    string work = argv[1], repos = argv[2], out = argv[3];
    double t0 = omp_get_wtime();
    deque<string> ns; normstore = &ns;
    // ---- inputs ----
    map<string,int> laneid;
    { FILE* f = fopen((work + "/lanes.tsv").c_str(), "r"); if (!f) die("lanes.tsv"); char b[8192];
      while (fgets(b, sizeof b, f)) { string l(b); if (l.back() == '\n') l.pop_back(); auto c = split(l, '\t'); Lane x; x.name = c[0]; x.repo = c[1]; x.id = LN.size(); laneid[x.name] = x.id; LN.push_back(x); } fclose(f); }
    { FILE* f = fopen((work + "/lanes.tsv").c_str(), "r"); char b[8192]; int i = 0;
      while (fgets(b, sizeof b, f)) { string l(b); if (l.back() == '\n') l.pop_back(); auto c = split(l, '\t');
        if (c[2] != "-") for (auto& e : split(c[2], ',')) { auto q = split(e, ':'); LN[i].parents.push_back({laneid.at(q[0]), q[1], stoi(q[2])}); } i++; } fclose(f); }
    NL = LN.size(); if (NL > 64) die("lanes > 64");
    { FILE* f = fopen((work + "/frames.tsv").c_str(), "r"); if (!f) die("frames.tsv"); char b[8192];
      while (fgets(b, sizeof b, f)) { string l(b); if (l.back() == '\n') l.pop_back(); auto c = split(l, '\t');
        Frame x; x.gi = stoi(c[0]); x.lane = laneid.at(c[1]); x.repo = c[2]; x.commit = c[3]; x.date = c[4]; x.k = stoi(c[5]); x.virt = c[6] == "1";
        if ((int)FR.size() != x.gi) die("frames.tsv out of order"); if (x.virt) VIRTF = x.gi; else LN[x.lane].frames.push_back(x.gi); FR.push_back(x); } fclose(f); }
    NF = FR.size(); if (NF >= 0xFFFF) die("too many frames for u16 origins");
    { FILE* f = fopen((work + "/files.tsv").c_str(), "r"); if (!f) die("files.tsv"); static char b[1 << 16];
      while (fgets(b, sizeof b, f)) { string l(b); if (l.back() == '\n') l.pop_back(); auto c = split(l, '\t'); FR[stoi(c[0])].files.push_back({c[2], c[1]}); } fclose(f); }
    read_blobs(repos);
    fprintf(stderr, "%d lanes, %d frames, %zu blobs read in %.1fs\n", NL, NF, blobs.size(), omp_get_wtime() - t0);

    // ---- lane graph: ancestry lists and descendant masks ----
    for (auto& L : LN) { L.anc.push_back({L.id, 1 << 30}); }
    for (int it = 0; it < NL; it++) for (auto& L : LN) for (auto& e : L.parents) if (e.kind == "code" || e.kind == "merge") {
        // parent lane up to the fork frame, then the parent's own ancestry clipped to the same cutoff
        for (auto& pa : LN[e.lane].anc) { int c = min(pa.second, e.frame); bool have = false;
            for (auto& q : L.anc) if (q.first == pa.first) { if (c > q.second) q.second = c; have = true; }
            if (!have) L.anc.push_back({pa.first, c}); } }
    for (auto& L : LN) L.desc = 1ull << L.id;
    for (int it = 0; it < NL; it++) for (auto& L : LN) for (auto& e : L.parents) if (e.kind != "related") LN[e.lane].desc |= L.desc;
    for (auto& L : LN) { fprintf(stderr, "  lane %-16s frames %3zu anc", L.name.c_str(), L.frames.size());
        for (auto& a : L.anc) fprintf(stderr, " %s<=%d", LN[a.first].name.c_str(), a.second > NF ? -1 : a.second); fprintf(stderr, " desc %d lanes\n", __builtin_popcountll(L.desc)); }

    // ---- intern raw + norm lines in global time order (text chunks follow time) ----
    unordered_map<string_view, u32> rawid; rawid.reserve(1 << 23);
    unordered_map<string_view, u32> normid; normid.reserve(1 << 23);
    blobraw.resize(blobs.size()); blobsig.resize(blobs.size()); vector<char> done(blobs.size(), 0);
    for (auto& f : FR) for (int b : f.blob) { if (done[b]) continue; done[b] = 1;
        const string& d = blobs[b]; size_t a = 0; auto& v = blobraw[b];
        while (a < d.size()) { size_t e = d.find('\n', a); size_t end = e == string::npos ? d.size() : e;
            size_t len = end - a; if (len && d[a + len - 1] == '\r') len--; string_view r(d.data() + a, len);
            auto it = rawid.find(r); u32 id;
            if (it == rawid.end()) { id = rawtxt.size(); rawid.emplace(r, id); rawtxt.push_back(r);
                string n = normalize(r); auto jt = normid.find(n); u32 nid;
                if (jt == normid.end()) { nid = normtriv.size(); ns.push_back(move(n)); string_view sv = ns.back(); normid.emplace(sv, nid);
                    normtriv.push_back(line_trivial(sv)); normlen.push_back(min<size_t>(sv.size(), 65535)); }
                else nid = jt->second;
                raw2norm.push_back(nid); } else id = it->second;
            v.push_back(id); if (e == string::npos) break; a = e + 1; } }
    const u32 NN = normtriv.size();
    #pragma omp parallel for schedule(dynamic, 16)
    for (size_t b = 0; b < blobs.size(); b++) { auto& s = blobsig[b]; for (u32 r : blobraw[b]) { u32 n = raw2norm[r]; if (!normtriv[n] && normlen[n] >= SIGLEN) s.push_back(n); }
        sort(s.begin(), s.end()); s.erase(unique(s.begin(), s.end()), s.end()); }
    fprintf(stderr, "raw lines %zu, norm lines %u (%.1fs)\n", rawtxt.size(), NN, omp_get_wtime() - t0);

    // virtual origin sets: norm in nullDCe's first frame, norm in any nullDC frame
    int L_nullDC = laneid.count("nullDC") ? laneid["nullDC"] : -1, L_nullDCe = laneid.count("nullDCe") ? laneid["nullDCe"] : -1;
    vector<u8> virtbits(NN, 0);
    if (L_nullDC >= 0 && L_nullDCe >= 0 && !LN[L_nullDCe].frames.empty()) {
        for (int b : FR[LN[L_nullDCe].frames[0]].blob) for (u32 r : blobraw[b]) virtbits[raw2norm[r]] |= 1;
        for (int g : LN[L_nullDC].frames) for (int b : FR[g].blob) for (u32 r : blobraw[b]) virtbits[raw2norm[r]] |= 2; }
    auto is_virtlane = [&](int lane) { return lane == L_nullDC || lane == L_nullDCe; };

    // ---- the incremental pass ----
    vector<vector<LFile>> state(NL);                    // current files per lane
    vector<vector<FT>> ftab(NF);                        // file table per frame (history, for forks)
    vector<unordered_map<u32, pair<u16,u16>>> firstorg(NL);   // per lane: norm -> (first frame gi, origin there)
    vector<unordered_map<u32, int>> cnt(NL);            // per lane: norm -> multiplicity in the current state
    vector<unordered_map<u32, vector<pair<u16,u16>>>> ivl(NL);   // per lane: norm -> presence intervals [k0, k1) (lane-local)
    unordered_map<u64, u16> idorg; idorg.reserve(1 << 24);        // (identity << 32 | norm) -> min origin
    vector<int> identfrom; vector<int> identlane0;
    vector<FrameRec> rec(NF);
    vector<int> sincekey(NL, 1 << 20); vector<u64> insSinceKey(NL, 0);
    auto newident = [&](int from, int lane) { identfrom.push_back(from); identlane0.push_back(lane); return (int)identfrom.size() - 1; };
    // related lane state indexes, rebuilt when the lane changed
    vector<int> invAt(NL, -2); vector<Inv> inv(NL); vector<vector<int>> invBlobs(NL);
    vector<int> laneVersion(NL, 0);
    auto ensure_inv = [&](int lane) { if (invAt[lane] == laneVersion[lane]) return; invBlobs[lane].clear();
        for (auto& f : state[lane]) invBlobs[lane].push_back(f.blob); build_inv(inv[lane], invBlobs[lane]); invAt[lane] = laneVersion[lane]; };
    // per related file: sorted (norm, min origin), cached by (lane, slot version)
    auto file_org = [&](const LFile& f) { vector<pair<u32,u16>> v; v.reserve(f.ln.size());
        for (auto& x : f.ln) { u32 n = raw2norm[x.raw]; if (!normtriv[n]) v.push_back({n, x.org}); }
        sort(v.begin(), v.end()); v.erase(unique(v.begin(), v.end(), [](auto& a, auto& b) { return a.first == b.first; }), v.end()); return v; };

    for (int g = 0; g < NF; g++) {
        auto& F = FR[g]; if (F.virt) continue;
        double ts = omp_get_wtime(); int L = F.lane; auto& Ls = LN[L]; int k = F.k; FrameRec& R = rec[g];
        bool first = (k == 0);
        // previous state: own lane, or for a lane's first frame the code parent's file table at the fork frame
        vector<LFile>& cur = state[L];
        vector<FT> base_tab; int base_kind = 0;   // 1 = own previous frame, 2 = fork parent table
        if (!first) { for (auto& f : cur) base_tab.push_back({f.path, f.blob, f.ident}); base_kind = 1; }
        else for (auto& e : Ls.parents) if (e.kind == "code" && e.frame >= 0) { base_tab = ftab[e.frame]; base_kind = 2; break; }
        int nf = F.files.size();
        vector<int> match(nf, -1); vector<string> status(nf, "new"); vector<int> ident(nf, -1), from(nf, -1);
        vector<char> btaken(base_tab.size(), 0);
        unordered_map<string, int> bpath; for (int i = 0; i < (int)base_tab.size(); i++) bpath[base_tab[i].path] = i;
        // 1. same path
        for (int i = 0; i < nf; i++) { auto it = bpath.find(F.files[i].first); if (it == bpath.end()) continue;
            int j = it->second; match[i] = j; btaken[j] = 1; ident[i] = base_tab[j].ident; status[i] = base_tab[j].blob == F.blob[i] ? "same" : "edit"; }
        // 2. moves: same blob or content overlap with an unmatched base file; 3. copies of a matched base file
        { struct C { double score; int i, j; bool copy; double sim; }; vector<C> cs; mutex mu;
          Inv biv; vector<int> bb; for (auto& t : base_tab) bb.push_back(t.blob); build_inv(biv, bb);
          unordered_map<int, vector<int>> bysha; for (int j = 0; j < (int)base_tab.size(); j++) bysha[base_tab[j].blob].push_back(j);
          #pragma omp parallel for schedule(dynamic, 4)
          for (int i = 0; i < nf; i++) { if (match[i] >= 0) continue; vector<C> mine; const string& p = F.files[i].first; int b = F.blob[i];
              auto it = bysha.find(b);
              if (it != bysha.end() && blobraw[b].size() >= 3) for (int j : it->second) mine.push_back({9 + pathsim(p, base_tab[j].path), i, j, (bool)btaken[j], 1.0});
              unordered_map<int,int> c; for (u32 n : blobsig[b]) { auto kt = biv.m.find(n); if (kt != biv.m.end()) for (int j : kt->second) c[j]++; }
              for (auto& kv : c) { int j = kv.first; auto& gb = blobsig[base_tab[j].blob]; double cf = (double)kv.second / max<size_t>(1, blobsig[b].size()), cg = (double)kv.second / max<size_t>(1, gb.size());
                  bool sameb = lower(base(base_tab[j].path)) == lower(base(p));
                  bool ok = (cf >= 0.5 && cg >= 0.2) || (cg >= 0.5 && cf >= 0.2) || (sameb && max(cf, cg) >= 0.25);
                  if (btaken[j]) ok = ok && cf >= 0.5;   // a copy of a file that is still there must be mostly that file
                  if (ok && kv.second >= 3) mine.push_back({(cf + cg) / 2 + 0.3 * pathsim(p, base_tab[j].path) + (sameb ? 0.2 : 0), i, j, (bool)btaken[j], 2.0 * kv.second / (blobsig[b].size() + gb.size())}); }
              lock_guard<mutex> lk(mu); cs.insert(cs.end(), mine.begin(), mine.end()); }
          sort(cs.begin(), cs.end(), [](const C& a, const C& b) { return a.score != b.score ? a.score > b.score : (a.i != b.i ? a.i < b.i : a.j < b.j); });
          for (auto& c : cs) { if (match[c.i] >= 0 || ident[c.i] >= 0) continue;
              if (!c.copy && !btaken[c.j]) { btaken[c.j] = 1; match[c.i] = c.j; ident[c.i] = base_tab[c.j].ident; status[c.i] = base_tab[c.j].blob == F.blob[c.i] ? "move" : "move+edit"; }
              else { match[c.i] = c.j; from[c.i] = base_tab[c.j].ident; status[c.i] = "copy"; ident[c.i] = -2; } } }
        // 4. still new: related / copy lanes' current files (cross-lane identity: a file brought over from another lane)
        { vector<int> rl; for (auto& e : Ls.parents) if ((e.kind == "related" || e.kind == "copy") && !LN[e.lane].frames.empty() && LN[e.lane].frames[0] < g) rl.push_back(e.lane);
          for (int r : rl) ensure_inv(r);
          for (int i = 0; i < nf; i++) { if (ident[i] != -1) continue; int b = F.blob[i]; double best = 0; int bl = -1, bj = -1;
              for (int r : rl) { auto& st = state[r];
                  for (int j = 0; j < (int)st.size(); j++) if (st[j].path == F.files[i].first) { double c = st[j].blob == b ? 1.0 : (double)shared_sig(blobsig[b], blobsig[st[j].blob]) / max<size_t>(1, max(blobsig[b].size(), blobsig[st[j].blob].size()));
                      if (c >= 0.3 && 10 + c > best) { best = 10 + c; bl = r; bj = j; } }
                  unordered_map<int,int> c; for (u32 n : blobsig[b]) { auto kt = inv[r].m.find(n); if (kt != inv[r].m.end()) for (int j : kt->second) c[j]++; }
                  for (auto& kv : c) { auto& gb = blobsig[st[kv.first].blob]; double cf = (double)kv.second / max<size_t>(1, blobsig[b].size()), cg = (double)kv.second / max<size_t>(1, gb.size());
                      bool sameb = lower(base(st[kv.first].path)) == lower(base(F.files[i].first));
                      bool ok = (cf >= 0.5 && cg >= 0.2) || (cg >= 0.5 && cf >= 0.2) || (sameb && max(cf, cg) >= 0.25);
                      double sc = (cf + cg) / 2 + 0.3 * pathsim(F.files[i].first, st[kv.first].path) + (sameb ? 0.2 : 0);
                      if (ok && kv.second >= 3 && sc > best) { best = sc; bl = r; bj = kv.first; } } }
              if (bl >= 0) { from[i] = state[bl][bj].ident; status[i] = "import"; ident[i] = -3; } } }
        // identities: unique per lane state; imports share the source identity unless this lane already holds it
        { unordered_set<int> used; for (int i = 0; i < nf; i++) if (ident[i] >= 0) { if (!used.insert(ident[i]).second) { from[i] = ident[i]; ident[i] = -2; status[i] = "copy"; } }
          for (int i = 0; i < nf; i++) { if (ident[i] == -3) { if (used.insert(from[i]).second) ident[i] = from[i]; else ident[i] = -2; }
              if (ident[i] == -2) { ident[i] = newident(from[i], L); if (status[i] == "import") status[i] = "copy"; }
              else if (ident[i] == -1) { ident[i] = newident(-1, L); from[i] = -1; status[i] = "new"; } } }
        // old instances of matched own-lane files (base_kind 1): diff against them; fork parents: fresh instances
        unordered_map<int, int> curByIdent; for (int j = 0; j < (int)cur.size(); j++) curByIdent[cur[j].ident] = j;
        vector<LFile> nst(nf); vector<Op> fops(nf); vector<vector<int>> newpos(nf);   // indices into nst[i].ln that are new
        #pragma omp parallel for schedule(dynamic, 2)
        for (int i = 0; i < nf; i++) { auto& nfile = nst[i]; nfile.path = F.files[i].first; nfile.blob = F.blob[i]; nfile.ident = ident[i];
            const auto& rawv = blobraw[F.blob[i]]; Op& op = fops[i]; op.ident = ident[i]; op.path = nfile.path; op.status = status[i]; op.from = from[i]; op.n = rawv.size();
            const LFile* old = nullptr;
            if (base_kind == 1 && match[i] >= 0 && status[i] != "copy") { auto it = curByIdent.find(base_tab[match[i]].ident); if (it != curByIdent.end()) old = &cur[it->second]; }
            const vector<u32>* oldraw = nullptr;
            if (old) oldraw = &blobraw[old->blob]; else if (match[i] >= 0) oldraw = &blobraw[base_tab[match[i]].blob];
            vector<pair<u8,int>> sc;
            if (oldraw) myers(oldraw->data(), oldraw->size(), rawv.data(), rawv.size(), sc); else sc.push_back({2, (int)rawv.size()});
            if (rawv.empty()) sc.clear();
            int x = 0, y = 0;
            for (auto& s : sc) { if (s.first == 0) { op.kept += s.second;
                    for (int q = 0; q < s.second; q++) { if (old) nfile.ln.push_back(old->ln[x + q]); else { nfile.ln.push_back({rawv[y + q], 0}); newpos[i].push_back(nfile.ln.size() - 1); } }
                    x += s.second; y += s.second; }
                else if (s.first == 1) { op.removed += s.second; x += s.second; }
                else { op.added += s.second; for (int q = 0; q < s.second; q++) { nfile.ln.push_back({rawv[y + q], 0}); newpos[i].push_back(nfile.ln.size() - 1); } y += s.second; } }
            if (old) for (auto& s : sc) op.script.push_back((u32)s.first << 30 | (u32)s.second);
            op.kind = old ? 'E' : 'A';
        }
        // origins of the new instances
        vector<int> rl; for (auto& e : Ls.parents) if ((e.kind == "related" || e.kind == "copy") && !LN[e.lane].frames.empty() && LN[e.lane].frames[0] < g) rl.push_back(e.lane);
        for (int r : rl) ensure_inv(r);
        #pragma omp parallel for schedule(dynamic, 2)
        for (int i = 0; i < nf; i++) { auto& nfile = nst[i]; if (newpos[i].empty() && !nfile.ln.empty()) { nfile.dom = 0; }
            vector<int> ids; for (int id = nfile.ident, d = 0; id >= 0 && d < 8; id = identfrom[id], d++) ids.push_back(id);
            if (from[i] >= 0 && find(ids.begin(), ids.end(), from[i]) == ids.end()) for (int id = from[i], d = 0; id >= 0 && d < 8; id = identfrom[id], d++) ids.push_back(id);
            vector<vector<pair<u32,u16>>> relorg;
            if (!rl.empty() && !newpos[i].empty()) { auto& sg = blobsig[nfile.blob];
                for (int r : rl) { unordered_map<int,int> c; for (u32 n : sg) { auto kt = inv[r].m.find(n); if (kt != inv[r].m.end()) for (int j : kt->second) c[j]++; }
                    for (auto& kv : c) if (kv.second >= MINSHARE) relorg.push_back(file_org(state[r][kv.first])); } }
            for (int p : newpos[i]) { auto& in = nfile.ln[p]; u32 n = raw2norm[in.raw]; if (normtriv[n]) { in.org = TRIV; continue; }
                int o = g;
                for (auto& a : Ls.anc) { auto it = firstorg[a.first].find(n); if (it != firstorg[a.first].end() && it->second.first <= a.second) o = min(o, (int)it->second.second); }
                for (int id : ids) { auto it = idorg.find(((u64)id << 32) | n); if (it != idorg.end()) o = min(o, (int)it->second); }
                for (auto& v : relorg) { auto it = lower_bound(v.begin(), v.end(), make_pair(n, (u16)0)); if (it != v.end() && it->first == n) o = min(o, (int)it->second); }
                if (o != VIRTF && VIRTF >= 0 && virtbits[n] == 3 && is_virtlane(FR[o].lane)) o = VIRTF;
                in.org = o; }
            // dominant origin over non-trivial lines; trivial new lines take it
            map<int,int> h; for (auto& in : nfile.ln) if (in.org != TRIV) h[in.org]++;
            int dom = g, best = -1; for (auto& kv : h) if (kv.second > best) { best = kv.second; dom = kv.first; }
            nfile.dom = dom; for (int p : newpos[i]) if (nfile.ln[p].org == TRIV) nfile.ln[p].org = TRIV;   // keep the marker
            fops[i].dom = dom;
        }
        // identity origins, first-seen, presence counts
        for (int i = 0; i < nf; i++) for (int p : newpos[i]) { auto& in = nst[i].ln[p]; if (in.org == TRIV) continue; u32 n = raw2norm[in.raw];
            u64 key = ((u64)nst[i].ident << 32) | n; auto it = idorg.find(key); if (it == idorg.end()) idorg.emplace(key, in.org); else if (in.org < it->second) it->second = in.org; }
        // presence: multiset of non-trivial norms per lane state (old state minus removed plus inserted = recount changed files)
        { unordered_map<u32,int> delta;
          unordered_set<int> keptOld;   // own-lane files whose instances carried over unchanged (same blob)
          for (int i = 0; i < nf; i++) { if (fops[i].kind == 'E' && fops[i].added == 0 && fops[i].removed == 0) continue;
              for (auto& in : nst[i].ln) if (in.org != TRIV) delta[raw2norm[in.raw]]++; }
          for (int i = 0; i < nf; i++) if (fops[i].kind == 'E' && fops[i].added == 0 && fops[i].removed == 0) { auto it = curByIdent.find(nst[i].ident); if (it != curByIdent.end()) keptOld.insert(it->second); }
          for (int j = 0; j < (int)cur.size(); j++) if (!keptOld.count(j)) for (auto& in : cur[j].ln) if (in.org != TRIV) delta[raw2norm[in.raw]]--;
          for (auto& kv : delta) { if (!kv.second) continue; int& c = cnt[L][kv.first]; int before = c; c += kv.second;
              if (before == 0 && c > 0) ivl[L][kv.first].push_back({(u16)k, (u16)0xFFFF});
              else if (before > 0 && c == 0) ivl[L][kv.first].back().second = k;
              if (c == 0) cnt[L].erase(kv.first); } }
        for (int i = 0; i < nf; i++) for (int p : newpos[i]) { auto& in = nst[i].ln[p]; if (in.org == TRIV) continue; u32 n = raw2norm[in.raw];
            firstorg[L].emplace(n, make_pair((u16)g, in.org)); }
        // deletes (own-lane files that did not survive)
        unordered_set<int> survivors; for (int i = 0; i < nf; i++) if (fops[i].kind == 'E') survivors.insert(nst[i].ident);
        vector<Op> dels; if (base_kind == 1) for (auto& f : cur) if (!survivors.count(f.ident)) { Op d; d.kind = 'D'; d.ident = f.ident; d.path = f.path; d.n = f.ln.size(); d.removed = f.ln.size(); dels.push_back(d); }
        // keyframe decision
        u64 ins = 0, tot = 0; for (int i = 0; i < nf; i++) { ins += newpos[i].size(); tot += nst[i].ln.size(); }
        bool key = first || sincekey[L] >= KEYMAX || (double)(insSinceKey[L] + ins) > KEYFRAC * max<u64>(1, tot);
        R.key = key; R.files = nf; R.lines = tot;
        for (int i = 0; i < nf; i++) { R.kept += fops[i].kept; R.added += fops[i].added; R.removed += fops[i].removed; }
        for (auto& d : dels) R.removed += d.removed;
        if (key) { sincekey[L] = 0; insSinceKey[L] = 0; } else { sincekey[L]++; insSinceKey[L] += ins; }
        for (int i = 0; i < nf; i++) { Op& op = fops[i];
            if (key) { op.kind = 'K'; op.script.clear(); op.ins = nst[i].ln; }
            else if (op.kind == 'A') op.ins = nst[i].ln;
            else { // edit: carry only inserted instances; an untouched file (same blob, same path) is dropped from the delta
                if (op.status == "same") { op.kind = 0; continue; }
                for (int p : newpos[i]) op.ins.push_back(nst[i].ln[p]); } }
        for (auto& op : fops) if (op.kind) R.ops.push_back(move(op));
        if (!key) for (auto& d : dels) R.ops.push_back(move(d));
        // stats: lines by origin lane and origin year
        R.by_lane.assign(NL + 1, 0);
        for (auto& f : nst) for (auto& in : f.ln) { if (in.org == TRIV) continue; int ol = in.org == VIRTF ? NL : FR[in.org].lane; R.by_lane[ol]++; R.by_year[stoi(FR[in.org].date.substr(0, 4))]++; }
        // commit the new state
        ftab[g].resize(nf); for (int i = 0; i < nf; i++) ftab[g][i] = {nst[i].path, nst[i].blob, nst[i].ident};
        cur = move(nst); laneVersion[L]++;
        double dt = omp_get_wtime() - ts;
        if (dt > 0.5 || key) fprintf(stderr, "  %3d %-10s %-16s k%-3d %4d files %7llu lines +%-6d -%-6d %s %.2fs\n", g, F.date.c_str(), Ls.name.c_str(), k, nf,
                                      (unsigned long long)tot, R.added, R.removed, key ? "KEY" : "   ", dt);
    }
    for (int L = 0; L < NL; L++) for (auto& kv : ivl[L]) if (!kv.second.empty() && kv.second.back().second == 0xFFFF) kv.second.back().second = LN[L].frames.size();
    fprintf(stderr, "pass done (%.1fs), identities %zu, idorg %zu\n", omp_get_wtime() - t0, identfrom.size(), idorg.size());

    // ---- keep and possible ----
    // frames of lane A after gi o: lane-local index of the first frame with gi > o
    auto firstAfter = [&](int A, int o) { auto& v = LN[A].frames; return (int)(upper_bound(v.begin(), v.end(), o) - v.begin()); };
    auto Dmask = [&](int o, int holder) { u64 m = LN[holder].desc; if (o == VIRTF) m |= LN[L_nullDC].desc | LN[L_nullDCe].desc; else m |= LN[FR[o].lane].desc; return m; };
    vector<vector<u16>> possible(NF, vector<u16>(NL, 0));
    for (int o = 0; o < NF; o++) for (int h = 0; h < NL; h++) { u64 m = Dmask(o, h); int c = 0; for (int A = 0; A < NL; A++) if ((m >> A) & 1) c += LN[A].frames.size() - firstAfter(A, o); possible[o][h] = c; }
    vector<vector<int>> fa(NL, vector<int>(NF)); for (int A = 0; A < NL; A++) for (int o = 0; o < NF; o++) fa[A][o] = firstAfter(A, o);
    auto keepOf = [&](u32 n, int o, int holder) -> u16 { u64 m = Dmask(o, holder); int c = 0;
        for (int A = 0; A < NL; A++) if ((m >> A) & 1) { auto it = ivl[A].find(n); if (it == ivl[A].end()) continue; int k0 = fa[A][o];
            for (auto& iv : it->second) { int s = max<int>(iv.first, k0), e = iv.second; if (e > s) c += e - s; } }
        return (u16)min(c, 0xFFFE); };
    // ---- outputs ----
    mkdir(out.c_str(), 0755); mkdir((out + "/text").c_str(), 0755); mkdir((out + "/lanes").c_str(), 0755);
    const size_t CH = 65536; size_t nch = (rawtxt.size() + CH - 1) / CH;
    #pragma omp parallel for schedule(dynamic, 1)
    for (size_t c = 0; c < nch; c++) { string t; for (size_t i = c * CH; i < min(rawtxt.size(), (c + 1) * CH); i++) { t.append(rawtxt[i]); t += '\n'; }
        char nm[64]; snprintf(nm, 64, "/text/lines-%03zu.txt.gz", c); wgz(out + nm, t.data(), t.size()); }
    // first frame in which each raw line appears (lets the viewer fetch only the text chunks it needs)
    // lane chunks: a keyframe plus the delta frames up to the next keyframe
    struct ChunkInfo { int lane, c, f0, f1; size_t bytes; };
    vector<ChunkInfo> chunks; vector<int> chunkOf(NF, -1); vector<int> keepMax(1, 0); u64 keepOver = 0;
    for (int L = 0; L < NL; L++) { auto& fr = LN[L].frames; int c = -1;
        for (size_t q = 0; q < fr.size(); q++) { if (rec[fr[q]].key) { c++; chunks.push_back({L, c, (int)q, (int)q, 0}); } chunks.back().f1 = q; chunkOf[fr[q]] = c; } }
    mkdir((out + "/lanes").c_str(), 0755);
    for (int L = 0; L < NL; L++) mkdir((out + "/lanes/" + LN[L].name).c_str(), 0755);
    #pragma omp parallel for schedule(dynamic, 1) reduction(+:keepOver)
    for (size_t ci = 0; ci < chunks.size(); ci++) { auto& C = chunks[ci]; auto& fr = LN[C.lane].frames;
        string j = "{\"lane\":"; jstr(j, LN[C.lane].name); j += ",\"chunk\":" + to_string(C.c) + ",\"frames\":["; string bin;
        for (int q = C.f0; q <= C.f1; q++) { int g = fr[q]; auto& R = rec[g];
            vector<u32> words, raws; vector<u16> orgs, keeps;
            string fj; bool firstop = true;
            for (auto& op : R.ops) {
                if (!firstop) fj += ','; firstop = false;
                fj += "[\""; fj += op.kind; fj += "\"," + to_string(op.ident) + ','; jstr(fj, op.path);
                fj += ',' + to_string(op.n);
                if (op.kind != 'D') { fj += ','; jstr(fj, op.status); fj += ',' + to_string(op.dom) + ',' + to_string(op.kept) + ',' + to_string(op.added) + ',' + to_string(op.removed);
                    fj += ',' + to_string(op.from) + ',' + to_string(op.script.size()) + ',' + to_string(op.ins.size()); }
                fj += ']';
                words.insert(words.end(), op.script.begin(), op.script.end());
                for (auto& in : op.ins) { raws.push_back(in.raw); u32 n = raw2norm[in.raw];
                    if (in.org == TRIV) { orgs.push_back(0); keeps.push_back(TRIV); }   // trivial: the viewer uses the op's dom
                    else { orgs.push_back(in.org); u16 kp = keepOf(n, in.org, C.lane); if (kp > possible[in.org][C.lane]) keepOver++; keeps.push_back(kp); } }
            }
            size_t off = bin.size();
            bin.append((const char*)words.data(), words.size() * 4); bin.append((const char*)raws.data(), raws.size() * 4);
            bin.append((const char*)orgs.data(), orgs.size() * 2); bin.append((const char*)keeps.data(), keeps.size() * 2);
            if (q > C.f0) j += ',';
            j += "{\"f\":" + to_string(g) + ",\"key\":" + (R.key ? string("true") : string("false")) + ",\"off\":" + to_string(off) + ",\"nw\":" + to_string(words.size()) + ",\"nl\":" + to_string(raws.size()) + ",\"ops\":[" + fj + "]}";
        }
        j += "]}";
        char nm[256]; snprintf(nm, sizeof nm, "/lanes/%s/c%03d", LN[C.lane].name.c_str(), C.c);
        wgz(out + nm + string(".json.gz"), j.data(), j.size()); wgz(out + nm + string(".bin.gz"), bin.data(), bin.size());
        struct stat st; size_t b = 0; if (!stat((out + nm + string(".json.gz")).c_str(), &st)) b += st.st_size; if (!stat((out + nm + string(".bin.gz")).c_str(), &st)) b += st.st_size; C.bytes = b;
    }
    if (keepOver) { fprintf(stderr, "error: %llu keep values exceed possible\n", (unsigned long long)keepOver); return 1; }
    // identities
    { vector<map<int, pair<int,int>>> span(identfrom.size());   // ident -> lane -> (first gi, last gi)
      vector<string> lastpath(identfrom.size());
      for (int g = 0; g < NF; g++) for (auto& t : ftab[g]) { auto& m = span[t.ident]; int L = FR[g].lane; auto it = m.find(L); if (it == m.end()) m[L] = {g, g}; else it->second.second = g; lastpath[t.ident] = t.path; }
      string j = "["; for (size_t id = 0; id < identfrom.size(); id++) { if (id) j += ','; j += "{\"from\":" + to_string(identfrom[id]) + ",\"lane\":" + to_string(identlane0[id]) + ",\"p\":"; jstr(j, lastpath[id]); j += ",\"v\":[";
          bool f1 = true; for (auto& kv : span[id]) { if (!f1) j += ','; f1 = false; j += '[' + to_string(kv.first) + ',' + to_string(kv.second.first) + ',' + to_string(kv.second.second) + ']'; } j += "]}"; }
      j += "]"; wgz(out + "/identities.json.gz", j.data(), j.size()); }
    // index core (tools/frames_manifest.py merges it with agents/frames/frames.json into data/frames.json)
    { string j = "{\"format\":2,\"chunk_lines\":" + to_string(CH) + ",\"raw_lines\":" + to_string(rawtxt.size()) + ",\"norm_lines\":" + to_string(NN) +
        ",\"text_chunks\":" + to_string(nch) + ",\"identities\":" + to_string(identfrom.size()) + ",\"virt\":" + to_string(VIRTF) + ",\"lanes\":[";
      for (int L = 0; L < NL; L++) { if (L) j += ','; j += "{\"name\":"; jstr(j, LN[L].name); j += ",\"desc\":["; bool f1 = true; for (int A = 0; A < NL; A++) if ((LN[L].desc >> A) & 1) { if (!f1) j += ','; f1 = false; j += to_string(A); }
          j += "],\"anc\":["; for (size_t q = 0; q < LN[L].anc.size(); q++) { if (q) j += ','; j += "[" + to_string(LN[L].anc[q].first) + "," + to_string(LN[L].anc[q].second > NF ? -1 : LN[L].anc[q].second) + "]"; }
          j += "],\"chunks\":["; f1 = true; for (auto& C : chunks) if (C.lane == L) { if (!f1) j += ','; f1 = false; j += "[" + to_string(LN[L].frames[C.f0]) + "," + to_string(LN[L].frames[C.f1]) + "," + to_string(C.bytes) + "]"; }
          j += "]}"; }
      j += "],\"frames\":[";
      for (int g = 0; g < NF; g++) { auto& R = rec[g]; if (g) j += ',';
          j += "{\"i\":" + to_string(g) + ",\"key\":" + (R.key ? string("true") : string("false")) + ",\"chunk\":" + to_string(chunkOf[g]) + ",\"files\":" + to_string(R.files) + ",\"lines\":" + to_string(R.lines);
          j += ",\"d\":[" + to_string(R.kept) + "," + to_string(R.added) + "," + to_string(R.removed) + "]";
          if (!R.by_lane.empty()) { j += ",\"by_lane\":{"; bool f1 = true; for (int A = 0; A <= NL; A++) if (R.by_lane[A]) { if (!f1) j += ','; f1 = false; j += '"'; j += A == NL ? string("nullDC-pre2008") : LN[A].name; j += "\":" + to_string(R.by_lane[A]); }
              j += "},\"by_year\":{"; f1 = true; for (auto& kv : R.by_year) { if (!f1) j += ','; f1 = false; j += "\"" + to_string(kv.first) + "\":" + to_string(kv.second); } j += "}"; }
          j += "}"; }
      j += "],\"possible\":["; for (int o = 0; o < NF; o++) { if (o) j += ','; j += '['; for (int h = 0; h < NL; h++) { if (h) j += ','; j += to_string(possible[o][h]); } j += ']'; }
      j += "]}"; wfile(out + "/frames.core.json", j); }
    fprintf(stderr, "done in %.1fs: %zu chunks\n", omp_get_wtime() - t0, chunks.size());
}
