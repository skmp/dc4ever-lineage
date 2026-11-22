// mkatlas: single-channel SDF atlas of DejaVu Sans Mono, ASCII 0x20..0x7E plus a 0x7F hollow box.
// Cells 48x96 px (1 x 2 world units), 16 x 6 grid -> 768 x 576 R8, written raw (sdf.r8) + metrics.json.
// Exact Euclidean distance transform (Felzenszwalb-Huttenlocher) on a 4x supersampled bitmap.
// build: g++ -O2 -fopenmp mkatlas.cpp $(pkg-config --cflags --libs freetype2) -o mkatlas
#include <ft2build.h>
#include FT_FREETYPE_H
#include <cstdio>
#include <cstdlib>
#include <cmath>
#include <vector>
#include <string>
#include <algorithm>

static const int CW = 48, CH = 96, GX = 16, GY = 6, SS = 4, SPREAD = 8;
static const double INF = 1e20;

static void edt1(const double* f, double* d, int n, int* v, double* z) {
    int k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (int q = 1; q < n; q++) {
        double s;
        for (;;) {
            s = ((f[q] + (double)q * q) - (f[v[k]] + (double)v[k] * v[k])) / (2.0 * q - 2.0 * v[k]);
            if (s <= z[k]) { k--; continue; }
            break;
        }
        k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (int q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (double)(q - v[k]) * (q - v[k]) + f[v[k]]; }
}
// squared distance to nearest "on" pixel
static std::vector<double> edt(const std::vector<unsigned char>& on, int w, int h) {
    std::vector<double> g(w * h);
    for (int i = 0; i < w * h; i++) g[i] = on[i] ? 0 : INF;
    int n = std::max(w, h);
    std::vector<double> f(n), d(n), z(n + 1); std::vector<int> v(n);
    for (int x = 0; x < w; x++) {
        for (int y = 0; y < h; y++) f[y] = g[y * w + x];
        edt1(f.data(), d.data(), h, v.data(), z.data());
        for (int y = 0; y < h; y++) g[y * w + x] = d[y];
    }
    for (int y = 0; y < h; y++) {
        for (int x = 0; x < w; x++) f[x] = g[y * w + x];
        edt1(f.data(), d.data(), w, v.data(), z.data());
        for (int x = 0; x < w; x++) g[y * w + x] = d[x];
    }
    return g;
}

int main(int argc, char** argv) {
    const char* font = argc > 1 ? argv[1] : "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf";
    std::string out = argc > 2 ? argv[2] : "data/font";
    FT_Library lib; FT_Face face;
    if (FT_Init_FreeType(&lib) || FT_New_Face(lib, font, 0, &face)) { fprintf(stderr, "freetype init failed\n"); return 1; }
    // advance = CW px at 1x  ->  pixel size such that advance(units)/upem * px = CW
    FT_Load_Char(face, 'M', FT_LOAD_NO_SCALE);
    double adv = face->glyph->advance.x, upem = face->units_per_EM;
    double px = CW / (adv / upem);                       // em size at 1x
    int hpx = (int)lround(px * SS);
    FT_Set_Pixel_Sizes(face, 0, hpx);
    double asc = face->ascender / upem * px, desc = -face->descender / upem * px;
    double baseline = (CH - (asc + desc)) * 0.5 + asc;   // px from cell top at 1x
    const int W = CW * GX, H = CH * GY;
    std::vector<unsigned char> atlas(W * H, 0);
    const int hw = CW * SS, hh = CH * SS;
    for (int c = 0x20; c <= 0x7F; c++) {
        std::vector<unsigned char> bm(hw * hh, 0);
        if (c == 0x7F) { // hollow box: the fold of every non-ASCII code point
            int x0 = (int)(0.14 * hw), x1 = (int)(0.86 * hw), y0 = (int)((baseline - asc * 0.78) * SS), y1 = (int)((baseline) * SS);
            int t = 3 * SS;
            for (int y = y0; y < y1; y++) for (int x = x0; x < x1; x++)
                if (x < x0 + t || x >= x1 - t || y < y0 + t || y >= y1 - t) bm[y * hw + x] = 1;
        } else if (c != 0x20) {
            if (FT_Load_Char(face, c, FT_LOAD_RENDER | FT_LOAD_TARGET_NORMAL)) continue;
            FT_Bitmap& b = face->glyph->bitmap;
            int ox = face->glyph->bitmap_left, oy = (int)lround(baseline * SS) - face->glyph->bitmap_top;
            for (unsigned y = 0; y < b.rows; y++) for (unsigned x = 0; x < b.width; x++) {
                int X = ox + x, Y = oy + y;
                if (X < 0 || Y < 0 || X >= hw || Y >= hh) continue;
                bm[Y * hw + X] = b.buffer[y * b.pitch + x] >= 128;
            }
        }
        std::vector<unsigned char> inv(hw * hh);
        for (int i = 0; i < hw * hh; i++) inv[i] = !bm[i];
        auto dout = edt(bm, hw, hh), din = edt(inv, hw, hh);
        int gi = c - 0x20, cx = gi % GX, cy = gi / GX;
        for (int y = 0; y < CH; y++) for (int x = 0; x < CW; x++) {
            // sample the hi-res field at the centre of the 1x pixel
            double sd = 0; int n = 0;
            for (int sy = 0; sy < SS; sy++) for (int sx = 0; sx < SS; sx++) {
                int i = (y * SS + sy) * hw + x * SS + sx;
                double o = sqrt(dout[i]), in = sqrt(din[i]);
                sd += (bm[i] ? (in - 0.5) : -(o - 0.5)); n++;
            }
            sd = sd / n / SS;                               // 1x px, positive inside
            double v = 128.0 + sd * (127.0 / SPREAD);
            atlas[(cy * CH + y) * W + cx * CW + x] = (unsigned char)std::clamp(v, 0.0, 255.0);
        }
    }
    std::string p = out + "/sdf.r8"; // gzip -9 it to sdf.r8.gz for the viewer
    FILE* f = fopen(p.c_str(), "wb"); fwrite(atlas.data(), 1, atlas.size(), f); fclose(f);
    p = out + "/metrics.json"; f = fopen(p.c_str(), "w");
    fprintf(f, "{\"font\":\"DejaVu Sans Mono\",\"format\":\"r8 raw, row-major, top row first\",\"width\":%d,\"height\":%d,"
               "\"cellW\":%d,\"cellH\":%d,\"cols\":%d,\"rows\":%d,\"first\":32,\"last\":127,\"spread\":%d,"
               "\"emPx\":%.3f,\"baselinePx\":%.3f,\"ascPx\":%.3f,\"descPx\":%.3f,\"encoding\":\"128 + sd_px*127/spread, inside positive\"}\n",
            W, H, CW, CH, GX, GY, SPREAD, px, baseline, asc, desc);
    fclose(f);
    printf("atlas %dx%d em=%.1fpx baseline=%.1f\n", W, H, px, baseline);
    return 0;
}
