<?php
declare(strict_types=1);
// Search term regression checks (U-01). Pure functions only: no database, session or network access.
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require dirname(__DIR__) . '/app/search.php';

$failures = 0;
function check(string $label, bool $passed): void
{
    global $failures;
    echo ($passed ? 'PASS ' : 'FAIL ') . $label . PHP_EOL;
    if (!$passed) $failures++;
}
// Mirrors LOCATE under utf8mb4_unicode_ci for ASCII text: case-insensitive substring per accepted form.
function finds(string $query, string $haystack): bool
{
    $haystack = mb_strtolower($haystack);
    foreach (search_terms($query) as $forms) {
        if (!array_filter($forms, fn($form) => str_contains($haystack, mb_strtolower($form)))) return false;
    }
    return true;
}

$terms = [
    'brown wallet' => [['brown'], ['wallet']],
    'wallet brown' => [['wallet'], ['brown']],
    '  Brown   WALLET ' => [['brown'], ['wallet']],
    'wallets' => [['wallet']],
    'wallet wallets Wallet' => [['wallet']],
    'batteries' => [['batteries', 'battery']],
    'glasses' => [['glass']],
    'watches' => [['watch']],
    'boxes' => [['box']],
    'cases' => [['case']],
    'shoes' => [['shoe']],
    'keys' => [['key']],
    'glass' => [['glass']],
    'campus' => [['campus']],
    'iris' => [['iris']],
    'bus' => [['bus']],
    'tas' => [['tas']],
    '"brown wallet",' => [['brown'], ['wallet']],
    'ID/Wallet' => [['id/wallet']],
    'fx-991' => [['fx-991']],
    '???' => [['???']],
    '' => [],
    '   ' => [],
];
foreach ($terms as $query => $expected) check('terms ' . json_encode($query) . ' => ' . json_encode($expected), search_terms($query) === $expected);
check('at most 8 words are used', count(search_terms('a1 b2 c3 d4 e5 f6 g7 h8 i9 j10')) === 8);

$haystack = "CONCAT_WS(' ',v.title,v.description)";
[$sql, $values] = search_condition(search_terms('brown wallets batteries'), $haystack);
check('condition requires every word', substr_count($sql, ' AND ') === 2);
check('one placeholder per accepted form', substr_count($sql, '?') === count($values) && $values === ['brown', 'wallet', 'batteries', 'battery']);
check('alternative forms of one word are OR-ed', str_contains($sql, '(LOCATE(?,' . $haystack . ')>0 OR LOCATE(?,' . $haystack . ')>0)'));
check('search text never enters the SQL', !str_contains($sql, 'brown') && !str_contains($sql, 'wallet'));
check('empty search adds no condition', search_condition(search_terms(''), $haystack) === ['', []]);
[$injectSql, $injectValues] = search_condition(search_terms("x' OR 1=1 --"), $haystack);
check('quotes and SQL keywords stay bound values', !str_contains($injectSql, "'x") && in_array('1=1', $injectValues, true));

// Audit regression cases against demo-style report text (title, description, category, area).
$wallet = 'Brown leather wallet Diagonal stitching along the inner fold. ID/Wallet Parkiran';
$calculator = 'Casio scientific calculator Grey solar calculator. Stationery Gedung C';
$headphones = 'AKG over-ear headphones Black studio headphones. Electronics Gedung D';
$umbrella = 'Brown folding umbrella Compact umbrella with wooden handle. Other Gedung D';
$battery = 'Spare battery pack Small power bank. Electronics Lapangan';
$glasses = 'Reading glasses case Black hard case. Accessories Gedung A';
foreach ([
    ['brown wallet', $wallet, true], ['wallet brown', $wallet, true], ['wallets', $wallet, true], ['wallet', $wallet, true],
    ['brown leather wallet', $wallet, true], ['Brown Wallet', $wallet, true], ['wallet parkiran', $wallet, true], ['id/wallet', $wallet, true],
    ['black wallet', $wallet, false], ['brown wallet gedung', $wallet, false],
    ['headphones', $headphones, true], ['black headphones', $headphones, true], ['umbrellas', $umbrella, true], ['brown umbrellas', $umbrella, true],
    ['batteries', $battery, true], ['glasses', $glasses, true], ['cases', $glasses, true],
    ['phone cases', $calculator, false], ['cases', $calculator, false], ['calculators casio', $calculator, true],
] as [$query, $text, $expected]) check(($expected ? 'finds ' : 'skips ') . json_encode($query) . ' in "' . strtok($text, ' ') . '…"', finds($query, $text) === $expected);

echo $failures ? "$failures search check(s) failed." . PHP_EOL : 'All search checks passed.' . PHP_EOL;
exit($failures ? 1 : 0);
