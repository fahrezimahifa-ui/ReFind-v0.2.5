<?php
declare(strict_types=1);
// Real-MariaDB qualification of word search (app/search.php) through the same view, haystack and
// collation as api/items.php. Fixtures exist only inside a rolled-back transaction on a guarded QA target.
if (PHP_SAPI !== 'cli') { http_response_code(403); exit(); }
if (basename(dirname(__DIR__)) === 'refind-dev' && !in_array(getenv('REFIND_TEST_PROFILE'), ['ui-ux-dev', 'xampp-stage'], true)) {
    throw new RuntimeException('Explicit development test profile required; legacy QA discovery refused.');
}
if ((basename(dirname(__DIR__)) === 'refind-v1-rc') !== (getenv('REFIND_TEST_PROFILE') === 'v1-rc')) {
    throw new RuntimeException('The v1-rc test profile runs only from, and is required by, the refind-v1-rc worktree.');
}
$target = getenv('REFIND_TEST_PROFILE') === 'xampp-stage' ? dirname(dirname(__DIR__)) . '/refind-xampp-stage'
    : (in_array(getenv('REFIND_TEST_PROFILE'), ['ui-ux-dev', 'v1-rc'], true) ? dirname(__DIR__) : dirname(dirname(__DIR__)) . '/ReFind_0.2.0_Test');
require $target . '/app/repository.php';
require $target . '/app/search.php';
require __DIR__ . '/qa-guard.php';
assert_qa_installation($target);

// Must stay identical to the haystack in api/items.php.
const HAYSTACK = "CONCAT_WS(' ',v.title,v.description,v.category_name,v.location_name,v.location_detail,v.floor_name)";
$results = [];
$failures = [];
$limitations = [];
function observe(string $name, bool $matches): void
{
    global $limitations;
    $limitations[] = ['behaviour' => $name, 'observed' => $matches];
    echo 'KNOWN LIMITATION ' . $name . ': ' . ($matches ? 'yes' : 'no') . PHP_EOL;
}
function expect(string $name, bool $ok): void
{
    global $results, $failures;
    $results[] = ['check' => $name, 'pass' => $ok];
    if (!$ok) $failures[] = $name;
    echo ($ok ? 'PASS ' : 'FAIL ') . $name . PHP_EOL;
}

db()->begin_transaction();
try {
    $student = row("SELECT user_id FROM users WHERE role='STUDENT' AND is_active=1 ORDER BY user_id LIMIT 1");
    if (!$student) throw new RuntimeException('A synthetic Student is required.');
    $open = (int) row("SELECT status_id FROM item_statuses WHERE status_code='OPEN'")['status_id'];
    $fixtures = [
        'casio' => ['Black Casio calculator', 'scientific solar small grey keys'],
        'battery' => ['Spare battery pack', 'USB-C output'],
        'watch' => ['Silver watch', 'metal strap'],
        'cafe' => ['Café loyalty card', 'stamped twice'],
        'kunci' => ['Kunci motor Honda', 'gantungan kunci biru, dekat parkiran'],
        'percent' => ['Charger 100% cable', 'braided_cable label'],
        'umbrella' => ['Blue umbrella', 'folding'],
    ];
    $ids = [];
    foreach ($fixtures as $key => [$title, $description]) {
        sql("INSERT INTO items(reporter_user_id,category_id,location_id,status_id,item_type,title,description,event_date,verification_clue) VALUES (?,1,35,?,'FOUND',?,?,'2026-10-10','Synthetic private clue')",
            [(int) $student['user_id'], $open, $title, $description]);
        $ids[$key] = (int) db()->insert_id;
    }
    $marks = implode(',', array_fill(0, count($ids), '?'));
    $byId = array_flip($ids);
    $search = function (string $q) use ($ids, $marks, $byId): array {
        [$condition, $values] = search_condition(search_terms($q), HAYSTACK);
        $where = 'v.item_id IN (' . $marks . ')' . ($condition !== '' ? ' AND ' . $condition : '');
        $found = array_map(fn($r) => $byId[(int) $r['item_id']], rows('SELECT v.item_id FROM v_items_overview v WHERE ' . $where . ' ORDER BY v.item_id', array_merge(array_values($ids), $values)));
        sort($found);
        return $found;
    };
    $category = row('SELECT category_name FROM v_items_overview WHERE item_id=?', [$ids['casio']])['category_name'];
    $categoryWord = mb_strtolower((string) preg_split('/\s+/u', trim((string) $category))[0]);

    expect('order-independent words: "calculator casio"', $search('calculator casio') === ['casio']);
    expect('same result in typed order: "casio calculator"', $search('casio calculator') === ['casio']);
    expect('case-insensitive under the column collation: "CASIO"', $search('CASIO') === ['casio']);
    expect('plural also finds singular: "calculators"', $search('calculators') === ['casio']);
    expect('-ies plural: "batteries"', $search('batteries') === ['battery']);
    expect('-es plural: "watches"', $search('watches') === ['watch']);
    expect('plain plural: "umbrellas"', $search('umbrellas') === ['umbrella']);
    // Known limitation (pre-existing in the earlier whole-phrase LOCATE search too): LOCATE() compares byte-length
    // substrings, so it is case-insensitive but not accent-insensitive when an accented letter is multi-byte.
    observe('unaccented "cafe" finds "Café"', $search('cafe') === ['cafe']);
    expect('accented query: "café"', $search('café') === ['cafe']);
    expect('Indonesian words in any order: "honda kunci"', $search('honda kunci') === ['kunci']);
    expect('words may come from different fields (title + description): "kunci parkiran"', $search('kunci parkiran') === ['kunci']);
    expect('word plus category name: "casio ' . $categoryWord . '"', $categoryWord === '' || in_array('casio', $search('casio ' . $categoryWord), true));
    expect('"%" is literal, not a wildcard: "100%"', $search('100%') === ['percent']);
    expect('"_" is literal, not a wildcard: "braided_cable"', $search('braided_cable') === ['percent']);
    expect('surrounding punctuation dropped: "\"casio,\""', $search('"casio,"') === ['casio']);
    expect('a missing word excludes the report: "casio umbrella"', $search('casio umbrella') === []);
    expect('8th distinct word still applies (no match)', $search('black casio calculator scientific solar small grey zzzunmatched') === []);
    expect('words beyond 8 are ignored (match)', $search('black casio calculator scientific solar small grey keys zzzunmatched') === ['casio']);
    expect('symbols-only query keeps whole-text behaviour: "***"', $search('***') === []);
    expect('whitespace-only query adds no condition', search_condition(search_terms("   \t "), HAYSTACK)[0] === '');
    expect('1,000-character query stays parameterised and bounded', count(search_terms(str_repeat('wallet ', 150))) === 1);
} finally {
    db()->rollback();
}
$receipt = ['scope' => 'Real MariaDB search semantics on guarded synthetic QA (rolled back)', 'database' => app_config()['db_name'],
    'passed' => !$failures, 'checks' => $results, 'known_limitations' => $limitations];
$directory = getenv('REFIND_EVIDENCE_DIR');
if ($directory) file_put_contents($directory . '/search-sql-results.json', json_encode($receipt, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . PHP_EOL);
echo json_encode(['passed' => !$failures, 'checks' => count($results), 'failed' => $failures, 'known_limitations' => $limitations], JSON_UNESCAPED_UNICODE) . PHP_EOL;
exit($failures ? 1 : 0);
