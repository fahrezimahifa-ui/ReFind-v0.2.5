# ReFind v0.2.5 — Security Audit and Technology Modernization Plan

**Audit date and advisory access date:** 1 November 2026 (Asia/Bangkok). Campus events remain Asia/Jakarta; audit and scheduled database timestamps remain UTC.  
**Assessment type:** read-only source/configuration assessment and public advisory research. **No remediation or migration was performed.**  
**Deployment assumption approved by the owner:** local operation now; Internet deployment later.  
**Audience:** ReFind maintainers, future implementers/reviewers, and the operator of the existing Windows/XAMPP installation.

## 1. Executive Summary

ReFind has substantial application-level protections: database-derived identity and roles, action-specific field allowlists, CSRF checks, prepared SQL, explicit public/private projections, private media endpoints, and guarded transactional ownership decisions. The reviewed source did **not establish a ReFind authentication bypass, IDOR, SQL injection, stored XSS, or ownership-integrity vulnerability**. This is a scoped review result, not a clean bill of health or a penetration-test certificate.

The most urgent risk lies below the application. PHP **8.2.12** is within the affected ranges of **CVE-2026-109618 and CVE-2026-109619**, both critical vendor-rated RCE vulnerabilities. Apache is configured to load mod_php; PHP has a finite memory limit and session upload progress enabled. Both CVEs appear in CISA's catalog, added 26 October 2026. Successful exploitation on this particular Windows/ZTS installation was **not attempted or demonstrated**. Authentication and CSRF cannot be relied on to protect PHP initialization before application code. [PHP vendor advisory](https://www.php.net/archive/2026.php#2026-10-21-5), [OOM advisory](https://github.com/php/php-src/security/advisories/GHSA-w8hw-w9fx-j79w), [stale-state advisory](https://github.com/php/php-src/security/advisories/GHSA-6wmf-4rv5-p3rp), [CISA-maintained catalog](https://raw.githubusercontent.com/cisagov/kev-data/main/known_exploited_vulnerabilities.json).

The installed stack also contains Apache 2.4.58, unsupported MariaDB 10.4.32, phpMyAdmin 5.2.1, and two distinct unsupported OpenSSL series. Apache listens on **0.0.0.0 and ::, ports 80/443**; MariaDB listens on **::, port 3306**. These bindings contradict a loopback-only assumption. The active Windows network category is Public; enabled Public-profile inbound allow rules for both programs have Any local/remote address scope. No connection test established LAN, IPv4-mapped IPv6, NAT or Internet reachability. A legacy PHP-CGI alias is configured separately from ReFind's mod_php integration.

**Evidence convention:** source/configuration/inventory facts are confirmed observations unless qualified; attack impact, prioritization and compatibility expectations are inferences; unexecuted runtime behavior and inaccessible facts are unverified. Recommendations describe future work, not changes made.

### 1.1 Assessment totals

| Measure | Result | Counting boundary |
|---|---:|---|
| Requested controls assessed | **30** | Exactly controls C01–C30 in section 5 |
| Verified | **14** | Source behavior verified; applicable historical tests reviewed; no new runtime proof |
| Implemented but Unverified | **4** | Runtime/concurrency/recovery properties need independent execution |
| Partial | **10** | Concrete coverage or operational gaps |
| Missing | **2** | Application MFA; externally deployed HTTPS enforcement |
| Not Applicable | **0** | Inapplicable subrequirements are explained rather than removing a whole control |
| Missing/partial/unverified controls | **16** | 4 + 10 + 2 |
| Confirmed applicable runtime CVEs | **2 Critical; 0 High; 0 Medium; 0 Low** | The two PHP advisories above; successful exploitation remains unverified |
| Confirmed exploitable defects in ReFind-authored code | **0 identified** | Not a claim that defects do not exist |
| Dependency advisory/version matches | **27 across 7 packages** | 1 Critical / 5 High / 15 Moderate / 6 Low in upstream databases; not 27 proven ReFind attack paths |

The CVE count is deliberately conservative: conditional Apache, phpMyAdmin, native-library and tooling issues remain separately classified. Unsupported software and broad bindings are confirmed operational findings, not additional invented CVEs.

### 1.2 Highest-priority actions for later approval

1. **P0:** verify and restrict network exposure to intended local access; retire unused CGI/admin/example surfaces; urgently rehearse a patched PHP replacement.
2. **P1:** establish a supported Windows-native runtime alongside the installation, targeting PHP 8.4.27-1, patched Apache 2.4.69 and MariaDB 11.4.13, subject to package/dependency verification and isolated regression gates.
3. **P1 before Internet access:** validated HTTPS, limited database privileges, private filesystem ACLs, appropriate request limits, abuse controls, operational security logs and a tested restore.
4. **P2:** preserve negative security tests through the uncommitted refactor; add dependency monitoring and close image-metadata/privacy coverage gaps.
5. **P3 locally:** consider BM MFA and recovery/session-management enhancements when deployment risk justifies them. MFA becomes a release decision before public privileged access; this system is not certified ASVS Level 2.

Remaining unknowns include end-to-end/router exposure despite the observed Windows allow rules, deployed database grants/TLS/plugins, actual Apache-SAPI PHP settings, certificate behavior, filesystem ACL effectiveness, private backup quality, several binary dependencies, and conditional advisory reachability. No real account, uploaded image, credential, session payload or private backup was opened.

## 2. Verified Environment Inventory

### 2.1 Source identity and the completed maintainability work

| Baseline | Verified identity and use |
|---|---|
| Remote repository | [ReFind-v0.2.5](https://github.com/fahrezimahifa-ui/ReFind-v0.2.5); main resolved on the audit date to **a610b1a0cb7ebb2b911f3468388076948a65b238** |
| Installed checkout, **I** | `C:/xampp/htdocs/ReFind_0.2.3`; branch `codex/release-readiness`; HEAD **4d74e9872b3afa5fa1ab09c081b30d1a3437a2b5**; initially clean |
| Primary audit source, **W** | `C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3`; branch `codex/maintainability-v025-followup`; base HEAD **a610b1a0cb7ebb2b911f3468388076948a65b238** plus **79 pre-existing status entries** |
| Installed/main comparison | Application code, assets, dependency locks and schema match. Eight documentation/exclusion files differ. Commit ancestry differs because the upstream UI changes were squashed; commit ordering alone is not a code comparison. |
| Earlier refactor | `2660ce5` is an ancestor of installed HEAD. The subsequent **seven-area follow-up is present but uncommitted and undeployed**. |
| Main CI | [Release-readiness run 41198075398](https://github.com/fahrezimahifa-ui/ReFind-v0.2.5/actions/runs/41198075398) completed successfully for a610b1a on 31 October. It does not test W's uncommitted overlay. |

The seven follow-up areas are readability; fixed shared template partials; frontend request consolidation; account mutation extraction; batched list reads; CSS cleanup; and shared QA transport/projection/route checks. Source and [docs/MAINTAINABILITY_FOLLOWUP.md:1](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/docs/MAINTAINABILITY_FOLLOWUP.md:1) support completion of the implementation. It is not an unfinished seven-area proposal.

Historical receipts distinguish:
- Full 26-stage matrix: `worktree-69f4a78dca70bd2947c79adfb2441511d5c8f781d239899822e6f14e30f1dd4b`.
- Later focused static/projection/routes/schema/workflow checks: **0510dddac3ac07db03e8c123608c5fa59fed237265cc8ac73f92a80aa4f7426b**, 146 files under that receipt's own fingerprint algorithm.

Both receipts were read selectively; no suites were rerun. The audit's broader manifest below uses a different algorithm and must not be compared directly with those historical hashes.

**Audit manifest algorithm:** sorted unique output of `git ls-files -co --exclude-standard -z`; SHA-256 of each existing regular file, excluding this report; aggregate SHA-256 over UTF-8 `relative_path + NUL + file_sha256 + LF`. Ignored runtime contents are excluded.

| Snapshot | Files | Initial aggregate SHA-256 |
|---|---:|---|
| I | 605 | `d9475b06037997c8f5a2b8d1c72b589477f79e7b5b57ebec626774580d49cabc` |
| W | 609 | `7baac5e0857ed460905a32a7b010ed57ab77bf6ef8b2ac88b28c29bc975c5033` |

Private-file preservation uses only aggregate path/size/mtime metadata, not contents: 105 entries in I and 3 in W. Database records were neither queried nor fingerprinted in this audit. See section 12 for the final preservation result.

Fresh remote identity was obtained through read-only GitHub API calls. No `git fetch` was run, because it would persist Git metadata beyond the permitted report write. The `origin` remote points at older ReFind-v0.2.0; the relevant remote is `v025`.

### 2.2 Runtime, libraries and development tooling

“Latest/candidate” means the version independently located on the audit date, not tested compatibility. Installed PHP library observations are from **CLI**, supplemented by Apache module configuration; no phpinfo page or app HTTP request was created.

| Component | Installed/observed | Supported/security-fixed candidate | Support/exposure/action |
|---|---|---|---|
| Windows | Windows 11 Home x64, build 26200 | Current supported Windows updates | Patch/edition lifecycle and update compliance unverified |
| PHP | 8.2.12 ZTS, VS2019 x64, 24 Oct 2023 | **8.2.35-1 bridge; 8.4.27-1 preferred; 8.5.12-1 alternative** | 8.2 branch security support ends 31 Dec 2026; installed patch is vulnerable |
| Apache | 2.4.58 Win64, Apache Lounge VS17 | **2.4.69** core; Windows build 261002 candidate | Running on 80/443; binary dependency BOM requires separate checks |
| Integration | `php_module` / `php8apache2_4.dll` | Matching **TS x64** PHP Apache module | Do not substitute an NTS/FPM build or mix DLL sets |
| MariaDB server | 10.4.32 binary; running process/listener | **11.4.13 LTS**; 10.11.19 fallback | 10.4 community EOL 18 Jun 2024; actual SELECT VERSION() not run |
| phpMyAdmin | 5.2.1, version constant | **5.2.3** latest published stable found | `Require local`; direct 2025 XSS fixes and transitive advisory review needed |
| Apache-side OpenSSL | 3.1.3 executable/library | Provider-compatible **3.5.9 LTS** | 3.1 EOL 14 Mar 2025; do not swap DLLs manually |
| PHP-side OpenSSL | 3.0.11 | Current PHP package's supported OpenSSL BOM | 3.0 public EOL 7 Sep 2026; must verify candidate bundle separately |
| PHP database client | mysqlnd 8.2.12 | Same selected PHP release | Not MariaDB Connector/C; distinguish connector-specific CVEs |
| GD | bundled 2.1.0-compatible, JPEG/PNG/WebP enabled | Selected patched PHP/GD package | Only avatar path fully decodes/re-encodes on server |
| JPEG/WebP | JPEG API version 8; WebP support present | Package-provider-supported versions | API label is not a precise libjpeg/libjpeg-turbo version; WebP decoder version unverified |
| libpng | 1.6.34 | Upstream 1.6.59; use compatible PHP build | Old API-specific vulnerabilities; ReFind PNG uploads are not fully decoded server-side |
| FreeType | 2.11.1 | Upstream 2.14.2 or compatible bundle | No user-supplied-font processing found in ReFind |
| zlib | 1.2.12 | Upstream 1.3.2 / compatible bundle | inflateGetHeader prerequisite matters for CVE-2022-37434 |
| libxml / PCRE2 | 2.10.3 / 10.40 | Current selected PHP package; upstream PCRE page reports 10.48 | Apache provider reports newer 10.49/2.15.4 in its own BOM; PHP/Apache copies are distinct |
| mbstring / fileinfo | libmbfl 1.3.2, Oniguruma 6.9.8 / libmagic 540 | Upgrade with PHP | No user-controlled regular expression compilation found |
| PHP cURL | 8.4.0, libssh2 1.10.0; no Brotli reported | Compatible current PHP bundle | No cURL/remote-URL fetch path found in ReFind production PHP |
| jQuery / Bootstrap | Local 3.7.1 / 5.3.8 | Latest registry 4.0.0 / 5.3.8; retain jQuery 3.7.1 pending major-version review | Explicit OSV queries returned no matches; this is not proof of absence |
| Node | 24.15.0 | **24.22.2 LTS** | QA only; 24.22.1 is the October security floor, superseded by 24.22.2 |
| Node native deps | OpenSSL 3.5.5, Brotli 1.2.0, c-ares 1.34.6, Undici 7.24.4 | Node 24.22.2 bundled set | Node is not the PHP website server |
| npm | 11.12.1 | Use npm bundled with chosen Node first; latest registry 12.2.1 | No independent npm major upgrade justified by this audit |
| Playwright / axe | 1.64.1 / 4.14.0, installed and locked | Same latest versions found | Browser/FFmpeg binary versions remain unverified; no binaries launched |
| ESLint / globals | 10.13.0 / 17.13.0 locked | Registry 10.14.0 / 17.14.0 | Review parent minimatch resolution; no forced major override |
| sharp | 0.35.5 installed/locked | Same latest version found | Development fixture/image tool, not PHP upload processing |
| PHPStan | 2.3.4 installed/locked; composer constraint ^2.1 | Keep compatible maintained 2.x | Dev-only; Composer executable version unverified |

Support/release sources, accessed 1 November 2026: [PHP lifecycle](https://www.php.net/supported-versions.php), [official Windows build metadata](https://downloads.php.net/~windows/releases/releases.json), [Apache security](https://httpd.apache.org/security/vulnerabilities_24.html), [Apache Lounge build BOM](https://www.apachelounge.com/viewtopic.php?p=44502), [MariaDB lifecycle](https://mariadb.org/about/#maintenance-policy), [Q3 MariaDB releases](https://mariadb.org/mariadb-server-12-3-11-8-11-4-and-10-11-q3-2026-maintenance-releases-and-goodbye-10-6/), [OpenSSL lifecycle](https://openssl-library.org/roadmap/), [Node release](https://nodejs.org/en/blog/release/v24.22.2), [phpMyAdmin release](https://www.phpmyadmin.net/files/5.2.3/), [libpng](https://libpng.org/pub/png/libpng.html), [zlib](https://zlib.net/), [FreeType](https://freetype.org/), [PCRE](https://www.pcre.org/). Package latest versions came from the corresponding public npm `/latest` endpoints; no installation or lock update occurred.

### 2.3 Configuration facts and limits

- Apache main config: `Listen 80` at line 60; `AllowOverride All` and `Require all granted` for htdocs at 273/278; SSL include at 545. `httpd-ssl.conf:36,52,79` configures 443, HIGH:MEDIUM ciphers and `SSLProtocol all -SSLv3`. Negotiated TLS versions/certificates were not tested; do not infer TLS 1.0/1.1 acceptance solely from the text.
- `httpd-xampp.conf:20` loads mod_php. Lines 48–55 expose a PHP-CGI alias with a grant for `php-cgi.exe`; this is separate attack surface even though ReFind uses mod_php. Lines 91–94 restrict phpMyAdmin locally.
- `httpd-default.conf:55,65` uses ServerTokens Full and ServerSignature On. Loaded modules include CGI, rewrite, headers, SSL, proxy/AJP and info/status; WebDAV server, HTTP/2, digest, charset_lite, heartmonitor and userdir modules were not enabled in the reviewed module list.
- `httpd-ajp.conf:9` maps /examples to local AJP. No ReFind requirement for this connector was found. Whether a backend is listening was not probed.
- `php.ini:398,433,506,701,853`: expose_php On; memory_limit 512M; display_errors On; POST and upload limits 40M. App entrypoints override display_errors Off, but startup/other XAMPP scripts remain separate. max_execution_time is 900 seconds.
- CLI reports session upload progress **1**, serialize handler **php**, SID length 26 at 5 bits/character. App sets strict mode and private save path itself. No runtime serializer switch was found. Windows ACP is **1252**.
- Windows firewall: Domain/Private/Public profiles enabled with default inbound Block; four enabled program-specific Public inbound Allow entries (two Apache, two mysqld), each with Any address scope. Active network category is Public. Effective packet reachability and any overriding rules/router isolation were not tested. Only httpd, mysqld and xampp-control processes were observed under XAMPP.
- Playwright's declared browser manifest expects Chromium 156.0.8078.4 (revision 1248), Firefox 157.0 (1555), WebKit 27.2 (2370), and FFmpeg revision 1013; these are package expectations, not independently launched/verified installed binaries.
- Database account/grants, database TLS, plugins and SQL modes were not inspected. Main database identity remains `refind_db_0_2_0` at 127.0.0.1:3306. Source defaults are development defaults, not proof of effective credentials.


## 3. Recent CVE Assessment

**Window:** 3 August–1 November 2026, with older unresolved issues included. Vendor publish dates, CVE-record publication dates and database “modified” dates are different fields. A September database modification does not establish a new September vulnerability.

**Classification:** **Confirmed affected** means the vendor range and relevant deployment facts match; it does not mean a successful exploit. **Potentially affected** means additional configuration, data or API prerequisites remain unresolved. **Patched** means the observed component already includes that particular fix. **Not affected** applies only to the identified version/platform/path. **Unable to verify** records an evidence gap or conflicting range, never a safe result.

Official CVE records were independently read through `https://cveawg.mitre.org/api/cve/<CVE-ID>` for the PHP criticals, Windows CGI issue, selected Apache issues, seven MariaDB issues and zlib. NVD's HTML pages were not readable through the research tool; CNA/vendor records were used instead. CISA's primary JSON URL returned 403; its official GitHub mirror was readable (catalog 2026.10.30).

### 3.1 PHP: immediate runtime priority

| Advisory | Dates and affected/fixed versions | Installed applicability and exact prerequisites | Decision/action |
|---|---|---|---|
| [CVE-2026-109618 / GHSA-w8hw-w9fx-j79w](https://github.com/php/php-src/security/advisories/GHSA-w8hw-w9fx-j79w) | Published 21 Oct; CNA updated 30 Oct. PHP 8.2 <8.2.35; 8.3 <8.3.36; 8.4 <8.4.27; 8.5 <8.5.12. Vendor Critical, CVSS 4.0 9.2. | **Confirmed affected runtime; high confidence.** PHP 8.2.12, mod_php and finite 512M limit match relevant facts. Failure during allocation/request cleanup is required. Specific Windows exploitation unverified. | P0: patched package rehearsal; application login is not a mitigating boundary. |
| [CVE-2026-109619 / GHSA-6wmf-4rv5-p3rp](https://github.com/php/php-src/security/advisories/GHSA-6wmf-4rv5-p3rp) | Same publish/update dates and fixed PHP versions; Critical 9.2. | **Confirmed affected runtime; high confidence.** Stale request-owned global state is the defect; same-worker error/upload paths are relevant. Upload progress is enabled. No assertion that every request is an exploit. | P0 together with prior row. Preserve app/session semantics during patch validation. |
| [CVE-2026-115560 informational notice](https://www.php.net/archive/2026.php#2026-10-23-1) | Vendor notice 23 Oct; full CNA lookup returned 404 during audit. Final regular-release fix not independently available. | **Not affected by the documented ReFind vector:** serializer is php, and no switch from php_binary/php_serialize to php before session_start was found. This does not remove the previous two CVEs. | Record notice; do not invent a fixed version or infer that all upload-progress usage is exploitable. |
| [CVE-2024-4577 / PHP-CGI argument injection](https://github.com/php/php-src/security/advisories/GHSA-3qgc-jrrr-25jv) | PHP 8.2 <8.2.20; fixed 8.2.20 (other branches 8.1.29/8.3.8). | **Potentially affected host surface, known code-page prerequisite not met by observed ACP1252.** CGI alias is configured, but the disclosed best-fit mapping examples require ACP932/936/950 or equivalent mapping. ReFind's main integration is mod_php. | Patch and remove unused CGI alias later; do not label a successful CGI RCE on this host. |
| [CVE-2024-8926 / CGI bypass](https://github.com/php/php-src/security/advisories/GHSA-p99j-rfp4-xqvq) | PHP 8.2 <8.2.24; fixed 8.2.24. | **Not affected by the specifically documented nonstandard OEM/ACP setup** based on ACP1252 observation; other CGI risk remains. | Include in runtime patch coverage, not confirmed-vulnerability totals. |
| [CVE-2026-111497 / Windows package rebuild](https://www.php.net/archive/2026.php#2026-10-26-1) | Rebuilt 8.2.35-1 / 8.4.27-1 etc. on 26 Oct include Brotli 1.2.1. | **Not affected through observed PHP cURL Brotli support:** curl_version reports no Brotli decoder. Separate Node Brotli 1.2.0 is present. | Select the -1 package rebuild, not just a runtime version string. |

The vendor states patching is the complete remedy for the two critical PHP flaws; partial mitigations do not establish safety. This report does not recommend disabling memory limits as a durable substitute, and made no mitigation/configuration changes. [PHP announcement](https://www.php.net/archive/2026.php#2026-10-21-5).

### 3.2 Apache: version and enabled-feature discrimination

| Advisory / vendor fix | Assessment for 2.4.58 Windows |
|---|---|
| [CVE-2026-59685](https://www.cve.org/CVERecord?id=CVE-2026-59685), 1 Oct; affects 2.4.0–2.4.68; fixed 2.4.69; vendor Moderate | **Potentially affected.** Windows path expansion and growing 8.3 names are required; filesystem short-name behavior and the necessary request path were not tested. |
| [CVE-2024-38472](https://www.cve.org/CVERecord?id=CVE-2024-38472), fixed 2.4.60; vendor Important | **Potentially affected.** Windows UNC/SSRF can expose NTLM material; outbound SMB reachability and trigger paths unverified. App SQL/CSRF protections do not resolve it. |
| [CVE-2024-38477](https://www.cve.org/CVERecord?id=CVE-2024-38477), fixed 2.4.60; Important | **Potentially affected.** mod_proxy is loaded and an AJP route exists; backend/trigger behavior not probed. |
| [CVE-2024-38474](https://www.cve.org/CVERecord?id=CVE-2024-38474) / [38475](https://www.cve.org/CVERecord?id=CVE-2024-38475), fixed 2.4.60 | **Not triggered by reviewed ReFind rewrites:** fixed page.php substitutions, no untrusted substitution backreferences. Other host contexts remain an inspection boundary. |
| [CVE-2024-38476](https://www.cve.org/CVERecord?id=CVE-2024-38476), fixed 2.4.60 | **Potentially affected host; no confirmed ReFind path.** Requires exploitable/malicious backend output affecting handlers. |
| [CVE-2024-40898](https://www.cve.org/CVERecord?id=CVE-2024-40898), fixed 2.4.62 | **No triggering server/vhost rewrite identified.** Per-directory ReFind rules do not by themselves satisfy that prerequisite. |
| [CVE-2025-59775](https://www.cve.org/CVERecord?id=CVE-2025-59775), fixed 2.4.66; Moderate | **Potentially affected pending effective directives.** Requires AllowEncodedSlashes On and MergeSlashes Off; not established from reviewed defaults. |
| CVE-2026-56154, fixed 2.4.69 | **Not triggered by reviewed rules:** no LA-U:HTTP lookahead. |
| CVE-2026-43951, fixed 2.4.68 | **Potentially affected.** headers/mime modules are loaded; multilingual-response conditions need isolated verification. |
| CVE-2026-42528/93546/58415; 57941; 46729; 47360; 48005/73636/73637; 56153; 63718; 79768 | **Not affected through reviewed configuration:** required DAV, HTTP/2, heartmonitor, session_cookie, digest, charset_lite, proxy_uwsgi or userdir feature absent. dav_lock alone is not a WebDAV service. |
| CVE-2026-42356 and CVE-2026-56449 | **Not affected by installed version:** respectively introduced in 2.4.60 and limited to 2.4.68. Newer advisories do not automatically affect older versions. |
| CVE-2026-59797 / related .htaccess expression issues | **No relevant untrusted .htaccess author/SSLRequire path established.** Filesystem write permission would materially alter this conclusion. |

For the older Apache rows, affected ranges are 2.4.0–2.4.59 for CVE-2024-38472/38474/38475/38476/38477; through 2.4.61 for 40898; through 2.4.65 for CVE-2025-59775. CVE-2026-43951 affects through 2.4.67 and 56154 through 2.4.68. These are version ranges, not proof of a trigger in ReFind.

All October module-exclusion rows in this table refer to fixes in Apache 2.4.69; their required modules/configuration are absent, or the installed version is outside the affected interval.

The CVE identifiers/fixes above were checked against the [Apache vendor register](https://httpd.apache.org/security/vulnerabilities_24.html); detailed selected ranges were cross-checked with the linked CNA records. Do not enable UnsafeAllow3F/UnsafePrefixStat or broadly permit UNC paths merely to hide an upgrade regression. ReFind's fixed substitutions should be tested unchanged.

### 3.3 MariaDB: do not extrapolate supported ranges to 10.4

The following CNA/maintainer ranges start at **10.6.1**, not 10.4. The common fixed series are 10.6.28, 10.11.19, 11.4.13, 11.8.9, 12.3.3 and 13.0.2. Installed **10.4.32 is unsupported**; exclusion from a maintained advisory range is not evidence of safety.

| Advisory (October CVE publication) | Required capability / impact | 10.4.32 conclusion |
|---|---|---|
| [CVE-2026-92262](https://github.com/MariaDB/server/security/advisories/GHSA-65jj-h265-3m7h) | Crafted legacy table names; authenticated DB capabilities; file/data corruption or potential RCE | **Unable to verify** against 10.4; do not count as confirmed |
| [CVE-2026-85746](https://github.com/MariaDB/server/security/advisories/GHSA-8fvj-c57c-pggx) | Low-privileged SQL access and deeply nested GIS serialization; memory corruption | **Unable to verify** against 10.4; no ReFind GIS query identified |
| [CVE-2026-85748](https://github.com/MariaDB/server/security/advisories/GHSA-mv8g-9f7q-hprm) | SYS_REFCURSOR, affected 12.3.1–12.3.2/13.0.1 | **Not affected**: feature/version range does not match 10.4 |
| [CVE-2026-97380](https://github.com/MariaDB/server/security/advisories/GHSA-625w-4hgq-qwmr) | Incorrect GRANT PROXY privilege check; other-account password changes | **Unable to verify** for 10.4 and actual grants |
| [CVE-2026-86047](https://github.com/MariaDB/server/security/advisories/GHSA-wxr3-wm3p-7w6p) | Crafted objects poison generated SQL applied during restore | **Unable to verify**; inspect/rehearse dumps in isolation, not on main |
| [CVE-2026-85985](https://github.com/MariaDB/server/security/advisories/GHSA-2245-9hm3-wxf6) | CONNECT file UDFs and OS file access | **Unable to verify**; plugin state/grants not queried |
| [CVE-2026-107823](https://github.com/MariaDB/server/security/advisories/GHSA-g2q2-3936-cp37) | CREATE USER and CREATE VIEW WITH GRANT OPTION; crafted metadata | **Unable to verify**; privilege prerequisites are material |

CVE-2026-92262/85746/85748 have upstream Critical ratings, but they are not three confirmed critical ReFind database exposures. Maintainer advisory publication and CNA publication differ (e.g. September GHSA versus 16 October CVE publication). [MariaDB security register](https://github.com/MariaDB/server/security/advisories).

Galera SST/notification, RPM packaging and systemd advisories do not describe the observed standalone Windows deployment. Connector/C CVE-2026-44172 does not describe PHP's mysqlnd prepared-statement/utf8mb4 implementation. These exclusions do not excuse MariaDB 10.4's EOL. [MariaDB maintenance policy](https://mariadb.org/about/#maintenance-policy).

### 3.4 phpMyAdmin and bundled PHP dependencies

- **Potentially affected:** [CVE-2025-24530 / PMASA-2025-1](https://www.phpmyadmin.net/security/PMASA-2025-1/) and [CVE-2025-24529 / PMASA-2025-2](https://www.phpmyadmin.net/security/PMASA-2025-2/), affecting 5.x before 5.2.2. Table-check/Insert XSS needs an authenticated administrative workflow and suitable attacker-controlled values. Current local-only Apache restriction reduces remote exposure; browser/local threats remain.
- **Not affected by the stated platform prerequisite:** [PMASA-2025-3 / CVE-2024-2961](https://www.phpmyadmin.net/security/PMASA-2025-3/) concerns vulnerable **glibc** iconv plus a non-default export charset path. Windows iconv presence is not glibc evidence.
- **Unverified prior claim:** no October 2026 phpMyAdmin application security release was found in the vendor's [security register](https://www.phpmyadmin.net/security/). Latest listed stable is [5.2.3, released 8 October 2025](https://www.phpmyadmin.net/files/5.2.3/), not October 2026.
- Updating the top-level application does not automatically prove that all later Twig/Symfony advisories are resolved. Prefer an updated vendor-supported package with a checked dependency BOM; do not run arbitrary Composer upgrades inside XAMPP's phpMyAdmin installation.

**OSV method:** one read-only querybatch of 171 public package/version pairs: 114 npm lock entries, 1 ReFind Composer package and 56 installed phpMyAdmin packages. Separate jQuery/Bootstrap queries bring the total to **173**. No package manager audit, install, cache or lock write was used. **27 matches** were returned; all 27 advisory records were read through OSV. A zero-match result is limited to that database and date.

The following inventory is intentionally retained for future remediation. “Potential” means the version matches but a reachable attacker-controlled application path is unproven. **None is a confirmed ReFind-authored vulnerability.**

| Package / installed version | Advisory / CVE | Upstream severity | Matching affected range → fix | OSV published / modified | Applicability / prerequisite |
|---|---|---|---|---|---|
| minimatch@10.2.6 | [GHSA-g3hv-75wg-m249](https://osv.dev/vulnerability/GHSA-g3hv-75wg-m249) / CVE-2026-118764 | MODERATE | <11.0.1 → 11.0.1 | 2026-10-30 / 2026-10-30 | Potential, QA only: attacker-controlled glob plus optimizationLevel ≥2; parent-compatible fix required. |
| paragonie/sodium_compat@v1.19.0 | [GHSA-mrfv-m5wm-5w6w](https://osv.dev/vulnerability/GHSA-mrfv-m5wm-5w6w) / CVE-2025-69277 | MODERATE | <1.24.0 → 1.24.0 | 2025-12-31 / 2026-09-10 | Potential: unusual/custom Ed25519 point-validation use; no ReFind crypto path. |
| slim/psr7@1.4 | [GHSA-q2qj-628g-vhfw](https://osv.dev/vulnerability/GHSA-q2qj-628g-vhfw) / CVE-2023-30536 | MODERATE | <1.4.1 → 1.4.1 | 2023-04-18 / 2026-09-10 | Potential: attacker-controlled HTTP header name/value in PSR-7 construction. |
| symfony/cache@v5.4.19 | [GHSA-6qh9-h6wf-jgqc](https://osv.dev/vulnerability/GHSA-6qh9-h6wf-jgqc) / CVE-2026-45073 | MODERATE | <5.4.52 → 5.4.52 | 2026-05-27 / 2026-09-10 | Potential: untrusted cache clear prefix with PdoAdapter; no ReFind use. |
| symfony/process@v5.4.19 | [GHSA-qq5c-677p-737q](https://osv.dev/vulnerability/GHSA-qq5c-677p-737q) / CVE-2024-51736 | HIGH | <5.4.46 → 5.4.46 | 2024-11-06 / 2026-09-10 | Potential: Windows Process class plus attacker-planted cmd.exe in working directory. |
| symfony/process@v5.4.19 | [GHSA-r39x-jcww-82v6](https://osv.dev/vulnerability/GHSA-r39x-jcww-82v6) / CVE-2026-24739 | MODERATE | <5.4.51 → 5.4.51 | 2026-01-28 / 2026-09-10 | Potential: PHP launched under MSYS2/Git Bash, native child processes and affected arguments. |
| tecnickcom/tcpdf@6.6.2 | [GHSA-4p8j-vhjm-6pvw](https://osv.dev/vulnerability/GHSA-4p8j-vhjm-6pvw) / CVE-2024-56519 | MODERATE | <6.8.0 → 6.8.0 | 2024-12-27 / 2025-11-03 | Potential: untrusted SVG rendered through TCPDF. |
| tecnickcom/tcpdf@6.6.2 | [GHSA-9mgx-552f-59p6](https://osv.dev/vulnerability/GHSA-9mgx-552f-59p6) / CVE-2024-56521 | HIGH | <6.8.0 → 6.8.0 | 2024-12-27 / 2024-12-27 | Potential: TCPDF remote resource loading with libcurl. |
| tecnickcom/tcpdf@6.6.2 | [GHSA-g9wg-98c2-qv3v](https://osv.dev/vulnerability/GHSA-g9wg-98c2-qv3v) / CVE-2024-32489 | MODERATE | <6.7.4 → 6.7.4 | 2024-04-15 / 2025-11-03 | Potential: attacker-controlled HTML passed to TCPDF. |
| tecnickcom/tcpdf@6.6.2 | [GHSA-mx3p-fhpw-x6rv](https://osv.dev/vulnerability/GHSA-mx3p-fhpw-x6rv) / CVE-2024-22640 | MODERATE | <6.7.5 → 6.7.5 | 2024-04-19 / 2025-11-04 | Potential: crafted color in untrusted TCPDF HTML input. |
| tecnickcom/tcpdf@6.6.2 | [GHSA-qx95-cwh6-9mvq](https://osv.dev/vulnerability/GHSA-qx95-cwh6-9mvq) / CVE-2024-56527 | MODERATE | <6.8.0 → 6.8.0 | 2024-12-27 / 2025-11-04 | Potential: attacker-controlled TCPDF error content reaches HTML. |
| tecnickcom/tcpdf@6.6.2 | [GHSA-rmv2-8jjc-23xw](https://osv.dev/vulnerability/GHSA-rmv2-8jjc-23xw) / CVE-2024-51058 | MODERATE | <6.7.6 → 6.7.6 | 2024-11-26 / 2025-11-03 | Potential: untrusted image source used by TCPDF. |
| tecnickcom/tcpdf@6.6.2 | [GHSA-w95c-7994-ghpr](https://osv.dev/vulnerability/GHSA-w95c-7994-ghpr) / CVE-2024-56522 | HIGH | <6.8.0 → 6.8.0 | 2024-12-27 / 2025-11-03 | Potential: TCPDF tag authentication/comparison path. |
| twig/twig@v3.5.0 | [GHSA-2g2g-8p8h-fgwm](https://osv.dev/vulnerability/GHSA-2g2g-8p8h-fgwm) / CVE-2026-47730 | LOW | >=3.0.0, <3.26.0 → 3.26.0 | 2026-06-05 / 2026-09-10 | Potential: HTML profiler dumper renders attacker-controlled profile/template names. |
| twig/twig@v3.5.0 | [GHSA-4j38-f5cw-54h7](https://osv.dev/vulnerability/GHSA-4j38-f5cw-54h7) / CVE-2026-46628 | LOW | <3.26.0 → 3.26.0 | 2026-05-21 / 2026-09-10 | Potential: spaceless filter applied to untrusted markup. |
| twig/twig@v3.5.0 | [GHSA-529h-vh3j-85hq](https://osv.dev/vulnerability/GHSA-529h-vh3j-85hq) / CVE-2026-49981 | HIGH | <3.27.0 → 3.27.0 | 2026-07-01 / 2026-09-10 | Potential: sandbox state changes across cached template renders. |
| twig/twig@v3.5.0 | [GHSA-5v5v-ww74-355v](https://osv.dev/vulnerability/GHSA-5v5v-ww74-355v) / CVE-2026-48806 | MODERATE | <3.27.0 → 3.27.0 | 2026-06-30 / 2026-09-10 | Unable to verify older 3.5 reachability: prose discusses 3.26 hardening/regression. |
| twig/twig@v3.5.0 | [GHSA-6377-hfv9-hqf6](https://osv.dev/vulnerability/GHSA-6377-hfv9-hqf6) / CVE-2024-51754 | LOW | <3.11.2 → 3.11.2 | 2024-11-06 / 2025-05-29 | Potential: untrusted sandboxed templates and Stringable objects. |
| twig/twig@v3.5.0 | [GHSA-6j75-5wfj-gh66](https://osv.dev/vulnerability/GHSA-6j75-5wfj-gh66) / CVE-2024-45411 | MODERATE | >=3.0.0, <3.11.1 → 3.11.1 | 2024-09-09 / 2024-10-10 | Potential: disabled global sandbox plus cached sandboxed include. |
| twig/twig@v3.5.0 | [GHSA-7fxw-r6jv-74c8](https://osv.dev/vulnerability/GHSA-7fxw-r6jv-74c8) / CVE-2026-46638 | MODERATE | <3.26.0 → 3.26.0 | 2026-05-21 / 2026-09-10 | Potential: deprecated sandbox/include path and cached templates. |
| twig/twig@v3.5.0 | [GHSA-7p85-w9px-jpjp](https://osv.dev/vulnerability/GHSA-7p85-w9px-jpjp) / CVE-2026-46633 | CRITICAL | <3.26.0 → 3.26.0 | 2026-05-21 / 2026-09-10 | Potential: ability to author Twig use-tags/templates; not report-title injection. |
| twig/twig@v3.5.0 | [GHSA-8x9c-rmqh-456c](https://osv.dev/vulnerability/GHSA-8x9c-rmqh-456c) / CVE-2026-48807 | MODERATE | <3.27.0 → 3.27.0 | 2026-06-30 / 2026-09-10 | Unable to verify older-version feature reachability; inspect coercion/API presence. |
| twig/twig@v3.5.0 | [GHSA-h8vq-8gpg-mhcg](https://osv.dev/vulnerability/GHSA-h8vq-8gpg-mhcg) / CVE-2026-48808 | MODERATE | <3.27.0 → 3.27.0 | 2026-06-30 / 2026-09-10 | Unable to verify: requires SourcePolicyInterface-specific sandbox behavior. |
| twig/twig@v3.5.0 | [GHSA-jjxq-ff2g-95vh](https://osv.dev/vulnerability/GHSA-jjxq-ff2g-95vh) / CVE-2024-51755 | LOW | <3.11.2 → 3.11.2 | 2024-11-06 / 2024-11-12 | Potential: sandboxed templates with array-like objects. |
| twig/twig@v3.5.0 | [GHSA-p42q-9prx-q5wq](https://osv.dev/vulnerability/GHSA-p42q-9prx-q5wq) / CVE-2026-48805 | LOW | <3.27.0 → 3.27.0 | 2026-06-30 / 2026-09-10 | Unable to verify: description says regression from 3.26, while OSV range starts at 0. |
| twig/twig@v3.5.0 | [GHSA-pr2w-4gpj-cpq4](https://osv.dev/vulnerability/GHSA-pr2w-4gpj-cpq4) / CVE-2026-47732 | HIGH | <3.26.0 → 3.26.0 | 2026-06-05 / 2026-09-10 | Potential: sandboxed templates with unguarded Stringable coercion. |
| twig/twig@v3.5.0 | [GHSA-vcc8-phrv-43wj](https://osv.dev/vulnerability/GHSA-vcc8-phrv-43wj) / CVE-2026-46635 | LOW | <3.26.0 → 3.26.0 | 2026-05-21 / 2026-09-10 | Potential: sandboxed column filter acting on objects. |

Dates in the dependency table are OSV record dates, not necessarily original maintainer disclosure dates (minimatch's maintainer disclosure was 27 October, OSV publication 30 October).

For Twig, broad scanner ranges must be reconciled with maintainer prose and installed API availability, especially regressions described as starting in 3.26. The installed compiler's string routine was inspected, but no untrusted-template feature was found in ReFind. phpMyAdmin uses its own server-controlled templates; obtaining template-write access is a separate prerequisite. Do not report “a report title causes Twig RCE.” Each OSV row links its range/provenance and maintainer references.

### 3.5 Node, OpenSSL, image and compression libraries

| Component/advisory | Applicability decision |
|---|---|
| [Node October security release](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases): CVE-2026-105482, 105483, 106069/106072 | **Potentially affected QA runtime**: DNS/TLS input/normalization prerequisites matter. Fixed Node 24.22.1; choose latest 24.22.2. No Node web service was found. |
| Node CVE-2026-111497 | **Potentially affected:** installed Brotli 1.2.0; untrusted Brotli decompression required. This is separate from PHP cURL's absent Brotli feature. |
| Node CVE-2026-105481, 106074, 106073 | **Conditional:** HTTP-agent peer behavior, built snapshots containing crypto caches, or the permission model respectively. No snapshot-based ReFind application deployment exists. |
| [OpenSSL lifecycle](https://openssl-library.org/roadmap/) | **Confirmed support gap**: Apache 3.1.3 and PHP 3.0.11 are different EOL copies. Node's maintained 3.5 line still needs its security patch. |
| [OpenSSL CVE-2026-84782](https://openssl-library.org/news/vulnerabilities/#CVE-2026-84782), 29 Sep | **Not a normal HTTPS attack path:** requires DTLS retransmission; do not equate TLS over TCP with DTLS. PHP 3.0.11 is below the listed 3.0.23 fix, but relevant API use is absent/unverified. |
| OpenSSL CVE-2026-84783 | **Not affected by installed versions:** listed as 4.0.0 before 4.0.3, not 3.0/3.1. |
| OpenSSL CVE-2023-5678 | **Potential library exposure, no ReFind path**: untrusted DH parameter checking/generation; fixed 3.0.13/3.1.5. |
| [zlib CVE-2022-37434](https://www.cve.org/CVERecord?id=CVE-2022-37434) | **Potentially affected library; ReFind route unproven.** 1.2.12 is old, but the advisory specifically requires inflateGetHeader. Do not infer exploitability from any image inflation. Use provider-patched library; upstream current is 1.3.2. |
| [libpng security register](https://libpng.org/pub/png/libpng.html) | **Potential API-specific issues:** old 1.6.34 falls in several setter/simplified-API ranges. CVE-2026-22695 is a later regression and CVE-2026-33636 is ARM Neon/from 1.6.36, so neither describes this x64 1.6.34 build. No full server PNG decode found in current report upload route. |
| [curl CVE-2023-38545](https://curl.se/docs/CVE-2023-38545.html) | **Patched:** PHP's libcurl 8.4.0 already includes the SOCKS5 fix. |
| [curl CVE-2025-9086](https://curl.se/docs/CVE-2025-9086.html) | **Not affected:** listed 8.13.0–8.15.0 range excludes installed 8.4.0. That does not make 8.4.0 generally current/safe. |
| JPEG, WebP, libxml and other bundled libraries | **Unable to verify all exact security patch levels.** Inventory is incomplete where native API labels hide the implementation version. No production XML parsing, remote URL fetch, arbitrary font loading or OS-command execution found in ReFind. |

**Candidate-package caveat:** Apache Lounge's published 2.4.69-261002 BOM includes OpenSSL 3.5.9, but also **Brotli 1.2.0**, predating the October decoder fix. It is a candidate for core compatibility, not an unconditional all-dependencies-patched endorsement. Obtain an updated provider package or establish that affected optional decoding paths are absent; never silently copy a replacement DLL. [Provider BOM](https://www.apachelounge.com/viewtopic.php?p=44502).

### 3.6 Advisory verification limits

This is a relevant-advisory assessment, not an exhaustive binary SBOM certification. No conclusion of “no CVEs” follows from an empty query, an EOL series disappearing from a supported-version table, an unreadable NVD page, or a missing CVE record. Windows Update state, Apache APR/native library versions, phpMyAdmin dependency call reachability, browser/FFmpeg versions and some GD dependencies still need non-invasive inventory in future isolated QA. Every remediation package must refresh these sources at implementation time.


## 4. Threat Model

### 4.1 Assets, actors and trust boundaries

Assets are account/password hashes, live session authority, private ownership clues/evidence, claimant identifiers, the integrity of ownership/pickup decisions, uploaded images, audit history and recoverable database/media snapshots. A matching score is only a candidate ranking, never an ownership probability.

Relevant attackers are an unauthenticated network client; an authenticated dishonest Student; a user of the same campus network; a compromised BM account; a malicious upload/dependency producer; and a local process or developer automation with filesystem access. Localhost access does not make every process or browser origin trustworthy.

| Boundary | Actual enforcement | Important limitation |
|---|---|---|
| Network → Apache/PHP | Host listeners, Apache config, request handling | App authentication starts after the runtime boundary; broad listeners and aliases are separate from app routes |
| Browser → protected HTML | Fixed route map and role checks before rendering; trusted partial names; output escaping | Other XAMPP applications share the host; app .htaccess cannot harden sibling/admin aliases |
| Browser → API | Current DB identity, method/field allowlists, CSRF and Origin checks, action role | No general business-write/search rate limiter |
| API → business objects | Own reporter/claimant predicates, eligible state, field projections | BM is intentionally campus-wide privileged; no extra Security/Student Service auth roles |
| Transactions → MariaDB | Prepared SQL, InnoDB, ordered parent locks, fresh revisions, advisory lock for matching/BM writes | Uniqueness of approved owners/confirmed pairs relies partly on application locking, not just a single database constraint |
| Database metadata → media bytes | Fixed collections, generated random paths, signed-in/BM checks, MIME response | Storage remains below DocumentRoot and depends on effective Apache denials and filesystem ACLs |
| Developer/CI → runtime state | CLI-only fixture, ownership/profile guards, separate database/path/session checks | Historical passing tests are not permission to execute them against main |
| Backups → restoration | Paused-write contract and synthetic recovery tooling | Real backup completeness, access and restoration were not examined |

Evidence: [page.php:14](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/page.php:14), [page.php:49](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/page.php:49), [app/routes.php:5](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/routes.php:5), [app/auth.php:61](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/auth.php:61), [app/policies.php:27](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/policies.php:27), [app/repository.php:42](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/repository.php:42), [app/workflow.php:177](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/workflow.php:177), [api/photos.php:6](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/api/photos.php:6), [tools/qa-guard.php:30](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/tools/qa-guard.php:30).

### 4.2 Route and projection map

| Endpoint | Read boundary | Write boundary / projection |
|---|---|---|
| session.php | Guest/authenticated bootstrap | Minimal own identity + per-session CSRF; GET creates/touches session state |
| auth.php | No business GET | CSRF login/logout; DB role, generic failures, rate limits |
| references.php | Guest allowed | Intended taxonomy, campus date/timezone and pickup desk; no write |
| account.php | Own account | Own name/password/avatar only; email, ID and role not mutable |
| avatar.php | Any signed-in user | Current 32-hex token; no arbitrary path; images are intentionally shared with signed-in users |
| items.php | Signed-in public fields; own eligible edit metadata separately | Student own report, guarded state, media ownership |
| claims.php | Student own claims; BM queue | Student own claim and own optional Lost link; private evidence URLs BM-only |
| staff.php | BM only | BM review/status with current revision and explicit confirmation |
| handovers.php | Student own claim pickup; BM queues/details | BM only; claimant email/student ID omitted for Students |
| notifications.php | Own notifications | Own read/read-all updates; no cross-user mark-read |
| photos.php | ITEM: signed-in; OWNERSHIP and claim: BM | No upload here; fixed authorized file delivery |
| page.php | Fixed public/protected route allowlist | GET/HEAD only; no dynamic template path |

Public means **visible to authenticated users** for reports and ITEM photos. Names, reporter IDs and current avatar URLs are intentional public projections; email/student ID/clue/evidence and other claimants' pickup details are not. A student may receive their own review note and retained evidence IDs without being allowed to retrieve private evidence bytes. These are distinct permissions.

### 4.3 Highest-impact realistic paths

| Scenario | Existing protection / realistic residual risk | Priority / future test |
|---|---|---|
| Network client reaches old PHP before login | App guards cannot repair engine initialization bugs; two critical applicable CVEs | **P0**, T01/T02 |
| Same-network client reaches PHP-CGI, admin or database listener | Local admin restrictions help, but broad listeners/unused CGI alias need exposure verification | **P0/P1**, T01 |
| Student calls staff or changes role/owner fields | DB role + method/action/field checks reject the request | Retain; T03/T04 |
| Student guesses claim, notification, Lost or evidence IDs | Query scoping and media authorization reject foreign private objects | Retain; T04/T06 |
| Attacker forges clues or claims ownership with a high match score | BM still decides; approval uses eligible fresh state, not score threshold | Retain; T09/T10 |
| Two BMs approve competing claims or race a release/completion | Ordered locks, revisions, current-state checks and transactions | High-impact regression boundary; T10/T11 |
| Compromised BM approves fraudulent pickup | Within-role abuse cannot be solved by IDOR guards; evidence access and decisions are valuable targets | Auditability and public-deployment BM authentication decision; T15 |
| Authenticated account floods reports/claims/searches | Per-file counts and pagination bound individual operations; total activity/storage and matching lock contention remain | **P1 before public access**, T12 |
| Upload carries metadata or unusual image content | Type/dimension/size/path controls are strong; report/claim bytes are not server-normalized | Privacy/decode verification, P2; T07 |
| Developer agent trusts repository/issue instructions or a “test” script | Could run setup, reveal secrets or point fixtures at main | Isolated tooling, protected checks and review; section 11 |

No SSRF fetch, arbitrary command execution, eval or unserialize path was identified in ReFind production PHP. This reduces specific advisory reachability; it does not cover Apache aliases or phpMyAdmin.

## 5. 30-Control Security Matrix

### 5.1 Assessment rules and standards

**Verified** means the named protection was established in the audited source and its relevant existing assertions inspected, not that every deployment behavior was newly tested. **Implemented but Unverified** is used for properties that require runtime/concurrency/recovery evidence beyond this audit. **Partial** means a specific part exists but material coverage is absent. **Missing** is contextual: local HTTP is intentional, while external HTTPS enforcement is absent.

ASVS **5.0.0**, not 4.x numbering, supplies applicable Level 1 and Level 2 requirements. ReFind's personal identifiers, private evidence and privileged ownership decisions justify L2-oriented review. Absence of MFA, limited recovery/session management, cookie/deployment exceptions and operational gaps mean this report does **not certify L1 or L2 compliance**. No L3 requirement is imposed merely to maximize a score. OAuth/JWT/SSO, arbitrary archive handling, SSRF fetch services and additional roles are not present features.

The mapping uses [ASVS 5.0](https://asvs.owasp.org/), [Top 10:2025](https://top10.owasp.org/2025/) and [API Top 10:2023](https://api-security.owasp.org/editions/2023/en/0x11-t10/). Principal risk categories are access control, misconfiguration, supply chain, authentication, injection, logging and exceptional-condition handling; API4/API6 are relevant to resource/business-flow abuse. OWASP cheat sheets supplement the control details.

**Severity in a control detail describes the attack scenario's possible impact, not an additional confirmed finding.** Difficulty and regression risk use Low/Medium/High for the minimum next work. Historical tests cited below were inspected, not executed; T01–T16 are the future tests in section 9.



### 5.2 Control index

| ID | Control | Status | Evidence confidence | Evidence entry point | Future verification |
|---|---|---|---|---|---|
| C01 | Password hashing and verification | **Verified** | High source | [app/auth.php:143](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/auth.php:143) | T05 |
| C02 | Login limiting and anti-enumeration | **Partial** | High source | [app/auth.php:157](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/auth.php:157) | T05/T12 |
| C03 | Password change, recovery and reauthentication | **Partial** | High source | [app/accounts.php:29](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/accounts.php:29) | T05/T15 |
| C04 | MFA for BM and other accounts | **Missing** | High source | [api/auth.php:8](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/api/auth.php:8) | T15 |
| C05 | Session lifecycle and invalidation | **Verified** | High source | [app/auth.php:6](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/auth.php:6) | T05 |
| C06 | Secure session cookies | **Implemented but Unverified** | High source; runtime Unverified | [app/auth.php:15](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/auth.php:15) | T02/T05 |
| C07 | CSRF prevention | **Verified** | High source | [app/auth.php:101](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/auth.php:101) | T03 |
| C08 | Server-side role authorization | **Verified** | High source | [app/auth.php:61](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/auth.php:61) | T03 |
| C09 | Object authorization / IDOR | **Verified** | High source | [app/policies.php:27](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/policies.php:27) | T04 |
| C10 | Field authorization / mass assignment | **Verified** | High source | [app/http.php:45](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/http.php:45) | T04/T06 |
| C11 | Report/claim/ownership/handover integrity | **Verified** | High source | [app/claims.php:82](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/claims.php:82) | T09/T10/T11 |
| C12 | Transactions, races and concurrency | **Implemented but Unverified** | High source; runtime Unverified | [app/repository.php:42](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/repository.php:42) | T10 |
| C13 | Server-side validation | **Verified** | High source | [app/http.php:51](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/http.php:51) | T08 |
| C14 | SQL injection prevention | **Verified** | High source | [app/db.php:23](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/db.php:23) | T08 |
| C15 | XSS/contextual output encoding | **Verified** | High source | [page.php:24](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/page.php:24) | T08 |
| C16 | Content Security Policy | **Implemented but Unverified** | High source; runtime Unverified | [app/http.php:23](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/http.php:23) | T02/T08 |
| C17 | File upload validation | **Verified** | High source | [app/uploads.php:5](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/uploads.php:5) | T07 |
| C18 | Image processing, metadata and storage | **Partial** | High source | [app/uploads.php:74](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/uploads.php:74) | T07 |
| C19 | Protected media retrieval | **Verified** | High source | [api/photos.php:6](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/api/photos.php:6) | T06 |
| C20 | Traversal/arbitrary file access | **Verified** | High source | [app/uploads.php:86](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/uploads.php:86) | T01/T06 |
| C21 | Application-wide rate/resource limits | **Partial** | High source/config; impact/deployment limited | [app/repository.php:430](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/repository.php:430) | T12 |
| C22 | External HTTPS/TLS enforcement | **Missing** | High source/config; impact/deployment limited | [app/auth.php:21](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/auth.php:21) | T02 |
| C23 | HTTP security headers | **Partial** | High source | [app/http.php:23](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/http.php:23) | T02 |
| C24 | Restrictive CORS / same-origin API | **Verified** | High source | [js/api.js:13](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/js/api.js:13) | T03 |
| C25 | Secrets/credential management | **Partial** | High source/config; impact/deployment limited | [app/config.php:103](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/config.php:103) | T13/T15 |
| C26 | PHP/Apache/admin hardening | **Partial** | High source | [.htaccess:1](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/.htaccess:1) | T01/T02/T13 |
| C27 | Database least privilege / transport | **Partial** | Deployed grants Unverified; High source | [app/db.php:5](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/db.php:5) | T13 |
| C28 | Dependencies and supply chain | **Partial** | High inventory; exploit path Unverified | [package.json:1](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/package.json:1) | T14 |
| C29 | Security logs, monitoring and audit | **Partial** | High source/config; impact/deployment limited | [app/http.php:86](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/http.php:86) | T15 |
| C30 | Backups and verified recovery | **Implemented but Unverified** | High source; runtime Unverified | [tools/backup-project.py:14](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/tools/backup-project.py:14) | T16 |

### 5.3 Evidence, attack scenarios and minimal improvements

#### C01 — Password hashing and verification

**Status:** Verified. **ASVS mapping:** 11.4.2 (L2); 6.2.8 (L1).

- **Evidence / existing protection:** [app/auth.php:143](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/auth.php:143), [app/accounts.php:174](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/accounts.php:174). password_verify, dummy hash, password_hash(PASSWORD_DEFAULT), NUL/72-byte rejection and no password trimming.
- **Attack / severity / confidence:** Offline cracking or hash/truncation bypass; High impact. Confirmed implementation; cost/actual account hashes not inspected.
- **Gap / minimal recommendation:** Keep existing hashes valid. Measure new hashing cost after PHP upgrade; consider rehash only in a separate reviewed change, never bulk-reset accounts.
- **Verification:** test-auth:259; test-account:105–129; T05. **Difficulty:** Low. **Regression risk:** Low.

#### C02 — Login limiting and anti-enumeration

**Status:** Partial. **ASVS mapping:** 6.1.1 / 6.3.1 (L1); 6.3.8 (L2).

- **Evidence / existing protection:** [app/auth.php:157](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/auth.php:157), [api/auth.php:8](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/api/auth.php:8). HMAC-keyed pair/IP buckets, locked file, 5 pair failures/15min and 30/IP defaults, dummy verification and generic failures.
- **Attack / severity / confidence:** Distributed guessing, timing enumeration or limiter contention; High potential impact. Controls confirmed; bypass/timing impact unverified.
- **Gap / minimal recommendation:** No per-account cross-IP policy or measured timing equivalence. Add bounded account-aware/backoff policy if needed, avoiding easy account lockout or campus-NAT denial.
- **Verification:** test-auth:126,246,254; T05/T12. **Difficulty:** Medium. **Regression risk:** Medium.

#### C03 — Password change, recovery and reauthentication

**Status:** Partial. **ASVS mapping:** 6.2.2–4 (L1); 6.4.3 / 7.5.1 (L2).

- **Evidence / existing protection:** [app/accounts.php:29](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/accounts.php:29), [app/accounts.php:134](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/accounts.php:134). Current password verification, independent limiter, locked fresh fingerprint, atomic hash update and session/CSRF rotation.
- **Attack / severity / confidence:** Stolen session or weak new password; High potential impact. Secure change path confirmed; recovery absent.
- **Gap / minimal recommendation:** No forgotten-password flow/common-password blocklist. First document operator-assisted recovery and add an offline list covering at least the top 3,000 policy-matching common passwords; automate recovery only with verified campus identity requirements.
- **Verification:** test-account:105–144; T05/T15. **Difficulty:** Medium. **Regression risk:** Medium.

#### C04 — MFA for BM and other accounts

**Status:** Missing. **ASVS mapping:** 6.3.3 (L2).

- **Evidence / existing protection:** [api/auth.php:8](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/api/auth.php:8), [app/auth.php:157](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/auth.php:157). Current login uses email/password only; role checks still apply.
- **Attack / severity / confidence:** Compromised BM password grants evidence/decision access; High impact, confirmed absence; compromise not established.
- **Gap / minimal recommendation:** Optional for present local demo. Before public BM access, use campus MFA/SSO or a separately reviewed MFA mechanism, or explicitly document compensating access restrictions/risk acceptance. No L2 claim without it.
- **Verification:** No MFA tests; T15. **Difficulty:** High. **Regression risk:** High.

#### C05 — Session lifecycle and invalidation

**Status:** Verified. **ASVS mapping:** 7.2.1–4 (L1); 7.3.1–2 (L2); 7.4.1–3.

- **Evidence / existing protection:** [app/auth.php:6](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/auth.php:6), [app/auth.php:40](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/auth.php:40). Private file sessions, strict/cookie-only mode, login rotation, idle/absolute expiry, fresh active-user/password fingerprint and logout destruction.
- **Attack / severity / confidence:** Fixation, old-cookie reuse or post-password-change replay; High impact. Enforcement confirmed in source.
- **Gap / minimal recommendation:** Keep defaults 30min idle/8h absolute unless explicitly changed. Session inventory/manual revocation UI is a later L2 gap, not a reason to rewrite current authentication.
- **Verification:** test-auth:110,202–234; test-account:110; T05. **Difficulty:** Low. **Regression risk:** Medium.

#### C06 — Secure session cookies

**Status:** Implemented but Unverified. **ASVS mapping:** 3.3.1–4 (L1/L2).

- **Evidence / existing protection:** [app/auth.php:15](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/auth.php:15), [app/auth.php:235](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/auth.php:235). HttpOnly, SameSite=Lax, host-only cookie and base-path scope; Secure conditional on server HTTPS.
- **Attack / severity / confidence:** Network theft or scope confusion; High on public HTTP, reduced for loopback. Source confirmed; delivered cookies/proxy normalization unverified.
- **Gap / minimal recommendation:** Validate real TLS cookies in QA. Existing cookie name is not an ASVS __Secure-/__Host- prefix; preserve current identity until a separately approved deployment/session migration. Do not blindly change Path to /.
- **Verification:** test-auth:104; test-release-security:35; T02/T05. **Difficulty:** Low. **Regression risk:** Medium.

#### C07 — CSRF prevention

**Status:** Verified. **ASVS mapping:** 3.5.1 / 3.5.3 (L1).

- **Evidence / existing protection:** [app/auth.php:101](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/auth.php:101), [js/api.js:13](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/js/api.js:13). Random session token, hash_equals, mismatched header/body rejection, Origin scheme/host/port validation; mutations use POST.
- **Attack / severity / confidence:** Cross-site profile/claim/BM write; High impact. Reviewed operations protected.
- **Gap / minimal recommendation:** Retain token and role ordering through refactors. Add absent/null Origin and conflicting body/header cases to targeted QA; do not use CORS as a CSRF replacement.
- **Verification:** test-auth:157; test-account:98; test-workflow:41; T03. **Difficulty:** Low. **Regression risk:** Medium.

#### C08 — Server-side role authorization

**Status:** Verified. **ASVS mapping:** 8.2.1 / 8.3.1 (L1).

- **Evidence / existing protection:** [app/auth.php:61](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/auth.php:61), [api/staff.php:5](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/api/staff.php:5). Role reread from active DB user; Student/BM API and HTML guards; no client-selectable role.
- **Attack / severity / confidence:** Student accesses BM evidence or decisions; High impact. No bypass established.
- **Gap / minimal recommendation:** Preserve exactly STUDENT and BUILDING_MANAGEMENT; check all new adapters before private reads. Source helper functions assume authorized callers, so future direct callers need explicit review.
- **Verification:** test-auth:135–154,221; T03. **Difficulty:** Low. **Regression risk:** Medium.

#### C09 — Object authorization / IDOR

**Status:** Verified. **ASVS mapping:** 8.2.2 (L1).

- **Evidence / existing protection:** [app/policies.php:27](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/policies.php:27), [api/claims.php:14](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/api/claims.php:14). Reporter ownership, own claimant predicates, own pickup/notification scope, and retained-photo membership checks.
- **Attack / severity / confidence:** Read/change another user's private record; High impact. Source protection confirmed.
- **Gap / minimal recommendation:** Keep negative tests for foreign IDs in both query/body and foreign retained-media IDs. Discoverable report IDs are not themselves a privacy defect.
- **Verification:** test-auth:164,184; test-student:48; T04. **Difficulty:** Low. **Regression risk:** Medium.

#### C10 — Field authorization / mass assignment

**Status:** Verified. **ASVS mapping:** 8.2.3 (L2); 15.3.1 / 15.3.3.

- **Evidence / existing protection:** [app/http.php:45](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/http.php:45), [app/accounts.php:142](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/accounts.php:142). Action field allowlists; server-derived owner/role; explicit public columns and own/BM projections.
- **Attack / severity / confidence:** Inject role, reporter ID, approval/status or secret response fields; High impact. No mass-assignment path established.
- **Gap / minimal recommendation:** Retain explicit projections and reject protected fields. Keep raw batched rows separate from public objects; snapshot equality alone must not be the only privacy assertion.
- **Verification:** test-account:92; test-auth:175; test-projection.php; T04/T06. **Difficulty:** Low. **Regression risk:** Medium.

#### C11 — Report/claim/ownership/handover integrity

**Status:** Verified. **ASVS mapping:** 2.3.1 (L1); 2.3.2 (L2).

- **Evidence / existing protection:** [app/claims.php:82](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/claims.php:82), [app/workflow.php:177](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/workflow.php:177). Eligibility and terminal checks; REJECTED final, same-record resubmission, BM confirmation/revision, distinct cancel/release/complete.
- **Attack / severity / confidence:** Skip approval, reclaim rejected item, forge return or reopen approved ownership; High impact. Guards confirmed; no defect established.
- **Gap / minimal recommendation:** Preserve existing business contract and labels. A matching score must never authorize ownership. Verify all exception paths after runtime or refactor changes.
- **Verification:** test-workflow:43–56; test-v025; T09/T10/T11. **Difficulty:** Low. **Regression risk:** High.

#### C12 — Transactions, races and concurrency

**Status:** Implemented but Unverified. **ASVS mapping:** 2.3.3–4 / 15.4.2–3 (L2).

- **Evidence / existing protection:** [app/repository.php:42](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/repository.php:42), [app/workflow.php:187](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/workflow.php:187). InnoDB transactions, numeric item lock order, claim reread/revision, matching advisory lock, rollback/error mapping; UNIQUE claim pair/handover.
- **Attack / severity / confidence:** Competing approvals, shared-Lost races or partial media/DB commits; High impact. Source confirmed, no new concurrency run.
- **Gap / minimal recommendation:** Existing schema does not by itself enforce every conditional one-owner/pair invariant. Retain application locks; do not add constraints or generic transaction abstractions without separate design and races/rollback tests.
- **Verification:** test-student:49,52,54; test-workflow:47,52,57–60; T10. **Difficulty:** Medium. **Regression risk:** High.

#### C13 — Server-side validation

**Status:** Verified. **ASVS mapping:** 2.2.1–3 (L1/L2).

- **Evidence / existing protection:** [app/http.php:51](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/http.php:51), [app/reports.php:14](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/reports.php:14). UTF-8/type/length/ID limits; active references, valid nonfuture campus date, nullable unknown time and schedule validation.
- **Attack / severity / confidence:** Bypass browser validation or submit inconsistent references/time; Medium/High impact. Server checks confirmed.
- **Gap / minimal recommendation:** Keep direct-API malformed arrays, control characters, boundaries and ignored/unsupported-field cases. Remaining malformed transport behavior needs QA, not frontend-only fixes.
- **Verification:** test-student:46; test-account:85; test-v025; T08. **Difficulty:** Low. **Regression risk:** Medium.

#### C14 — SQL injection prevention

**Status:** Verified. **ASVS mapping:** 1.2.4 (L1).

- **Evidence / existing protection:** [app/db.php:23](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/db.php:23), [api/items.php:47](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/api/items.php:47). mysqli prepare/bind; dynamic SQL names/fragments restricted to fixed allowlists and placeholder counts.
- **Attack / severity / confidence:** SQL-shaped search/IDs/notes become executable SQL; High impact. No production concatenation of untrusted SQL tokens found.
- **Gap / minimal recommendation:** Retain parameter binding and review identifier/order fragments separately. CLI fixture raw SQL is not a public production API and remains behind CLI/isolation guards.
- **Verification:** test-release-security:43; test-student:44; T08. **Difficulty:** Low. **Regression risk:** Medium.

#### C15 — XSS/contextual output encoding

**Status:** Verified. **ASVS mapping:** 1.2.1–3 (L1).

- **Evidence / existing protection:** [page.php:24](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/page.php:24), [js/student-common.js:101](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/js/student-common.js:101). HTML substitution via htmlspecialchars; user values rendered with text/attribute APIs; encoded IDs; JSON encoding.
- **Attack / severity / confidence:** Stored report/profile/note markup executes in Student/BM browser; High impact. No unsafe user-controlled HTML sink found.
- **Gap / minimal recommendation:** Keep safe DOM construction and URL sources; do not replace text() with html() during visual work. Test all rendered sensitive/public text paths, not only names.
- **Verification:** test-account:188; test-release-security:51; T08. **Difficulty:** Low. **Regression risk:** Medium.

#### C16 — Content Security Policy

**Status:** Implemented but Unverified. **ASVS mapping:** 3.4.3 (L2).

- **Evidence / existing protection:** [app/http.php:23](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/http.php:23), [page.php:5](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/page.php:5). HTML policy restricts scripts/styles/connect to self, base-uri none, frame-ancestors none and form-action self; local assets.
- **Attack / severity / confidence:** Residual XSS loads attacker code or frames; High potential impact. Policy source confirmed; actual headers/asset compatibility not exercised.
- **Gap / minimal recommendation:** Verify HTML success/error/redirect paths under Apache. No need to add unsafe-inline or nonce infrastructure without a concrete requirement; CSP is additional protection, not a replacement for encoding.
- **Verification:** test-release-security:51; T02/T08. **Difficulty:** Low. **Regression risk:** Low.

#### C17 — File upload validation

**Status:** Verified. **ASVS mapping:** 5.2.1–2 / 5.3.2.

- **Evidence / existing protection:** [app/uploads.php:5](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/uploads.php:5), [app/reports.php:168](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/reports.php:168). Upload status/is_uploaded_file, actual size ≤250000 bytes, MIME allowlist, dimensions ≤1200, count/retained-ID limits and random filenames.
- **Attack / severity / confidence:** Upload a script, wrong collection, oversize or foreign retained file; High potential impact. Controls confirmed.
- **Gap / minimal recommendation:** Keep server checks independent of the 10MB client input/preparation flow. Transport limits and full image normalization belong to C18/C21; extension spoof alone cannot choose a storage path.
- **Verification:** test-student:47–48; test-ui-profile; T07. **Difficulty:** Low. **Regression risk:** Medium.

#### C18 — Image processing, metadata and storage

**Status:** Partial. **ASVS mapping:** 5.2.2; V14 privacy context.

- **Evidence / existing protection:** [app/uploads.php:74](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/uploads.php:74), [app/avatars.php:18](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/avatars.php:18). Avatars are 512×512 JPEG, fully decoded/re-encoded; report/claim uploads are type/dimension checked and stored unchanged; cleanup respects commit/references.
- **Attack / severity / confidence:** Bypass client canvas stripping and retain EXIF/GPS or unusual image bytes; Medium privacy/availability scenario. Byte-preservation confirmed; real exposure unverified.
- **Gap / minimal recommendation:** After patching native libraries, consider bounded server re-encoding for new report/claim images with orientation/format/byte-limit tests. Do not rewrite existing media or assume metadata leak/RCE has occurred.
- **Verification:** test-ui-profile:75; test-student:47–54; T07. **Difficulty:** Medium. **Regression risk:** Medium.

#### C19 — Protected media retrieval

**Status:** Verified. **ASVS mapping:** 8.2.2; 5.3.1–2.

- **Evidence / existing protection:** [api/photos.php:6](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/api/photos.php:6), [api/avatar.php:5](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/api/avatar.php:5). ITEM requires sign-in; private evidence requires BM; fixed collection/path regex; current avatar reference must belong to active account.
- **Attack / severity / confidence:** Student retrieves private proof or old/deleted avatar; High privacy impact. Endpoint controls confirmed.
- **Gap / minimal recommendation:** Keep bytes authorization separate from retained-ID/count visibility. Avatars are intentionally visible to any signed-in user; no raw avatar_path is returned.
- **Verification:** test-auth:175,190; test-ui-profile:82; T06. **Difficulty:** Low. **Regression risk:** Medium.

#### C20 — Traversal/arbitrary file access

**Status:** Verified. **ASVS mapping:** 5.3.2 (L1).

- **Evidence / existing protection:** [app/uploads.php:86](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/uploads.php:86), [app/routes.php:51](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/routes.php:51). Fixed storage collections/hex filenames, route/template allowlists, safe return parser and Apache internal-directory denials.
- **Attack / severity / confidence:** Read configuration/secret/session or choose external redirect/template path; High impact. No arbitrary path found.
- **Gap / minimal recommendation:** Validate equivalent rules on the new server, including Windows case/encoded separators and PATH_INFO. ACL/junction defense is a host concern; test directories must not redirect to main.
- **Verification:** test-auth:196,238; T01/T06. **Difficulty:** Low. **Regression risk:** Medium.

#### C21 — Application-wide rate/resource limits

**Status:** Partial. **ASVS mapping:** 2.4.1 / 15.2.2 (L2); 5.2.4 (L3 reference only).

- **Evidence / existing protection:** [app/repository.php:430](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/repository.php:430), [app/reports.php:98](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/reports.php:98). Authentication throttles, pagination cap 48, per-request photo limits and a 5s lock acquisition wait.
- **Attack / severity / confidence:** Authenticated report/claim flood, storage growth, unbounded sessions or matching-lock contention; Medium/High availability risk, inferred impact.
- **Gap / minimal recommendation:** Add pragmatic write/search budgets and total storage monitoring before public access. Tune body/field/time limits using valid multipart fixtures; do not impose L3 per-user quotas just for checklist completion.
- **Verification:** No business-abuse load proof; T12. **Difficulty:** Medium. **Regression risk:** Medium.

#### C22 — External HTTPS/TLS enforcement

**Status:** Missing. **ASVS mapping:** 12.1.1 / 12.2.1–2 (L1).

- **Evidence / existing protection:** [app/auth.php:21](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/auth.php:21), [docs/INSTALLATION_AND_RELEASE.md:21](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/docs/INSTALLATION_AND_RELEASE.md:21). Secure cookie behavior exists; documented local URL is HTTP; no application HTTPS redirect/trusted proxy deployment configured.
- **Attack / severity / confidence:** Network interception of login/session on non-loopback access; High risk for public deployment. Current public reachability unknown.
- **Gap / minimal recommendation:** Retain local operation while rehearsing TLS on separate ports. Public deployment must use a trusted certificate, canonical host and verified proxy/server HTTPS state; enable HSTS only after validation.
- **Verification:** No current TLS/browser handshake test; T02. **Difficulty:** Medium. **Regression risk:** Medium.

#### C23 — HTTP security headers

**Status:** Partial. **ASVS mapping:** 3.4.1 / 3.4.4–6; 13.4.

- **Evidence / existing protection:** [app/http.php:23](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/http.php:23), [.htaccess:13](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/.htaccess:13). No-store/private dynamic responses, nosniff, referrer policy, frame denial and HTML CSP; static JS/CSS revalidation.
- **Attack / severity / confidence:** Cache sensitive content, framing or server-level error leakage; Medium/High scenario. App headers confirmed; host coverage unverified.
- **Gap / minimal recommendation:** Verify headers for dynamic success/error/media and server errors. Add HTTPS/HSTS and any justified document isolation at deployment; do not blindly apply COEP that breaks resources.
- **Verification:** test-release-security:28,51; T02. **Difficulty:** Low. **Regression risk:** Medium.

#### C24 — Restrictive CORS / same-origin API

**Status:** Verified. **ASVS mapping:** 3.4.2 / 3.5.1.

- **Evidence / existing protection:** [js/api.js:13](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/js/api.js:13), [app/auth.php:114](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/auth.php:114). Same-origin credentials/fetch; no Access-Control-Allow-Origin reflection/wildcard in reviewed app; Origin check plus CSRF on writes.
- **Attack / severity / confidence:** Foreign site reads authenticated JSON or submits accepted mutation; High impact. Browser default same-origin restriction is intentional.
- **Gap / minimal recommendation:** Keep cross-origin clients unsupported. Missing permissive CORS headers is not a vulnerability. Reassess only if a distinct client origin becomes an actual requirement.
- **Verification:** test-auth:157; test-release-security:39; T03. **Difficulty:** Low. **Regression risk:** Low.

#### C25 — Secrets/credential management

**Status:** Partial. **ASVS mapping:** 13.3.2 (L2); 14.2.1.

- **Evidence / existing protection:** [app/config.php:103](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/config.php:103), [app/config.php:137](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/config.php:137). Ignored override, private auth secret validation, HTTP denial for dotfiles/runtime, credential-safe error messages; historical redacted secret scanning.
- **Attack / severity / confidence:** Read secret/config or expose it through tooling/logs; High impact. Source handling confirmed; deployed ACLs/actual credentials unverified.
- **Gap / minimal recommendation:** Inspect permissions/rotation procedures later without printing values. Preserve auth secret and account hashes; no new vault service is required merely for this local app. Full ASVS secrets-management requirements remain unmet/unverified.
- **Verification:** test-release-security:23; CI secret scan; T13/T15. **Difficulty:** Low. **Regression risk:** Medium.

#### C26 — PHP/Apache/admin hardening

**Status:** Partial. **ASVS mapping:** 13.4.1–5; V12.

- **Evidence / existing protection:** [.htaccess:1](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/.htaccess:1), [api/bootstrap.php:1](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/api/bootstrap.php:1). App/internal runtime denials and local phpMyAdmin; display errors disabled by entrypoints. Old binaries, global error display and unused aliases remain.
- **Attack / severity / confidence:** Runtime compromise, information leak or unintended admin surface; Critical/High depending advisory. Configuration/version facts confirmed; exploitability conditional.
- **Gap / minimal recommendation:** Patch via side-by-side stack; least enabled modules/aliases, read-only source ACLs, server-wide error/log policy, canonical host, loopback/local admin restriction and verified limits.
- **Verification:** test-release-security:23–35; T01/T02/T13. **Difficulty:** Medium. **Regression risk:** Medium.

#### C27 — Database least privilege / transport

**Status:** Partial. **ASVS mapping:** V13.2; 12.3.1–2 (L2).

- **Evidence / existing protection:** [app/db.php:5](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/db.php:5), [docs/INSTALLATION_AND_RELEASE.md:26](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/docs/INSTALLATION_AND_RELEASE.md:26). Prepared client/utf8mb4/UTC and documented dedicated DML-account requirement; source has development defaults.
- **Attack / severity / confidence:** Web compromise uses excessive DB privileges or cleartext nonlocal connection; High potential impact. Actual grants/TLS/plugins unverified.
- **Gap / minimal recommendation:** Operator verifies grants/current account metadata without revealing secrets, then uses a dedicated runtime DML principal and separate provisioning principal. Bind locally; use verified TLS if DB becomes nonlocal.
- **Verification:** No live grant/TLS query run; T13. **Difficulty:** Medium. **Regression risk:** Medium.

#### C28 — Dependencies and supply chain

**Status:** Partial. **ASVS mapping:** 15.2.4 (L2); A03:2025.

- **Evidence / existing protection:** [package.json:1](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/package.json:1), [.github/workflows/release-readiness.yml:8](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/.github/workflows/release-readiness.yml:8). Exact npm locks, Composer lock, local frontend assets, pinned Actions/digests, npm ignore-scripts, redacted history scan and minimal CI permissions.
- **Attack / severity / confidence:** Malicious package/action or unpatched native/transitive library; High impact. 27 database matches; application exploit paths unproven.
- **Gap / minimal recommendation:** Add scheduled/read-only advisory checking and review minimal parent-compatible updates. OSV has no ReFind PHPStan/direct-frontend match today; never infer all binaries are clear.
- **Verification:** Lock/installed inventory + OSV current; T14. **Difficulty:** Low. **Regression risk:** Medium.

#### C29 — Security logs, monitoring and audit

**Status:** Partial. **ASVS mapping:** 16.3.1–4 / 16.4 (L2).

- **Evidence / existing protection:** [app/http.php:86](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/http.php:86), [app/workflow.php:513](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/app/workflow.php:513). Generic public history, private pickup before/after audit, UTC records and redacted 500 class/file/line logs; review notes kept private.
- **Attack / severity / confidence:** Compromised BM or repeated auth/access failures go undetected; Medium/High operational risk. Business audit confirmed; auth/security event coverage incomplete.
- **Gap / minimal recommendation:** Add bounded structured auth/denial/limiter/critical-action events, protected rotation and a simple review/alert procedure. No passwords, tokens, private clues or evidence in logs; no SIEM required for local demo.
- **Verification:** test-workflow:43,50–53; logging gaps; T15. **Difficulty:** Medium. **Regression risk:** Medium.

#### C30 — Backups and verified recovery

**Status:** Implemented but Unverified. **ASVS mapping:** Operational recovery; V14 data protection context.

- **Evidence / existing protection:** [tools/backup-project.py:14](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/tools/backup-project.py:14), [docs/INSTALLATION_AND_RELEASE.md:37](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/docs/INSTALLATION_AND_RELEASE.md:37). Paused-write backup contract; SQL + storage/config plan; historical disposable recovery checks; production backup contents deliberately not read.
- **Attack / severity / confidence:** Inconsistent restore loses ownership records/media or resurrects stale credentials; High impact. Procedure confirmed; real recovery unverified.
- **Gap / minimal recommendation:** Rehearse an operator-approved matched private snapshot on an empty isolated server; compare DB/media/identity invariants. Treat source, schema/data and runtime files as one recovery unit.
- **Verification:** Historical synthetic recovery; T16. **Difficulty:** Medium. **Regression risk:** High.

References for exact requirement IDs: [ASVS authentication](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x15-V6-Authentication.md), [sessions](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x16-V7-Session-Management.md), [authorization](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x17-V8-Authorization.md), [validation/business logic](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x11-V2-Validation-and-Business-Logic.md), [frontend](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x12-V3-Web-Frontend-Security.md), [file handling](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x14-V5-File-Handling.md), [logging](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x25-V16-Security-Logging-and-Error-Handling.md). Practical guidance: [Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html). These mappings express applicability, not blanket requirement passes.



## 6. Confirmed Findings and Unverified Risks

Findings below are root-cause/work-package inputs, not another CVE count. A confirmed absence or old version can justify action even while a particular exploit remains unverified.

| ID | Severity / confidence | Confirmed evidence | Inference / verification boundary | Minimum next action |
|---|---|---|---|---|
| F01 | **Critical / High** | PHP 8.2.12 matches both October critical advisories; mod_php configuration, finite memory limit and upload-progress state observed | Runtime applicability confirmed; Windows/ZTS exploit success and hostile reachability not demonstrated | P0 exposure review and patched PHP rehearsal, then separately approved cutover |
| F02 | **High / High** patch deficit | Apache 2.4.58 is far behind 2.4.69; Windows-specific memory/UNC and loaded-proxy advisories require attention | Each prerequisite remains as section 3 classifies it; not a blanket RCE claim | Patched Apache bundle with verified native dependencies; remove unnecessary features |
| F03 | **High / High** configuration fact | Apache wildcard 80/443; MariaDB wildcard IPv6 3306; PHP-CGI alias and AJP example mapping configured | Enabled Any-scope Public firewall allow entries and an active Public network were confirmed; effective LAN/router/Internet reachability remains untested | Verify intended access; loopback-only local deployment and minimal aliases/modules in an approved change |
| F04 | **High / High** lifecycle gap | MariaDB 10.4.32 is EOL; PHP/Apache OpenSSL series also EOL | New supported-series MariaDB CVEs cannot simply be assigned to 10.4; effective DB privilege unknown | Side-by-side supported database/native stack, verified logical import and least privilege |
| F05 | **Medium / High** version matches | phpMyAdmin 5.2.1 and 26 OSV matches in its installed dependency set; known direct 2025 fixes absent by version | Most library paths require privileged/admin/untrusted-template/remote-resource conditions not established | Keep admin access local; use maintained vendor package/BOM or leave admin interface disabled when unnecessary |
| F06 | **Medium / High** gap; Medium impact confidence | Authentication limits exist; no general report/claim/search budgets or aggregate storage policy found; report saves lock opposite-type reports and refresh matching | Sustained exhaustion/lock starvation not measured | Measure synthetic workload, add proportionate limits before public access |
| F07 | **Low / High** code gap | Report/claim uploads preserve incoming bytes after header/type/dimension checks; avatar uploads re-encode | No actual GPS/private-image disclosure or decoder exploitation observed | Test synthetic metadata; decide bounded server normalization only after native library patches |
| F08 | **Medium / High** operations gap | Business history/private pickup audit exists; centralized auth/denial/limiter event logging and alert procedure incomplete | Real log access, retention, monitoring and backup restoration unknown | Minimal protected structured logs, review triggers, and recovery rehearsal |
| F09 | **Low locally; High for public BM / High** | Single-factor login; no self-service recovery, common-password filter or session inventory | No account compromise found; not all missing features are necessary for the current local demo | Define public authentication/recovery policy and explicit L2 gaps before public pilot |
| F10 | **Low to Medium / High** tool match | minimatch 10.2.6 matched 27 Oct advisory; ESLint/config-array depend on major 10 | Adversarial glob plus optimizationLevel ≥2 is required; no public ReFind call path | Review maintainer-compatible parent upgrade; keep untrusted CI bounded |

### 6.1 Unverified risks that remain open

| Unknown | Why it matters | Safe verification later |
|---|---|---|
| End-to-end LAN and router exposure | Wildcard bind plus Public/Any program allow entries are strong exposure evidence, but not a packet reachability test | Inspect firewall/forwarding policy; use authorized controlled connectivity checks in QA |
| Apache-SAPI PHP/library versions/settings | CLI and web SAPIs can load different configuration/dependencies | Private CLI/controlled local diagnostic in QA, never a permanent phpinfo endpoint |
| DB grants, actual user, plugins, SQL modes and TLS | Determines blast radius and MariaDB prerequisites | Metadata-only operator queries; redact account secrets and avoid user rows |
| File ACLs, junction/reparse behavior and service identity | Denials below DocumentRoot do not protect from local filesystem access | Verify effective permissions on source/config/runtime/backup; refuse redirected QA paths |
| Active TLS protocols, certificate trust and cookie delivery | Configuration syntax is not a TLS handshake | Isolated TLS listener + browser/header assertions |
| Native GD/WebP/JPEG/APR dependency BOM | Some version strings are API compatibility labels | Provider manifest + actual binary metadata; no speculative CVE matching |
| Real backup consistency/restorability | Historical synthetic recovery is a narrower result | Owner-approved private matched snapshot restored into a new empty isolated destination |
| Transitive phpMyAdmin reachability | Scanner ranges can overstate old-version regressions and missing API paths | Vendor patch/prose/source comparison; no exploit run against the installed admin UI |
| Hosted repo branch protections/rulesets | Passing CI does not prove it is required for merge | Read-only repository-policy review before an implementation PR |
| Current workstation compromise | Old vulnerable software is not evidence of intrusion | No forensic claim made; separate investigation only if exposure/incident evidence warrants it |

### 6.2 Important non-findings

- A missing CORS allow-origin header is the intended same-origin design, not a defect.
- A signed-in user seeing another reporter's display name/current avatar is intentional.
- Source defaults are not proof of actual deployed database credentials or grants.
- A JavaScript validation check does not substitute for server validation; here substantial independent server checks exist.
- A MIME-valid polyglot is not automatically PHP execution: media paths are generated, direct storage is denied, and the byte endpoint uses a fixed image type with nosniff.
- A match score does not bypass BM approval. Cancel schedule does not release ownership. Never retrieved does not authorize disposal.
- PHP-CGI vulnerabilities require a CGI exposure/configuration path; mod_php identity alone is insufficient. Conversely, mod_php's existence does not make the separate CGI alias disappear.
- No claim of malicious AI authorship, secret leakage, actual account takeover, or current database corruption is supported by this review.

## 7. Technology Upgrade Comparison

### 7.1 Recommended target and alternatives

**Safest default:** assemble a minimal supported **Windows-native stack in a new isolated directory**, retaining Apache/mod_php, procedural PHP/mysqli and MariaDB. Validate it side by side, then make any cutover a separate approved operation. This avoids changing ReFind's public interfaces or introducing containers, tunnels, frameworks or new always-on services.

| Choice | Security/maintenance benefit | Compatibility and regression cost | Decision |
|---|---|---|---|
| Keep present binaries | No migration work | Retains critical PHP issues, EOL database/OpenSSL and old Apache | **Reject as a public-deployment target**; current local exposure still needs P0 handling |
| Patch PHP 8.2.35-1 alongside old stack temporarily | Closes October PHP core issues with the smallest language-version change | Old Apache/database/native risks remain; same-minor DLL/config checks and rollback still required | **Short emergency bridge only**, if 8.4 rehearsal cannot finish promptly |
| PHP **8.4.27-1 TS x64** | Supported security branch through 31 Dec 2028; avoids imminent 8.2 EOL | Must review 8.3 + 8.4 changes, hashing cost, warnings, GD and sessions | **Preferred PHP candidate** |
| PHP 8.5.12-1 | Longer PHP support runway | Extra major-version compatibility review with no required ReFind feature | Supported alternative, not the default |
| Apache **2.4.69**, provider Windows build with supported deps | Fixes current core security backlog while retaining routing model | VS/CRT/PHP module compatibility; default-handler/rewrite/TLS changes; BOM caveat from section 3 | **Preferred core candidate, package acceptance conditional** |
| MariaDB **11.4.13 LTS** | Maintained binaries to 29 May 2029; current published fixes | Logical import, SQL modes/views/constraints, locking, authentication/TLS and dump compatibility need tests | **Preferred database candidate** |
| MariaDB 10.11.19 | Smaller version gap; existing historical CI used 10.11 | Shorter maintenance to 16 Feb 2028; still needs data/SQL testing | Compatibility fallback if 11.4 fails a concrete requirement |
| MariaDB 11.8.9 / 12.3.3 | Maintained alternatives | Newer features add no current ReFind benefit; 11.8 Community binary support ends earlier than 11.4 | Not selected absent demonstrated benefit |
| New XAMPP bundle, PHP 8.4.27 | Familiar packaging/control panel | Vendor page lists Apache **2.4.65**, MariaDB **10.11.16**, OpenSSL **3.5.1**; therefore not a fully patched target | Useful comparison/reference only; do not assume “new XAMPP” resolves the whole audit |
| IIS/FastCGI or alternate hosting model | Possible supported Windows runtime route | Requires equivalent .htaccess/routing/denial/header behavior and SAPI/session retests | Unnecessary integration change for this task's default |
| Rewrite/framework/database replacement | None required by the evidence | Large authorization/workflow/schema regression surface | **Out of scope and not recommended** |

The XAMPP comparison uses its [published included versions](https://www.apachefriends.org/download.html), not an installed/downloaded package. Upstream PHP Windows packages are independently published at [official metadata](https://downloads.php.net/~windows/releases/releases.json). For Apache's TS integration, follow [PHP Windows Apache guidance](https://www.php.net/manual/en/install.windows.apache2.php). Recheck available packages at implementation time.

### 7.2 Component-specific compatibility gates

| Area | Required rehearsal and acceptance | Difficulty / downtime / rollback |
|---|---|---|
| PHP/Apache/CRT | Matching x64 TS module, selected VS build, correct VC redistributable, isolated php.ini/extension_dir; both CLI and Apache report the expected version; rewrite/denials/headers unchanged | Medium. Side-by-side preparation avoids downtime; cutover restart only after gates. Restore matched binary/config snapshot, not a single executable. |
| PHP 8.2 → 8.4 behavior | Review [8.3 incompatibilities](https://www.php.net/manual/en/migration83.incompatible.php), [8.4 incompatibilities](https://www.php.net/manual/en/migration84.incompatible.php) and [deprecations](https://www.php.net/manual/en/migration84.deprecated.php). Capture warnings in protected QA logs, not browser output. | Medium. No source fix is presumed; any required fix is a separate focused PR. |
| Password hashing/auth | Existing bcrypt hashes must still verify unchanged. PHP 8.4 raises default bcrypt cost 10→12; measure password-change/new-hash latency and limiter locking. Preserve fingerprint secret, cookie/session identity and expiry semantics. [PHP change](https://www.php.net/manual/en/migration84.other-changes.php) | Medium. No forced reset or bulk rehash. Credential changes after cutover must not be lost through rollback. |
| Sessions | Copied synthetic file sessions survive supported upgrade if intended; old IDs invalidate on logout/password change; no cross-installation cookie/storage collisions | Medium. QA uses a different session namespace. Main session preservation requires paused writers and explicit paths at cutover. |
| GD/images | JPEG/PNG/WebP MIME, dimensions/counts and cleanup still work; 512px avatar full decode/re-encode returns valid JPEG; orientation and malformed files tested | Medium. No mass rewriting of existing media. Save old matched media/metadata for rollback. |
| Database schema/queries | Logical import all 14 tables, 2 views, 25 FKs and existing avatar column; preserve charset/collation, nulls, timestamps, sequences, uniqueness, SELECT/prepared types and view semantics | High. No ReFind schema migration is intended. Do not copy the 10.4 datadir or system privilege tables into 11.4. |
| Locks/transactions | GET_LOCK, ordered FOR UPDATE, stale revisions, same-user/shared-Lost claims, approval/return/release rollback all pass | High regression impact. Require complete isolated business regression and failed-operation snapshots before cutover. |
| Native dependencies | Accept provider-supported package sets with provenance/checksums; verify actual loaded OpenSSL/GD/cURL/other dependencies. No DLL transplant between PHP/Apache/MariaDB. | Medium. Missing/old BOM components block “fully patched” acceptance, even when php -v looks current. |
| phpMyAdmin | Latest vendor stable plus transitive review; keep it out of the app runtime requirement and local/admin-only. Disable when unnecessary rather than introduce a dependency-maintenance project. | Low/Medium. Back up only its configuration appropriately; no direct package-manager mutations inside current installation. |
| Node/npm/QA | Select Node **24.22.2** (includes 24.22.1 security changes), retain matching Playwright package/browser pair; use existing npm behavior first | Low/Medium. Isolated tooling first; restore prior tool path if necessary without changing app dependencies. |
| npm dependency finding | Inspect ESLint 10.14.0's actual lock resolution; existing ESLint ^10.2.5/config-array ^10.2.4 do not permit minimatch 11.0.1. Avoid --force or an untested major override. | Medium. Patch through a compatible maintainer path or document the controlled-glob limitation and review deadline. |
| Resource usage | Run only one QA server/browser sequence when required; stop QA afterward. Compare bounded query counts, login hashing and peak process memory with fixtures, not real traffic | No new Redis, SIEM, Kubernetes, container runtime or tunnel requirement. |

**Public interface and schema policy:** no route, role, request/response field, status code, match rule, campus-time rule or application schema change is authorized by the runtime plan. Additive QA guard profiles and deployment configuration changes belong to separate reviewed implementation work. Any session-name, credential or account-provisioning change requires an explicit migration decision rather than being hidden in a runtime update.


## 8. Security Hardening Roadmap

**All work below requires a separate implementation/cutover authorization.** Creating this report authorizes none of these changes. P0 is urgency, not permission for this audit to change the host.

### 8.1 Order and common rules

`WP01 exposure → WP02 PHP patch → WP03 supported web stack → WP04 database/recovery → WP05 public gate`. WP06–WP08 follow independently where their prerequisites are met; WP09 is a future product/security decision.

Every package must preserve the existing application version/folder/database labels, account records/hashes, current session identity unless separately approved, and all media collections. Use small `codex/` branches/PRs for source changes; keep real credentials/configuration/backup artifacts private. Configuration-only operational work needs a reviewable redacted change and restore receipt, not secret commits.

| Package | Priority | Objective | Dependency | Complexity / regression |
|---|---|---|---|---|
| WP01 | P0 | Make intended local-only exposure true | Owner-approved host change | Low–Medium / Medium |
| WP02 | P0 | Remove critical PHP runtime exposure | WP01 + isolated package rehearsal | Medium / Medium |
| WP03 | P1 | Supported PHP/Apache/native stack | WP02; valid package BOM | Medium / High |
| WP04 | P1 | Supported MariaDB + least privilege + recovery | WP03-compatible QA and matched backup | High / High |
| WP05 | P1 before public pilot | TLS/deployment/resource/security operations gate | WP03/WP04 and defined external host | Medium / High |
| WP06 | P2 | Supply-chain and negative-test maintenance | Stable source fingerprint | Low–Medium / Medium |
| WP07 | P2 | Image privacy/normalization decision | Patched native image stack | Medium / Medium |
| WP08 | P2 | Maintainability security verification | W reviewed/frozen | Medium / High if broad edits |
| WP09 | P3 locally | MFA/recovery/session management evolution | Campus identity/access policy | Medium–High / High |

### WP01 — Local exposure and unused surfaces

- **Objective/components:** Apache/MySQL listeners, Windows inbound rules, CGI/admin/example aliases, optional XAMPP services. Keep loopback HTTP working at the same main URL.
- **Prerequisites/order:** review the current config/firewall rules and save private rollback copies; identify the exact Apache/MariaDB instance. Scope restrictions to this installation; preserve other services/worktrees.
- **Environment/tests:** first apply equivalent restrictions to the new local-only QA instance; T01 checks both IPv4/IPv6 and direct alias paths without real user accounts. Verify controlled access from the intended local client and denial from an authorized separate client if one is available.
- **Acceptance:** intended loopback access works; Apache and MariaDB no longer have unintended external bindings/allow rules; unused CGI/AJP surfaces are unavailable; local admin access has an explicit boundary.
- **Rollback:** restore only the changed config/rules if operationally necessary, while retaining an equally restrictive exposure boundary. Do not automatically reopen broad vulnerable access.
- **Review unit:** redacted host-config change record; `codex/security-local-exposure` PR only for relevant documented/equivalent config changes.

### WP02 — Urgent PHP security patch

- **Objective/components:** patched PHP core and matched extensions. Prefer 8.4.27-1 if compatibility gates pass promptly; use **8.2.35-1 TS VS16 x64** as a short bridge if 8.4 has a concrete blocking regression.
- **Prerequisites/order:** WP01, verified official package provenance, new isolated web/PHP paths and a tested source/config/runtime snapshot. No direct replacement of php.exe/php8ts.dll alone.
- **Environment/tests:** native QA below, initially synthetic; T02/T03/T05/T07/T09/T10 and PHP/JS/static checks on the chosen runtime. Recheck actual Apache-loaded build and extension paths.
- **Acceptance:** fixed PHP release/package identity on CLI and web SAPI; existing hashes/session rules/media/transactions pass; no unintended user-visible warnings. Neither RCE needs an exploit test to prove a fixed version.
- **Rollback:** pause writers and restore matched binaries/config/runtime if needed; keep WP01 containment. A rollback to vulnerable PHP cannot be called release-ready.
- **Review unit:** `codex/security-php-runtime`; source compatibility fixes only if test evidence requires them. Record a dated end-of-bridge milestone before PHP 8.2 EOL.

### WP03 — Supported web/native stack

- **Objective/components:** Apache 2.4.69 and PHP 8.4.27-1 in a minimal Windows-native stack, with compatible CRT/module/native dependency sets.
- **Prerequisites/order:** WP02; provider BOM/advisory verification, including Brotli caveat. Do not assume a new XAMPP bundle or a new version string clears every dependency.
- **Environment/tests:** T01–T11 on synthetic QA; complete Student/BM regression across both themes; compare canonical API projections and current route/partial behavior.
- **Acceptance:** fixed routes and private-directory denials behave identically; original fixed RewriteRules require no unsafe compatibility flags; no unnecessary CGI/proxy/example/admin exposure; loaded libraries match accepted BOM.
- **Rollback:** switch to the preserved previous complete stack with writers paused and containment retained; do not mix binaries from two builds.
- **Review unit:** `codex/security-supported-stack`; separate runtime integration from unrelated UI/refactor work.

### WP04 — Database LTS, principal boundaries and recovery

- **Objective/components:** logical application-data import into MariaDB **11.4.13**, or 10.11.19 only if a concrete compatibility failure justifies fallback; separate provisioning and runtime principals.
- **Prerequisites/order:** matched paused-write SQL/media/config snapshot; empty new datadir/server; database identity and both endpoint ports verified. Runtime DML privileges must be separately approved before changing current effective credentials.
- **Environment/tests:** T10/T13/T16 plus all 9 schema and 18 workflow/media invariant checks on synthetic data; rehearse an owner-approved private snapshot only after synthetic acceptance.
- **Acceptance:** all original application tables/views/FKs, values/hashes, media references, avatar column, user/password hashes, timestamps/nulls and workflow outcomes preserved. No main setup/seeding or unsolicited app schema migration.
- **Rollback:** keep old datadir untouched; restore a matched logical/data/media snapshot into the correct old-compatible environment. No in-place datadir downgrade and no copying system privilege tables across major versions.
- **Review unit:** `codex/security-mariadb-lts`, private migration/restore receipts and a distinct cutover approval.

### WP05 — Public-deployment gate

- **Objective/components:** external HTTPS/canonical host, appropriate TLS/cookies/headers, source/runtime ACLs, least privilege, request limits, business abuse control, common-password rejection, security logging and operational ownership.
- **Prerequisites/order:** WP03/WP04, chosen hostname/access model, trusted certificate and tested recovery. A real campus pilot also needs account provisioning and privacy/retention responsibility; research proposals are not automatic features.
- **Environment/tests:** TLS QA, T01–T16 as applicable. Tune limits from valid maximum report/claim/avatar requests and finite synthetic load; test proxy behavior only if a proxy is actually chosen.
- **Acceptance:** no public HTTP credentials/session delivery; no private files/debug/administrative surfaces exposed; invalid origin/foreign objects denied; bounded resources and observable security events. BM MFA or documented compensating access restrictions must be an explicit public-access decision.
- **Rollback:** keep public access closed while restoring tested config/source. Do not “fix” failed deployment by disabling CSRF, weakening CSP or trusting all forwarded headers.
- **Review unit:** `codex/security-public-readiness`, split application controls from host policy when review becomes too broad.

### WP06 — Dependency/advisory and CI maintenance

- **Objective/components:** scheduled advisory inventory for lockfiles, phpMyAdmin and native stacks; redacted secret scans and negative security gates.
- **Prerequisites/order:** freeze intended W source; review package provenance and parent version ranges. Recheck ESLint 10.14.0's actual dependency resolution rather than assume its patch resolves minimatch.
- **Environment/tests:** T14; no forced dependency major update. Preserve package/browser matching and PHPStan platform constraints.
- **Acceptance:** advisory results have owner, applicable path, fix/risk decision and review date; no unreviewed reachable Critical/High exposure; exceptions are explicit and time-bounded. Failing security assertions cannot be changed solely to make CI green.
- **Rollback:** restore prior reviewed manifests/lockfiles/tool paths as one set; preserve evidence and isolate tooling if the prior set is vulnerable.
- **Review unit:** `codex/security-dependency-maintenance`.

### WP07 — Image privacy and content normalization

- **Objective/components:** decide whether new report/claim uploads should receive the same bounded server normalization assurance as avatars.
- **Prerequisites/order:** patch native decoders first; use synthetic EXIF/GPS/orientation fixtures. No original private photos are needed to design this feature.
- **Environment/tests:** T07; validate prepared-size ceilings after re-encoding, JPEG/PNG/WebP policy, alpha/orientation, disk/memory failure and rollback.
- **Acceptance:** if implemented, no private metadata survives in normalized new media; visual orientation and contract limits hold; existing media files/records are unchanged.
- **Rollback:** revert the new-upload pipeline only; do not delete originals or bulk-convert existing storage.
- **Review unit:** `codex/security-image-normalization`; **defense-in-depth/privacy work**, not a claimed current upload-RCE fix.

### WP08 — Preserve security through the maintainability follow-up

- **Objective/components:** separately review/freeze the seven-area uncommitted follow-up and validate its final source, especially account locks, private projections, shared partials and QA guards.
- **Prerequisites/order:** identify a stable source manifest; retain all pre-existing changes and historical receipts. Do not merge/deploy the refactor as an incidental runtime-patching step.
- **Environment/tests:** final-source full regression plus focused projection/privacy/revision tests; T03–T11/T14. Keep the corrected projection oracle and explicit missing-report 404.
- **Acceptance:** all public interfaces/state rules unchanged; fresh reads under transaction locks preserved; privacy assertions include forbidden fields and foreign actors; receipts identify exact source tested.
- **Rollback:** source-only rollback is valid only if there was no data/schema/runtime change; otherwise use the coordinated recovery policy.
- **Review unit:** existing follow-up work in its own PR when separately authorized.

### WP09 — Longer-term authentication and operations

- **Objective/components:** campus-aligned BM MFA/SSO, secure forgotten-password recovery, session inventory/revocation, and additional abuse/incident monitoring where justified.
- **Prerequisites/order:** define campus identity provider/account lifecycle and support responsibility first. Preserve the two app roles; do not add stakeholder roles merely because research mentions them.
- **Environment/tests:** T05/T15 and provider-specific negative tests; recovery must not bypass MFA. Evaluate lockout/recovery burden for a small service.
- **Acceptance:** documented enrollment/recovery/revocation behavior, stable role mapping, secure factor storage, negative tests and a workable operator procedure.
- **Rollback:** disable new enrollment/access until a safe route is restored; do not create a password-only bypass for an enforced MFA population.
- **Review unit:** one feature PR per mechanism. MFA is P3 for the current local demo, but must be reconsidered as P1 for public privileged access.

## 9. Testing and Verification Plan

### 9.1 What this audit actually executed

**Executed:** source/configuration inspection, non-sensitive binary/extension version queries, Git/source hashes, private-file metadata aggregation, local listener/firewall metadata inspection, selected historical receipt reads, remote main/CI metadata reads, vendor/CNA/OSV research and report validation.

**Not executed:** app HTTP requests, session/bootstrap/login, SQL queries/dumps, setup/seeding/migrations, fixture preparation, browser/API suites, stress/exploit payloads, Docker, tunnels, dependency installation/audit commands, runtime upgrades, Git fetch/checkout/commit/push, PR creation or CI dispatch. A GET to session.php/page.php can write session state, so “read-only browser smoke” was not used.

Historical evidence is limited to section 2's exact checkpoints. Main CI success was freshly observed as metadata; the workflow itself is historical. Linux/container results do not establish Windows/Apache/DLL compatibility.

### 9.2 Proposed local-only native QA environment

Use a **new task-owned directory**, for example `%LOCALAPPDATA%/ReFindRuntimeQA/security-modernization-<unique-run>`. Refuse an existing destination. Keep Apache/PHP/MariaDB binaries, datadir, logs and credentials outside its web root; put the app in `www/ReFind_0.2.3`.

- Bind QA HTTP **127.0.0.1:8086**, TLS **127.0.0.1:8446** and MariaDB **127.0.0.1:3312**; refuse occupied ports. Do not open firewall exceptions or public tunnels.
- Use database **refind_db_0_2_0_test** on the separate server, a new synthetic runtime principal, separate private media/auth state and session name **refind_runtime_upgrade_qa**. Never share main's session/auth/media directories.
- Preserve all existing legacy QA and the port3311 staging installation. The existing guard hardcodes 3311; **do not point it at 3312 or bypass it**.
- A later additive `runtime-upgrade` profile must verify ownership marker, exact source/destination realpaths, no junction/reparse redirection, loopback host, port3312, _test schema, unique session identity and separate storage before fixtures may mutate anything. Deliberately main-like inputs must fail before opening the target database.
- Start only the task-owned native processes when tests require them. Capture their exact binary/config/datadir/port identities and stop only those verified processes afterward.
- Begin with synthetic accounts and images. Private snapshot restoration is a separate operator-approved rehearsal after isolation passes; it must not become a new publicly accessible clone.

The main database name, local URL base and account/session identities are preserved through any eventual approved cutover. QA-specific identities are temporary boundaries, not a requested rename of main.

### 9.3 Exact future scenarios

All tests below are **designed, not run in this audit**. Mutation/fixture work belongs only in the guarded QA environment. For negative writes, compare full synthetic business-table/media snapshots before/after, not just HTTP status. Avoid version-CVE exploit payloads; fixed-package evidence and safe regression checks suffice.

| ID | Prerequisites and proposed action | Expected secure result / success criterion |
|---|---|---|
| **T01 Exposure / host denials** | QA listeners/config known; request protected internal/dot/dependency/evidence paths using ordinary, case-varied and encoded-separator URLs; inspect aliases and IPv4/IPv6 bind policy | Internal paths/aliases denied with 403/404; only intended loopback listeners; no source, SQL, fixture, credential or media bytes. No port/service exposed to public network. |
| **T02 TLS / headers / cookies** | Isolated trusted test certificate; HTTP/TLS endpoints; inspect HTML, JSON, media, 401/403/404/500 and redirect responses | Expected content types/no-store/nosniff/frame/CSP/referrer behavior; Secure/HttpOnly/SameSite/path/host scope on TLS; valid chain and TLS1.2/1.3 policy; no credential POST over external HTTP. Verify HSTS only on intended TLS host. |
| **T03 Role / method / CSRF** | Guest, Student A/B, BM A/B; valid per-session token plus absent/stale/conflicting tokens, wrong Origin and forged forwarded headers | Guest 401, wrong role/CSRF 403, unsupported method405/field400; protected HTML redirect/403 before BM content. No mutation or automatic POST replay. Requests with absent Origin still need correct CSRF. |
| **T04 Object / field authorization** | Foreign report/claim/notification/pickup/evidence IDs and protected owner/role fields; retained IDs belonging to another fixture | Foreign private reads404/403; foreign writes403/409 as contract; field injection400/403; notification read-all affects only own rows; full data/media snapshots unchanged. |
| **T05 Password / sessions / throttles** | Synthetic hashes, two browsers/sessions and controlled test clock; password boundaries, current-password failures, concurrent changes | Password not trimmed/truncated; 73-byte input rejected; current session ID/CSRF rotate; peers fail on next protected request; old cookie/logout replay fails; 30min/8h expiry honored; configured failure threshold429 + Retry-After. One concurrent credential winner; no stale overwrite. Never use real accounts. |
| **T06 Projection / media privacy** | Synthetic distinctive private markers, public/BM/owner/other-user requests; current/stale avatar tokens and malformed kind/path/IDs | No other user's clue/evidence/email/student ID/review/pickup details in public payloads. ITEM auth-only; ownership/claim bytes BM-only; raw paths absent; stale/removed avatar404. Allowed own review/retained IDs remain available. |
| **T07 Upload / image boundaries** | Synthetic JPEG/PNG/WebP, EXIF/GPS/orientation, header-only/corrupt/polyglot samples; count/size/pixel limits; controlled disk/transaction failures | Rejected types/size/count/dimensions422; generated paths only; foreign retain403; invalid avatar no commit; rollback deletes only newly created files and old referenced media remains. Record current report metadata preservation; assert stripping only after a separately approved normalization feature. |
| **T08 Input / SQL / XSS** | Direct API valid/invalid UTF-8, arrays, NUL/control characters, malformed IDs/dates, SQL-shaped strings and inert markup fixtures | Input400/422 without partial writes; search treats SQL tokens literally; report/name/note/contact text remains text; no script execution/browser exceptions; CSP needs no unsafe relaxation. |
| **T09 Claim state contract** | Eligible Found/own Lost, PENDING/NEED_MORE_INFO/WITHDRAWN/REJECTED/APPROVED and terminal fixtures | NEED_MORE_INFO/WITHDRAWN reuse claim ID when eligible; REJECTED remains409 claim_final; own-found/foreign-Lost disallowed; one active linked-Lost claim; duplicate same-user claim never creates another record. |
| **T10 Ownership concurrency / rollback** | Separate BM sessions/connections, identical revisions, competing claims/shared Lost; QA-only notification/media failure points | Exactly one approved owner/confirmed pair/handover; loser409; locks reread state; failed decision leaves all relevant tables/history/notifications/media unchanged. Tests must exercise actual parallel requests, not just sequential duplicates. |
| **T11 Pickup / time integrity** | Approved pending/scheduled/completed fixtures; future/invalid campus schedule values and fresh/stale revisions | cancel_schedule retains APPROVED/HANDOVER and same handover; release rejects claim/pair and reopens eligible reports; complete sets Returned atomically; unchanged reschedule409; UTC storage/ISO Z and Asia/Jakarta display; unknown event time stays null. |
| **T12 Resource abuse** | Disposable synthetic data, bounded request generator with explicit low ceilings and stop condition; valid maximum multipart requests | Valid max requests succeed; configured excess is rejected predictably, normally429/413/422; memory/disk/lock wait remain bounded, no partial writes or worker starvation. Establish budgets from measured workload; no stress run on main. |
| **T13 Database / ACL / transport** | Operator-controlled QA principals, empty new DB, safe metadata queries, known service identity | Runtime principal has only necessary DML, provisioning principal separated; expected schema only; no FILE/SUPER/CREATE USER/GRANT privileges unless explicitly justified; remote DB uses validated TLS; web source/config read-only and required private collections writable. Do not log password/authentication-string fields. |
| **T14 Supply chain / CI / QA guards** | Frozen manifests/source; disposable dependency directory and intentionally invalid QA target metadata | Lock and installed versions/BOM match accepted inputs; advisory matches reviewed; main URL/port3306/shared storage/session/junction inputs fail closed before fixture writes. Actions read-only token and pinned references retained; no secrets/non-synthetic artifacts published. |
| **T15 Logging / account operations** | Synthetic successful/failed login, authorization denial, limiter and BM actions, control-character notes and failed storage paths | Defined security events recorded with UTC/correlation and bounded fields; no raw password/token/clue/evidence in logs; generic public errors. Operator can follow documented account-disable/recovery/MFA policy without bypassing security or exposing secrets. |
| **T16 Recovery / migration** | Approved matched snapshot, paused writers, new empty destination with confirmed identity, accepted target binaries | All application table/schema/media/identity hashes and 9/18 invariants agree; both roles' synthetic workflows pass; failed restore never touches main. Repeat restoration/rollback under writer pause without account/media loss. Real snapshot rehearsal remains private and separately authorized. |

Run code syntax/static gates and existing regression suites on the selected runtime only after their isolation guards are adapted and validated. Keep both positive and negative assertions; retain evidence of failed attempts. A refactor equality oracle must be supplemented by explicit privacy/permission assertions so a shared baseline bug is not simply reproduced.


## 10. Backup, Migration, and Rollback Plan

This section is a **future approved procedure**. No backup, database connection, import/export, session copy or service restart was performed during this audit.

### 10.1 Preserve a coherent recovery unit

Preserve matching application code/commit or source manifest; validated Apache/PHP/MariaDB configurations and binary versions; private local configuration; the complete application database; all four media collections (**items, evidence, claims, avatars**); the authentication secret and installation receipts; and session state if session continuity is required. SQL alone or a Git clone alone is insufficient.

Private backups contain credentials, evidence and session authority. Store them **outside Apache's web root**, restrict access, encrypt according to the operator's storage policy and keep a verified independent copy. Do not include them in Git, CI artifacts or this report. Do not print authentication hashes/strings, password values or session cookies in preservation receipts.

### 10.2 Rehearsal sequence

1. **Approve and freeze the source/runtime target.** Record source fingerprints, exact binary/BOM identities and rollback paths. Resolve the PHP/Apache dependency caveats before declaring the package accepted.
2. **Verify free space and ownership.** Keep the old installation/datadir untouched. Reserve sufficient space for the original, the new runtime, matched backups and rehearsal output; do not assume capacity or a downtime duration from the small classroom dataset.
3. **Validate the empty QA environment first.** Confirm unique path/ports/session namespace, guard refusal for main-like inputs and no symlinks/junctions into main. Create synthetic data only there.
4. **Rehearse logical export/import with synthetic data.** Use compatible dump/client tools and verify their generated SQL against both the target and intended rollback client. New dump headers/options, quoting fixes and SQL modes can affect older clients. Never run an unreviewed dump as arbitrary privileged SQL.
5. **Obtain a separately approved real snapshot only if needed.** Pause **all writers** for the entire SQL-plus-file snapshot window: other app copies, Student/BM actions, scheduled tasks and maintenance commands. `--writes-paused` is an operator assertion, not a technical write lock.
6. **Capture SQL plus matching media/config/runtime.** Use protected credential input/options, not a command-line password. Record file/table/schema counts and private hashes without publishing contents. Existing [tools/backup-project.py:14](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/tools/backup-project.py:14) is main-specific and must be reviewed for the chosen source/binaries before later use.
7. **Restore into an empty isolated server only.** Keep the application database name appropriate to that isolated server; never target main 127.0.0.1:3306. Do not restore the `mysql` system database across versions, copy the old datadir into 11.4, or run setup/demo seeding over imported application records.
8. **Recreate/verify server principals deliberately.** Preserve app user records/password hashes exactly. Database-server principals/plugins/grants are a separate compatibility concern; any credential/principal migration requires explicit authorization and a private record, not blind copying of privilege tables.
9. **Validate preservation and behavior.** Compare all expected objects/values, constraints, next IDs, charset/collation, UTC/null times, avatar references and media bytes. Run the 9 schema and 18 workflow/media checks and T03–T16 in isolation. Unexpected additional objects or mismatches are blockers, not permission to delete data.
10. **Rehearse recovery to the preserved old-compatible stack.** Confirm that the backups actually restore. In-place database file downgrade is not a rollback strategy. Retain the original untouched backup and evidence of the rehearsal.

### 10.3 Eventual cutover and rollback gates

**Before cutover:** all mandatory security/compatibility tests pass; unresolved advisory conditions are documented; matched private backups and restore proof exist; source/config changes are reviewed; exact start/stop identities are recorded. Public access remains closed.

During an approved maintenance window:
- Pause writers, take the final matched snapshot/delta and confirm no second app can write to the same database with separate media storage.
- Stop only the verified old web/database processes required by the approved switch. Start the accepted new stack at the original public/local service identity only after port ownership is clear.
- Preserve the main database name, account rows/hashes, URL base, auth secret, media and session namespace/path. QA used distinct state; it must never be copied over main.
- Check schema/media invariants, authorized sign-in/session/media behavior and the appropriate workflow acceptance using the approved operational procedure before reopening writes. These future checks can change sessions and must be explicitly scoped at that time.
- Monitor errors, failed login/session behavior, image failures, DB conflicts, disk space and latency through a defined observation window. Size the window and expected downtime from measured rehearsal results, not a guessed number of minutes.

**Rollback triggers:** wrong loaded binaries/config, data/media/hash mismatch, authorization/privacy regression, transaction/invariant failure, broken session/hash compatibility, unacceptable repeated 500/lock failures or inability to establish the intended exposure boundary.

If no new writes were admitted, restore the matched previous code/runtime/config/SQL/media state with containment retained. If writes occurred after cutover, first pause again and capture that state; reconcile or preserve the new records, credential changes, sessions and uploads before restoring. **Never silently discard post-cutover data or restore an older password hash over a newer password change.** Prefer a controlled forward fix when lossless rollback is not established.

A vulnerable old runtime restored for recovery must remain isolated/restricted; “service works again” is not security acceptance.

## 11. CI/CD and Ongoing Security Maintenance

### 11.1 Existing safeguards, checked against source

[.github/workflows/release-readiness.yml:8](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/.github/workflows/release-readiness.yml:8) grants `contents: read`, pins Actions to commit SHAs, disables persisted checkout credentials and has bounded job timeouts/concurrency. Static CI uses locked dependencies and `npm ci --ignore-scripts`; PHPStan is development-only. Gitleaks is checksum-verified and fully redacted.

[.gitleaks.toml:1](C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/.gitleaks.toml:1) extends default rules and narrows its checksum exception to the generic-api-key rule, two named historical manifests and exact SHA-256-entry-shaped lines. It is not a global secret-scanning disable. No fresh history secret scan was executed in this audit.

The existing Linux/container CI image references are pinned to digests. That helps reproducibility but can **freeze old vulnerable layers**; hashes are not patch-level guarantees. Historical Linux/container jobs were inspected, not started. This report neither changes nor authorizes Docker use. The required new compatibility rehearsal is Windows-native.

### 11.2 Lightweight proposed gates

| When | Proposed check | Acceptance / retained evidence |
|---|---|---|
| Every relevant PR | PHP/JS syntax, ESLint, PHPStan, existing offline safety checks, redacted secret scan | Pin exact tested source; fail on removed/disabled security assertions and exposed real artifacts |
| Authorization/account/media/workflow PR | Focused negative API/browser tests plus necessary positive paths | Guest/foreign actor/role/field/CSRF/stale revision cases; full synthetic DB/media preservation for rejected operations |
| Runtime/database/refactor release | Windows-native full regression, actual loaded BOM, projection/privacy tests and recovery | Source/runtime identities, PASS/FAIL/NOT RUN separated, preserved failed attempts |
| Weekly, or on dependency update | OSV/GHSA/vendor advisory inventory for lockfiles and admin/native packages | Applicability and fix review; distinguish data modification date from disclosure; no automatic --force remediation |
| Monthly | PHP/Apache/MariaDB/OpenSSL/Node support and package review | Update a small owner/date/action register; rebuild accepted package sets before support expiry |
| New KEV/critical advisory | Prompt human triage of installed version, exposure and vendor patch | Treat exposed core runtime issue as urgent; no exploit needed; no automatic production mutation |
| Before public release and after deployment change | Exposure, TLS/cookies/headers, private-file access, grants and backup checks | Explicit pass or signed-off scoped exception; no old local-development defaults assumed safe |

A small CI job or manually run script can perform package/version queries without installing libraries. Secrets and runtime settings must not be included in that outbound payload. Keep native package provenance/checksums and a reviewed change log. Automated results need human applicability review, especially EOL versions, historical Twig regressions and dev-only dependencies.

Do not create a new service, paid platform, distributed cache, WAF, SIEM or framework solely to improve a checklist score. File-backed throttles and sessions can remain suitable for one local host if bounded, tested and monitored. Multi-node deployment is a separate design.

### 11.3 AI-assisted development risk review and safeguards

| Risk | Evidence-based assessment | Minimum safeguard |
|---|---|---|
| Frontend-only validation | Independent server validation exists in reports, claims, accounts and uploads | Require direct-API negative tests; do not accept browser-only evidence |
| Refactor weakens authorization | Current adapters retain role/CSRF checks; extracted mutate_account retains fresh account lock and session-lock contract | Review boundary/order changes before formatting noise; pin final source and compare functional behavior |
| Raw batched rows leak private columns | Public column list is explicit; raw revision rows are kept separate in staff list projection | Assert forbidden fields/markers for foreign users in addition to baseline parity |
| Generic helpers hide fresh-state checks | Item revision accepts optional preloaded history for reads; mutation path still rereads by default | Explicitly review every mutation call; never pass stale batch context into decision guards |
| Unnecessary dependencies or stale advice | Follow-up introduced no app framework/dependency; existing dependencies/native packages still need review | Reject packages without a concrete need; verify package names/provenance and current advisories |
| CI privilege or untrusted PR execution | Current workflow uses ordinary pull_request/push, read-only contents token and pinned actions | Preserve minimal permissions; do not add privileged pull_request_target execution of untrusted code; keep untrusted strings out of shell source |
| Secret exposure by agent/tooling | This audit deliberately avoided local secret/session/data contents; existing redacted scan is historical evidence | Give agents scoped source/QA access; metadata/allowlisted config inspection; never paste private dumps/config into prompts or logs |
| Repository/issue prompt injection | AGENTS files, issue comments, test output and downloaded proofs can contain instructions; they are not blanket permission for host/database mutation | Treat untrusted content as data; independently review commands/scripts and target ownership before execution; apply least privileges |
| Passing tests with no relevant assertion | Existing suites inspect forbidden roles/IDs/fields and snapshots, which is stronger than status-only smoke | Keep adversarial actors, concurrency and rollback snapshots; test a specific boundary rather than mirror implementation |
| Documentation drift | B06 headers and some older statements coexist with v0.2.5/avatar/follow-up changes | Use current code/schema and exact receipts; label historical/proposed/as-built; update docs in the related later PR |

AI assistance is a development-process risk, not proof that generated code is vulnerable. ReFind has no runtime LLM endpoint in the reviewed application; a user report cannot directly “prompt inject” a nonexistent application model. The relevant prompt-injection boundary is developer/agent tooling.

### 11.4 Minimal operational ownership

Assign an operator responsible for updates, backup/restore, account disable/recovery and incident review. Keep a short private version/permission register and a redacted security-event review procedure. Alert/review on sustained authentication denials, repeated server failures, storage exhaustion, unusual BM decisions and repeated transaction conflicts. Business notifications are not a substitute for protected security logs. Campus privacy/retention/disposal decisions need product/operator policy; this audit does not invent them.

## 12. Final Recommendations

1. **Address exposure and the two critical PHP runtime advisories first.** The observed Public-profile Any-scope program allow rules and wildcard listeners make “localhost installation” an inadequate security assumption.
2. **Use a new minimal Windows-native stack alongside the existing installation.** PHP 8.4.27-1 TS x64, patched Apache 2.4.69 and MariaDB 11.4.13 are the preferred compatibility candidates, subject to full bundle/advisory verification. Latest XAMPP alone is not a fully patched acceptance result.
3. **Retain the application architecture and security boundaries.** Preserve the two roles, explicit projections, prepared statements, CSRF, private media, fresh revisions, transaction locking and business semantics. No rewrite or application schema migration is needed merely to change runtime versions.
4. **Keep the refactor and runtime rollout independently reviewable.** The newer seven-area work is implemented but uncommitted; its historical final-focused/full-matrix checkpoints must remain distinct.
5. **Treat public deployment as a separate release gate.** Require tested TLS, database privileges, file access, abuse/resource limits, logs, account policy and recoverability. Do not claim ASVS compliance from the 14 source-verified controls.
6. **Resolve conditional risks using isolated evidence.** Do not turn every library advisory into a claimed ReFind RCE, or dismiss an EOL component because its old series is missing from an advisory's maintained ranges.
7. **Preserve data and reversibility.** Match source, SQL, media, credentials/config and intended sessions during any future approved snapshot/cutover. No copied datadirs, executable-only replacement, hidden password resets or discarded post-cutover records.

### 12.1 Deliverable and source access

Report location: `C:/Users/LENOVO/.codex/worktrees/refind-v025-maintainability/ReFind_0.2.3/docs/security/REFIND_SECURITY_AUDIT_AND_MODERNIZATION_PLAN.md`.

All web/advisory/API sources in this report were accessed on **1 November 2026**. Inline vendor/CNA/GHSA/OSV links support the associated claims; version/release links distinguish current upstream evidence from repository history. Short historical test references in section 5 resolve under **W/tools/**, with `.cjs` unless a PHP/Python filename is stated. Local clickable evidence links point to the uncommitted audit worktree and line positions; they may change after future edits.

### 12.2 Explicit limits and unchanged-state claim

This audit made no application-code/configuration edits, database query or mutation, credential/session/media content access, runtime/dependency upgrade, service/firewall change, Docker/tunnel operation, deployment, commit, push, merge, PR or CI dispatch. Read-only GitHub API calls replaced a persistent git fetch. Real database contents were not independently hashed; the claim is that **this audit did not access or change them**, not that unrelated external processes were frozen.

The only intended persistent file change is this Markdown report in the isolated worktree. Pre-existing uncommitted work is preserved. Source and runtime-file metadata comparison results are recorded below after file verification.

### 12.3 Final preservation and report-verification receipt

**Result: PASS — only this report was added.** The completed report was written to the isolated worktree, then both checkouts were compared with the initial audit snapshot.

| Check | Installed application I | Audit worktree W |
|---|---|---|
| Pre-existing non-ignored files | **605 unchanged** | **609 unchanged**, excluding this report |
| Aggregate source SHA-256 | Identical to section 2.1 | Identical to section 2.1 |
| Private-file/config metadata | **105 entries unchanged** | **3 entries unchanged** |
| HEAD and local/remote branch refs | Unchanged | Unchanged |
| Original Git status | Clean, unchanged | All **79 pre-existing entries preserved** |
| Added/changed task deliverable | None | Only `docs/security/REFIND_SECURITY_AUDIT_AND_MODERNIZATION_PLAN.md` |

Report checks passed: all twelve required sections; all 30 unique control rows and details; totals **14 Verified / 4 Implemented but Unverified / 10 Partial / 2 Missing**; 16 future test scenarios; 27 linked OSV records; and **103 valid local evidence file/line links**. UTF-8 and placeholder/email/private-key/provider-token pattern checks also passed. Pattern checks supplement the deliberate avoidance of sensitive inputs; they are not an independent secret-scan certification.

No database connection, app HTTP request or mutation suite was used for preservation checks. Database contents were not independently compared, and unrelated host activity was not frozen. **No ReFind application, database, credential, session, media, service or firewall change was performed by this audit.** No remediation was implemented.
