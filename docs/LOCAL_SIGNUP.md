# Normal local Student registration

Open http://localhost/ReFind_0.2.3/login.html as a guest and select **Create account** directly below **Log in**. Enter Full name, Email, Password and Confirm password. Successful registration immediately signs in an active Student. Later logout/login uses the same email and password. There is no access key, launcher, unlock screen or registration expiry.

## Local boundary and configuration

The entire ReFind directory is limited to actual loopback connection peers by its root .htaccess. It supports IPv4, IPv6 and mapped IPv4 loopback, rejects non-loopback peers before PHP, and ignores Host/forwarded-header claims. This covers pages, APIs and assets over the existing HTTP/HTTPS listeners. Other XAMPP applications, listeners, firewall rules and services are unchanged. ReFind cannot be shared over LAN/VPN without deliberately reassessing this boundary.

The ignored local override sets registration_enabled=true and registration_local_only=true. Source defaults remain false/true, with 10 registration attempts per IP per 900 seconds. The obsolete registration_access_file setting, key API and activation tools have been removed. Old private activation files are inert; existing backups and historical reports are preserved.

Session bootstrap's registration_enabled remains effective availability for the requester. Authentication, CSRF, password rules, hashing, duplicate handling, server-assigned Student role, nullable Student ID, automatic sign-in and BM permissions are unchanged. Email neither verifies mailbox ownership nor proves UMN enrollment.

A loopback proxy/tunnel can originate local connections. The inspected Windows/WSL forwarding metadata contained no route into ReFind; this must be rechecked before activation and after future forwarding/networking changes. Do not treat forwarded headers or a hostname as proof of locality.

## Verification and operation

No extra service or periodic activation is needed: run the existing Apache/MariaDB installation normally. To disable registration, set only registration_enabled=false in the private override, preserving other settings. Never run setup/seeding to check an existing database connection.

Use owned disposable QA for account creation, login mutations and workflows. The registration UI suite covers both themes at 320/390/768/1280/1440px; tools/test-local-access.cjs tests real loopback/non-loopback Apache behavior and a synthetic sibling site. Native main acceptance is guest GET/HEAD only: no test accounts, login or registration POSTs. Test results and source manifests remain separate from private configuration backups.

For rollback, restore the complete private configuration backup before returning to the original source revision. Preserve every account, password, session, upload and database record; perform no SQL restoration, migration, reset or seeding. A retired key activation must remain revoked if its old source/configuration is restored.
