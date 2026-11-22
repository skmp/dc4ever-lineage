# id | repo | ref | date (display/order) | lane | why
dc4ever-2005|skmp_dc4ever|26403b8~2|2005-09-15|dc4ever|Final DC4Ever tree (C#). Real dates 2003-2005: history rebuilt in 2019 from backups, one commit per file at its mtime; README commits 2019 excluded
nulldc-2010-05|skmp_nullDC|761dc87|2010-05-09|nullDC|nullDC 1.0.x open-sourced on Google Code: first complete tree (initial + rest of code + emitter + PuruPuru). nullDC itself was closed-source 2005-2010; no earlier history exists
nulldc-2010-12|skmp_nullDC|7708112|2010-12-29|nullDC|End of 2010, the busiest svn year (124 of 148 commits)
nulldc-2011-09|skmp_nullDC|c563e07|2011-09-14|nullDC|Last trunk revision before the nulldc-360 import (2011-10-15); nulldc-360 shares 93/203 source files verbatim with trunk of this era
nulldc-last|skmp_nullDC|1611c3c|2023-07-10|nullDC|Last commit (svn r150 2013-03 + GitHub README/nullRend edits 2015, 2023); archived
nullDCe-2009|skmp_nullDCe|39c0550|2009-10-16|nullDCe|Recovered nullDCe archive (fork of nullDC mainline late 2008; PSP/Wii/PS3/Xbox hackports). Committed 2017; latest in-source date 2009-10-16 (PPCEmit generated header), so dated 2009-10 (range 2008-2010)
nulldc-360-2011|gligli_nulldc-360|0330292|2011-10-15|nulldc-360|gligli Xbox 360 port, initial import (nullDC 1.0.x svn trunk 2010-2011 + Xenos renderer, PPC dynarec)
nulldc-360-last|gligli_nulldc-360|7b0bd50|2022-02-11|nulldc-360|Last commit (activity 2011-2012, GCC 9.4 rebuild 2022)
reicast-2013-import|skmp_reicast-emulator|1c16baeb0|2013-12-19|reicast|reicast 'project import': the private newdc/nullDC-Android rewrite (2012-2013) imported into git; root commit shared by reicast, flycast and nullDC 3
reicast-r6|skmp_reicast-emulator|r6|2014-01-27|reicast|First tagged release r6
reicast-r7-rc1|skmp_reicast-emulator|r7-rc1|2014-12-11|reicast|r7-rc1, end of the 2014 peak (985 commits that year)
reicast-r8|skmp_reicast-emulator|r8|2018-09-04|reicast|r8, 2018 revival (1104 commits); flycast diverges right after (first flycast-only commit 2018-10-20)
reicast-r19.07|skmp_reicast-emulator|r19.07|2019-07-14|reicast|r19.07 (after the libswirl restructure); flycast's last merge from reicast is 2019-05-17
reicast-r20.04|skmp_reicast-emulator|r20.04|2020-04-02|reicast|r20.04, last tagged release
reicast-last|skmp_reicast-emulator|2e32999c4|2025-09-30|reicast|Last commit of alpha (code state = 2021-12-22 plus README/notice edits); archived 2025. nullDC 3 branches from 95b673698 (2021-12-22)
flycast-v1.0|flyinghead_flycast|v1.0|2021-05-27|flycast|flycast v1.0 (reicast descendant: shares root and 3279 commits with reicast, forked 2018)
flycast-v2.0|flyinghead_flycast|v2.0|2022-08-25|flycast|flycast v2.0
flycast-v2.4|flyinghead_flycast|v2.4|2024-10-21|flycast|flycast v2.4
flycast-head|flyinghead_flycast|105342d53|2026-11-22|flycast|flycast master HEAD at collection time
nulldc3-fpgadc-2023|skmp_nulldc3|038f7ef3|2023-07-07|nulldc3|First nullDC 3 commits on top of reicast 2021-12-22: 'fpgadc: Add refsw-offline' (VRAM/PVR dumps + offline refsw renderer): root of the fpgadc lane
minicast-import|skmp_minicast|580d7b8|2025-01-20|fpgadc|minicast initial import: reicast/nullDC-3-pre fork for the DE10-nano ARM feeding polly2-rtl (513/533 source files identical to nulldc3 2023-08..2024-07)
nullDC4Wii-first|BenoitAdam_nullDC4Wii|e812c58|2026-01-21|nullDC4Wii|nullDC4Wii first import = nullDCe main bad8d6a (2024-09-26) verbatim modulo CRLF (203/203 source files)
nullDCe-ps2-2024|skmp_nullDCe|c3e0c9b|2024-09-27|nullDCe|nullDCe 2024 PS2 port work (skmp/ps2 branch tip; main bad8d6a is the nullDC4Wii base)
nullDC4Wii-a0.50|BenoitAdam_nullDC4Wii|alpha0.50|2026-07-13|nullDC4Wii|Mid-life tag alpha0.50
polly2-r1|skmp_polly2-rtl|be391db|2026-07-17|fpgadc|polly2-rtl pinned by DreamSTer r1 (first FPGA Dreamcast core release)
minicast-r1|skmp_minicast|697f565|2026-07-17|fpgadc|minicast pinned by DreamSTer r1
polly2-r2|skmp_polly2-rtl|7a70d24|2026-07-17|fpgadc|polly2-rtl pinned by DreamSTer r2
polly2-r2b|skmp_polly2-rtl|635ec79|2026-07-17|fpgadc|polly2-rtl pinned by DreamSTer r2b
polly2-r3|skmp_polly2-rtl|436372f|2026-07-17|fpgadc|polly2-rtl pinned by DreamSTer r3
polly2-r4|skmp_polly2-rtl|c22506c|2026-07-18|fpgadc|polly2-rtl pinned by DreamSTer r4 and r5 (r5 repins nothing: same polly2-rtl and minicast commits as r4)
minicast-r2|skmp_minicast|6fcc0e1|2026-07-17|fpgadc|minicast pinned by DreamSTer r2 and r2b
minicast-r3|skmp_minicast|585205b|2026-07-17|fpgadc|minicast pinned by DreamSTer r3
minicast-r4|skmp_minicast|0998288|2026-07-18|fpgadc|minicast pinned by DreamSTer r4 and r5
minicast-r6|skmp_minicast|450eb49|2026-07-30|fpgadc|minicast pinned by DreamSTer r6
polly2-r6|skmp_polly2-rtl|a37f92c|2026-07-30|fpgadc|polly2-rtl pinned by DreamSTer r6
NotDC-PS3-first|Mayo1970_NotDC-PS3|5a32b94|2026-09-19|NotDC-PS3|NotDC-PS3 initial repo: nullDC4Wii ~2026-09-18 (9659506, alpha0.76 era; 229/272 source files identical)
polly2-r6b|skmp_polly2-rtl|95fc3ba|2026-10-24|fpgadc|polly2-rtl pinned by DreamSTer r6b (last release; = polly2-rtl-lite r6b FPGA core)
minicast-r6b|skmp_minicast|9185ab8|2026-10-24|fpgadc|minicast pinned by DreamSTer r6b (= minicast main HEAD)
devtools-v3.0.0-pre|skmp_dreamcast-devtools|v3.0.0-pre|2026-10-24|fpgadc|dreamcast-devtools (TypeScript debugger UI) at the nullDC 3.0.0-pre pin (HEAD is 2026-10-24 as well)
nulldc3-v3.0.0-pre|skmp_nulldc3|v3.0.0-pre|2026-10-25|nulldc3|nullDC 3.0.0-pre tag (= main HEAD 4e773df2)
shrike4-head|skmp_shrike4-rtl|5843f0c|2026-10-31|fpgadc|shrike4-rtl (SH4) HEAD: models, rtl/v1, testbenches, console harness
caique-head|skmp_caique-rtl|2d9898f|2026-11-01|fpgadc|caique-rtl (AICA) HEAD
wren7-head|skmp_wren7-rtl|95988ea|2026-11-01|fpgadc|wren7-rtl (ARM7DI) HEAD
NotDC-PS3-0.8.3|Mayo1970_NotDC-PS3|0.8.3|2026-11-01|NotDC-PS3|NotDC-PS3 0.8.3 (= main HEAD); carries plugs/caiqueAICA from caique-rtl 5aa2376
nullDC4Wii-head|BenoitAdam_nullDC4Wii|ad015e2|2026-11-19|nullDC4Wii|nullDC4Wii main HEAD (alpha0.805 + Wii U port)
nulldc3-refsw3|skmp_nulldc3|4f3efe15|2026-11-20|nulldc3|nullDC 3 skmp/refsw3 branch tip (29 commits past main: refsw3 bit-exact PVR renderer work)
dreamcast-tests-head|fpgadc_dreamcast-tests|a932980|2026-11-20|fpgadc|dreamcast-tests (console test suite) HEAD
polly2-r8-develop|skmp_polly2-rtl|3800f9f|2026-11-21|fpgadc|polly2-rtl r8/develop: the new bit-exact cycle-accurate PVR2 CORE model. Unrelated history: its root 4ca41fb (2026-11-20) has no merge-base with main, so it is its own lane, not a continuation of r6b
