# WP01 local exposure change proposal

Status: **PROPOSED — NOT APPLIED**. Prepared 2026-11-02, Asia/Bangkok (UTC+07).
Authority: [approved roadmap](REFIND_SECURITY_AUDIT_AND_MODERNIZATION_PLAN.md), WP01.
The user's implementation authorization requires this exact proposal and rollback before changing existing firewall rules or main XAMPP configuration.

## Verified state and scope

- Installed source: 4d74e9872b3afa5fa1ab09c081b30d1a3437a2b5, clean.
- GitHub main: a610b1a0cb7ebb2b911f3468388076948a65b238, independently re-resolved on 2026-11-02.
- Latest follow-up: the existing dirty maintainability worktree, same 609-file fingerprint as the audit. Its 80 pre-existing status entries, including the approved report, remain untouched.
- **Final privileged inventory: main Apache and MariaDB are running with their original wildcard listeners.** HTTP/HTTPS bind 0.0.0.0 and :: on 80/443; MariaDB binds :: on 3306. Parent/process timestamps identify launch through xampp-control.exe around 12:40 +07 on 2026-11-02. This was external to the QA tools. No matching Windows service is registered. The earlier stopped-state observation applies only to the initial preparation checkpoint; LAN/Internet reachability is still unverified.
- Active network category: Public. Effective firewall profiles: enabled, inbound Block, outbound Allow.
- Four Public inbound allow rules remain enabled for the XAMPP executables, all addresses and ports. Both TCP and UDP rules exist; TCP is the relevant current server protocol.
- Main Apache configuration still contains wildcard HTTP/HTTPS listeners, CGI aliases and the AJP examples include. MariaDB has no active bind-address directive in its inspected allowlist.
- Existing phpMyAdmin/webalizer/status/info restrictions already use local authorization. Retain those boundaries.

The proposed end state is local-only access. It removes LAN access for **all applications using these XAMPP instances**, including other worktrees. No ReFind public route, API, role, session name, database name or application file changes. Confirm any intentional LAN/CGI/Tomcat use before approval; none was demonstrated by this inspection.

## Ownership verification completed on 2026-11-02

Both PersistentStore and ActiveStore returned exactly the four listed local rules: Enabled True, Inbound Allow, Public; Service Any; local/remote addresses and ports Any; the listed TCP/UDP protocol and exact Program path. No matching Windows service uses either executable. The program filters scope these rules to the intended XAMPP installation rather than other Apache/MySQL executable paths; disabling them does not edit another program's rule.

Service Any is not evidence that a rule is required by an unrelated service. There is no direct unrelated Windows service dependency in this inventory. Manual applications sharing these two binaries, future service registration, intentional LAN clients, and other XAMPP sites' CGI/AJP requirements are not exhaustively provable from a service snapshot. The proposed binding affects all such XAMPP consumers. Preserve that operational review point rather than asserting no possible dependency.

The cgi-bin directory proposal now also changes AllowOverride All to None so an .htaccess file cannot restore the denied access. Main files and rules remain unchanged; all four configuration precondition hashes were rechecked and match below.

## Exact proposed firewall change

Only change Enabled from True to False for these four existing rule Names. Do not delete rules, use a DisplayName wildcard, change profile defaults, add exceptions or create new background services.

| Program | Protocol | Exact rule Name |
|---|---|---|
| C:\xampp\apache\bin\httpd.exe | TCP | TCP Query User{D20F32CB-A64F-403A-B53E-7D2736B922B3}C:\xampp\apache\bin\httpd.exe |
| C:\xampp\apache\bin\httpd.exe | UDP | UDP Query User{0D2583EC-50A6-4BC8-9569-DA019BDD34C4}C:\xampp\apache\bin\httpd.exe |
| C:\xampp\mysql\bin\mysqld.exe | TCP | TCP Query User{EB0CA1E0-C04A-4162-AC8E-56AB3787C8B7}C:\xampp\mysql\bin\mysqld.exe |
| C:\xampp\mysql\bin\mysqld.exe | UDP | UDP Query User{98F98946-536F-48F9-9EB6-82646575A17E}C:\xampp\mysql\bin\mysqld.exe |

Review-only PowerShell sequence below; **not executed**. Requery PersistentStore and ActiveStore immediately before mutation and reject missing/extra/different rules, executable paths, actions, scopes, protocols or profiles. A Group Policy rule must not be edited as a local rule.

~~~powershell
$ruleNames = @(
  'TCP Query User{D20F32CB-A64F-403A-B53E-7D2736B922B3}C:\xampp\apache\bin\httpd.exe',
  'UDP Query User{0D2583EC-50A6-4BC8-9569-DA019BDD34C4}C:\xampp\apache\bin\httpd.exe',
  'TCP Query User{EB0CA1E0-C04A-4162-AC8E-56AB3787C8B7}C:\xampp\mysql\bin\mysqld.exe',
  'UDP Query User{98F98946-536F-48F9-9EB6-82646575A17E}C:\xampp\mysql\bin\mysqld.exe'
)
# $rollbackDirectory is a new private, ACL-restricted directory outside htdocs.
# Save each rule plus its application/address/port filters and Enabled value.
# Reverify exactly these four identities against the baseline JSON before this step.
foreach ($ruleName in $ruleNames) {
  Set-NetFirewallRule -PolicyStore PersistentStore -Name $ruleName -Enabled False
}
~~~

## Exact proposed service-configuration changes

These are contextual diffs for the current files, **not a script to apply automatically**. The original files are not copied into Git. Recheck hashes and exact match counts before changing anything; abort on drift.

C:\xampp\apache\conf\httpd.conf:

~~~diff
@@ line 60
-Listen 80
+Listen 127.0.0.1:80
+Listen [::1]:80
@@ line 371
-    ScriptAlias /cgi-bin/ "C:/xampp/cgi-bin/"
+    # WP01: unused CGI alias disabled.
+    # ScriptAlias /cgi-bin/ "C:/xampp/cgi-bin/"
@@ lines 387-391 (only this Directory block)
 <Directory "C:/xampp/cgi-bin">
-    AllowOverride All
+    AllowOverride None
     Options None
-    Require all granted
+    Require all denied
 </Directory>
@@ line 564
-Include "conf/extra/httpd-ajp.conf"
+# WP01: unused AJP examples mapping disabled.
+# Include "conf/extra/httpd-ajp.conf"
~~~

C:\xampp\apache\conf\extra\httpd-ssl.conf:

~~~diff
@@ line 36
-Listen 443
+Listen 127.0.0.1:443
+Listen [::1]:443
~~~

The existing _default_:443 virtual host and certificate configuration remain in place. Listener binding supplies the network boundary. TLS policy modernization is a separate tested runtime change.

C:\xampp\apache\conf\extra\httpd-xampp.conf:

~~~diff
@@ lines 48-56
-ScriptAlias /php-cgi/ "C:/xampp/php/"
+# WP01: ReFind uses mod_php; disable the unused direct PHP-CGI alias.
+# ScriptAlias /php-cgi/ "C:/xampp/php/"
 <Directory "C:/xampp/php">
     AllowOverride None
     Options None
     Require all denied
-    <Files "php-cgi.exe">
-          Require all granted
-    </Files>
 </Directory>
~~~

C:\xampp\mysql\bin\my.ini:

~~~diff
@@ lines 28-29
 [mysqld]
 port=3306
+bind-address=127.0.0.1
~~~

Keep datadir, credentials, SQL modes, collations, schema, binaries and accounts unchanged. The existing application's database host is IPv4 loopback, so this does not require an application configuration change. No raw datadir copy or executable-only replacement.

## Application sequence and acceptance gate

1. Review this proposal; obtain the user's main-configuration/firewall authorization. Verify any other intended XAMPP consumers.
2. Review the completed isolated equivalent: Apache 2.4.69/PHP 8.4.27-1 on IPv4/IPv6 loopback, seven private/alias paths denied, TLS chain/hostname/protocol tests, and the clean 26-stage MariaDB 11.4 synthetic matrix passed. This verifies the candidate boundary, not the syntax or effect of editing the existing XAMPP files. Native BOM qualifications remain in the implementation record.
3. Main is currently running. Coordinate a brief pause for all XAMPP HTTP/SQL writers, record the current running/process state, and stop only these identified instances using the normal Control Panel controls. With services stopped and writers paused, save private byte-for-byte copies of the four files, their hashes, exact rule/filter snapshots and prior process/service state. Do not export the entire host firewall policy or include credentials in a tracked receipt. Keep XAMPP stopped until the approved verification/restart step. This pause affects every site/database consumer on these shared instances; the user must approve that impact.
4. Disable the four exact rules. Apply only the reviewed diff; abort on source/config drift.
5. Run existing Apache configuration syntax checks against the edited configuration before starting it. If invalid, remain stopped and restore the affected file.
6. In the approved verification window start the existing instances normally. Inspect executable paths and listeners: Apache only 127.0.0.1/::1 on 80/443, MariaDB only 127.0.0.1:3306. Recheck effective rule state.
7. Check guest login/page access over IPv4/IPv6, protected/private-directory denials, phpMyAdmin's local restriction, and unavailable /php-cgi/, /cgi-bin/ and /examples. Do not send exploit strings or authenticate with real accounts. A login-page request can create guest session state; execute this only in that separately approved main verification window. Full account/workflow tests remain synthetic QA only.
8. If an authorized separate LAN client is available, verify TCP refusal without account/API mutations. Until then label off-host reachability unverified. Do not infer router/NAT/UPnP or IPv6 Internet policy from local rules.
9. Restore the original stopped/running state as agreed and write a redacted verification receipt. No public deployment or main-runtime cutover.

Acceptance requires both the configured and effective boundaries, intended local access, no unintended external listeners or broad allow rules, and no operational regression. A stopped service by itself does not complete WP01.

## Rollback, with containment retained

- Never mass-import firewall policy or kill an unrelated process.
- On failure stop only the identified XAMPP instances using their normal controls; do not stop by broad process-name wildcard. Keep the four broad allow rules disabled.
- Restore only the four changed configuration files from the private, hash-verified pre-change copies while services are stopped. Recheck their original SHA-256 values and Apache syntax.
- Restoring wildcard listeners does **not** authorize restarting them externally exposed. Keep the instances stopped until a corrected loopback configuration passes, or retain an independently verified equivalent firewall boundary. With restored wildcard listeners, assess all effective matching rules before any restart.
- Exact prior firewall state is retained for recovery review. Re-enabling a broad Public allow rule requires a new explicit approval and a reviewed equal-or-stronger network boundary; it is not the default rollback.
- No data/schema/runtime changes occur in this package, so no SQL restoration, account reset, session deletion or media replacement is part of rollback.

## Configuration precondition hashes (SHA-256)

| File | Hash |
|---|---|
| apache/conf/httpd.conf | 6fb3a36928e00007a206152ac5dce25257e4960d79c0127679ac75ede231ba10 |
| apache/conf/extra/httpd-ssl.conf | 91473e6b86e62d246d7f0758a1d671238fc1b820dd12ba5ab3d4eebe233ad685 |
| apache/conf/extra/httpd-xampp.conf | 791876ab51f37637624cdb44ee08c9b7a00c908b6a9d0fc719496de1e0e8524b |
| mysql/bin/my.ini | 6152ad66950baa39f93071a21baea0afe363c54376132fa36dba9f0284fe393b |

The executable versions remain PHP 8.2.12 / Apache 2.4.58 / MariaDB 10.4.32. Containment reduces exposure; it does not patch the vendor-confirmed PHP core vulnerabilities.
