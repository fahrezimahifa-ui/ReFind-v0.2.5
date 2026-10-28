<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require __DIR__ . '/../app/auth.php';
require_once __DIR__ . '/qa-guard.php';
assert_qa_installation(app_root());
if (app_config()['db_name'] !== 'refind_db_0_2_0_test') { fwrite(STDERR, 'Fixture mutations require the isolated _test database.' . PHP_EOL); exit(1); }
try {
    $input = json_decode(file_get_contents('php://stdin'), true, 64, JSON_THROW_ON_ERROR);
    $action = $input['action'] ?? '';
    if ($action === 'query') {
        if (!is_string($input['query'] ?? null) || !preg_match('/^\s*(SELECT|INSERT|UPDATE|DELETE)\b/i', $input['query']) ||
            preg_match('/\b(?:refind_db_0_1_0|refind_db_0_2_0|OUTFILE|LOAD_FILE)\b|;/i', $input['query'])) {
            throw new RuntimeException('Fixture SQL must stay within the test database and approved statement types.');
        }
        $stmt = sql($input['query'], $input['values'] ?? []);
        $result = $stmt->get_result();
        echo json_encode(['rows' => $result ? $result->fetch_all(MYSQLI_ASSOC) : [], 'id' => (string) db()->insert_id, 'affected' => $stmt->affected_rows], JSON_THROW_ON_ERROR);
    } elseif (in_array($action, ['clear_throttle', 'clear_password_throttle'], true)) {
        $file = fopen(storage_dir('auth') . ($action === 'clear_throttle' ? '/attempts.json' : '/password-attempts.json'), 'c+');
        if (!$file || !flock($file, LOCK_EX)) throw new RuntimeException('Cannot lock test limiter.');
        ftruncate($file, 0); fwrite($file, '{}'); fflush($file); flock($file, LOCK_UN); fclose($file);
        echo '{"cleared":true}';
    } elseif ($action === 'failpoint') {
        $name='b04_test_failpoint';
        $existing=row('SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME=?',[$name]);
        if ($existing) db()->query('DROP TRIGGER `b04_test_failpoint`');
        if (($input['mode']??'')==='media') db()->query("CREATE TRIGGER b04_test_failpoint BEFORE INSERT ON item_photos FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='B04 controlled media rollback'");
        elseif (($input['mode']??'')==='claim_notification') db()->query("CREATE TRIGGER b04_test_failpoint BEFORE INSERT ON notifications FOR EACH ROW BEGIN IF NEW.notification_type='CLAIM_SUBMITTED' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='B04 controlled claim rollback'; END IF; END");
        elseif (($input['mode']??'')==='approval_notification') db()->query("CREATE TRIGGER b04_test_failpoint BEFORE INSERT ON notifications FOR EACH ROW BEGIN IF NEW.notification_type='CLAIM_APPROVED' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='B05 controlled approval rollback'; END IF; END");
        elseif (($input['mode']??'')==='handover_notification') db()->query("CREATE TRIGGER b04_test_failpoint BEFORE INSERT ON notifications FOR EACH ROW BEGIN IF LEFT(NEW.notification_type,9)='HANDOVER_' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='B05 controlled pickup rollback'; END IF; END");
        elseif (($input['mode']??'')!=='off') throw new RuntimeException('Unknown controlled test failure.');
        echo '{"configured":true}';
    } elseif ($action === 'expire') {
        $id = $input['id'] ?? '';
        if (!is_string($id) || !preg_match('/^[a-zA-Z0-9,-]{16,128}$/D', $id) || !is_file(storage_dir('sessions') . '/sess_' . $id)) throw new RuntimeException('Unknown test session.');
        session_id($id); start_app_session();
        if (!isset($_SESSION['auth'])) throw new RuntimeException('No authenticated test session.');
        if (($input['type'] ?? '') === 'idle') $_SESSION['auth']['last_seen'] = time() - app_config()['idle_seconds'] - 2;
        elseif (($input['type'] ?? '') === 'absolute') $_SESSION['auth']['issued_at'] = time() - app_config()['absolute_seconds'] - 2;
        else throw new RuntimeException('Unknown expiry type.');
        session_write_close(); echo '{"expired":true}';
    } else throw new RuntimeException('Unknown fixture action.');
} catch (Throwable $error) { fwrite(STDERR, 'Test fixture failed: ' . $error->getMessage() . PHP_EOL); exit(1); }
