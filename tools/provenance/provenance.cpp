// provenance: line origins, file identities and snapshot diffs for the nullDC lineage viewer.
//
// Inputs (tools/prov_prep.py writes them): WORK/snapshots.tsv, WORK/files.tsv; blobs are read from
// REPOS/<repo>.git with `git cat-file --batch`. Outputs go to OUT/ (see agents/provenance/REPORT.md for the format).
//
//   provenance WORK REPOS OUT
//
// Definitions
//   raw line   : bytes up to '\n', trailing '\r' removed (text shown by the viewer)
//   norm line  : raw line with whitespace runs collapsed to one space and trimmed (used for matching)
//   trivial    : norm line that is empty or only brackets / punctuation / comment delimiters; trivial lines get
//                their file's dominant origin and keep = 255
//   origin     : earliest snapshot (order_date order) where the norm line appears
//                (a) in any file of an earlier snapshot of the same repo or of a code-ancestor (fork) up to the
//                    fork point (anc mask), or
//                (b) in an earlier file with the same file identity (any repo), or
//                (c) in a file of a RELATED parent snapshot that shares >= MINSHARE significant lines with it.
//                The origin of a matched occurrence is inherited, so the answer is transitive.
//                Virtual origin VIRT = "nullDC up to the 2008 fork": a line whose origin is nullDCe-2009 or a nullDC
//                snapshot and that is present both in nullDCe-2009 and in some nullDC snapshot.
//   keep       : number of snapshots after the origin holding the line, in repos descending from the origin's repo or
//                from the repo of the snapshot being described
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
#include <array>
#include <set>
#include <algorithm>
#include <thread>
#include <mutex>
#include <atomic>
#include <memory>
#include <omp.h>
#include <zlib.h>
#include <sys/stat.h>

using namespace std;
typedef uint64_t u64; typedef uint32_t u32; typedef uint8_t u8;

static const int MINSHARE = 5;      // significant lines shared with a related-parent file to count it
static const int SIGLEN = 10;       // min norm length of a "significant" line (identity / related matching)
static const int DFMAX = 40;        // skip lines present in more files than this when matching files
static const u8 VIRT = 40;          // output origin id of the virtual nullDC <=2008 origin

struct Snap { int idx; string id, repo, lane, odate, date; u64 anc, rel, desc; vector<int> parents; };
struct File {
    int snap; string path; string sha; int blob = -1;
    vector<u32> raw;         // raw line ids
    vector<u32> sig;         // sorted distinct significant norm ids
    vector<pair<u32,u8>> org;// sorted (norm id, origin code) for non-trivial lines (for related lookups)
    vector<u8> origin, keep; // per line, output ids
    int ident = -1, from = -1;   // identity id; identity this one was copied from
    int pred_snap = -1, pred_file = -1; string status = "new"; double sim = 0;
    int kept = 0, added = 0, removed = 0;   // vs predecessor, norm multiset (non-blank)
    u8 dom = 0;
};

static vector<Snap> S;
static vector<vector<File>> F;   // per snapshot
static vector<string> blobs;     // contents
static vector<string_view> rawtxt; static vector<u32> raw2norm;
static vector<string_view> normtxt; static vector<u8> normtriv; static vector<u64> presence;
static vector<string> normstore;
static int NS;

static vector<string> split(const string& s, char c) { vector<string> o; size_t a = 0; for (;;) { size_t b = s.find(c, a); o.push_back(s.substr(a, b == string::npos ? string::npos : b - a)); if (b == string::npos) break; a = b + 1; } return o; }

static void die(const char* m) { fprintf(stderr, "error: %s\n", m); exit(1); }

// ---- blob reading: one `git cat-file --batch` per repo, repos in parallel ----
static void read_blobs(const string& repos) {
    unordered_map<string, int> shaid; map<string, vector<string>> perrepo;
    for (auto& fs : F) for (auto& f : fs) {
        auto it = shaid.find(f.sha);
        if (it == shaid.end()) { int id = shaid.size(); shaid[f.sha] = id; perrepo[S[f.snap].repo].push_back(f.sha); f.blob = id; }
        else f.blob = it->second;
    }
    blobs.resize(shaid.size());
    vector<thread> th; mutex mu;
    for (auto& kv : perrepo) th.emplace_back([&, repo = kv.first, shas = kv.second]() {
        char tmpl[] = "/tmp/provshaXXXXXX"; int fd = mkstemp(tmpl); FILE* t = fdopen(fd, "w");
        for (auto& s : shas) fprintf(t, "%s\n", s.c_str()); fclose(t);
        string cmd = "git -C '" + repos + "/" + repo + ".git' cat-file --batch < " + tmpl;
        FILE* p = popen(cmd.c_str(), "r"); if (!p) die("popen");
        char hdr[512];
        for (auto& s : shas) {
            if (!fgets(hdr, sizeof hdr, p)) die("cat-file short");
            char sha[64], type[16]; long n; if (sscanf(hdr, "%63s %15s %ld", sha, type, &n) != 3) die(hdr);
            string data(n, '\0'); if ((long)fread(&data[0], 1, n, p) != n) die("fread"); fgetc(p);
            int id; { lock_guard<mutex> g(mu); id = shaid[s]; }
            blobs[id] = move(data);
        }
        pclose(p); unlink(tmpl);
    });
    for (auto& t : th) t.join();
}

static bool line_trivial(string_view n) {
    if (n.empty()) return true;
    for (char c : n) if (!strchr("{}()[];,:*/ ", c)) return false;   // brackets, punctuation, comment delimiters
    return true;
}

static string normalize(string_view r) {
    string o; o.reserve(r.size()); bool ws = false;
    for (char c : r) { if (c == ' ' || c == '\t' || c == '\v' || c == '\f' || c == '\r') ws = true; else { if (ws && !o.empty()) o += ' '; ws = false; o += c; } }
    return o;
}

// ---- gzip + json helpers ----
static void wgz(const string& path, const void* d, size_t n) {
    gzFile g = gzopen(path.c_str(), "wb9"); if (!g) die(path.c_str());
    const char* p = (const char*)d; while (n) { unsigned k = n > (1u << 30) ? (1u << 30) : n; gzwrite(g, p, k); p += k; n -= k; } gzclose(g);
}
static void wfile(const string& path, const string& s) { FILE* f = fopen(path.c_str(), "wb"); if (!f) die(path.c_str()); fwrite(s.data(), 1, s.size(), f); fclose(f); }
static void jstr(string& o, string_view s) {
    o += '"';
    for (unsigned char c : s) {
        if (c == '"') o += "\\\""; else if (c == '\\') o += "\\\\"; else if (c == '\n') o += "\\n"; else if (c == '\t') o += "\\t";
        else if (c < 0x20) { char b[8]; snprintf(b, 8, "\\u%04x", c); o += b; } else o += c;
    }
    o += '"';
}

static inline int code_of(int snapidx) { return snapidx * 2 + 2; }       // VIRT code = 3 (between dc4ever 2 and idx1 4)
static int VIRTCODE = 3;
static inline u8 out_of(int code) { return code == VIRTCODE ? VIRT : (u8)(code / 2 - 1); }

int main(int argc, char** argv) {
    if (argc < 4) die("usage: provenance WORK REPOS OUT");
    string work = argv[1], repos = argv[2], out = argv[3];
    double t0 = omp_get_wtime();
    // ---- inputs ----
    { FILE* f = fopen((work + "/snapshots.tsv").c_str(), "r"); if (!f) die("snapshots.tsv"); char b[4096];
      while (fgets(b, sizeof b, f)) { string l(b); if (l.back() == '\n') l.pop_back(); auto c = split(l, '\t');
        Snap s; s.idx = stoi(c[0]); s.id = c[1]; s.repo = c[2]; s.lane = c[3]; s.odate = c[4]; s.date = c[5];
        s.anc = stoull(c[6]); s.rel = stoull(c[7]); if (c[8] != "-") for (auto& p : split(c[8], ',')) s.parents.push_back(stoi(p));
        s.desc = stoull(c[9]); S.push_back(s); } fclose(f); }
    NS = S.size(); F.resize(NS);
    { FILE* f = fopen((work + "/files.tsv").c_str(), "r"); if (!f) die("files.tsv"); static char b[1 << 16];
      while (fgets(b, sizeof b, f)) { string l(b); if (l.back() == '\n') l.pop_back(); auto c = split(l, '\t');
        File x; x.snap = stoi(c[0]); x.sha = c[1]; x.path = c[2]; F[x.snap].push_back(move(x)); } fclose(f); }
    int idx_nullDCe = -1; u64 nulldcmask = 0;
    for (auto& s : S) { if (s.id == "nullDCe-2009") idx_nullDCe = s.idx; if (s.repo == "skmp_nullDC") nulldcmask |= 1ull << s.idx; }
    read_blobs(repos);
    fprintf(stderr, "read %zu blobs in %.1fs\n", blobs.size(), omp_get_wtime() - t0);

    // ---- intern raw + norm lines (snapshot order => text chunks follow time) ----
    unordered_map<string_view, u32> rawid; rawid.reserve(1 << 22);
    unordered_map<string_view, u32> normid; normid.reserve(1 << 22);
    normstore.reserve(1 << 22);
    vector<vector<u32>> blobraw(blobs.size()); vector<char> done(blobs.size(), 0);
    for (int s = 0; s < NS; s++) for (auto& f : F[s]) {
        if (!done[f.blob]) {
            done[f.blob] = 1; const string& d = blobs[f.blob]; size_t a = 0; vector<u32>& v = blobraw[f.blob];
            while (a < d.size()) {
                size_t e = d.find('\n', a); size_t end = e == string::npos ? d.size() : e;
                size_t len = end - a; if (len && d[a + len - 1] == '\r') len--;
                string_view r(d.data() + a, len);
                auto it = rawid.find(r); u32 id;
                if (it == rawid.end()) {
                    id = rawtxt.size(); rawid.emplace(r, id); rawtxt.push_back(r);
                    string n = normalize(r); auto jt = normid.find(n); u32 nid;
                    if (jt == normid.end()) { nid = normtxt.size(); normstore.push_back(move(n)); string_view sv = normstore.back();
                        // normstore may reallocate: keep views valid by reserving; fall back to re-pointing below
                        normid.emplace(sv, nid); normtxt.push_back(sv); normtriv.push_back(line_trivial(sv)); presence.push_back(0); }
                    else nid = jt->second;
                    raw2norm.push_back(nid);
                } else id = it->second;
                v.push_back(id);
                if (e == string::npos) break; a = e + 1;
            }
        }
        f.raw = blobraw[f.blob];
    }
    if (normstore.size() > (1u << 22)) die("normstore reallocated: raise the reserve");
    fprintf(stderr, "raw lines %zu, norm lines %zu (%.1fs)\n", rawtxt.size(), normtxt.size(), omp_get_wtime() - t0);
    for (int s = 0; s < NS; s++) for (auto& f : F[s]) for (u32 r : f.raw) presence[raw2norm[r]] |= 1ull << s;
    // significant distinct norm ids per file
    for (int s = 0; s < NS; s++) {
        #pragma omp parallel for schedule(dynamic, 8)
        for (size_t i = 0; i < F[s].size(); i++) { auto& f = F[s][i];
            for (u32 r : f.raw) { u32 n = raw2norm[r]; if (!normtriv[n] && normtxt[n].size() >= SIGLEN) f.sig.push_back(n); }
            sort(f.sig.begin(), f.sig.end()); f.sig.erase(unique(f.sig.begin(), f.sig.end()), f.sig.end()); }
    }
    // inverted index per snapshot (sig norm -> files), only for lines in <= DFMAX files of that snapshot
    vector<unordered_map<u32, vector<u32>>> inv(NS);
    #pragma omp parallel for schedule(dynamic, 1)
    for (int s = 0; s < NS; s++) { auto& m = inv[s]; for (u32 i = 0; i < F[s].size(); i++) for (u32 n : F[s][i].sig) m[n].push_back(i);
        for (auto it = m.begin(); it != m.end();) { if ((int)it->second.size() > DFMAX) it = m.erase(it); else ++it; } }
    vector<unordered_map<string, u32>> bypath(NS), bysha(NS);
    for (int s = 0; s < NS; s++) for (u32 i = 0; i < F[s].size(); i++) { bypath[s][F[s][i].path] = i; bysha[s].emplace(F[s][i].sha, i); }

    // ---- per snapshot: identities, then origins ----
    int nident = 0; vector<vector<pair<int,int>>> identfiles;   // identity -> (snap, file)
    vector<int> identfrom;
    unordered_map<u64, u8> idorg; idorg.reserve(1 << 23);       // (identity<<32|norm) -> min origin code
    auto base = [](const string& p) { size_t k = p.rfind('/'); return k == string::npos ? p : p.substr(k + 1); };
    auto lower = [](string s) { for (auto& c : s) c = tolower(c); return s; };
    auto pathsim = [&](const string& a, const string& b) {   // shared trailing components / max components
        auto x = split(a, '/'), y = split(b, '/'); int k = 0;
        while (k < (int)x.size() && k < (int)y.size() && lower(x[x.size() - 1 - k]) == lower(y[y.size() - 1 - k])) k++;
        return (double)k / max(x.size(), y.size()); };
    for (int s = 0; s < NS; s++) {
        double ts = omp_get_wtime(); auto& fs = F[s]; int nf = fs.size();
        // candidates: (score, file, parent snap, parent file, status)
        struct Cand { double score; int f, ps, pf; double sim; bool path; };
        vector<vector<Cand>> cands(nf);
        auto isrel = [&](int p) { return (S[s].rel >> p) & 1; };
        #pragma omp parallel for schedule(dynamic, 4)
        for (int i = 0; i < nf; i++) { auto& f = fs[i];
            for (int p : S[s].parents) {
                auto it = bypath[p].find(f.path);
                if (it != bypath[p].end()) { auto& g = F[p][it->second];
                    size_t sh = 0; { size_t a = 0, b = 0; while (a < f.sig.size() && b < g.sig.size()) { if (f.sig[a] == g.sig[b]) { sh++; a++; b++; } else if (f.sig[a] < g.sig[b]) a++; else b++; } }
                    double c = (double)sh / max<size_t>(1, max(f.sig.size(), g.sig.size()));
                    if (f.sha == g.sha) c = 1;
                    if (!isrel(p) || c >= 0.3) cands[i].push_back({10 + c, i, p, (int)it->second, c, true});
                }
                auto jt = bysha[p].find(f.sha);
                if (jt != bysha[p].end() && F[p][jt->second].path != f.path && f.raw.size() >= 3) cands[i].push_back({9 + pathsim(f.path, F[p][jt->second].path), i, p, (int)jt->second, 1.0, false});
                // content overlap
                unordered_map<u32, int> cnt;
                for (u32 n : f.sig) { auto kt = inv[p].find(n); if (kt != inv[p].end()) for (u32 g : kt->second) cnt[g]++; }
                for (auto& kv : cnt) { auto& g = F[p][kv.first]; if (g.path == f.path) continue;
                    double cf = (double)kv.second / max<size_t>(1, f.sig.size()), cg = (double)kv.second / max<size_t>(1, g.sig.size());
                    bool sameb = lower(base(g.path)) == lower(base(f.path));
                    bool ok = (cf >= 0.5 && cg >= 0.2) || (cg >= 0.5 && cf >= 0.2) || (sameb && max(cf, cg) >= 0.25);
                    if (ok && kv.second >= 3) { double sim = 2.0 * kv.second / (f.sig.size() + g.sig.size());
                        cands[i].push_back({(cf + cg) / 2 + 0.3 * pathsim(f.path, g.path) + (sameb ? 0.2 : 0), i, p, (int)kv.first, sim, false}); }
                }
            }
        }
        vector<Cand> all; for (auto& v : cands) for (auto& c : v) all.push_back(c);
        sort(all.begin(), all.end(), [](const Cand& a, const Cand& b) { return a.score > b.score; });
        set<pair<int,int>> taken; vector<char> assigned(nf, 0);
        for (auto& c : all) {
            auto& f = fs[c.f]; if (assigned[c.f]) continue; auto& g = F[c.ps][c.pf];
            assigned[c.f] = 1; f.pred_snap = c.ps; f.pred_file = c.pf; f.sim = c.sim;
            bool same_content = f.sha == g.sha;
            if (taken.insert({c.ps, c.pf}).second) {
                f.ident = g.ident;
                f.status = c.path ? (same_content ? "same" : "edit") : (same_content ? "move" : "move+edit");
            } else { f.ident = nident++; identfiles.emplace_back(); identfrom.push_back(g.ident); f.from = g.ident; f.status = "copy"; }
        }
        // "taken" may still map one parent identity to two children of the same snapshot when parents differ but
        // share an identity (prev + fork parent): the second one becomes a copy.
        unordered_set<int> seen;
        for (int i = 0; i < nf; i++) { auto& f = fs[i];
            if (f.ident < 0) { f.ident = nident++; identfiles.emplace_back(); identfrom.push_back(-1); }
            else if (!seen.insert(f.ident).second) { int g = f.ident; f.ident = nident++; identfiles.emplace_back(); identfrom.push_back(g); f.from = g; f.status = "copy"; }
            identfiles[f.ident].push_back({s, i}); }
        // diff vs predecessor
        #pragma omp parallel for schedule(dynamic, 8)
        for (int i = 0; i < nf; i++) { auto& f = fs[i]; if (f.pred_snap < 0) { f.added = 0; for (u32 r : f.raw) if (!normtxt[raw2norm[r]].empty()) f.added++; continue; }
            auto& g = F[f.pred_snap][f.pred_file]; vector<u32> a, b;
            for (u32 r : g.raw) if (!normtxt[raw2norm[r]].empty()) a.push_back(raw2norm[r]);
            for (u32 r : f.raw) if (!normtxt[raw2norm[r]].empty()) b.push_back(raw2norm[r]);
            sort(a.begin(), a.end()); sort(b.begin(), b.end()); size_t x = 0, y = 0; int k = 0;
            while (x < a.size() && y < b.size()) { if (a[x] == b[y]) { k++; x++; y++; } else if (a[x] < b[y]) x++; else y++; }
            f.kept = k; f.removed = a.size() - k; f.added = b.size() - k; }
        // related files per file (related parents only): files sharing >= MINSHARE significant lines
        // origins
        u64 anc = S[s].anc; int selfcode = code_of(s);
        #pragma omp parallel for schedule(dynamic, 4)
        for (int i = 0; i < nf; i++) { auto& f = fs[i];
            vector<const File*> relf;
            for (int p = 0; p < s; p++) if ((S[s].rel >> p) & 1) {
                unordered_map<u32, int> cnt;
                for (u32 n : f.sig) { auto kt = inv[p].find(n); if (kt != inv[p].end()) for (u32 g : kt->second) cnt[g]++; }
                for (auto& kv : cnt) if (kv.second >= MINSHARE) relf.push_back(&F[p][kv.first]);
            }
            vector<int> ids; for (int id = f.ident, d = 0; id >= 0 && d < 8; id = identfrom[id], d++) ids.push_back(id);
            vector<int> codes(f.raw.size(), -1); map<int,int> hist;
            for (size_t l = 0; l < f.raw.size(); l++) { u32 n = raw2norm[f.raw[l]]; if (normtriv[n]) continue;
                int o = selfcode; u64 m = presence[n] & anc; if (m) o = min(o, code_of(__builtin_ctzll(m)));
                for (int id : ids) { auto it = idorg.find(((u64)id << 32) | n); if (it != idorg.end()) o = min(o, (int)it->second); }
                for (auto* g : relf) { auto it = lower_bound(g->org.begin(), g->org.end(), make_pair(n, (u8)0));
                    if (it != g->org.end() && it->first == n) o = min(o, (int)it->second); }
                if (o != VIRTCODE && idx_nullDCe >= 0 && ((presence[n] >> idx_nullDCe) & 1) && (presence[n] & nulldcmask)) {
                    int oi = o / 2 - 1; if (oi == idx_nullDCe || ((nulldcmask >> oi) & 1)) o = VIRTCODE; }
                codes[l] = o; hist[o]++; }
            int dom = selfcode, best = -1; for (auto& kv : hist) if (kv.second > best) { best = kv.second; dom = kv.first; }
            f.dom = out_of(dom); f.origin.resize(f.raw.size()); f.keep.resize(f.raw.size());
            for (size_t l = 0; l < f.raw.size(); l++) {
                if (codes[l] < 0) { f.origin[l] = f.dom; f.keep[l] = 255; continue; }
                int o = codes[l]; f.origin[l] = out_of(o); u32 n = raw2norm[f.raw[l]];
                u64 later, desc;
                if (o == VIRTCODE) { later = ~1ull; desc = S[idx_nullDCe].desc; for (int t = 0; t < NS; t++) if ((nulldcmask >> t) & 1) desc |= S[t].desc; }
                else { int oi = o / 2 - 1; later = oi >= 63 ? 0 : (~0ull << (oi + 1)); desc = S[oi].desc; }
                desc |= S[s].desc;   // the holder's own repo family too (sibling-attributed origins)
                f.keep[l] = (u8)min(254, __builtin_popcountll(presence[n] & later & desc));
            }
            for (size_t l = 0; l < f.raw.size(); l++) if (codes[l] >= 0) f.org.push_back({raw2norm[f.raw[l]], (u8)codes[l]});
            sort(f.org.begin(), f.org.end());
            f.org.erase(unique(f.org.begin(), f.org.end(), [](auto& a, auto& b) { return a.first == b.first; }), f.org.end());
        }
        for (auto& f : fs) for (auto& pr : f.org) { u64 k = ((u64)f.ident << 32) | pr.first; auto it = idorg.find(k);
            if (it == idorg.end()) idorg.emplace(k, pr.second); else if (pr.second < it->second) it->second = pr.second; }
        fprintf(stderr, "  %2d %-22s %5d files %.2fs\n", s, S[s].id.c_str(), nf, omp_get_wtime() - ts);
    }

    // ---- outputs ----
    mkdir(out.c_str(), 0755); mkdir((out + "/text").c_str(), 0755); mkdir((out + "/snap").c_str(), 0755);
    const size_t CH = 65536; size_t nch = (rawtxt.size() + CH - 1) / CH;
    #pragma omp parallel for schedule(dynamic, 1)
    for (size_t c = 0; c < nch; c++) {
        string t; vector<u64> pr; for (size_t i = c * CH; i < min(rawtxt.size(), (c + 1) * CH); i++) { t.append(rawtxt[i]); t += '\n'; pr.push_back(presence[raw2norm[i]]); }
        char nm[64]; snprintf(nm, 64, "/text/lines-%03zu.txt.gz", c); wgz(out + nm, t.data(), t.size());
        snprintf(nm, 64, "/text/presence-%03zu.bin.gz", c); wgz(out + nm, pr.data(), pr.size() * 8);
    }
    // origin labels
    auto olabel = [&](int o) { return o == VIRT ? string("nullDC-pre2008") : S[o].id; };
    // per snapshot files + dirs
    vector<vector<u64>> lines_by_origin(NS, vector<u64>(41, 0)), lines_by_origin_dom(NS, vector<u64>(41, 0));
    vector<string> stats_foreign(NS);
    #pragma omp parallel for schedule(dynamic, 1)
    for (int s = 0; s < NS; s++) {
        auto& fs = F[s]; vector<u32> ids; vector<u8> og, kp;
        map<string, array<u64, 43>> dirs;   // [0]=files [1]=lines [2..42]=origin hist
        string j = "{\"snap\":" + to_string(s) + ",\"id\":"; jstr(j, S[s].id); j += ",\"files\":[";
        vector<pair<int,int>> foreign;   // (foreign non-trivial lines, file)
        for (size_t i = 0; i < fs.size(); i++) { auto& f = fs[i];
            ids.insert(ids.end(), f.raw.begin(), f.raw.end()); og.insert(og.end(), f.origin.begin(), f.origin.end()); kp.insert(kp.end(), f.keep.begin(), f.keep.end());
            if (i) j += ','; j += "{\"p\":"; jstr(j, f.path);
            j += ",\"id\":" + to_string(f.ident) + ",\"n\":" + to_string(f.raw.size()) + ",\"st\":\"" + f.status + "\",\"o\":" + to_string(f.dom);
            if (f.pred_snap >= 0) { j += ",\"pred\":[" + to_string(f.pred_snap) + "," + to_string(f.pred_file) + "]"; char b[32]; snprintf(b, 32, "%.3f", f.sim); j += ",\"sim\":"; j += b;
                j += ",\"d\":[" + to_string(f.kept) + "," + to_string(f.added) + "," + to_string(f.removed) + "]"; }
            if (f.from >= 0) j += ",\"from\":" + to_string(f.from);
            j += '}';
            int fo = 0; for (size_t l = 0; l < f.raw.size(); l++) { lines_by_origin[s][f.origin[l]]++; if (f.keep[l] != 255 && f.origin[l] != VIRT && S[f.origin[l]].repo != S[s].repo && !(f.origin[l] == VIRT)) fo++;
                if (f.keep[l] != 255 && f.origin[l] == VIRT && S[s].repo != "skmp_nullDC" && S[s].repo != "skmp_nullDCe") fo++; }
            foreign.push_back({fo, (int)i});
            string d = f.path; vector<string> parts; for (;;) { size_t k = d.rfind('/'); if (k == string::npos) { parts.push_back(""); break; } d = d.substr(0, k); parts.push_back(d); }
            for (auto& dp : parts) { auto& a = dirs[dp]; a[0]++; a[1] += f.raw.size(); for (u8 o : f.origin) a[2 + o]++; }
        }
        j += "],\"dirs\":[";
        bool first = true;
        for (auto& kv : dirs) { if (!first) j += ','; first = false; j += '['; jstr(j, kv.first); j += ',' + to_string(kv.second[0]) + ',' + to_string(kv.second[1]) + ",{";
            bool f2 = true; for (int o = 0; o < 41; o++) if (kv.second[2 + o]) { if (!f2) j += ','; f2 = false; j += '"' + to_string(o) + "\":" + to_string(kv.second[2 + o]); }
            j += "}]"; }
        j += "]}";
        char nm[64]; snprintf(nm, 64, "/snap/%02d.json.gz", s); wgz(out + nm, j.data(), j.size());
        string b; b.append((const char*)ids.data(), ids.size() * 4); b.append((const char*)og.data(), og.size()); b.append((const char*)kp.data(), kp.size());
        snprintf(nm, 64, "/snap/%02d.bin.gz", s); wgz(out + nm, b.data(), b.size());
        sort(foreign.rbegin(), foreign.rend()); string fj = "[";
        for (int k = 0, w = 0; k < (int)foreign.size() && w < 25; k++) { if (!foreign[k].first) break; auto& f = fs[foreign[k].second];
            map<int,int> by; for (size_t l = 0; l < f.raw.size(); l++) if (f.keep[l] != 255) by[f.origin[l]]++;
            if (w++) fj += ','; fj += "{\"p\":"; jstr(fj, f.path); fj += ",\"lines\":" + to_string(f.raw.size()) + ",\"foreign\":" + to_string(foreign[k].first) + ",\"by\":{";
            bool f2 = true; for (auto& kv : by) { if (!f2) fj += ','; f2 = false; fj += "\"" + olabel(kv.first) + "\":" + to_string(kv.second); } fj += "}}"; }
        fj += "]"; stats_foreign[s] = fj;
    }
    // identities
    { string j = "["; for (int id = 0; id < nident; id++) { if (id) j += ','; j += "{\"from\":" + to_string(identfrom[id]) + ",\"v\":[";
        bool f1 = true; for (auto& sf : identfiles[id]) { if (!f1) j += ','; f1 = false; j += '[' + to_string(sf.first) + ',' + to_string(sf.second) + ']'; } j += "]}"; }
      j += "]"; wgz(out + "/identities.json.gz", j.data(), j.size()); }
    // snapshot-pair diffs over norm multisets (non-blank lines)
    vector<vector<pair<u32,u32>>> ms(NS);
    #pragma omp parallel for schedule(dynamic, 1)
    for (int s = 0; s < NS; s++) { vector<u32> v; for (auto& f : F[s]) for (u32 r : f.raw) if (!normtxt[raw2norm[r]].empty()) v.push_back(raw2norm[r]);
        sort(v.begin(), v.end()); for (size_t i = 0; i < v.size();) { size_t k = i; while (k < v.size() && v[k] == v[i]) k++; ms[s].push_back({v[i], (u32)(k - i)}); i = k; } }
    vector<u64> tot(NS, 0); for (int s = 0; s < NS; s++) for (auto& p : ms[s]) tot[s] += p.second;
    vector<u64> kept(NS * NS, 0);
    #pragma omp parallel for schedule(dynamic, 1) collapse(2)
    for (int a = 0; a < NS; a++) for (int b = 0; b < NS; b++) { auto& x = ms[a]; auto& y = ms[b]; size_t i = 0, k = 0; u64 c = 0;
        while (i < x.size() && k < y.size()) { if (x[i].first == y[k].first) { c += min(x[i].second, y[k].second); i++; k++; } else if (x[i].first < y[k].first) i++; else k++; }
        kept[a * NS + b] = c; }
    { string j = "{\"note\":\"kept[a][b] = multiset intersection of non-blank whitespace-collapsed lines of snapshot a and b; added = lines[b]-kept, removed = lines[a]-kept\",\"lines\":[";
      for (int s = 0; s < NS; s++) { if (s) j += ','; j += to_string(tot[s]); } j += "],\"kept\":[";
      for (int a = 0; a < NS; a++) { if (a) j += ','; j += '['; for (int b = 0; b < NS; b++) { if (b) j += ','; j += to_string(kept[a * NS + b]); } j += ']'; }
      j += "]}"; wfile(out + "/diffs.json", j); }
    // stats + manifest
    { string j = "{\"origins\":["; for (int o = 0; o < 41; o++) { if (o) j += ','; jstr(j, olabel(o)); } j += "],\"snapshots\":[";
      for (int s = 0; s < NS; s++) { if (s) j += ','; map<string,int> st; for (auto& f : F[s]) st[f.status]++;
        j += "{\"id\":"; jstr(j, S[s].id); j += ",\"lines_by_origin\":{"; bool f1 = true;
        for (int o = 0; o < 41; o++) if (lines_by_origin[s][o]) { if (!f1) j += ','; f1 = false; j += '"' + olabel(o) + "\":" + to_string(lines_by_origin[s][o]); }
        j += "},\"file_status\":{"; f1 = true; for (auto& kv : st) { if (!f1) j += ','; f1 = false; j += '"' + kv.first + "\":" + to_string(kv.second); }
        j += "},\"top_foreign_files\":" + stats_foreign[s] + "}"; }
      j += "]}"; wfile(out + "/stats.json", j); }
    { string j = "{\"format\":1,\"chunk_lines\":" + to_string(CH) + ",\"raw_lines\":" + to_string(rawtxt.size()) + ",\"norm_lines\":" + to_string(normtxt.size()) +
        ",\"text_chunks\":" + to_string(nch) + ",\"identities\":" + to_string(nident) + ",\"virt_origin\":40,\"snapshots\":[";
      for (int s = 0; s < NS; s++) { if (s) j += ','; u64 ln = 0; for (auto& f : F[s]) ln += f.raw.size();
        j += "{\"i\":" + to_string(s) + ",\"id\":"; jstr(j, S[s].id); j += ",\"repo\":"; jstr(j, S[s].repo); j += ",\"lane\":"; jstr(j, S[s].lane);
        j += ",\"date\":"; jstr(j, S[s].date); j += ",\"order_date\":"; jstr(j, S[s].odate);
        j += ",\"files\":" + to_string(F[s].size()) + ",\"lines\":" + to_string(ln) + ",\"parents\":[";
        for (size_t k = 0; k < S[s].parents.size(); k++) { if (k) j += ','; j += to_string(S[s].parents[k]); }
        j += "],\"anc\":\"" + to_string(S[s].anc) + "\",\"rel\":\"" + to_string(S[s].rel) + "\",\"desc\":\"" + to_string(S[s].desc) + "\"}"; }
      j += "],\"origins\":["; for (int o = 0; o < 41; o++) { if (o) j += ','; jstr(j, olabel(o)); } j += "]}";
      wfile(out + "/manifest.core.json", j); }
    fprintf(stderr, "done in %.1fs\n", omp_get_wtime() - t0);
}
