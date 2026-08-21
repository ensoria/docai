# DocAI Messaging Fixture 初版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`（推奨）または `superpowers:executing-plans` を使い、この計画を task 単位で実行すること。進捗は各 step のチェックボックス（`- [ ]`）で管理する。

**Goal:** DocAI Messaging 0.17.1 の Compatibility Core fixture を先行公開できる状態から始め、complete generator surface、release candidate、安定版 `v1.0.0` の versioned conformance corpus までを、再現可能な checker と証跡付きで構築する。

**Architecture:** source input、生成済み document set、focused valid/invalid fixture、fixture checker、coverage/evidence を一つの垂直スライスとして段階ごとに完成させる。Markdown の字句解析・構造解析・document-set 検証は再利用可能な純粋関数として分離し、公開 validator API ではなく、versioned corpus の期待結果を判定する runner から利用する。

**Tech Stack:** Node.js ESM、Node.js 標準ライブラリ（`node:test`、`node:assert/strict`、`node:crypto`、`node:fs`、`node:path`）、JSON 形式の AsyncAPI fixture、Markdown、トークン evidence のみ Python 3.9 以上と `tiktoken==0.13.0`（`o200k_base`）。

## Global Constraints

- 規範仕様は `docai-messaging/README.md`。fixture や checker が README と衝突した場合、fixture に合わせて解釈を固定せず、README の意味を先にレビューする。
- 初期 corpus は DocAI Messaging `0.17.1` を対象に `docai-messaging/fixtures/core/v0.17.1/` へ作成する。
- `0.17.1` の意味を変える README 修正が必要になった場合は §3.1 に従って仕様バージョンを更新し、新しい versioned fixture ディレクトリを作る。公開済み corpus を上書きしない。
- source fixture は YAML parser 依存を避けるため JSON 形式の AsyncAPI 3.0.0 / 3.1.0 を使用する。YAML 表現そのものの検証は source adapter 実装の別計画とする。
- Core checker は corpus 固有の expectation checker とし、公開 reusable validator、generator、AsyncAPI-to-DocAI converter を名乗らない。
- parser/validator の純粋関数は corpus runner から分離し、後続の complete surface checker と安定版 checkerで再利用する。
- invalid fixture は原則として一つの primary rule だけを違反させる。cascade diagnostics が発生する場合は primary と secondary を区別する。
- fixture 内の秘密情報、実在個人情報、規制対象データ、機密 production 値は禁止する。例は constraint-valid な synthetic data のみを使う。
- document-set root は closed root とし、`INDEX.md`、`CONVENTIONS.md`、`indexes/`、`channels/`、`workflows/`、`references/` 以外の証跡や source を valid set 内へ混在させない。
- Git は読み取り専用で扱う。`git add`、`git commit`、tag、push は、ユーザーから明示的な指示がない限り実行しない。各 task の完了時は推奨 commit message のみ提示する。
- checker が通ることだけで仕様準拠を宣言しない。README §8 の coverage matrix と人手レビューを別の release gate とする。
- トークン削減の正式な主張には README §6.2 の evidence を必須とする。`characters / 4` の近似値を正式な token count として扱わない。

---

## Target File Structure

```text
docai-messaging/
  fixtures/
    README.md
    rules.json
    core/
      v0.17.1/
        README.md
        COVERAGE.md
        SOURCE-TRACEABILITY.md
        cases.json
        source/
          storefront-asyncapi-3.1.0.json
          storefront-behavior.json
          projection-input-manifest.json
          focused/
            asyncapi-3.0.0-message-selection.json
            asyncapi-3.1.0-message-selection.json
            recursive-schema.json
        valid/
          full/
            INDEX.md
            CONVENTIONS.md
            channels/
        focused/
          valid/
          invalid/
    complete-candidates/
      v0.17.1/
        README.md
        COVERAGE.md
        SOURCE-TRACEABILITY.md
        TOKEN-EVIDENCE.md
        cases.json
        source/
        valid/
          full/
          compact/
        focused/
          valid/
          invalid/
        evaluations/
          tasks.json
          retrieval-runs.json
          RESULTS.md
    release-candidates/
      v1.0.0-rc.1/
        README.md
        COVERAGE.md
        SOURCE-TRACEABILITY.md
        SEMANTIC-DRIFT-AUDIT.md
        REVIEW.md
        cases.json
        source/
        valid/
          full/
          compact/
        focused/
          valid/
          invalid/
        evaluations/
    conformance/
      v1.0.0/
        README.md
        COVERAGE.md
        SOURCE-TRACEABILITY.md
        SEMANTIC-DRIFT-AUDIT.md
        REVIEW.md
        TOKEN-EVIDENCE.md
        cases.json
        source/
        valid/
          full/
          compact/
        focused/
          valid/
          invalid/
        evaluations/
  tools/
    lib/
      diagnostics.mjs
      metadata.mjs
      identity.mjs
      markdown.mjs
      tables.mjs
      paths.mjs
      sentence.mjs
      media-type.mjs
      json-value.mjs
      document-set.mjs
      fixture-runner.mjs
      validators/
        core.mjs
        complete.mjs
    tests/
      metadata.test.mjs
      identity.test.mjs
      markdown.test.mjs
      tables.test.mjs
      paths.test.mjs
      sentence.test.mjs
      media-type.test.mjs
      json-value.test.mjs
      document-set.test.mjs
      fixture-runner.test.mjs
    check-core-fixtures.mjs
    check-complete-fixtures.mjs
    check-conformance-fixtures.mjs
    check-release-readiness.mjs
    restamp-document-set.mjs
    build-token-evidence.py
    token-evidence-requirements.txt
  CHANGELOG.md
  RELEASE.md
```

## Validation Interfaces

後続 task は、以下の interface 名と戻り値を変更せずに利用する。

```js
// tools/lib/diagnostics.mjs
export function diagnostic(ruleId, file, line, message, severity = "error", cascade = false) {
  return { ruleId, file, line, message, severity, cascade };
}

// tools/lib/document-set.mjs
export function loadDocumentSet(rootDir) {
  return { rootDir, files, paths, diagnostics };
}

export function validateDocumentSet(documentSet, options) {
  return { diagnostics, facts };
}

// tools/lib/fixture-runner.mjs
export function runFixtureCorpus(corpusDir, validator) {
  return { passed, failed, cases, diagnostics };
}
```

`cases.json` は次の形式に固定する。

```json
{
  "docai_messaging": "0.17.1",
  "scope": "compatibility-core",
  "cases": [
    {
      "id": "core-valid-full-set",
      "kind": "document-set",
      "path": "valid/full",
      "expected": "valid",
      "expected_rule_ids": []
    },
    {
      "id": "metadata-duplicate-standard-key",
      "kind": "focused-document",
      "path": "focused/invalid/metadata-duplicate-standard-key.md",
      "expected": "invalid",
      "expected_rule_ids": ["DM-META-004"]
    }
  ]
}
```

Rule ID の prefix は次に固定する。

| Prefix | Area |
|---|---|
| `DM-META` | opening metadata、version、profile、extension |
| `DM-PARSE` | shared context-free Markdown、table、path、sentence lexical/structural parsing |
| `DM-ID` | identity trailer、digest、closed root、mixed set |
| `DM-SRC` | Sources、source_refs、projection manifest |
| `DM-IDX` | INDEX routing、shards、context selection |
| `DM-CONV` | CONVENTIONS、dependency closure、common shapes |
| `DM-OP` | operation heading、Behavior、bindings、Channel |
| `DM-MSG` | Message、Headers、Bindings、Payload、variants |
| `DM-REPLY` | Reply、reply selection、correlation、timeout |
| `DM-FAIL` | Failure Handling、common/inline failure shapes |
| `DM-INC` | `unknown`、`unsupported`、`none`、deviation |
| `DM-ADAPTER` | schema、wire、header、protocol adapter boundary |
| `DM-TRUST` | instruction trust boundary、publication safety |
| `DM-PROFILE` | full/compact parity、`field_defaults`、`same_as` |
| `DM-WORKFLOW` | workflow grammar、routing、recovery |
| `DM-REF` | Reference Material |
| `DM-TOKEN` | sharding/reduction measurement evidence |
| `DM-COMPAT` | future-minor compatibility、publication scope |

---

### Task 1: Corpus Contract と Test Harness を固定する

> **Plan change / impact (user-approved):** Task 1 now guarantees that every expected and emitted rule ID is cataloged. Task 5 no longer introduces catalog-membership enforcement; it extends the existing guarantee with unused-rule detection and one-to-one test/catalog correspondence.

**Files:**

- Create: `docai-messaging/fixtures/README.md`
- Create: `docai-messaging/fixtures/rules.json`
- Create: `docai-messaging/fixtures/core/v0.17.1/cases.json`
- Create: `docai-messaging/tools/lib/diagnostics.mjs`
- Create: `docai-messaging/tools/lib/fixture-runner.mjs`
- Create: `docai-messaging/tools/tests/fixture-runner.test.mjs`

**Interfaces:**

- Consumes: `cases.json` の固定 schema と rule prefix table。
- Produces: `diagnostic()`、`runFixtureCorpus()`、human-readable checker report。

- [x] **Step 1: fixture の役割と非目標を文書化する**
  - `fixtures/README.md` に versioned corpus、valid set、focused valid/invalid、source、evidence の役割を書く。
  - checker は corpus expectation checker であり、公開 validator や generator ではないと明記する。
  - published fixture は immutable とし、意味変更は新しい version directory で行う。

- [x] **Step 2: rule catalog を作る**
  - `rules.json` に `rule_id`、README section、短い説明、Core/complete の scope を記録する。
  - 最初に `DM-META-001`、`DM-META-004`、`DM-ID-001`、`DM-SRC-001`、`DM-IDX-001` の最小行を置き、各 task で追記する。

- [x] **Step 3: failing runner test を書く**

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runFixtureCorpus } from "../lib/fixture-runner.mjs";

function createTemporaryCorpus(testCase) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "docai-messaging-runner-"));
  fs.mkdirSync(path.join(root, "focused", "invalid"), { recursive: true });
  fs.writeFileSync(path.join(root, testCase.path), "invalid fixture\n");
  fs.writeFileSync(path.join(root, "cases.json"), JSON.stringify({
    docai_messaging: "0.17.1",
    scope: "compatibility-core",
    cases: [testCase]
  }));
  return root;
}

test("fails when an invalid case does not emit its expected rule", () => {
  const corpus = createTemporaryCorpus({
    id: "metadata-duplicate-standard-key",
    kind: "focused-document",
    path: "focused/invalid/metadata-duplicate-standard-key.md",
    expected: "invalid",
    expected_rule_ids: ["DM-META-004"]
  });
  const result = runFixtureCorpus(corpus, () => ({ diagnostics: [] }));
  assert.equal(result.failed, 1);
});
```

  - catalog にない expected/emitted rule ID、valid case の error、unexpected primary error、failure summary/exit code を直接 test にする。

- [x] **Step 4: test が期待どおり失敗することを確認する**
  - Run: `node --test docai-messaging/tools/tests/fixture-runner.test.mjs`
  - Expected: catalog にない expected/emitted rule ID assertion で FAIL。

- [x] **Step 5: manifest loader と expectation comparison を最小実装する**
  - valid case は error diagnostics が 0 件であることを要求する。
  - invalid case は全 `expected_rule_ids` を primary diagnostic として含むことを要求する。
  - 予期しない primary error は失敗、`cascade: true` の追加 error は report に残す。
  - `cases.json` と fixture root の `rules.json` を読み、expected と emitted の全 rule ID が catalog に存在しない場合は deterministic に失敗する。

- [x] **Step 6: report format を固定する**
  - 各 case を、例えば `FAIL metadata-duplicate-standard-key expected=invalid actual=valid rules=none` の形式で出力する。
  - catalog にない expected/emitted rule ID は case report に明示する。
  - 最後に `N passed, M failed` を出力し、`M > 0` なら process exit code 1 とする。

- [x] **Step 7: runner test を再実行する**
  - Run: `node --test docai-messaging/tools/tests/fixture-runner.test.mjs`
  - Expected: catalog membership と all runner tests が PASS。

**Review gate:** fixture の validity と checker 自身の correctness が循環定義になっていないことを確認する。

**Suggested commit message:** `test(messaging): define fixture corpus contract and runner`

---

### Task 2: Markdown、Metadata、Table、Path Parser を TDD で作る

> **Plan change / impact (user-approved):** Shared context-free lexical and structural parser failures use the new fixed `DM-PARSE` prefix. Task 2 catalogs `DM-PARSE-001` through `DM-PARSE-004`; later semantic validators deliberately emit or translate to the relevant area-specific rule when a violation is semantic and may retain the parser diagnostic as cascade evidence. A pure syntax-focused fixture may use `DM-PARSE` as its primary diagnostic. Task 5's catalog/test correspondence checks cover these entries as well.

**Files:**

- Create: `docai-messaging/tools/lib/metadata.mjs`
- Create: `docai-messaging/tools/lib/markdown.mjs`
- Create: `docai-messaging/tools/lib/tables.mjs`
- Create: `docai-messaging/tools/lib/paths.mjs`
- Create: `docai-messaging/tools/lib/sentence.mjs`
- Test: corresponding files under `docai-messaging/tools/tests/`
- Test: `docai-messaging/tools/tests/parser-diagnostics.test.mjs`

**Interfaces:**

- Produces: `parseOpeningMetadata(line)`、`scanMarkdown(source)`、`parsePipeTable(lines)`、`parseDocsPath(value)`、`validateSentenceLine(line, min, max)`。

- [x] **Step 1: metadata escaping の failing tests を書く**
  - six standard keys の順序、odd/even backslash run、`\|`、`\\`、unknown escape、trailing backslash、duplicate key を個別 test にする。
  - missing standard key と duplicate extension key を明示的な regression test にする。
  - `x-[a-z0-9][a-z0-9._-]*` の valid/invalid と pre-1.0 unknown standard key rejection を含める。

- [x] **Step 2: table parser の failing tests を書く**
  - leading/trailing pipe、separator row、列数一致、odd/even escaped pipe、ASCII trim、`\|` decode のみを検証する。
  - HTML entity、code span、emphasis を勝手に正規化しない test を含める。

- [x] **Step 3: path と sentence grammar の failing tests を書く**
  - docs-root-relative path、profile link、`none` collision、`.` / `..`、backslash、query/fragment を検証する。
  - `. ! ? 。 ！ ？` を literal count し、URL、略語、inline code 内も数える。

- [x] **Step 4: parser tests の RED を確認する**
  - Run: `node --test docai-messaging/tools/tests/metadata.test.mjs docai-messaging/tools/tests/markdown.test.mjs docai-messaging/tools/tests/tables.test.mjs docai-messaging/tools/tests/paths.test.mjs docai-messaging/tools/tests/sentence.test.mjs docai-messaging/tools/tests/parser-diagnostics.test.mjs`
  - Expected: import または未実装 assertion で FAIL。

- [x] **Step 5: pure parser を実装する**
  - parse failure は例外文字列ではなく `diagnostic()` を返し、line number を保持する。
  - shared parser failure は `DM-PARSE-001`（Markdown）、`DM-PARSE-002`（table）、`DM-PARSE-003`（path）、`DM-PARSE-004`（sentence）を返し、四つすべてを rule catalog に登録する。metadata failure は `DM-META-*` のままとする。
  - 後続 validator は semantic violation を relevant area-specific rule として意図的に emit/translate し、`DM-PARSE` は cascade evidence として保持してよい。pure syntax-focused case は `DM-PARSE` を primary にしてよい。
  - Markdown heading と fenced block の境界を source line ベースで保持する。
  - prose の見た目を評価せず、README §3.5 の source grammar のみを実装する。

- [x] **Step 6: parser tests の GREEN を確認する**
  - Run: `node --test docai-messaging/tools/tests/metadata.test.mjs docai-messaging/tools/tests/markdown.test.mjs docai-messaging/tools/tests/tables.test.mjs docai-messaging/tools/tests/paths.test.mjs docai-messaging/tools/tests/sentence.test.mjs docai-messaging/tools/tests/parser-diagnostics.test.mjs`
  - Expected: 全 test PASS。

**Review gate:** parser が Markdown renderer の挙動や locale に依存していないことを確認する。

**Suggested commit message:** `feat(messaging): add deterministic markdown fixture parsers`

---

### Task 3: Media Type と Arbitrary-Precision JSON Semantics を実装する

**Files:**

- Create: `docai-messaging/tools/lib/media-type.mjs`
- Create: `docai-messaging/tools/lib/json-value.mjs`
- Test: `docai-messaging/tools/tests/media-type.test.mjs`
- Test: `docai-messaging/tools/tests/json-value.test.mjs`

**Interfaces:**

- Produces: `canonicalizeMediaType(sourceValue)`、`parseExactJson(source)`、`equalExactJson(a, b)`。

- [x] **Step 1: RFC 9110 media type fixtures を test table にする**
  - type/subtype/parameter-name case folding、parameter ASCII sort、token/quoted equivalence、quoted-pair、empty parameter entry、OWS around `;` を valid にする。
  - whitespace around `=`、duplicate case-folded parameter、invalid UTF-8 相当入力、trailing escape を invalid にする。
  - multibyte UTF-8、Unicode normalization が異なる値、`: ` を含む quoted value の byte length を検証する。

- [x] **Step 2: exact JSON tests を書く**
  - `1`、`1.0`、`1e0` は等価。
  - IEEE 754 を超える隣接整数は不等価。
  - arbitrary exponent、negative zero、object order independence、array order sensitivity、duplicate object member rejection、non-normalized string inequality を検証する。

- [x] **Step 3: tests の RED を確認する**
  - Run: `node --test docai-messaging/tools/tests/media-type.test.mjs docai-messaging/tools/tests/json-value.test.mjs`
  - Expected: FAIL。

- [x] **Step 4: decimal を Number へ変換しない parser/comparator を実装する**
  - number は sign、coefficient digits、base-10 exponent の canonical tuple として比較する。
  - object member を exact decoded string key の Map として保持し、duplicate を parse error にする。
  - media type は UTF-8 bytes に対して ABNF class を評価する。

- [x] **Step 5: tests の GREEN を確認する**
  - Run: `node --test docai-messaging/tools/tests/media-type.test.mjs docai-messaging/tools/tests/json-value.test.mjs`
  - Expected: 全 test PASS。

**Review gate:** JavaScript `Number`、locale sort、Unicode normalization が canonical comparison に混入していないことを確認する。

**Suggested commit message:** `feat(messaging): validate media types and exact JSON values`

---

### Task 4: Identity、Digest、Closed Root、Mixed Set 検証を実装する

> **Plan change / impact (user-approved):** `projection_digest` は emitted set ではなく producer-published projection-input manifest の exact UTF-8 bytes に由来するため、restamp CLI は `--projection-manifest <path>` と document-set root の両方を明示的に要求する。manifest の auto-discovery は行わず、manifest は closed root の外側に置き、projection identity を先に stamp してから set identity を計算する。この変更は Task 8、12、15 の restamp command と Task 16 の freeze 手順にも反映する。

**Files:**

- Create: `docai-messaging/tools/lib/identity.mjs`
- Create: `docai-messaging/tools/lib/document-set.mjs`
- Create: `docai-messaging/tools/restamp-document-set.mjs`
- Test: `docai-messaging/tools/tests/identity.test.mjs`
- Test: `docai-messaging/tools/tests/document-set.test.mjs`

**Interfaces:**

- Consumes: metadata parser、docs path parser。
- Produces: `computeSetDigest(files)`、`deriveShortId(fullDigest)`、`loadDocumentSet(rootDir)`。

- [x] **Step 1: digest vector tests を書く**
  - README の `set_digest` / `set_id`、`projection_digest` / `projection_id` 例を固定 vector にする。
  - `SELF` replacement、path length-prefix、ASCII path order、file add/remove/rename/content change を検証する。

- [x] **Step 2: closed-root tests を書く**
  - unrelated file、symbolic link、invalid UTF-8、empty directory、missing trailer、trailer 後の非空行を拒否する。
  - source/evidence が valid document-set root の外側にある valid case を受理する。

- [x] **Step 3: mixed-set tests を書く**
  - version、profile、perspective、set_id、projection_id の各 mismatch を別 rule ID で拒否する。
  - coverage、knowledge、source_refs は file ごとに異なってよいことを positive test にする。

- [x] **Step 4: tests の RED を確認する**
  - Run: `node --test docai-messaging/tools/tests/identity.test.mjs docai-messaging/tools/tests/document-set.test.mjs`
  - Expected: FAIL。

- [x] **Step 5: byte-exact digest implementation を作る**
  - UTF-8 bytes と path bytes を明示し、OS path separator を digest input に使わない。
  - root INDEX だけ full digests を要求し、task-scoped reader と whole-set validator の責務を分離する。

- [x] **Step 6: write 専用 restamp helper を実装する**
  - `restamp-document-set.mjs` だけが document-set file の trailer を更新できるようにする。
  - CLI は `restamp-document-set.mjs [--write] --projection-manifest <path> <document-set-root>` とし、manifest と root の両方を必須にして auto-discovery を禁止する。
  - manifest は closed root の外側の regular file とし、valid UTF-8 を確認したうえで exact bytes の SHA-256 を `projection_digest`、その short ID を `projection_id` として先に stamp する。その後に prescribed `SELF` replacement で `set_digest` と `set_id` を計算する。manifest 自体とその path は `set_digest` に含めない。
  - default は dry-run とし、`--write` 指定時だけ明示 root 内を書き換える。missing/invalid manifest、missing root、root 内 manifest は書き換え前に失敗する。
  - validator と fixture checker は常に read-only とし、validation failure を自動修復しない。
  - tests は exact manifest bytes の固定 vector、missing/invalid UTF-8 manifest、manifest/root 明示、auto-discovery rejection、root 外の同一 bytes を持つ別 manifest path、dry-run byte preservation、`--write` 後の whole-set validation と converged dry-run を検証する。

- [x] **Step 7: tests の GREEN を確認する**
  - Run: `node --test docai-messaging/tools/tests/identity.test.mjs docai-messaging/tools/tests/document-set.test.mjs`
  - Expected: 全 test PASS。

**Review gate:** fixture を編集した後に ID を手作業で合わせる運用を禁止し、write capability を restamp helper に限定する。

**Suggested commit message:** `feat(messaging): verify document-set identity and closed roots`

---

### Task 5: Compatibility Core の INDEX、Sources、Routing 検証を作る

> **Plan change / impact (user-approved):** Task 5 は、Step 1〜4 の全 test を先に RED にして Step 5 で一括実装する順序から、`root INDEX structure`、`Sources direct/sharded resolution`、`operation routing/retrieval`、`Unprojected Operations`、`rule catalog correspondence` の垂直 slice 順へ変更する。各 slice は、対象 test の RED、最小実装、対象 test と既存回帰 test の GREEN を一つの checkpoint とし、checkpoint ごとに commit 可能な状態で停止できるようにする。公開済み interface、rule の意味、Task 5 の最終 coverage、Task 6 以降の依存関係は変更しない。`tools/lib/validators/core.mjs` は slice ごとに段階的に拡張し、`validateDocumentSet()` が identity diagnostics と Core diagnostics を一つの read-only 結果へ統合する。元の Step 5 に相当する実装は各 Step 1〜4 へ移動し、Task 5 全体の integration regression は新しい Step 5 で確認する。

> **Plan change / impact (user-approved):** Checkpoint 3 の開始前に、肥大化した `tools/lib/validators/core.mjs` を Core root orchestration、Sources、operation routing の責務へ分割する。`core.mjs` は root structure と各 validator の統合だけを担当し、既存 Sources 実装を `core-sources.mjs`、Checkpoint 3 の routing model と simulated retrieval trace を `core-routing.mjs` に置く。これは内部構成だけの変更であり、`validateDocumentSet()`、既存 diagnostics、`facts.core.sources`、`facts.core.sourceResolutions` の契約を維持する。影響として内部 module 間の入力を `documentSet`、root file、root Markdown scan に固定し、Task 6 以降も対象 validator module を拡張して `core.mjs` の再肥大化を避ける。Checkpoint 3 の commit にはこの責務分割を含める。

**Checkpoint boundaries:**

1. root INDEX の固定構造、profile link、flat empty Operations/Workflows
2. Sources の direct/sharded catalog と fixed-point resolution
3. operation routing と simulated retrieval trace
4. Unprojected Operations の direct/sharded grammar
5. Task 5 integration と rule catalog/test correspondence

**Files:**

- Modify: `docai-messaging/tools/lib/validators/core.mjs`
- Create: `docai-messaging/tools/lib/validators/core-sources.mjs`
- Create: `docai-messaging/tools/lib/validators/core-routing.mjs`
- Modify: `docai-messaging/fixtures/rules.json`
- Test: `docai-messaging/tools/tests/document-set.test.mjs`

- [x] **Step 1: root INDEX state machine を RED→GREEN で実装する**
  - opening metadata、optional profile link、`# Messaging Index`、Sources、Operations/Operation Shards、Workflows、optional Unprojected Operations、identity trailer の順序を検証する。
  - empty operation set の flat `none` form を positive test にする。
  - failing tests が `DM-IDX-*` の期待した欠落・順序違反で RED になることを確認してから、root structure に必要な最小 validator を実装する。
  - 対象 test と既存の document-set regression tests が GREEN であることを確認し、最初の checkpoint とする。

- [x] **Step 2: Sources direct/sharded resolution を RED→GREEN で実装する**
  - global unique ID、ASCII order、`all` reservation、API identity/version unknown markers、Revision `none` を検証する。
  - overlapping ranges、false positive load、transitive contributor chain、contributor cycle、duplicate/missing row の fixed-point resolution を検証する。
  - 対象 test の RED を確認してから最小実装し、Sources checkpoint の GREEN を確認する。

- [x] **Step 3: operation routing と retrieval trace を RED→GREEN で実装する**
  - flat rows、hierarchical bounds、Task membership、reply prefix、context list separator/order/eligibility、routing-provenance closure を検証する。
  - exact selector、semantic fallback の load-all は fixture runner の simulated retrieval trace として検証する。
  - `facts.core.operationRetrieval` に Task、Action、Channel、Operation、Message ごとの exact trace と semantic fallback trace を保持し、fixture validator が loaded/false-positive shard、selected contract path、source resolution を検査できるようにする。operation-index shard の aggregate `source_refs` は selected-operation provenance に含めない。
  - 対象 test の RED を確認してから最小実装し、operation-routing checkpoint の GREEN を確認する。

- [x] **Step 4: Unprojected Operations を RED→GREEN で実装する**
  - length-prefixed ASCII/multibyte identity、embedded delimiter、leading zero、byte mismatch、grouping collision、one marker per completeness dimension を検証する。
  - sensitive routing value の非開示と safe identity/location 不在時の generation-failure expectation を source-aware case として記録する。
  - 対象 test の RED を確認してから最小実装し、Unprojected Operations checkpoint の GREEN を確認する。

- [x] **Step 5: Task 5 integration regression を実行する**
  - Run: `node --test docai-messaging/tools/tests/document-set.test.mjs`
  - Expected: root、Sources、operation routing、Unprojected Operations と既存 identity tests がすべて PASS。

- [x] **Step 6: rule catalog と tests の対応を確認する**
  - 各 test 名に一つ以上の `DM-SRC-*` または `DM-IDX-*` rule ID を含める。
  - Task 1 の catalog-membership enforcement を前提に、未使用 rule ID と一対一で対応しない test/catalog entry を checker で失敗させる。
  - Task 2 で cataloged になった `DM-PARSE-001`〜`DM-PARSE-004` も unused-rule と test/catalog correspondence の対象に含める。

**Review gate:** selected operation の source resolution が root/shard aggregate scope を誤って全ロードしないことを確認する。

**Suggested commit message:** `feat(messaging): validate core index and source routing`

Checkpoint 1 の suggested commit message: `feat(messaging): validate core root index structure`

Checkpoint 2 の suggested commit message: `feat(messaging): validate source catalogs and shard resolution`

Checkpoint 3 の suggested commit message: `feat(messaging): validate operation routing and retrieval traces`

Checkpoint 4 の suggested commit message: `feat(messaging): validate unprojected operation routing`

Checkpoint 5 の suggested commit message: `test(messaging): audit Task 5 rule test correspondence`

---

### Task 6: Compatibility Core の CONVENTIONS と Operation Grammar を作る

> **Plan change / impact (user-approved):** Task 6 は、CONVENTIONS tests、operation state-machine tests、Message tests、Payload tests、Reply/Failure tests をすべて先に追加して最後に一括実装する順序から、依存関係に沿った七つの垂直 slice へ変更する。common failure shape は Message/Payload と同じ文法を使うため、その共通 validator が完成した後に実装し、Data Representation の format catalog resolution も payload constraint fragment を取得できる checkpoint へ移動する。各 slice は対象 test の RED、最小実装、対象 test と既存回帰 test の GREEN を一つの checkpoint とし、checkpoint ごとに commit 可能な状態で停止する。公開済み interface、rule の意味、Task 6 の最終 coverage、Task 7 以降の依存関係は変更しない。

> **Plan change / impact (user-approved):** Task 5 で固定した root orchestration の責務を維持するため、`tools/lib/validators/core.mjs` へ Task 6 の全 grammar を追加しない。CONVENTIONS の structure/state/catalog/common-shape orchestration を `core-conventions.mjs`、operation file と section orchestration を `core-operations.mjs`、primary/reply/failure-shape が共有する Message/Payload grammar を `core-messages.mjs` に置く。`core.mjs` は各 validator を read-only に統合し、既存の `validateDocumentSet()` diagnostics と `facts.core` の field を維持したまま Task 6 facts を追加する。影響として内部 module 間の入力を `documentSet` と Task 5 の routing/source facts に固定し、Message/Payload の方向規則を一か所で検証する。

**Checkpoint boundaries:**

1. CONVENTIONS の固定 structure と基本 section state（`DM-CONV-001`〜`DM-CONV-002`）
2. operation file、heading/purpose、Behavior、Operation Bindings、Channel（`DM-OP-001`〜`DM-OP-004`）
3. Message identity/selection、direction-correct tables、leading collapse（`DM-MSG-001`〜`DM-MSG-003`）
4. Payload state、representation、field/variant/example と format catalog resolution（`DM-MSG-004`〜`DM-MSG-006`、`DM-CONV-003`）
5. Reply state、keys/channel、message selection と INDEX routing（`DM-REPLY-001`〜`DM-REPLY-003`）
6. Failure Handling state/table/reference と common/inline shape（`DM-FAIL-001`〜`DM-FAIL-003`、`DM-CONV-004`）
7. Task 6 integration、rule catalog/test correspondence、review gate

**Files:**

- Modify: `docai-messaging/tools/lib/validators/core.mjs`
- Create: `docai-messaging/tools/lib/validators/core-conventions.mjs`
- Create: `docai-messaging/tools/lib/validators/core-operations.mjs`
- Create: `docai-messaging/tools/lib/validators/core-messages.mjs`
- Modify: `docai-messaging/fixtures/rules.json`
- Test: `docai-messaging/tools/tests/document-set.test.mjs`

- [x] **Step 1: CONVENTIONS structure/state を RED→GREEN で実装する**
  - `CONVENTIONS.md` の `# Messaging Conventions` と十五個の固定 `##` heading の全件・順序・重複・余分な heading を検証する。
  - 各 section が exactly one core state を持つことを検証する。authoritatively non-applicable な `none`、whole-section `unknown` と直後の `**unknown**:`、`**unsupported**: replaces CONVENTIONS <heading>:`、non-empty expanded content を positive/negative pair にする。
  - `DM-CONV-001` を file/title/heading structure、`DM-CONV-002` を section state と marker adjacency に割り当て、catalog と test 名を同じ checkpoint で対応させる。
  - 対象 test の RED を確認してから `core-conventions.mjs` の最小実装と `core.mjs` への read-only integration を行い、既存回帰 test も GREEN にする。

- [x] **Step 2: operation envelope/Behavior/Channel を RED→GREEN で実装する**
  - channel file に file-level title/prose wrapper がなく、一つ以上の operation が routing row と一致して exactly one file に現れることを検証する。
  - operation heading/purpose、optional deprecation marker、Behavior six keys、Operation Bindings、Channel Parameters/Bindings と固定 section 順を検証する。
  - `DM-OP-001`〜`DM-OP-004` を structure、heading/placement、Behavior、bindings/Channel に割り当てる。

- [x] **Step 3: direction-correct Message grammar を RED→GREEN で実装する**
  - Message identity/order/selection/replacement、SEND の Required、RECEIVE の Presence、reply の逆方向、nullable、nested ancestor applicability、`$` row invariants を検証する。
  - Headers/Bindings の leading collapse と、first expanded subsection 後の `none` heading retention を検証する。
  - `DM-MSG-001`〜`DM-MSG-003` を direction/table、collapse、identity/selection/replacement に割り当て、primary/reply Message が共有する parser を `core-messages.mjs` に実装する。

- [x] **Step 4: Payload representation と format catalog を RED→GREEN で実装する**
  - whole payload marker、media type、nullability、example、field table、raw binary、multiple media selection、tagged/untagged variant boundaryを検証する。
  - example field coverage、object openness、constraints order、format/format_annotation fragment の exact `Format | Role | Meaning` resolution と convention dependency closure を検証する。
  - `DM-MSG-004`〜`DM-MSG-006` を payload state、representation、field/variant/example、`DM-CONV-003` を format catalog に割り当てる。

- [x] **Step 5: Reply grammar を RED→GREEN で実装する**
  - Reply の `none` / whole-section `unknown` / replacement `unsupported` / expanded state、channel/correlation/timeout keys、static/dynamic channel を検証する。
  - reply message set/address/selection fallback、direction reversal、reply INDEX entries の一致を検証する。
  - `DM-REPLY-001`〜`DM-REPLY-003` を state、keys/channel、selection/routing に割り当てる。

- [x] **Step 6: Failure Handling と common/inline shape を RED→GREEN で実装する**
  - Failure Handling の core states、canonical leading deviation、`Failure | Signal | Condition | Action` table、Action recovery state を検証する。
  - `common:<label>` / `inline:<label>` の exact whole-cell reference と unique resolution、expanded/replacement shape、Message subsection collapse を共有 grammar で検証する。
  - `DM-FAIL-001`〜`DM-FAIL-003` を state/deviation、table/reference、inline shape、`DM-CONV-004` を common shape に割り当てる。

- [x] **Step 7: Task 6 integration と rule correspondence を確認する**
  - Run: `node --test docai-messaging/tools/tests/document-set.test.mjs`
  - Expected: CONVENTIONS、operation、Message、Payload、Reply、Failure Handling と既存 tests がすべて PASS。
  - Task 6 test 名に一つ以上の `DM-CONV-*`、`DM-OP-*`、`DM-MSG-*`、`DM-REPLY-*`、`DM-FAIL-*` rule ID を含め、未使用・未知・重複 catalog entry を checker で失敗させる。

**Review gate:** operation-level `none` が CONVENTIONS を抑止せず、抑止には `**deviation**:` が必要であることを positive/negative pair で確認する。

**Suggested commit message:** `feat(messaging): validate core conventions and operations`

Checkpoint 1 の suggested commit message: `feat(messaging): validate conventions structure and states`

Checkpoint 2 の suggested commit message: `feat(messaging): validate operation behavior and channel grammar`

Checkpoint 3 の suggested commit message: `feat(messaging): validate message direction and structure`

Checkpoint 4 の suggested commit message: `feat(messaging): validate payload representations and formats`

Checkpoint 5 の suggested commit message: `feat(messaging): validate reply grammar and routing`

Checkpoint 6 の suggested commit message: `feat(messaging): validate failure handling and shapes`

Checkpoint 7 の suggested commit message: `test(messaging): audit Task 6 rule correspondence`

---

### Task 7: Incomplete Information、Adapter Boundary、Trust Boundary を作る

> **Plan clarification / impact (user-approved):** Step 5 で同一の `related-navigation` URL input に異なる outcome 名を割り当てていたため、Step 6 開始時に `preserve-navigation-data` へ統一する。URL は source bytes のまま割当済み navigation data として保持し、instruction authority を持たず、取得を許可しない。変更対象は Step 5 test の期待値1件と Step 6 の pure expectation implementation だけであり、trust boundary の意味、test coverage、Task 7 以降の順序や依存関係は変更しない。

> **Plan clarification / impact (user-approved):** Step 6 の exact completeness propagation は、Task 4 の identity fixture が許可していた marker と無関係な `coverage` / `knowledge` のファイル単位差異より優先する。既存の valid CONVENTIONS fixture は child の incomplete marker を root metadata に集約し、mixed-set identity fixture は `source_refs` だけがファイルごとに異なり得ることを検証する形へ更新する。opening-metadata の identity rules、`source_refs` semantics、Task 7 の scope と後続順序は変更しない。

**Files:**

- Modify: `docai-messaging/tools/lib/validators/core.mjs`
- Modify: `docai-messaging/fixtures/rules.json`
- Test: `docai-messaging/tools/tests/document-set.test.mjs`

- [x] **Step 1: `none` / `unknown` / `unsupported` / conflict matrix を test 化する**
  - missing knowledge、known unrepresentable、known absence、equally authoritative conflict を別結果にする。
  - file/root coverage と knowledge propagation、unrelated marker の selected-operation non-blocking behavior を検証する。

- [x] **Step 2: partial unnamed collection cases を test 化する**
  - named siblings retained、collection-level marker、no synthetic row、canonical example omissionを検証する。
  - no-sibling Headers/Parameters と representation-local payload form を区別する。

- [x] **Step 3: perspective/counterpart cases を test 化する**
  - same-application carry-through、complete counterpart mapping、missing mapping、conflicting mapping、action-only inversion rejection を検証する。

- [x] **Step 4: direct adapter boundary cases を test 化する**
  - AsyncAPI 3.0.0 / 3.1.0 schemaFormat default、registered aliases、JSON Schema Draft 07、parameterless JSON/+json wire、parameterized/unregistered wire unsupported を検証する。
  - header encoding/exposure と protocol binding mapping の有無を source-aware expectation として記録する。

- [x] **Step 5: trust/publication-safety cases を test 化する**
  - prose、example、URL、schema string、metadata-like line、identity-like line、profile link、key list、fixed value、`x-` structure の escape attempt を含める。
  - known sensitive fact は non-disclosing `unsupported`、real credential/PII fixture は corpus 自体へ保存せず synthetic sentinel で拒否条件を表す。

- [x] **Step 6: test を RED→GREEN で実装する**
  - Run: `node --test docai-messaging/tools/tests/document-set.test.mjs`
  - Expected: 全 test PASS。

**Review gate:** checker が source 内容を instruction として実行・fetch せず、純粋な bytes/data として扱うことを確認する。

**Suggested commit message:** `feat(messaging): enforce incomplete-state and trust boundaries`

---

### Task 8: Core の Authoritative Source と Valid Full Set を作る

**Files:**

- Create: files under `docai-messaging/fixtures/core/v0.17.1/source/`
- Create: `docai-messaging/fixtures/core/v0.17.1/valid/full/INDEX.md`
- Create: `docai-messaging/fixtures/core/v0.17.1/valid/full/CONVENTIONS.md`
- Create: channel files under `valid/full/channels/`
- Create: `README.md` and `SOURCE-TRACEABILITY.md`

- [x] **Step 1: contract-complete source scenario を固定する**
  - storefront service perspective で SEND command、RECEIVE event、explicit reply を含む。
  - at-least-once、deduplication、ordering、ack/nack、failure recovery、authorization を behavior input に明記する。
  - main source は representable JSON payload/header schema と必要な behavior facts をすべて持ち、root `coverage: complete` / `knowledge: complete` を成立させる。
  - recursion、missing knowledge、zero-message selection は `source/focused/` の別 input に置き、contract-complete main set の projection manifest には含めない。

- [x] **Step 2: AsyncAPI 3.0.0 と 3.1.0 selection source を main source から分離する**
  - operation `messages` explicit/omitted/empty と reply `messages` explicit/omitted/empty を source-level fixture に含める。
  - 同じ論理 API を表す場合も source ID、specification version、revision を別々に記録する。

- [x] **Step 3: deterministic projection-input manifest を作る**
  - source exact SHA-256、perspective、precedence、counterpart mapping、adapter versions、stable-name overrides、publication policy identity を sorted-key JSON と LF で記録する。
  - manifest 自体の canonical serialization rule を fixture README に記載する。

- [x] **Step 4: minimal-but-representative contract-complete full set を手作業で作る**
  - `INDEX.md`、全 convention headings、SEND/RECEIVE/reply/failure operation を作る。
  - source facts を projection し、推測で completeness を上げない。
  - main full set には `unknown` / `unsupported` を含めない。これらは別の focused document-set case に置き、root completeness の positive/negative 判定を独立させる。

- [x] **Step 5: identity を helper で計算して固定する**
  - Run: `node docai-messaging/tools/restamp-document-set.mjs --write --projection-manifest docai-messaging/fixtures/core/v0.17.1/source/projection-input-manifest.json docai-messaging/fixtures/core/v0.17.1/valid/full`
  - Expected: projection digest、set digest、short IDs を更新する。
  - Run: `node docai-messaging/tools/restamp-document-set.mjs --projection-manifest docai-messaging/fixtures/core/v0.17.1/source/projection-input-manifest.json docai-messaging/fixtures/core/v0.17.1/valid/full`
  - Expected: `restamp required: no`、exit code 0。

- [x] **Step 6: source traceability を全 fact domain で記録する**
  - INDEX row、CONVENTIONS section、operation section、payload representation、marker ごとに source ID/location を対応付ける。
  - checker で自動確認できない semantic mapping を明示する。

**Review gate:** valid set の各 client-visible fact が source または明示的 projection configuration に辿れ、README だけから新しい contract fact を発明していないことを確認する。

**Suggested commit message:** `test(messaging): add core authoritative sources and full set`

---

### Task 9: Core Focused Valid/Invalid Corpus を完成させる

**Files:**

- Create: files and mini document-set directories under `docai-messaging/fixtures/core/v0.17.1/focused/valid/`
- Create: files and mini document-set directories under `docai-messaging/fixtures/core/v0.17.1/focused/invalid/`
- Modify: `cases.json`
- Modify: `COVERAGE.md`

各 checkbox は、最低一つの valid case と一つの invalid case、対応する rule ID、checker assertion を含む。

> **Plan change / impact (user-approved):** 先頭の Metadata focused group では `source_refs` の値 grammar を raw metadata parser の `DM-META-001` case として重複検証せず、後続の「Direct/sharded Sources」group で document-set 文脈の `DM-SRC-005` case として扱う。`parseOpeningMetadata()` は format version、profile、perspective、coverage、knowledge の opening-stamp 固有値と key/order/escape を検証し、`source_refs` の catalog resolution、canonical list、重複、ASCII ordering は Sources validator の既存責務に維持する。影響として、今回の Metadata checkpoint は valid な `source_refs: all` を含むが、その invalid fixture と checker assertion は Sources checkpoint まで保留する。

> **Plan change / impact (user-approved):** Identity focused group では、`cases.json` に `task-scoped-document-set` kind を追加し、同じ stale-digest mini set を task-scoped では valid、whole-set では `DM-ID-003` invalid として二つの case から検証する。これにより validator の `wholeSet: false` / `true` 境界を fixture corpus 自体で固定し、mixed-set と short-ID の case は digest 再計算による別 primary error を混在させず `DM-ID-002`、`DM-ID-005`〜`DM-ID-009` を一件ずつ検証できる。影響として、`focused/valid/identity-task-scoped-stale-digest/` は task-scoped validation に対する valid fixture であり、whole-set publication 用の valid set ではないことを case kind と対になる whole-set invalid case で明示する。

> **Implementation note (Sources checkpoint):** `DM-SRC-003` は direct/sharded Sources 直後の source-qualified unknown marker と `knowledge: requires-input` に加え、同じ marker が `CONVENTIONS.md` の `Schema Evolution` に一度ずつ verbatim で再掲されることも検証する。focused corpus は再掲済みの valid case と再掲欠落の invalid case を分離し、既存の direct/sharded positive checker cases もこの cross-file contract を満たす形へ更新する。

> **Implementation note (Operations checkpoint):** full/compact の operation routing parity を focused corpus で直接検証するため、`cases.json` に `operation-profile-pair` kind を追加し、二つの task-scoped document set を同時に検証する。ペア検証は各 profile の既存 Core validation を先に適用し、両方から Operations fact を取得できる場合に routing form と operation shard path の完全一致を `DM-IDX-006` として検証する。影響として、単独 document-set validation の interface と意味は変更せず、profile 間でのみ成立する制約を fixture runner の明示的な case kind に隔離する。

> **Implementation note (Context checkpoint):** context focused corpus は、required workflow、supplemental workflow / Reference Material、exact `, ` separator、ASCII ordering、重複、列間 overlap、forbidden target、および空リスト sentinel `none` と有効な `workflows/none.md` の区別を `DM-IDX-005` で検証する。valid mini set 内の workflow と Reference Material は標準形で収録するが、Core checker assertion は operation retrieval fact の required / supplemental paths に限定する。影響として、workflow / Reference Material の complete-surface 対応を Core に昇格させず、既存 production validator を変更せずに Core の context routing contract を固定する。

> **Implementation note (Unprojected Operations checkpoint):** direct / sharded document-set fixtures に加え、投影前の grouping-key collision と sensitive withholding を checker で実行するため、`cases.json` に `unprojected-source-scenario` kind を追加する。既存 `evaluateUnprojectedSourceExpectations()` の結果を `validateUnprojectedSourceExpectations()` が read-only facts と集約 `DM-IDX-008` diagnostic に変換し、generation-failure diagnostic は source operation identity や sensitive value を表示しない。影響として、公開 document grammar と既存 evaluator の結果は変更せず、source-aware generation boundary を focused corpus runner から再利用可能にする。

> **Implementation note (Perspective / counterpart checkpoint):** same-application の SEND / RECEIVE carry-through、complete counterpart、counterpart 不在、action-only の不完全 counterpart、同優先度 authoritative conflict を `perspective-source-scenario` kind で検証する。既存 `evaluatePerspectiveSourceExpectations()` の結果を `validatePerspectiveSourceExpectations()` が read-only facts と集約 `DM-INC-001` diagnostic に変換し、conflict diagnostic には source mapping ID や競合 channel を含めない。影響として、counterpart 不在と action-only は仕様どおり Unprojected unknown へ退避できる valid fixture とし、生成停止となる authoritative conflict だけを invalid fixture にする。公開 document grammar と evaluator の resolution semantics は変更しない。

> **Implementation note (Operation message-selection checkpoint):** AsyncAPI 3.0.0 / 3.1.0 の実際の local channel / message `$ref` を持つ focused source を `asyncapi-operation-message-selection` kind で検証する。`evaluateAsyncApiOperationMessageSelection()` は explicit non-empty subset と omission 時の全 channel message を read-only facts に解決し、explicit empty と空 channel に対する omission は通常 operation を発明せず localized unsupported Unprojected outcome にする。`validateAsyncApiOperationMessageSelection()` は既知の zero-message operation を一つの `DM-IDX-008` diagnostic に集約する。影響として、両 exact version の互換的な selection semantics と zero-message fallback を source 構造から固定し、公開 document grammar は変更しない。

> **Implementation note (Reply message-selection checkpoint):** AsyncAPI 3.0.0 / 3.1.0 の Reply Object と投影済み INDEX reply entry を組にした `asyncapi-reply-message-selection` scenario を検証する。`evaluateAsyncApiReplyMessageSelection()` は explicit non-empty を expanded Reply、explicit empty を primary operation を保持する whole-Reply unsupported、別の authoritative selection がない omission を channel 候補数 0 / 1 / 複数および channel 不在のすべてで whole-Reply unknown に解決し、expanded Reply だけに `reply:` entry を要求する。`validateAsyncApiReplyMessageSelection()` は欠落・余分・発明された reply routing を集約 `DM-REPLY-003` diagnostic にする。影響として、Reply fallback が primary operation を削除せず、unknown / unsupported Reply の identity を INDEX に漏らさない境界を source facts から固定し、公開 document grammar は変更しない。

> **Implementation note (CONVENTIONS / format / failure-shape checkpoint):** task-scoped document set の valid case 一件で CONVENTIONS の `none` / `unknown` / replacement / expanded の四状態、UUID constraint format catalog、expanded / replacement common failure shape、common reference、および inline replacement failure shape を統合検証する。invalid case は whole-section state の混在、正規化すると二件目になる format catalog、common replacement の label / replacement-name 不一致、inline replacement の label / replacement-name 不一致を一件ずつ分離し、`DM-CONV-002` / `DM-CONV-003` / `DM-CONV-004` / `DM-FAIL-003` の単一 primary diagnostic を固定する。影響として、Task 6 で実装済みの CONVENTIONS / failure-shape validator と read-only facts を document-set 境界で実行可能にし、公開 document grammar と production validation semantics は変更しない。

> **Implementation note (Behavior checkpoint):** task-scoped document set の valid case 一件に四つの operation を lexical order で収録し、六つの canonical Behavior key、`at-most-once` / `at-least-once` / `exactly-once` の三 delivery token、scope と条件を伴う qualified exactly-once、複数の `unknown` fact と六キー後の post-key marker、および `knowledge: requires-input` 集約を統合検証する。invalid case は key order、非canonical delivery token、unqualified exactly-once、unknown marker 欠落を一件ずつ分離し、各 case の単一 primary diagnostic を `DM-OP-003` に固定する。影響として、Task 6 で実装済みの Behavior validator を document-set 境界で実行可能にし、公開 document grammar、production validation semantics、および read-only fact interface は変更しない。

> **Implementation note (Binding-scope checkpoint):** task-scoped document set の valid case 一件で Operation Bindings、primary Channel Bindings、primary Message Bindings、Reply Channel Bindings、reply Message Bindings、および inline failure-shape Bindings の六 scope にそれぞれ独立した `Protocol | Property | Value / Rule` table を置き、expanded Reply の INDEX routing、primary / reply message facts、inline failure-shape fact と併せて統合検証する。invalid case は六 scope の各 table について `Property` を誤った `Name` column に置換した一件だけを持ち、Operation / Channel を `DM-OP-004`、primary / reply Message を `DM-MSG-002`、Reply Channel を `DM-REPLY-002`、failure shape を `DM-FAIL-003` の単一 primary diagnostic に固定する。影響として、Task 6 で実装済みの binding validators を document-set 境界で実行可能にし、公開 document grammar、production validation semantics、および read-only fact interface は変更しない。

> **Implementation note (Message direction / nested-ancestor checkpoint):** task-scoped document set の valid case 一件で、SEND の `Required=yes|no|conditional|unknown`、RECEIVE の `Presence=always|optional|<exact condition>|unknown`、両方向の `Nullable=yes|no|unknown`、および optional / nullable / absent / array-element ancestor 配下でも適用時の子を SEND=`yes` / RECEIVE=`always` のまま表す nested-field semantics を header table と JSON payload field table で統合検証する。invalid case は非canonical Nullable、RECEIVE の bare `conditional`、両方向の column 取り違え、SEND conditional の条件欠落、unknown cell の post-table marker 欠落を一件ずつ分離し、すべて単一 primary `DM-MSG-001` diagnostic に固定する。unknown marker 欠落 case は、Headers subsection state や set-level knowledge まで同時に壊さないよう payload field table に局所化し、別の正規な Behavior unknown marker で `knowledge: requires-input` の全体整合を維持する。影響として、Task 6 で実装済みの direction / nullability / ancestor validators を document-set 境界で実行可能にし、公開 document grammar、production validation semantics、および read-only fact interface は変更しない。

> **Implementation note (Payload unknown / partial-collection checkpoint):** task-scoped document set の valid case 一件に四つの operation を収録し、whole-payload representation-set unknown、concrete media type を保持する representation-local field-collection unknown、Headers の no-sibling whole-subsection unknown、Headers / Parameters / non-polymorphic payload の named-sibling partial table、synthetic row を作らない additional-unnamed marker、および payload partial table の canonical example omission を統合検証する。invalid case は generic whole-section unknown を non-empty Payload に使う形、whole-payload unknown と concrete representation の共存、representation-local unknown と field table の共存、partial field table の marker 欠落、partial marker と通常 example の共存を一件ずつ分離し、すべて単一 primary `DM-MSG-004` diagnostic に固定する。focused RED で見つかった境界欠落に対応し、Message Headers subsection-state validator は unknown cell を持たない `additional unnamed header` marker を正規な partial table として受理し、complete structured representation validator は同 marker と example の共存を拒否する。影響として、公開 document grammar と read-only fact interface は変更せず、production validation semantics を README §3.4 の既存規定に一致させる。

> **Implementation note (Root payload shape / recursion checkpoint):** task-scoped document set の valid case 一件に root scalar、root array と `$[]` item container、dynamic-key root map と `$.{key}` value path、local allowed-with-type / forbidden object openness、および recursive schema の representation-local replacement を統合検証する。invalid case は SEND root の `Required=yes`、RECEIVE root の `Presence=always`、`payload_nullable` と root `Nullable` の一致、scalar root `$` row の必須性、object openness、および recursive replacement の排他性を一件ずつ分離し、単一 primary `DM-MSG-001` / `DM-MSG-004` / `DM-MSG-005` diagnostic に固定する。focused RED で見つかった root-map example coverage の境界欠落に対応し、field coverage は `map<string, T>` の実キーを `{key}` path に対応付け、named property と `{key}` が共存する object では明示 row を優先する。影響として、公開 document grammar と read-only fact interface は変更せず、README §4.1 の root map path semantics を production validator で受理・検証できるようにする。

> **Implementation note (Exact constraint / default / format checkpoint):** task-scoped document set の valid case 一件で、arbitrary-precision number の数学的 equality、`uniqueItems`、canonical constraint order、SEND / RECEIVE の AsyncAPI effective `default` prose、JSON Schema Draft 07 の非behavioral `default_annotation`（JSON `null` を含む）、constraint / annotation format catalog、および open custom format の fragment omission と table 直後の localized `unsupported` を統合検証する。invalid case は exact-equal duplicate item、SEND default behavior 欠落、annotation default への construction behavior 付与、format role 不一致を一件ずつ分離し、単一 primary `DM-MSG-005` / `DM-CONV-003` diagnostic に固定する。source-aware `schema-field-source-scenario` は exact-version vocabulary から expected fragment / behavior / coverage を導出し、custom format の silent projection を拒否する。影響として、Message field validator は default fragment と direction-specific omission semantics の prose consistency も検証し、source evaluator は exact JSON source spellingを保持したまま recognized / custom format 境界を fixture runner から検証可能にする。公開 document grammar は変更しない。

> **Implementation note (Wire / raw binary / header-encoding checkpoint):** task-scoped document set の valid case 一件で、parameterless `application/json`、RFC 9110 token を含む parameterless `+json`、known parameterized JSON / unregistered XML の representation replacement、logical Headers table、および content / size / integrity rule を持つ authoritatively opaque raw binary を統合検証する。invalid document case は parameterized JSON と structured XML を raw-binary prose に偽装する形を分離し、各 case の単一 primary diagnostic を `DM-MSG-004` に固定する。source-aware `adapter-source-scenario` は direct JSON wire、unmapped wire replacement、exact publication mapping による parameter preservation、`projection_digest` に含まれる証明済み emitted-media-type normalization、header encoding / exposure と schema target の互換性を比較し、projection mismatch を単一 `DM-ADAPTER-002` / `DM-ADAPTER-003` diagnostic に集約する。影響として、payload-wire evaluator は canonical media-type parser に基づいて任意 top-level type の parameterless `+json` を直接登録し、non-direct target は complete wire semantics を持つ exact mapping のみ受理する。header evaluator は schema target が与えられた場合に mapping の明示的 compatibility も要求する。公開 document grammar と ordinary-reader requirement は変更しない。

> **Implementation note (Reply channel / fallback / operation-identity checkpoint):** task-scoped document set の valid case 一件に、address parameter を厳密に列挙する static Reply channel、request から導出する dynamic Reply channel、SEND の deadline / expiry action、RECEIVE で conventions に従う `timeout: none`、Reply `none`、whole-section `unknown`、whole-section replacement `unsupported`、および embedded Reply と同じ static channel / message を選ぶ独立 operation を統合する。read-only facts は expanded Reply だけを reply message として保持し、unknown / unsupported fallback から reply identity を作らず、embedded Reply から operation を合成せず、独立宣言された operation だけを通常 operation として保持する。invalid case は whole-Reply unknown と expanded key の混在、`correlation: none`、dynamic channel の Parameters、static channel parameter の欠落、SEND の `timeout: none`、whole-Reply unknown から発明した INDEX `reply:` entry を一件ずつ分離し、単一 primary `DM-REPLY-001` / `DM-REPLY-002` / `DM-REPLY-003` diagnostic に固定する。影響として、Task 6 の既存 Reply validator と fact interface を focused document-set 境界で固定し、production validation semantics と公開 document grammar は変更しない。

> **Implementation note (Failure states / actions / shapes checkpoint):** task-scoped document set の valid case 一件に、deviation なしの `none` / whole-section `unknown` / whole-section replacement / expanded table、各 incomplete state に先行する deviation、sorted multiple deviations を伴う expanded table、および suppression-only deviation-plus-`none` を統合する。expanded RECEIVE operation は malformed payload、unknown variant、handler error を exact `inline:<label>` / `common:<label>` Signal で表し、expanded / replacement の common shape と expanded / replacement の inline shape を一度ずつ解決する。invalid case は core state の混在、deviation order、recovery state を欠く Action、Signal prose に埋め込んだ shape reference、inline shape の first-use order、replacement shape 後の normal subsection を一件ずつ分離し、既存の label mismatch cases と合わせて単一 primary `DM-FAIL-001` / `DM-FAIL-002` / `DM-FAIL-003` / `DM-CONV-004` diagnostic に固定する。影響として、Task 6 の既存 Failure validator と read-only failure-shape facts を focused document-set 境界で固定し、production validation semantics、fact interface、および公開 document grammar は変更しない。

> **Implementation note (Publication safety / instruction escape checkpoint):** `trust-boundary-source-scenario` と `publication-safety-source-scenario` を focused corpus runner に追加し、source-derived prose、example、navigation URL、schema string、opening metadata、identity trailer、profile link、Behavior / Reply key、standard / `x-` marker、standalone / collapsed fixed value、headingを read-only expectations として検証する。trust invalid cases は navigation が retrieval authority を持つ形、明示的 denial を欠く形、standard marker が prose location から構造化する形を分離し、単一 primary `DM-TRUST-001` / `DM-TRUST-002` diagnostic に固定する。publication valid case は authorized non-secret value の exact emission、sensitive contract fact の non-disclosing `unsupported`、sensitive example の synthetic replacement、mandatory structural / catalog value に限った source-authorized contract-equivalent safe override を統合し、synthetic sentinel を出力しない。通常の client-relevant sensitive fact に override input があっても別 contract へ sanitize せず `unsupported` にする。publication invalid cases は safe override のない mandatory structural value と catalog cell、canonical incomplete-information placement を作れない mandatory cell に source location だけを与えた形、unsafe source value と同一またはそれを内包する override、および source value を埋め込んだ feature class / publication-safe location を一件ずつ分離し、それぞれ単一 primary `DM-TRUST-003` generation-failure concern に固定する。影響として、Task 7 の pure evaluator に standard marker / standalone fixed-value detection、explicit navigation-denial comparison、authorized exact / mandatory-only safe-override outcomes、non-disclosing output-field guard と二つの scenario validator facts を追加する。公開 document grammar は変更せず、source projection semantics を README §3.6 / §3.7 の既存規定に一致させる。

> **Implementation note (Canonical structure / language checkpoint):** deprecated operation、Behavior / Operation Bindings / primary Channel Parameters・Bindings / primary Message Headers・Bindings・Payload / Reply / reply Channel Parameters・Bindings / reply Message Headers・Bindings・Payload / Failure Handling の全許可位置に canonical leading deviation を持つ task-scoped valid set を追加する。invalid document cases はこの valid set に対する exact one-replacement mutation として保存し、置換元が一度だけ存在することを runner で検証したうえで、Behavior post-key marker group の連続性と order、leading deviation order、Related・Message heading・failure shape の禁止位置、payload marker の immediate sequence 分断、および deprecation marker と INDEX summary prefix の不一致をそれぞれ単一 primary diagnostic に固定する。`language-structure-source-scenario` と `DM-LANG-001` は projection configuration が宣言する一つの prose language、重複翻訳なし、および validator-owned structural kind mapping から導出した canonical English token の exact emission を source-aware facts として検証し、自然言語の文字種推測や fixture-supplied canonical token への信頼は行わない。focused RED で既存 Behavior valid fixture の post-key marker が Unicode scalar-value 順でなかったことを検出したため canonical order に修正する。影響として、Operation validator は Behavior marker と各 operation-level leading deviation の厳密昇順、Behavior marker group の source-line adjacency、および Related の deviation 禁止を検証する。公開 document grammar は変更せず、production validation semantics と source projection expectations を README §3.4 / §4.1 / §6 の既存規定に一致させる。

> **Implementation note (Implementation readiness capability checkpoint):** 既存の contract-complete `valid/full` set、`sendCreateOrder` operation、trusted task `submit an order` を共有する `implementation-readiness-source-scenario` を追加する。同一契約に対し、ordinary reader の DocAI Messaging version / profile / publication scope / required structure、target runtime capability、source-aware reader の exact source-adapter support を個別に変え、期待する readiness と blocker を `DM-INC-003` で検証する。task-scoped requirement のみを評価するため、未選択の Avro representation / codec は JSON task を阻害せず、ordinary reader は source adapter を持たなくても ready になり、source-aware validation だけが applicable exact adapter set を要求する。invalid case は必須 runtime capability 欠落を ready とした projection mismatch 一件に限定する。影響として、既存 marker-based selected retrieval scope evaluator を保持したまま、その結果と reader / task / runtime / adapter capability を合成する read-only evaluator と focused corpus facts を追加し、公開 document grammar と document-set compliance semantics は変更しない。作業順序の変更はない。

> **Implementation note (One-invalidity audit checkpoint):** Core manifest 176 cases のうち invalid 132 cases を全件監査し、各 `expected_rule_ids` がちょうど一つの primary concern を宣言し、validator の実 primary diagnostics も cascade を除いて同じ一つの rule concern に収束することを確認する。manifest cases と corpus results を入力とする read-only `auditFixtureOneInvalidity` helper を fixture runner に追加し、expected concern が zero / multiple、actual concern が zero / multiple、expected / actual mismatch を個別に報告する unit tests と、全 Core invalid fixture を監査する integration test を追加する。監査結果は 132 / 132 cases が適合し、fixture の分割や規則変更は不要だった。影響として、通常の corpus pass/fail semantics は変更せず、Task 9 の one-invalidity property を継続的に検証する regression gate のみを追加する。作業順序の変更はない。

> **Implementation note (Core coverage matrix foundation checkpoint):** `fixtures/core/v0.17.1/COVERAGE.md` を作成し、README §8 の Core corpus clause を stable `R8-CORE-*` ID、authoritative source または normative derivation、`cases.json` case ID、primary rule ID、checker test、coverage status に一対一対応させる matrix contract を固定する。最初の `R8-CORE-001`–`R8-CORE-004` は Core publication prerequisite、opening metadata / identity trailer、metadata extension / escape / unknown key、set digest / closed root / path-content binding / short ID / mixed set / task-scoped identity を扱う。29 case IDs、11 rule IDs、4 source/evidence paths と checker test names の存在を read-only audit で確認した。全 Core clause の対応が終わるまで overarching `R8-CORE-001` は `partial` のままとし、Task 9 の coverage-matrix Step も未完了として保持する。影響として、人手 release review 用の traceability artifact を追加するだけで、fixture、rule、checker semantics は変更しない。作業順序の変更はない。

> **Implementation note (Core coverage matrix Sources / routing checkpoint):** `R8-CORE-005`–`R8-CORE-010` として direct / sharded Sources、reader/runtime/adapter-relative implementation readiness、flat Operations、required / supplemental context、hierarchical Operation Shards、exact `none` sentinel と `workflows/none.md` の区別を matrix に追加する。既存の focused cases、rules、source evidence、retrieval-fact tests によって Sources、flat / hierarchical routing、context grammar、sentinel distinction は `covered` と確認した。一方、README §8 が要求する required workflow を必要とする contract-complete set の Core-reader not-ready 判定は、既存 `contexts-required-supplemental-valid` が retrieval facts だけを検証しており capability readiness へ接続されていないため、`R8-CORE-006` と `R8-CORE-008` を `partial` とする。影響として、coverage artifact が既存 gap を release-ready と誤表示せず可視化する。fixture、rule、checker semantics と作業順序はこの checkpoint では変更しない。

> **Approved design (required-workflow Core-reader readiness checkpoint):** coverage matrix の残行を展開する前に、`R8-CORE-006` / `R8-CORE-008` の既知 gap を解消する順序変更を行う。readiness evaluator は scenario に手入力された `requiredStructures` だけでなく、選択 operation の実際の `requiredContexts` からこの version で required context に許可された workflow capability を導出し、reader が workflow structure を持たなければ各 required path を識別する `structure:workflow:<path>` blocker を返す。同じ `contexts-required-supplemental-valid` document set を source scenario から再利用し、required workflow paths は Core reader を not-ready にする一方、supplemental workflow path は blocker に現れず readiness 判定へ影響しないことを検証する。正しい not-ready projection の valid scenario と、誤って ready と宣言する単一 `DM-INC-003` invalid scenario を追加する。既存の marker、runtime、adapter readiness semantics と公開 document grammar は変更しない。実装完了後に両 matrix row を `covered` にする。

> **Implementation note (required-workflow Core-reader readiness checkpoint):** 承認設計どおり、選択 operation row の `requiredContexts` を readiness evaluator に接続し、reader が `workflow` structure を持たない場合は各 required path に `structure:workflow:<path>` blocker を生成する。既存 `contexts-required-supplemental-valid` を再利用する valid source scenario は `workflows/a-required.md` と `workflows/none.md` だけを blockers とし、supplemental `workflows/z-supplemental.md` を除外する一方、workflow-capable reader は同じ contract で ready になる。対応する invalid scenario は required workflow を誤って ready とする projection mismatch を単一 `DM-INC-003` concern として固定する。影響として、contract-complete root と reader capability を分離する README §3 / §6.1 / §8 の既存 semantics を checker で実行可能にし、公開 document grammar、marker/runtime/adapter readiness、および ordinary-reader の source-adapter requirement は変更しない。`R8-CORE-006` / `R8-CORE-008` は `covered` になり、coverage matrix の残行展開へ戻れる。

> **Implementation note (Core coverage matrix sentinel / Unprojected checkpoint):** `R8-CORE-011` / `R8-CORE-012` として sentinel-like source literal の structural containment / ambiguity fallback / mandatory-cell generation failure、および direct / sharded Unprojected Operations の aggregate state、opaque identity、non-disclosing sensitive withholding、generation failure、selected-readiness isolation を matrix に追加する。sentinel clause は既存 trust / publication-safety source scenarios により `covered` と確認した。Unprojected clause は direct / sharded grammar、UTF-8 length-prefix、grouping、retrieval、sensitive withholding が covered だが、safe identity または safe location 不在を manifest 登録した focused invalid cases がなく、direct Unprojected marker を持つ root `INDEX.md` を selected-operation readiness が常に blocking とするため `partial` とする。影響として、二つの既存 release gap を明示し、未検証挙動を release-ready と誤表示しない。fixture、rule、checker semantics と作業順序はこの checkpoint では変更しない。

> **Approved design (Unprojected selected-readiness isolation checkpoint):** coverage matrix の残行を展開する前に `R8-CORE-012` の二つの gap を解消する。selected-operation readiness は、検証済み `coreFacts.unprojectedOperations.groups[].markers` の `indexPath` / `line` から exclusion set を作り、projected operation を評価するときだけ、その marker 行を同じ file の incomplete-marker scan から除外する。他の root-level marker は引き続き blocking とし、Unprojected facts が得られない場合は何も除外しない conservative fallback を使う。実 document-set fixture には正常な projected operation と unrelated direct Unprojected marker を同居させ、root の aggregate `coverage: requires-source` を保持したまま selected operation が ready になることを検証する。source-aware invalid scenario は publication-safe operation identity 不在と publication-safe source location 不在を一件ずつ分離し、各 facts の exact generation-failure reason と単一 `DM-IDX-008` concern を固定する。既存 direct/sharded grammar、whole-set completeness、Unprojected audit retrieval、公開 document grammar、および projected operation が見つからない場合の not-ready behavior は変更しない。完了後に `R8-CORE-012` を `covered` にする。

> **Implementation note (Unprojected selected-readiness isolation checkpoint):** `core.mjs` は検証済み Unprojected facts の `indexPath` / `line` を file-scoped exclusion set に変換し、projected operation の selected-readiness scan だけから該当 marker 行を除外するようになった。facts 未登録 marker は引き続き blocking となり、facts 不在時は一行も除外しない。正常な projected operation と unrelated direct marker を持つ実 document set、および publication-safe identity / location 不在を分離した二つの source-aware invalid fixture を追加し、各 exact generation-failure reason と単一 `DM-IDX-008` concern を固定した。Core manifest は 179 cases / 134 invalid cases となり、one-invalidity audit は 134/134、全 596 tests は PASS した。影響として root aggregate `coverage: requires-source`、一般の incomplete-marker metadata propagation、direct / sharded grammar、Unprojected retrieval、row 不在時の not-ready behavior は変えず、`R8-CORE-012` だけを `covered` に更新した。

> **Implementation note (Core coverage matrix perspective / operation-selection checkpoint):** `R8-CORE-013`–`R8-CORE-015` として same-application action carry-through、complete / missing / action-only / conflicting counterpart mapping、generic unprojected reason、AsyncAPI 3.0.0 / 3.1.0 operation message selection、および decoded `perspective` metadata grammar を matrix に追加する。source perspective と operation selection は versioned manifest cases、exact facts assertions、単一-concern invalid cases により `covered` と確認した。decoded `perspective` は Unicode / internal ASCII space の valid fixture、empty / leading / trailing space rejection、case-only set mismatch が covered だが、Unicode normalization だけが異なる focused exact-comparison case と canonical fixture の exact decoded-value assertion がないため `R8-CORE-015` を `partial` とする。影響として二つの既存 clause を release evidence に昇格し、一つの未検証境界を明示する。fixture、rule、checker semantics と作業順序はこの checkpoint では変更しない。

> **Approved design (decoded perspective exactness checkpoint):** coverage matrix の残行を展開する前に `R8-CORE-015` の gap を解消する順序変更を承認する。独立した task-scoped invalid document set `identity-perspective-normalization-mixed` を追加し、root `INDEX.md` の decoded `perspective` は NFC `café`（code points `[99, 97, 102, 233]`）、`CONVENTIONS.md` は表示上同じ NFD `café`（code points `[99, 97, 102, 101, 769]`）とする。他の metadata、document structure、identity handles は一致させ、唯一の primary concern を `DM-ID-007` に固定する。case を `cases.json` / `identityCaseIds` に登録し、identity corpus test は両 code-point sequence、raw inequality、NFC-normalized equality、単一 `DM-ID-007` error を literal assertions で検証する。metadata corpus test は既存 `metadata-canonical-extensions-and-escapes` の parsed `perspective` が exact decoded value `店舗 service|west\edge` であることを固定する。production parser と set-wide strict comparison は変更せず、manifest は 180 cases / 135 invalid cases、one-invalidity audit は 135/135 に更新する。完了後に `R8-CORE-015` を `covered` とし、既存 case-only mismatch、empty / leading / trailing-space rejection、metadata escape semantics、他の identity rules を維持する。

> **Implementation note (decoded perspective exactness checkpoint):** 承認設計どおり `identity-perspective-normalization-mixed` task-scoped document set を追加し、NFC root `[99, 97, 102, 233]` と NFD conventions `[99, 97, 102, 101, 769]` の raw inequality / NFC equality、および単一 primary `DM-ID-007` を literal assertions で固定した。既存 canonical metadata fixture は decoded `perspective` が exact value `店舗 service|west\edge` であることを corpus test から直接検証する。Core manifest は 180 cases / 135 invalid cases、one-invalidity audit は 135/135、全 596 tests は PASS し、`R8-CORE-015` は `covered` になった。影響として Unicode normalization や case folding を行わない set-wide identity semantics と escape decoding の regression evidence を追加し、production parser、validator、diagnostic interface、他の identity / metadata fixtures は変更しない。

> **Implementation note (Core coverage matrix payload-knowledge / direction checkpoint):** `R8-CORE-016`–`R8-CORE-020` として whole-payload representation-set fallback、partial / no-sibling field collections、`$` root-row invariants、nullable ancestor applicability、receive-side Presence semantics を matrix に追加する。既存 versioned fixtures、source-aware adapter facts、単一-concern invalid cases、checker tests により representation-set unknown と known-media adapter unsupported の対比、および root / nested nullability と `always` / `optional` / exact condition / `unknown` は `covered` と確認した。一方、partial header / parameter で synthetic row を生成しない source-aware expectation、whole-section `unknown` Parameters の versioned valid case、failure-signal payload の `$` root-row case がないため `R8-CORE-017`–`R8-CORE-019` を `partial` とする。影響として既存 payload / message clauses を release evidence に対応付け、三つの未検証境界を明示する。fixture、rule、checker semantics と作業順序はこの checkpoint では変更しない。

> **Approved design (partial collection / Parameters unknown / failure root-row checkpoint):** `R8-CORE-017`–`R8-CORE-019` の gap は、source projection と生成文書の責務を分離し、rule ごとの正常系・単一違反系で固定する。新しい `partial-collection-source-scenario` は既存 `evaluatePartialCollectionSourceExpectations()` を再利用し、各 projected object の exact match を検証する。valid scenario は named sibling がある header / parameter / field で `retainedNames` が source の既知名だけであること、固定 `additional unnamed <memberKind>` marker、field example が faithful でないときの `canonicalExample: omit` を検証する。また named sibling なしの header / parameter は `whole-section-unknown`、field と polymorphic field は concrete representation を保つ `representation-local-unknown` になることを同じ facts に含める。invalid source scenarios は、synthetic member または誤った retained name を含む一件を `DM-INC-004`、no-sibling で誤った形式を宣言する一件を `DM-INC-005` として分離する。validator は mismatch の分類にだけ normative rule を用い、source 値から新しい document member を発明しない。
>
> 生成文書側は、既存 `payload-unknown-forms-and-partial-collections-valid` に placeholder 付き Channel を追加し、`#### Parameters` 全体の `unknown` と直後の canonical marker、set-level `knowledge: requires-input` を固定する。failure signal は独立した task-scoped valid document set に expanded inline failure shape の RECEIVE scalar JSON Payload を置き、`$` row が `Presence=always`、`Nullable=payload_nullable` を満たすことを検証する。その valid set を base に exact one-replacement mutation で `$` の Presence だけを `optional` に変え、failure-shape validator の通常 Message/Payload diagnostic remapping を通じた単一 primary `DM-FAIL-003` を固定する。
>
> manifest は source valid 一件、source invalid 二件、failure valid 一件、failure mutation invalid 一件の合計五件を追加し、180 cases / 135 invalid cases から 185 cases / 138 invalid cases になる見込みとする。whole-section unknown Parameters は既存 valid case の同一契約 family に追加するため manifest case を増やさない。全追加 case は `core-corpus.test.mjs` の対応 ID list、exact facts / document assertions、one-invalidity audit で検証する。全 test、Core corpus、reference audit、`git diff --check` が成功した後に `R8-CORE-017`–`R8-CORE-019` を `covered` にする。公開 document grammar、既存 partial-collection evaluator の projection semantics、Message/Payload/Failure production validation semantics、read-only document facts は変更しない。作業順序は既存の coverage gap 解消順を維持する。

> **Plan change / impact (user-approved final review fix):** final review で、scenario が duplicate `collectionId` を持つ場合に `Map(collectionId)` lookup が後続 case で先行 case を上書きし、入力順の evaluator result と case 固有 `projected` の対応を失う defect が確認された。`validatePartialCollectionSourceExpectations()` は evaluator result と同じ配列 index の source case `projected` を比較する方式へ変更し、`collectionId` の一意性制約は新設しない。duplicate ID でも各 case 固有 projection が exact なら diagnostic は生成しないことを dedicated regression `associates duplicate partial-collection IDs by source-case index` で固定する。manifest 185 cases / 138 invalid cases、diagnostic の分類・message、facts、evaluator semantics / order / interface、public document grammar、Message/Payload/Failure production semantics は不変とする。この承認により Task 4 の三 implementation-file scope は `core.mjs` を含む四 file の final-fix checkpoint へ拡張され、full suite は新規 regression 一件を加えた 599 tests を見込む。

> **Implementation note (partial collection / Parameters unknown / failure root-row closure):** Task 1–3 の versioned evidence を統合し、Core manifest の final count を 185 cases / 138 invalid cases、one-invalidity audit を 138/138 に固定した。`core-corpus.test.mjs` の audit は manifest total 185 も literal assertion し、source valid / synthetic-member invalid (`DM-INC-004`)、no-sibling source valid / form invalid (`DM-INC-005`) と既存 valid document set の whole-section `unknown` Parameters assertion、failure-signal root-row valid / Presence-only mutation invalid (`DM-FAIL-003`) を coverage matrix の `R8-CORE-017`–`R8-CORE-019` へ exact evidence として追加してすべて `covered` にした。final-review fix 後に実測した full suite は 599 tests が PASS した。影響として public grammar、partial-collection evaluator semantics、document validator semantics は変更せず、versioned evidence と regression gate だけを更新した。

> **Implementation note (Core coverage matrix Unprojected identity / Reply selection checkpoint):** `R8-CORE-021`–`R8-CORE-023` として length-prefixed Unprojected Operation identity、explicit non-empty Reply expansion / no synthetic operation、omitted / zero / invalid Reply selection と INDEX omission を matrix に追加する。ASCII / multibyte UTF-8、embedded delimiter、leading zero、byte-length mismatch、source ID と decoded identity の grouping は既存 versioned document sets と exact parser tests により `covered` と確認した。Reply は AsyncAPI 3.0.0 / 3.1.0 の explicit non-empty、omitted zero / one / multiple / no-channel、explicit empty、primary-operation retention、INDEX omission mismatch が covered だが、同じ reply channel / message を選ぶ independently declared operation の共存、authoritative non-empty / empty selection、authoritative selection 付き omission、duplicate / unresolved / ambiguous / out-of-scope selected identity の versioned evidence がないため `R8-CORE-022` / `R8-CORE-023` を `partial` とする。影響として一つの既存 clause を release evidence に昇格し、二つの未検証境界を明示する。fixture、rule、checker semantics と作業順序はこの checkpoint では変更しない。

> **Approved design (Reply selection evidence closure):** 既存 `asyncapi-reply-message-selection` scenario を source-to-Reply-to-INDEX の統合境界として拡張する案1を採用する。第一 checkpoint は `projectedOperationIds` を source の通常 operation message-selection 結果から導出し、embedded Reply から operation を合成せず、同じ reply channel / message を選ぶ independently declared operation を別 operation のまま保持する exact valid scenario と synthetic operation 一件だけを加えた単一 `DM-REPLY-003` invalid scenario を追加する。第二 checkpoint は optional `authoritativeReplyMessageSelections` を追加し、omitted Reply に対する authoritative non-empty / empty selection と duplicate / unresolved / ambiguous / out-of-scope identity resolution を actual source message reference に照合する。各 invalid identity は一 fixture 一違反に分離し、解決失敗時は generation failure と空の INDEX reply entries を固定する。既存 evaluator signature、公開 document grammar、source-native explicit / omitted semantics は維持し、二 checkpoint に分けてユーザーの commit 単位とする。

> **Implementation note (`R8-CORE-022` independent-operation coexistence checkpoint):** `evaluateAsyncApiReplyMessageSelection()` は既存 primary-operation selection evaluator の結果から normally projected source operation IDs を lexical order で公開し、Reply 自体から別 operation ID を生成しない。scenario validator は `projectedOperationIds` が提示された場合だけ exact comparison し、INDEX routing mismatch と同じ単一 `DM-REPLY-003` projection concern に集約する。versioned valid scenario は `requestWithReply` の embedded Reply と、同じ `replySelection` channel / `replyAccepted` message を選ぶ `independentReplyConsumer` が別々に残ることを固定する。paired invalid scenario はその二 operation を保持したまま `syntheticReplyOperation` 一件だけを余分に投影する。Core manifest は 187 cases / 139 invalid cases となり、`R8-CORE-022` を `covered` に更新した。影響として source-native Reply selection、INDEX reply-entry semantics、公開 document grammar、既存 scenario の呼び出し interface は変更せず、optional projection comparison と read-only facts だけを追加する。

> **Implementation note (`R8-CORE-023` authoritative Reply selection checkpoint):** `evaluateAsyncApiReplyMessageSelection()` は backward-compatible な optional 第二引数で `authoritativeReplyMessageSelections` を受け、native `reply.messages` が omitted の operation にだけ適用する。各 selection は source ID と exact target operation を持ち、selected identity ごとの source message reference が concrete Message Object まで cycle-safe に一件解決すること、referenced reply channel の scope 内であること、または channel 不在時に Reply applicability が明示されることを検証する。empty authoritative set は primary operation を保持する whole-Reply unsupported、non-empty set は expanded Reply、duplicate / missing / unresolved / ambiguous / out-of-scope identity、duplicate target、unmatched / non-Reply target は generation failure と空の INDEX reply entries になる。AsyncAPI 3.0.0 / 3.1.0 の valid scenario は omitted zero / one / multiple / no-channel の authoritative counterparts、components Message Object への正常な reference chain、reverse input からの lexical multi-message output を固定し、各 invalid concern は一 fixture 一 `DM-REPLY-003` に分離した。Core manifest は 196 cases / 146 invalid cases となり、`R8-CORE-023` を `covered` に更新した。影響として既存 source-native explicit / omitted semantics、Reply fallback、公開 document grammar、既存一引数 evaluator 呼び出しは維持し、authoritative selection の read-only facts と値を開示しない aggregate generation-failure diagnostic だけを追加する。

> **Final review hardening (`R8-CORE-023`):** initial implementation review で、map-key existence だけでは dangling / cyclic Message Reference Object を actual Message Object と誤認できること、duplicate target が array order による last-wins になること、unmatched / non-Reply target と missing identity が無視または受理されることを確認した。resolver は local channel / components Message reference chain を concrete object まで追跡し、dangling / cycle / non-object を unresolved とする。authoritative inputs は target ごとに grouping し、native `reply.messages` の explicit / omitted 分岐より先に duplicate target を generation failure として拒否する。Reply operation set にない target も aggregate failure に含め、失敗時は Reply INDEX entry を出さない。diagnostic message が source ID、target operation、identity、source reference を含まない assertion を追加した。影響として manifest は当初見込みの 193 / 143 から 196 / 146 に増えたが、単一 authoritative selection は omitted Reply にだけ適用するため native selection precedence は維持され、rule scope、公開 interface、diagnostic rule ID は変更しない。

> **Approved design (`R8-CORE-024`–`R8-CORE-026` defaults / formats / constraint examples):** README §8 の Reply selection に続く順序を維持し、JSON Schema Draft 07 / AsyncAPI default、exact-vocabulary format と catalog closure、unsatisfiable constraint / illustrative-example / generator failure を三つの independently reviewable row に分ける。既存 versioned evidence だけで充足する default row は `covered`、一部が unit-level checker にしかない format と constraint/example row は不足する versioned evidence を列挙して `partial` とする。この checkpoint では fixture や production checker を変更しない。

> **Implementation note (`R8-CORE-024`–`R8-CORE-026` matrix checkpoint):** `R8-CORE-024` は Draft 07 の `default_annotation`（JSON `null` を含む）、AsyncAPI SEND / RECEIVE の effective default、annotation default への behavior 付与拒否、SEND effective behavior 欠落拒否を既存 source scenario / document set で確認して `covered` にした。`R8-CORE-025` は recognized constraint / annotation format、open custom format の localized unsupported、catalog role / duplicate row を対応付けたが、case-mismatched format value、missing catalog row、exact normalized source-independent semantics、required-workflow convention closure の versioned fixture がないため `partial` とした。`R8-CORE-026` は exact constraints と example validation の既存 evidence を対応付けたが、unsatisfiable-constraint replacement、valid-example-values unknown marker、generator-capability failure の versioned fixture がないため `partial` とした。影響として Core manifest は 196 cases / 146 invalid cases のままで、rule、checker semantics、公開 document grammar、作業順序は変更しない。

> **Approved design (`R8-CORE-025` source-aware exact-format checkpoint):** 既存 `schema-format-default-projection-valid` scenario を拡張し、AsyncAPI 3.0.0 / 3.1.0 の exact `int32` が同じ constraint fragment / catalog role へ正規化されることと、case-mismatched `INT32` が exact vocabulary に一致せず localized unsupported になることを literal facts で固定する。production evaluator は既存 exact comparison semantics を維持し、case-folding mutation で fixture が実際に誤実装を検出することを確認する。missing catalog row と required-workflow closure は後続 checkpoint に分離する。

> **Implementation note (`R8-CORE-025` source-aware exact-format checkpoint):** versioned valid source scenario に `asyncapi-3.0-int32` と `asyncapi-case-mismatched-int32` を追加し、Core corpus checker は AsyncAPI 3.0.0 / 3.1.0 の同一 `format="int32"` / `constraint-catalog` facts と `INT32` の `requires-source` / localized unsupported factsを literal deep equality で検証する。format lookup を一時的に case-insensitive にした mutation と AsyncAPI 3.0.0 vocabulary mapping を除いた mutation はそれぞれ当該 scenario を `DM-MSG-005` で失敗させ、復元後に targeted test が成功した。`R8-CORE-025` の未解消versioned evidence は missing catalog row と required-workflow convention closure の二件だけとなる。影響として production evaluator、公開 interface、document grammar、Core manifest 196 cases / 146 invalid cases は変更しない。

- [x] Metadata、extension name/order/escape、unknown non-`x-` key、sentence grammar。
- [x] Identity trailer、set/projection digest、closed root、mixed set、task-scoped identity check。
- [x] Direct/sharded Sources、unknown API identity/version、Revision none、overlap、fixed-point、cycle。
- [x] Flat/hierarchical Operations、bounds、semantic load-all、false positive、path parity。
- [x] Required/supplemental context、eligible/forbidden target、separator/order、`none` sentinel collision。
- [x] Direct/sharded Unprojected Operations、multibyte identity、group collision、sensitive withholding。
- [x] Same-application action、counterpart mapping complete/missing/conflicting。
- [x] AsyncAPI 3.0.0/3.1.0 operation message explicit/omitted/empty selection。
- [x] AsyncAPI 3.0.0/3.1.0 reply message explicit/omitted/empty selectionと INDEX omission。
- [x] CONVENTIONS whole-section states、format semantics catalog、common/replacement failure shapes。
- [x] Behavior six keys、delivery tokens、exactly-once qualification、unknown facts。
- [x] Operation/channel/message/reply/failure binding scopes。
- [x] SEND Required、RECEIVE Presence optional/condition/unknown、Nullable、nested ancestor semantics。
- [x] whole payload unknown、representation-local field collection、partial named siblings、example omission。
- [x] `$` root rows、root scalar/array/map/object、object openness、recursive unsupported。
- [x] exact JSON constraint/equality、default_annotation/default、recognized/custom format behavior。
- [x] parameterless JSON/+json、parameterized/unregistered wire、raw binary boundary、header encoding。
- [x] Reply static/dynamic channel、correlation、timeout、whole-Reply fallback、no synthetic operation。
- [x] Failure core states、deviations、common/inline shapes、receive malformed/unknown/handler errors。
- [x] publication safety、unsafe mandatory value failure、instruction structural escape。
- [x] canonical marker order、deviation placement、deprecated marker、single prose language、English structure。
- [x] implementation readiness cases: same contract under different reader/runtime/adapter capabilities。

- [x] **Step: one-invalidity audit を行う**
  - 各 invalid fixture に `expected_rule_ids` が一つの primary concern を示すことを確認する。
  - 複数の独立違反がある fixture は分割する。

- [ ] **Step: Core coverage matrix を完成させる**
  - README §8 の Core corpus 要件を一行ずつ `COVERAGE.md` に写し、source、valid fixture、invalid fixture、rule ID、checker test を対応付ける。
  - [x] Matrix contract と `R8-CORE-001`–`R8-CORE-004`（publication prerequisite、metadata、identity）を対応付ける。
  - [x] `R8-CORE-005`–`R8-CORE-010`（Sources、readiness、Operations、context、sentinel）を対応付ける。
  - [x] required-workflow readiness gap を先に解消する順序変更と設計を承認する。
  - [x] `R8-CORE-006` / `R8-CORE-008` の required-workflow Core-reader readiness gap を解消する。
    - [x] RED: `focused/valid/implementation-readiness-required-workflow-valid.json` と対応する単一-concern invalid scenario を `cases.json` / `core-corpus.test.mjs` に登録し、required workflow paths だけを literal blocker として期待する focused test が現行 evaluator で失敗することを確認する。
    - [x] GREEN: `tools/lib/validators/core.mjs` で選択 operation row の `requiredContexts` から version-defined workflow structure requirements を導出し、reader の `structures` に `workflow` がなければ `structure:workflow:<path>` blockers を返す。既存 marker / declared structure / runtime / adapter blockers は維持する。
    - [x] VERIFY: focused readiness test、全 `tools/tests/*.test.mjs`、one-invalidity audit、reference audit、`git diff --check` を通す。
    - [x] DOCS: `COVERAGE.md` の両 row を `covered` にし、この TODO に実装結果と影響を記録する。
  - [x] `R8-CORE-011`–`R8-CORE-012`（sentinel-like source literals、Unprojected Operations）を対応付ける。
  - [x] `R8-CORE-012` の missing-safe-identity/location focused cases と unrelated direct-marker non-blocking gap を解消する。
    - [x] facts-driven marker-line exclusion と focused fixture 分割の設計を承認する。
  - [x] `R8-CORE-013`–`R8-CORE-015`（perspective projection、operation message selection、decoded perspective）を対応付ける。
  - [x] `R8-CORE-015` の exact decoded-value assertion と Unicode-normalization-only mismatch fixture gap を解消する。
    - [x] 独立 document set、literal code-point assertions、production semantics 非変更の設計と順序変更を承認する。
  - [x] `R8-CORE-016`–`R8-CORE-020`（payload knowledge forms、partial collections、root rows、direction / ancestor semantics）を対応付ける。
  - [x] `R8-CORE-017`–`R8-CORE-019` の source-aware no-synthetic-member、whole-section unknown Parameters、failure-signal `$` root-row gap を解消する。
    - [x] rule ごとの source scenario 分離、既存 Parameters fixture 拡張、独立 failure root-row valid / mutation invalid の設計を承認する。
    - [x] source projection、Parameters document evidence、failure `$` document evidence、coverage / regression の四 checkpoint に分けた実装計画を作成する。
    - [x] RED: `partial-collection-source-scenario` runner boundary、source valid / `DM-INC-004` invalid / `DM-INC-005` invalid、whole-section unknown Parameters、failure `$` root-row valid / `DM-FAIL-003` mutation invalid の focused tests を追加し、未実装 boundary だけが失敗することを確認する。
    - [x] GREEN: exact projected-object comparison と rule-specific aggregate diagnostic を追加し、生成文書 fixture は既存 production validators で受理・拒否させる。
    - [x] VERIFY: focused tests、全 `tools/tests/*.test.mjs`、Core corpus 185/185、one-invalidity audit 138/138、reference audit、`git diff --check` を通す。
    - [x] DOCS: `COVERAGE.md` の三 row を `covered` にし、この TODO に実装結果と影響を追記する。
  - [x] `R8-CORE-021`–`R8-CORE-023`（length-prefixed Unprojected identity、Reply selection / no-synthetic-operation、Reply fallback / INDEX omission）を対応付ける。
  - [x] `R8-CORE-022` の independently declared operation coexistence evidence を解消する。
  - [x] `R8-CORE-023` の authoritative / invalid selection identity evidence を解消する。
  - [x] `R8-CORE-024`–`R8-CORE-026`（schema defaults、format catalog / closure、constraint / example failure）を対応付ける。
  - [ ] `R8-CORE-025` の versioned evidence gap を解消する。
    - [x] case-mismatched format と AsyncAPI 3.0.0 / 3.1.0 source-independent semantics を固定する。
    - [ ] missing catalog row と required-workflow closure を固定する。
  - [ ] `R8-CORE-026` の unsatisfiable replacement、valid-example-values unknown、generator-capability failure の versioned evidence gap を解消する。
  - [ ] 残る Core corpus clause を `R8-CORE-*` row に分解して対応付け、`R8-CORE-001` を `covered` にする。

#### Partial Collection / Parameters Unknown / Failure Root-Row Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Git state は agent が変更せず、各 task 完了後にユーザーの commit のため停止する。

**Goal:** `R8-CORE-017`–`R8-CORE-019` の source-aware partial/no-sibling projection、whole-section unknown Parameters、failure-signal `$` root-row を versioned Core corpus の exact positive / one-invalidity negative evidence で固定する。

**Architecture:** 既存 pure evaluator に read-only scenario validator を重ね、source expectation と projected object の structural exactness を document validator から分離する。Parameters と failure shape は task-scoped Markdown set で既存 production validator を実行し、source projection の diagnostic と生成文書の diagnostic を混ぜない。

**Tech Stack:** Node.js ESM、`node:test`、`node:assert/strict`、`node:util` の `isDeepStrictEqual`、versioned JSON / Markdown fixtures、既存 corpus runner / document-set validator。

##### Global Constraints

- README §3.4 / §4.1、`DM-INC-004`、`DM-INC-005`、`DM-FAIL-003` の normative semantics は変更しない。
- `evaluatePartialCollectionSourceExpectations(cases)` の入力・出力・順序は変更ず、scenario validator だけを追加する。
- source validator は object key order に依存しない structural exact comparison を行い、欠落・余分・値違いのすべてを mismatch にする。
- invalid fixture は一件一 primary concern とし、source 値や synthetic member 名を diagnostic message に表示しない。
- fixture / manifest / checker ID list は既存の ASCII lexical order を保つ。
- task-scoped document set は digest restamp を必要とせず、opening metadata / identity handles / standard section order の既存 grammar を保つ。
- 各 task の targeted test と `git diff --check` が成功した時点で停止し、次 task への未完了変更を混ぜない。

---

##### Task 1: Versioned partial-collection source scenarios

**Files:**

- Create: `docai-messaging/fixtures/core/v0.17.1/source/focused/partial-collection-source-valid.json`
- Create: `docai-messaging/fixtures/core/v0.17.1/source/focused/partial-collection-synthetic-member-invalid.json`
- Create: `docai-messaging/fixtures/core/v0.17.1/source/focused/partial-collection-no-sibling-form-invalid.json`
- Modify: `docai-messaging/tools/lib/validators/core.mjs`
- Modify: `docai-messaging/tools/tests/core-corpus.test.mjs`
- Modify: `docai-messaging/fixtures/core/v0.17.1/cases.json`

**Interfaces:**

- Consumes: `evaluatePartialCollectionSourceExpectations(cases: Array<object>): Array<object>`
- Produces: `validatePartialCollectionSourceExpectations(scenario: {cases: Array<object>}, options?: {file?: string}): {diagnostics: Array<object>, facts: {partialCollectionSourceExpectations: Array<object>}}`
- Produces: corpus kind `partial-collection-source-scenario`。

- [ ] **Step 1: source fixtures と failing corpus test を追加する**

  valid scenario は次の exact expectation を入力順で持つ。

  ```text
  request-headers:    partial-table, retainedNames=[correlation-id], marker=additional unnamed header
  channel-parameters: partial-table, retainedNames=[tenant], marker=additional unnamed parameter
  request-fields:     partial-table, retainedNames=[id], marker=additional unnamed field,
                      canonicalExample=omit, representation={mediaType:application/json, nullable:no}
  response-headers:   whole-section-unknown
  reply-parameters:   whole-section-unknown
  response-fields:    representation-local-unknown,
                      representation={mediaType:application/json, nullable:yes}
  event-variants:     representation-local-unknown,
                      representation={mediaType:application/json, nullable:no}
  ```

  `partial-collection-synthetic-member-invalid` は `request-headers` の projected `retainedNames` だけを `["correlation-id", "x-generated"]` にし、`partial-collection-no-sibling-form-invalid` は named member のない `reply-parameters` を `partial-table` / `["generated"]` / `additional unnamed parameter` として宣言する。`cases.json` に valid 一件と単一-rule invalid 二件を登録し、test は valid facts の七 object を literal deep equality で検証する。

  この checkpoint で invalid case は 135 から 137 に増えるため、one-invalidity integration assertion も `{ passed: true, audited: 137, errors: [] }` に更新する。

- [ ] **Step 2: targeted test を実行し RED を確認する**

  Run: `node --test --test-name-pattern='partial-collection source scenarios' docai-messaging/tools/tests/core-corpus.test.mjs`

  Expected: `validatePartialCollectionSourceExpectations is not a function` または未対応 kind で FAIL。

- [ ] **Step 3: exact scenario validator と runner branch を最小実装する**

  `core.mjs` に次の classification を実装する。

  ```js
  export function validatePartialCollectionSourceExpectations(
    scenario,
    { file = "source-input.json" } = {}
  ) {
    const expectations = evaluatePartialCollectionSourceExpectations(scenario.cases ?? []);
    const sources = new Map((scenario.cases ?? []).map((entry) => [entry.collectionId, entry]));
    const mismatches = expectations.flatMap((expected) => {
      if (isDeepStrictEqual(expected, sources.get(expected.collectionId)?.projected)) return [];
      return [{
        ruleId: expected.form === "partial-table" ? "DM-INC-004" : "DM-INC-005"
      }];
    });
    const ruleIds = [...new Set(mismatches.map((entry) => entry.ruleId))];
    return {
      diagnostics: ruleIds.map((ruleId) => diagnostic(
        ruleId,
        file,
        1,
        `Partial collection projection disagrees with ${mismatches.filter((entry) => entry.ruleId === ruleId).length} exact source expectation(s).`
      )),
      facts: { partialCollectionSourceExpectations: expectations }
    };
  }
  ```

  `core.mjs` の import に `import { isDeepStrictEqual } from "node:util";` を追加し、`validateCase()` は JSON を parse してこの function を呼ぶ。

- [ ] **Step 4: targeted GREEN と one-invalidity を確認する**

  Run: `node --test --test-name-pattern='partial-collection source scenarios|audits every Task 9 invalid fixture' docai-messaging/tools/tests/core-corpus.test.mjs`

  Expected: source valid は diagnostics `[]`、二つの invalid はそれぞれ `DM-INC-004` / `DM-INC-005` 一件、audit は `137/137`。

- [ ] **Step 5: diff を確認しユーザーの commit のため停止する**

  Run: `git diff --check`

  Expected: output なし。

  Suggested commit message: `test(messaging): validate partial collection source projections`

##### Task 2: Whole-section unknown Parameters document evidence

**Files:**

- Modify: `docai-messaging/fixtures/core/v0.17.1/focused/valid/payload-unknown-forms-and-partial-collections-valid/INDEX.md`
- Modify: `docai-messaging/fixtures/core/v0.17.1/focused/valid/payload-unknown-forms-and-partial-collections-valid/channels/payload-unknown.md`
- Modify: `docai-messaging/tools/tests/core-corpus.test.mjs`

**Interfaces:**

- Consumes: existing task-scoped document-set validator and `messageDefinitions.byOperation` facts.
- Produces: operation `unknown-parameters` at Channel `orders.e.{tenant}.unknown-parameters` with primary Message `unknown-parameters-message`.

- [ ] **Step 1: exact expected operation を test に先行追加する**

  `payloadUnknownCaseIds` の valid assertion に次を追加し、channel source が canonical sequence を持つことを検証する。

  ```js
  "unknown-parameters": ["unknown-parameters-message"]
  ```

  ```text
  #### Parameters

  unknown
  **unknown**: channel parameter collection requires the complete channel declaration at source-a

  #### Bindings
  ```

- [ ] **Step 2: targeted test で RED を確認する**

  Run: `node --test --test-name-pattern='payload unknown and partial-collection corpus' docai-messaging/tools/tests/core-corpus.test.mjs`

  Expected: `unknown-parameters` operation が現行 facts にないため FAIL。

- [ ] **Step 3: INDEX row と operation document を追加する**

  INDEX の最後に次の lexical-following row を追加する。

  ```markdown
  | SEND | orders.e.{tenant}.unknown-parameters | unknown-parameters | unknown-parameters-message | send with unknown parameters | Preserves a whole unknown channel parameter collection | none | none |
  ```

  channel file の最後に canonical Behavior / Operation Bindings / Channel / Message / Reply / Failure Handling / Related 順の SEND operation を追加する。Channel は Step 1 の exact Parameters sequence、Message は `- Headers: none`、`- Bindings: none`、headed Payload `none` を持つ。opening metadata の `knowledge: requires-input` は維持する。

- [ ] **Step 4: targeted GREEN と diff を確認する**

  Run: `node --test --test-name-pattern='payload unknown and partial-collection corpus' docai-messaging/tools/tests/core-corpus.test.mjs`

  Expected: PASS、valid diagnostics `[]`、operation facts は五 operations。

  Run: `git diff --check`

  Expected: output なし。

- [ ] **Step 5: ユーザーの commit のため停止する**

  Suggested commit message: `test(messaging): cover whole-section unknown parameters`

##### Task 3: Failure-signal `$` root-row document evidence

**Files:**

- Create: `docai-messaging/fixtures/core/v0.17.1/focused/valid/failure-signal-root-row-valid/CONVENTIONS.md`
- Create: `docai-messaging/fixtures/core/v0.17.1/focused/valid/failure-signal-root-row-valid/INDEX.md`
- Create: `docai-messaging/fixtures/core/v0.17.1/focused/valid/failure-signal-root-row-valid/channels/failure-root.md`
- Create: `docai-messaging/fixtures/core/v0.17.1/focused/invalid/failure-signal-root-presence-invalid.json`
- Modify: `docai-messaging/fixtures/core/v0.17.1/cases.json`
- Modify: `docai-messaging/tools/tests/core-corpus.test.mjs`

**Interfaces:**

- Consumes: `task-scoped-document-set`, `task-scoped-document-set-mutation`, inline failure-shape parsing, RECEIVE Payload validation, diagnostic remapping.
- Produces: valid operation `publish-with-failure-root`, inline shape `failure-code`, and one-invalidity mutation `failure-signal-root-presence-invalid`.

- [ ] **Step 1: valid / invalid manifest expectations と failing test を追加する**

  `failureContractCaseIds` に二 case ID を追加し、valid channel source が次の exact failure Payload を持つことと inline fact を検証する。

  ````markdown
  **message_shape**: failure-code

  - Headers: none
  - Bindings: none
  #### Payload

  **payload_presence**: always
  **media_type**: application/json
  **payload_nullable**: no
  ```json
  "rejected"
  ```
  | Field | Type | Presence | Nullable | Meaning |
  |---|---|---|---|---|
  | $ | string | always | no | Stable failure code |
  ````

- [ ] **Step 2: targeted test で RED を確認する**

  Run: `node --test --test-name-pattern='failure-signal root-row corpus' docai-messaging/tools/tests/core-corpus.test.mjs`

  Expected: manifest case または fixture が未登録のため FAIL。

- [ ] **Step 3: minimal valid document set を作成する**

  `CONVENTIONS.md` は全 canonical section が `none` の task-scoped full profile とする。`INDEX.md` は source-a 一件、SEND `failures.root` / `publish-with-failure-root` / `publish-message` 一行、Workflows `none` とする。channel operation は canonical seven operation subsections を持ち、primary Message Payload は `none`、Failure Handling は次の一行と Step 1 の inline shape を持つ。

  ```markdown
  | Failure | Signal | Condition | Action |
  |---|---|---|---|
  | rejected | inline:failure-code | The broker rejects the published message | Record the stable failure code and do not retry the message |
  ```

- [ ] **Step 4: exact one-replacement mutation を作成する**

  ```json
  {
    "id": "failure-signal-root-presence-invalid",
    "base": "../valid/failure-signal-root-row-valid",
    "path": "channels/failure-root.md",
    "replace": {
      "from": "| $ | string | always | no | Stable failure code |",
      "to": "| $ | string | optional | no | Stable failure code |"
    }
  }
  ```

  manifest で valid は `task-scoped-document-set` / expected valid、mutation は `task-scoped-document-set-mutation` / expected `DM-FAIL-003` とする。

  この checkpoint で invalid case は 137 から 138 に増えるため、one-invalidity integration assertion も `{ passed: true, audited: 138, errors: [] }` に更新する。

- [ ] **Step 5: targeted GREEN と one-invalidity を確認する**

  Run: `node --test --test-name-pattern='failure-signal root-row corpus|audits every Task 9 invalid fixture' docai-messaging/tools/tests/core-corpus.test.mjs`

  Expected: valid diagnostics `[]`、inline shape fact `failure-code`、mutation primary diagnostic `DM-FAIL-003` 一件、audit `138/138`。

- [ ] **Step 6: diff を確認しユーザーの commit のため停止する**

  Run: `git diff --check`

  Expected: output なし。

  Suggested commit message: `test(messaging): cover failure signal root rows`

##### Task 4: Coverage closure and full regression

**Files:**

- Modify: `docai-messaging/tools/lib/validators/core.mjs`（user-approved final-review fix で追加）
- Modify: `docai-messaging/fixtures/core/v0.17.1/COVERAGE.md`
- Modify: `docai-messaging/TODO-docai-messaging-fixtures-1.md`
- Modify: `docai-messaging/tools/tests/core-corpus.test.mjs`

Final review の Important finding 対応により、この checkpoint は当初の三 file scope から上記四 implementation files へ拡張された。

**Interfaces:**

- Consumes: 185-case manifest、138 invalid-case results、Task 1–3 の exact facts / document assertions.
- Produces: `R8-CORE-017`–`R8-CORE-019` status `covered` と 138-case one-invalidity regression gate.

- [ ] **Step 1: final manifest / audit counts を固定する**

  ```js
  assert.equal(manifest.cases.length, 185);
  assert.deepEqual(audit, { passed: true, audited: 138, errors: [] });
  ```

- [ ] **Step 2: coverage matrix の三 row を exact evidence で更新する**

  - `R8-CORE-017`: source valid / synthetic-member invalid / `DM-INC-004` / source-scenario test を追加し `covered`。
  - `R8-CORE-018`: no-sibling source valid / form invalid / unknown-parameters document evidence / `DM-INC-005` を追加し `covered`。
  - `R8-CORE-019`: failure-signal-root-row valid / Presence mutation invalid / `DM-FAIL-003` / failure source assertion を追加し `covered`。
  - Remaining Inventory からこの三 gap を削除し、未対応の後続 Core clauses だけを残す。

- [ ] **Step 3: TODO に implementation note と影響を記録する**

  final counts `185 cases / 138 invalid`、one-invalidity `138/138`、実際の full test 数、変更しなかった public grammar / evaluator semantics / document validator semantics、三 row の `covered` 化を記録し、RED / GREEN / VERIFY / DOCS checklist を完了にする。

- [ ] **Step 4: full verification を実行する**

  Run: `node --test docai-messaging/tools/tests/*.test.mjs`

  Expected: 全 test PASS。

  Run: `node --test --test-name-pattern='partial-collection source scenarios|associates duplicate partial-collection IDs by source-case index|payload unknown and partial-collection corpus|failure-signal root-row corpus|audits every Task 9 invalid fixture' docai-messaging/tools/tests/core-corpus.test.mjs`

  Expected: 全 targeted test PASS、Core corpus 185/185、one-invalidity 138/138。

  Run: `node -e 'const m=require("./docai-messaging/fixtures/core/v0.17.1/cases.json"); if (m.cases.length !== 185 || m.cases.filter((c) => c.expected === "invalid").length !== 138) process.exit(1)'`

  Expected: output なし、exit code 0。

  Run: `node -e 'const m=require("./docai-messaging/fixtures/core/v0.17.1/cases.json"); const ids=new Set(m.cases.map((c)=>c.id)); const required=["partial-collection-source-valid","partial-collection-synthetic-member-invalid","partial-collection-no-sibling-form-invalid","failure-signal-root-row-valid","failure-signal-root-presence-invalid"]; if(required.some((id)=>!ids.has(id))) process.exit(1)'`

  Expected: coverage に追加する五 case ID がすべて manifest に存在し、output なし、exit code 0。

  Run: `git diff --check`

  Expected: output なし。

- [ ] **Step 5: ユーザーの commit のため停止する**

  Suggested commit message: `docs(messaging): close payload collection coverage gaps`

#### Unprojected Selected-Readiness Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan step-by-step in the current workspace. Subagent execution is not part of this checkpoint.

**Goal:** 検証済み direct Unprojected marker が unrelated projected operation の selected-readiness を妨げないようにし、publication-safe identity / location 不在の generation failure を versioned Core corpus で固定する。

**Architecture:** `coreFacts.unprojectedOperations.groups[].markers` だけを信頼境界とし、marker の `indexPath` と `line` を file-scoped exclusion set に変換する。projected operation row が見つかった後の marker scan にだけ exclusion set を渡し、root aggregate completeness と一般の incomplete-marker 判定には適用しない。

**Tech Stack:** Node.js ESM、`node:test`、versioned Markdown / JSON fixture corpus、既存 DocAI Messaging validator helpers。

##### Global Constraints

- `README.md` §3.2 / §3.6 / §6.1 と承認済み設計の normative semantics を変更しない。
- 検証済み facts がない場合は marker を一行も除外しない。
- 同じ file の facts-identified line だけを除外し、他の `unknown` / `unsupported` marker は blocking のままにする。
- projected operation が見つからない場合の `ready: false`、direct / sharded grammar、whole-set completeness、audit retrieval は変更しない。
- Git は read-only inspection に限定し、コミットはユーザーが行う。

##### Task 1: `R8-CORE-012` の fixture、evaluator、coverage を一つの TDD checkpoint で完成させる

**Files:**

- Create: `docai-messaging/fixtures/core/v0.17.1/focused/valid/unprojected-unrelated-marker-readiness-valid/INDEX.md`
- Create: `docai-messaging/fixtures/core/v0.17.1/focused/valid/unprojected-unrelated-marker-readiness-valid/CONVENTIONS.md`
- Create: `docai-messaging/fixtures/core/v0.17.1/focused/valid/unprojected-unrelated-marker-readiness-valid/channels/orders.md`
- Create: `docai-messaging/fixtures/core/v0.17.1/focused/invalid/unprojected-source-missing-identity-invalid.json`
- Create: `docai-messaging/fixtures/core/v0.17.1/focused/invalid/unprojected-source-missing-location-invalid.json`
- Modify: `docai-messaging/fixtures/core/v0.17.1/cases.json`
- Modify: `docai-messaging/tools/tests/core-corpus.test.mjs`
- Modify: `docai-messaging/tools/lib/validators/core.mjs`
- Modify: `docai-messaging/fixtures/core/v0.17.1/COVERAGE.md`
- Modify: `docai-messaging/TODO-docai-messaging-fixtures-1.md`

**Interfaces:**

- Consumes: `coreFacts.unprojectedOperations.groups[].markers[]` の `{ indexPath: string, line: number }`、既存 `evaluateSelectedOperationReadiness(documentSet, coreFacts, { operation })`。
- Produces: `unprojectedMarkerLinesByPath(coreFacts): Map<string, Set<number>>` と、optional `excludedLines` を受ける `incompleteMarkers(file, { excludedLines })`。公開される readiness 戻り値の shape は変更しない。

- [x] **Step 1: RED fixture と exact corpus assertions を追加する**

  - valid document set は既存 canonical flat-operation fixture と同じ `create-order` operation を持たせ、root metadata を `coverage: requires-source | knowledge: complete` とする。root に次の direct marker を追加し、通常 validation は valid、root aggregate state は `requires-source` のままにする。

    ```markdown
    ## Unprojected Operations

    **unsupported**: localized: source operation source-a 12:legacy-order: source operation cannot be projected from source.json#/operations/1
    ```

  - source-aware invalid fixtures は一件一違反とし、次の入力をそれぞれ登録する。

    ```json
    {"cases":[{"sourceOperationId":"operation-missing-identity","sourceId":"source-a","operationIdentity":null,"publicationSafeLocation":"source.json#/operations/2"}]}
    ```

    ```json
    {"cases":[{"sourceOperationId":"operation-missing-location","sourceId":"source-a","operationIdentity":"safe-operation","publicationSafeLocation":null}]}
    ```

  - `cases.json` と `unprojectedCaseIds` に三件を追加する。`executes the Task 9 Unprojected Operations corpus and fixes audit retrieval` で、valid fixture の `create-order` readiness と invalid facts / diagnostic を exact match する。

    ```js
    assert.deepEqual(coreValidator.evaluateSelectedOperationReadiness(
      readinessDocumentSet,
      readinessValidation.facts.core,
      { operation: "create-order" }
    ), {
      operation: "create-order",
      ready: true,
      selectedPaths: ["CONVENTIONS.md", "INDEX.md", "channels/orders.md"],
      blockingMarkers: []
    });
    assert.deepEqual(missingIdentity.facts.unprojectedSourceExpectations, [{
      sourceOperationId: "operation-missing-identity",
      expectation: "generation-failure",
      reason: "publication-safe-operation-identity-unavailable"
    }]);
    assert.deepEqual(missingLocation.facts.unprojectedSourceExpectations, [{
      sourceOperationId: "operation-missing-location",
      expectation: "generation-failure",
      reason: "publication-safe-source-location-unavailable"
    }]);
    for (const result of [missingIdentity, missingLocation]) {
      assert.deepEqual(result.diagnostics.map(({ ruleId, severity }) => ({ ruleId, severity })), [
        { ruleId: "DM-IDX-008", severity: "error" }
      ]);
    }
    ```

  - 同じ test で trust boundary も固定する。fixture の root に facts 未登録の `**unknown**:` 行だけを追加した scan は `[{ kind: "unknown", path: "INDEX.md" }]` で blocking になり、同じ fixture を `unprojectedOperations: null` facts で評価した scan は `[{ kind: "unsupported", path: "INDEX.md" }]` で blocking になることを exact match する。

- [x] **Step 2: focused test を実行して現行 evaluator の失敗を確認する**

  - Run: `node --test --test-name-pattern="Task 9 Unprojected Operations" docai-messaging/tools/tests/core-corpus.test.mjs`
  - Expected: corpus validation 自体は通るが、`create-order` の readiness が root の unrelated `unsupported` marker により `false` となり、`ready: true` assertion が FAIL する。

- [x] **Step 3: facts-driven line exclusion を最小実装する**

  - `core.mjs` に次の boundary を実装する。`incompleteMarkers` の既存 caller は default の空 set を使うため、aggregate metadata semantics は変わらない。

    ```js
    function incompleteMarkers(file, { excludedLines = new Set() } = {}) {
      const scanned = scanMarkdown({ text: file.content, file: file.path });
      if (scanned.value === null) return { unknown: false, unsupported: false };
      const eligible = (line) => !line.inFence && !excludedLines.has(line.line);
      return {
        unknown: scanned.value.lines.some((line) => (
          eligible(line) && line.text.startsWith("**unknown**: ")
        )),
        unsupported: scanned.value.lines.some((line) => (
          eligible(line) && line.text.startsWith("**unsupported**: ")
        ))
      };
    }

    function unprojectedMarkerLinesByPath(coreFacts) {
      const linesByPath = new Map();
      for (const group of coreFacts?.unprojectedOperations?.groups ?? []) {
        for (const marker of group.markers ?? []) {
          if (typeof marker.indexPath !== "string" || !Number.isInteger(marker.line)) continue;
          if (!linesByPath.has(marker.indexPath)) linesByPath.set(marker.indexPath, new Set());
          linesByPath.get(marker.indexPath).add(marker.line);
        }
      }
      return linesByPath;
    }
    ```

  - operation row が存在する branch で map を一度作り、各 `selectedPath` の scan に `excludedLines: linesByPath.get(selectedPath) ?? new Set()` を渡す。row 不在 branch は変更しない。

- [x] **Step 4: focused regression、trust-boundary regression、既存 unrelated-marker regression を通す**

  - Run: `node --test --test-name-pattern="Task 9 Unprojected Operations|unrelated marker" docai-messaging/tools/tests/core-corpus.test.mjs docai-messaging/tools/tests/document-set.test.mjs`
  - Expected: 新しい direct-root fixture、facts 未登録 marker の blocking、facts 不在時の conservative fallback、既存 unrelated-channel test がすべて PASS。root metadata は `requires-source` のままで、validated Unprojected marker だけが selected scan から除外される。

- [x] **Step 5: corpus one-invalidity expectation と coverage docs を更新する**

  - invalid manifest が 132 件から 134 件になるため `audits every Task 9 invalid fixture as one primary concern` の expected `audited` を `134` に更新する。
  - `COVERAGE.md` の `R8-CORE-012` に新しい valid case と二つの invalid caseを追加し、checker evidence に exact source facts / selected-readiness assertion を明記して status を `covered` にする。
  - この TODO の task checkbox を完了し、facts-driven exclusion、三 fixture、one-invalidity 134/134、既存 semantics 非変更を implementation note に記録する。

- [x] **Step 6: checkpoint 全体を検証する**

  - Run: `node --test docai-messaging/tools/tests/*.test.mjs`
  - Expected: 全 test PASS、Core corpus failures 0、one-invalidity audit 134/134。
  - Run: `git diff --check`
  - Expected: 出力なし。
  - Read-only review: `git status --short` と `git diff --stat` で上記 Files 以外の変更がないことを確認する。

- [x] **Step 7: ユーザーの commit checkpoint で停止する**

  - Suggested commit message: `fix(messaging): isolate unprojected readiness markers`

#### Decoded Perspective Exactness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan step-by-step in the current workspace. Subagent execution is not part of this checkpoint. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** decoded `perspective` の exact value preservation と Unicode normalization を行わない set-wide strict comparison を versioned Core corpus evidence で固定し、`R8-CORE-015` を `covered` にする。

**Architecture:** production parser と `validateDocumentSet` の strict string comparison は変更せず、既存の task-scoped identity fixture pattern に NFC / NFD だけが異なる独立 document set を追加する。corpus test は表示文字列だけでなく literal code-point sequence、raw inequality、NFC-normalized equality、canonical escaped value の decoded result、単一 primary diagnostic を直接検証する。

**Tech Stack:** Node.js ESM、`node:test` / `node:assert/strict`、versioned Markdown / JSON fixture corpus、既存 `loadDocumentSet` / `validateDocumentSet` / `parseOpeningMetadata` helpers。

##### Global Constraints

- `README.md` §3.1 / §3.2 / §8 と承認済み設計の normative semantics を変更しない。
- `perspective` の比較前に Unicode normalization、case folding、trim を追加しない。
- normalization-only fixture は他の metadata、document structure、`set_id`、`projection_id` を一致させ、primary concern を `DM-ID-007` 一件に限定する。
- NFC / NFD の判別は source rendering に依存せず、literal code-point arrays `[99, 97, 102, 233]` と `[99, 97, 102, 101, 769]` で固定する。
- canonical metadata fixture の expected decoded value は JavaScript string `"店舗 service|west\\edge"` とし、escaped pipe と escaped backslash の両方を検証する。
- manifest は 180 cases / 135 invalid cases、one-invalidity audit は 135/135 とする。
- Git は read-only inspection に限定し、コミットはユーザーが行う。

##### Task 1: `R8-CORE-015` の fixture、exact assertions、coverage を一つの TDD checkpoint で完成させる

**Files:**

- Create: `docai-messaging/fixtures/core/v0.17.1/focused/invalid/identity-perspective-normalization-mixed/INDEX.md`
- Create: `docai-messaging/fixtures/core/v0.17.1/focused/invalid/identity-perspective-normalization-mixed/CONVENTIONS.md`
- Modify: `docai-messaging/fixtures/core/v0.17.1/cases.json`
- Modify: `docai-messaging/tools/tests/core-corpus.test.mjs`
- Modify: `docai-messaging/fixtures/core/v0.17.1/COVERAGE.md`
- Modify: `docai-messaging/TODO-docai-messaging-fixtures-1.md`

**Interfaces:**

- Consumes: `loadDocumentSet(rootDir).files[].metadata.perspective`、`validateCase(fixturePath, fixtureCase)`、既存 `metadataAndSentenceCaseIds` / `identityCaseIds` corpus grouping。
- Produces: versioned case `identity-perspective-normalization-mixed` と exact-value regression assertions。production module の export、diagnostic shape、validation semantics は変更しない。

- [x] **Step 1: manifest と exact corpus assertions を先に追加する**

  - `cases.json` の `identity-perspective-mixed` の直後に次の case を登録し、`identityCaseIds` に同じ ID を ASCII lexical order で追加する。この時点では fixture directory をまだ作らない。

    ```json
    {
      "id": "identity-perspective-normalization-mixed",
      "kind": "task-scoped-document-set",
      "path": "focused/invalid/identity-perspective-normalization-mixed",
      "expected": "invalid",
      "expected_rule_ids": ["DM-ID-007"]
    }
    ```

  - metadata corpus test で canonical case を直接 parse し、decoded value を exact match する。

    ```js
    const canonicalCase = byId.get("metadata-canonical-extensions-and-escapes");
    const canonical = validateCase(
      path.join(corpusPath, canonicalCase.path),
      canonicalCase
    );
    assert.equal(canonical.value.perspective, "店舗 service|west\\edge");
    ```

  - identity corpus test で新規 document set を load し、root / conventions の decoded code points と比較 semantics、単一 diagnostic を exact match する。

    ```js
    const normalizationCase = byId.get("identity-perspective-normalization-mixed");
    const normalizationPath = path.join(corpusPath, normalizationCase.path);
    const normalizationSet = loadDocumentSet(normalizationPath);
    const indexPerspective = normalizationSet.files
      .find((file) => file.path === "INDEX.md").metadata.perspective;
    const conventionsPerspective = normalizationSet.files
      .find((file) => file.path === "CONVENTIONS.md").metadata.perspective;
    const codePoints = (value) => [...value].map((character) => character.codePointAt(0));

    assert.deepEqual(codePoints(indexPerspective), [99, 97, 102, 233]);
    assert.deepEqual(codePoints(conventionsPerspective), [99, 97, 102, 101, 769]);
    assert.notEqual(indexPerspective, conventionsPerspective);
    assert.equal(indexPerspective.normalize("NFC"), conventionsPerspective.normalize("NFC"));

    const normalization = validateCase(normalizationPath, normalizationCase);
    assert.deepEqual(
      normalization.diagnostics.map(({ ruleId, severity }) => ({ ruleId, severity })),
      [{ ruleId: "DM-ID-007", severity: "error" }]
    );
    ```

- [x] **Step 2: focused test を実行して fixture evidence が未作成のため失敗することを確認する**

  - Run: `node --test --test-name-pattern="Task 9 metadata|Task 9 identity" docai-messaging/tools/tests/core-corpus.test.mjs`
  - Expected: metadata exact decoded-value assertion は PASS する一方、新規 identity case は fixture directory が存在しないため FAIL し、manifest entry だけでは `R8-CORE-015` evidence が成立しないことを確認できる。

- [x] **Step 3: normalization-only task-scoped document set を作成する**

  - `identity-perspective-mixed` の `INDEX.md` / `CONVENTIONS.md` を byte-for-byte の構造 baseline とし、opening metadata の `perspective` だけを次の値へ置換する。他の opening metadata、body、identity trailer は変更しない。
  - `INDEX.md` は NFC の一 scalar `é` を使う。

    ```markdown
    > docai-messaging: 0.17.1 | profile: full | perspective: café | coverage: complete | knowledge: complete | source_refs: all
    ```

  - `CONVENTIONS.md` は ASCII `e` と combining acute accent U+0301 を使う。editor normalization を検知する authority は source 表示ではなく Step 1 の code-point assertion とする。

    ```markdown
    > docai-messaging: 0.17.1 | profile: full | perspective: café | coverage: complete | knowledge: complete | source_refs: all
    ```

  - `INDEX.md` の Sources / Operations / Workflows と `CONVENTIONS.md` の全 canonical subsection、および両 identity trailer は baseline から変更せず、task-scoped validation が digest recomputation を要求しない既存 boundary を利用する。

- [x] **Step 4: focused regression を通して exact comparison を確認する**

  - Run: `node --test --test-name-pattern="Task 9 metadata|Task 9 identity" docai-messaging/tools/tests/core-corpus.test.mjs`
  - Expected: canonical decoded value、両 code-point arrays、raw inequality、NFC equality、単一 `DM-ID-007` diagnostic、focused corpus failures 0 がすべて PASS する。

- [x] **Step 5: one-invalidity count、coverage matrix、TODO を更新する**

  - `audits every Task 9 invalid fixture as one primary concern` の expected `audited` を `134` から `135` に更新する。
  - `COVERAGE.md` の `R8-CORE-015` invalid fixtures に `identity-perspective-normalization-mixed` を追加し、checker evidence に exact decoded-value / code-point assertions を明記して status を `covered` にする。
  - `Remaining Core Inventory` から `R8-CORE-015` の gap 記述を除き、同 row が covered になった事実を記録する。`R8-CORE-001` は残り clause があるため `partial` のままにする。
  - この TODO の `R8-CORE-015` gap checkbox と本 plan の steps を完了し、180 cases / 135 invalid cases、one-invalidity 135/135、production semantics 非変更、検証結果を implementation note に記録する。

- [x] **Step 6: checkpoint 全体を検証する**

  - Run: `node --test docai-messaging/tools/tests/*.test.mjs`
  - Expected: 全 test PASS、Core corpus failures 0、one-invalidity audit 135/135。
  - Run: `git diff --check`
  - Expected: 出力なし。
  - Read-only review: `git status --short` と `git diff --stat` で Files に列挙した対象以外の変更がないこと、および production files に差分がないことを確認する。

- [x] **Step 7: ユーザーの commit checkpoint で停止する**

  - Suggested commit message: `test(messaging): cover decoded perspective exactness`

**Review gate:** `docai-messaging/README.md` §8 の Core corpus 要件（現在の 1031–1043 行）に uncovered 行がないことを確認する。

**Suggested commit message:** `test(messaging): complete core conformance fixtures`

---

### Task 10: Core Checker と先行公開 Gate を完成させる

**Files:**

- Create: `docai-messaging/tools/check-core-fixtures.mjs`
- Modify: `fixture-runner.mjs`
- Modify: Core `README.md` and `COVERAGE.md`

- [ ] **Step 1: read-only CLI を実装する**
  - default corpus は `fixtures/core/v0.17.1`。
  - optional positional path で candidate corpus を検証できる。
  - restamp は Task 4 の専用 helper に限定し、この CLI は file を変更しない。

- [ ] **Step 2: checker self-tests を追加する**
  - valid corpus の mutation copy を tmp directory に作り、metadata、digest、INDEX row、marker propagation を一箐所ずつ壊して拒否を確認する。

- [ ] **Step 3: full Core command を実行する**
  - Run: `node --test docai-messaging/tools/tests/*.test.mjs`
  - Expected: 全 test PASS。
  - Run: `node docai-messaging/tools/check-core-fixtures.mjs`
  - Expected: 全 cases PASS、未使用 rule 0、coverage gap 0。

- [ ] **Step 4: Core publication review を記録する**
  - format compliance、contract completeness、reader-relative readiness を別々に判定する。
  - publication scope identity/version と adapter mapping identity/version を out-of-band metadata に記録する。
  - design-review draft から Compatibility Core implementation target へ変更する README edit は、fixture review 後の別 change set とする。

- [ ] **Step 5: stop rule を適用する**
  - normative meaning、fixture expectation、checker rule のいずれかがレビュー中に変わった場合は公開を止め、仕様バージョンと fixture version を再評価する。

**Exit criteria:** Core checker、coverage matrix、source traceability、人手レビューが全て完了し、Core 外構造を implementation-ready と誤表示していない。

**Suggested commit message:** `feat(messaging): gate the compatibility core fixture release`

---

### Task 11: Complete Surface Validator と Full/Compact Equivalence を作る

**Files:**

- Create: `docai-messaging/tools/lib/validators/complete.mjs`
- Create: `docai-messaging/tools/check-complete-fixtures.mjs`
- Add tests under `docai-messaging/tools/tests/`

- [ ] Workflow、Workflow Shards、Reference Material、selective conventions、variants、non-JSON adapters、compact profile を complete scope として有効化する。
- [ ] full/compact path、routing form、projection identity、coverage、knowledge、source_refs parity を検証する。
- [ ] expanded comparison view を実装し、profile link、identity、`x-`、example canonicalization、`field_defaults`、`same_as` 以外の差を拒否する。
- [ ] `field_defaults` の logical column reconstruction、order、duplicate、unknown/inapplicable column、`Meaning=none` を検証する。
- [ ] `same_as` の backward same-file target、paired full canonical equality、retrieval-unit discoverability、incomplete target rejection を検証する。
- [ ] invalid compact example fence/info string、prose mismatch、standard heading/marker/table/example/order mismatch を検証する。
- [ ] Run: `node --test docai-messaging/tools/tests/*.test.mjs`
- [ ] Expected: 全 test PASS。

**Review gate:** compact checker 自身が full projection の contract を推測せず、paired full set の exact canonical view とだけ比較する。

**Suggested commit message:** `feat(messaging): validate complete full and compact surfaces`

---

### Task 12: Complete Candidate の Full/Compact Set と Advanced Structures を作る

**Files:**

- Create: files under `docai-messaging/fixtures/complete-candidates/v0.17.1/`

- [ ] Core source scenario を拡張し、required/supplemental workflows、Reference Material、multiple source/index shards を追加する。
- [ ] full set に flat と sharded catalog の代表を含め、各 shard の false-positive/fallback retrieval task を定義する。
- [ ] workflow の全 section を expanded/none/unknown/unsupported で表す separate cases を作る。
- [ ] Reference Material の instruction authority、fence length、UTF-8 normalization、forbidden target cases を作る。
- [ ] tagged/untagged polymorphism、raw binary、adapter-defined structured non-JSON representation を作る。
- [ ] compact set を full と同じ paths で作り、compact example、field defaults、same-as、selective conventions を実際に使う。
- [ ] complete candidate の同じ explicit projection-input manifest を `--projection-manifest <candidate-manifest-path>` で指定し、`restamp-document-set.mjs --write` で full/compact root を個別に restamp する。manifest は auto-discover せず、同じ manifest での dry-run 再実行が両方 `restamp required: no` になることを確認する。
- [ ] source traceability を complete structures まで拡張する。
- [ ] Run: `node docai-messaging/tools/check-complete-fixtures.mjs`
- [ ] Expected: valid full/compact pair と既存 Core cases が全 PASS。

**Review gate:** advanced structure を使わない selected operation が unrelated advanced marker のために blocked にならないことを確認する。

**Suggested commit message:** `test(messaging): add complete full and compact candidate sets`

---

### Task 13: Complete Surface Focused Corpus を完成させる

**Files:**

- Create: complete candidate `focused/valid/*.md`
- Create: complete candidate `focused/invalid/*.md`
- Modify: complete candidate `cases.json` and `COVERAGE.md`

- [ ] Profile fallback、unknown profiles、full/compact path/routing parity。
- [ ] Direct/sharded workflows、routing name/display title、exact/semantic/load-all selection。
- [ ] Workflow intro sentence grammar、section states、list/table constraints、deviation placement。
- [ ] Reference Material fence、embedded backticks、structural escape、non-UTF-8 rejection。
- [ ] selective convention dependency closure over required workflows と supplemental/direct fallback。
- [ ] reply-prefixed routing、whole-Reply unknown identity/message-set/channel forms。
- [ ] stable-name override、derived names、128-bit collision expansion、remaining collision failure。
- [ ] every binding scope、adapter tuple unique/absent/duplicate mapping、rule-version digest coverage。
- [ ] non-JSON schema/wire/header combinations、opaque raw binary、structured-as-raw rejection。
- [ ] tagged/untagged variants、delimiter/JSON/const equality、missing-field fallback。
- [ ] `field_defaults` valid/invalid reconstruction と token-savings assertion boundary。
- [ ] `same_as` valid/invalid targets、paired-full comparison、retrieval unit、failure shape prohibition。
- [ ] exact JSON arbitrary precision を compact examples、same-as、variant、constraints で横断検証。
- [ ] complete workflow section states と expanded list/table invalid forms。
- [ ] future-minor synthetic reader compatibility fixtures（metadata key、table suffix、`x-` order）。
- [ ] `docai-messaging/README.md` §8 の complete-surface corpus 要件（現在の 1045–1049 行）を `COVERAGE.md` に一対一対応させる。
- [ ] Run: `node docai-messaging/tools/check-complete-fixtures.mjs`
- [ ] Expected: coverage gap 0、全 cases PASS。

**Review gate:** Core fixtures だけから complete surface compatibility を推論していないことを確認する。

**Suggested commit message:** `test(messaging): complete advanced surface fixture coverage`

---

### Task 14: Token Measurement Evidence を作る

**Files:**

- Create: `docai-messaging/tools/build-token-evidence.py`
- Create: `docai-messaging/tools/token-evidence-requirements.txt`
- Create: complete candidate `evaluations/tasks.json`
- Create: complete candidate `evaluations/retrieval-runs.json`
- Create: complete candidate `TOKEN-EVIDENCE.md` and `evaluations/RESULTS.md`

- [ ] `token-evidence-requirements.txt` に `tiktoken==0.13.0` を固定する。
- [ ] tokenizer は `o200k_base`、count input は exact UTF-8 loaded context とする。
- [ ] representative task corpus に SEND construction、RECEIVE handling、reply handling、failure recovery、workflow completion を含める。
- [ ] 各 task で root row considered、loaded shards、false positives、load-all、profile fallback、whole-CONVENTIONS fallback、required/supplemental paths を記録する。
- [ ] DocAI full、DocAI compact、reference-resolved AsyncAPI baseline に同じ client-visible contract と task boundary を与える。
- [ ] format-specific parser instruction tokens と retrieval tool-result tokens を各方式の total に含める。
- [ ] per-task totals と nearest-rank p50/p95/max を計算する。
- [ ] compact/sharding/selective convention が total task tokens を増やす case は regression として開示し、その scope への無条件 savings claim を禁止する。
- [ ] cache/billed-token claim は、この初版では行わない。将来行う場合だけ README §6.2 の cold/warm sequence と provider cache evidence を別計画で追加する。
- [ ] Run: `python3 docai-messaging/tools/build-token-evidence.py docai-messaging/fixtures/complete-candidates/v0.17.1/evaluations/tasks.json`
- [ ] Expected: deterministic `retrieval-runs.json` と `RESULTS.md`、同じ input で byte-identical 再生成。

**Review gate:** `characters / 4`、provider-reported usage、`o200k_base` の結果を混在させない。

**Suggested commit message:** `test(messaging): publish reproducible token evidence`

---

### Task 15: `v1.0.0-rc.1` Corpus を作り、Review Loop を閉じる

**Files:**

- Create: `docai-messaging/fixtures/release-candidates/v1.0.0-rc.1/`
- Create: RC `SEMANTIC-DRIFT-AUDIT.md` and `REVIEW.md`
- Create: `docai-messaging/tools/check-conformance-fixtures.mjs`

- [ ] Core と complete candidate の reviewed source、sets、focused cases、evidence を RC directory へ固定する。
- [ ] RC document set の `docai-messaging` は prerelease suffix を使わず `1.0.0` とする。README と fixture README の publication label に `v1.0.0-rc.1` を記録する。
- [ ] specification version の `0.17.1` → `1.0.0`、publication scope identity、adapter mapping version、reviewed RC projection manifest を同じ RC change set で更新し、`restamp-document-set.mjs [--write] --projection-manifest docai-messaging/fixtures/release-candidates/v1.0.0-rc.1/source/projection-input-manifest.json <RC-root>` として全 document set を restamp する。RC manifest は auto-discover しない。
- [ ] candidate との差を heading/marker/table/example/prose/source fact ごとに分類する。
- [ ] semantic drift がある差は再評価対象、identity/provenance wording のみの差は no-resubmit 理由を記録する。
- [ ] checker を RC path に対して実行し、Core と complete 全 rule を検証する。
- [ ] source-aware reviewer が各 generated fact と authoritative source を再照合する。
- [ ] independent reviewer checklist で blocker、wording issue、future backlog、open question を分離する。
- [ ] RC review で normative meaning、fixture expectation、checker behavior が変わった場合は stable 化を止め、README §3.1 で version impact を判断し `v1.0.0-rc.2` を作る。
- [ ] 変更が publication wording のみになるまで RC review loop を繰り返す。
- [ ] Run: `node docai-messaging/tools/check-conformance-fixtures.mjs docai-messaging/fixtures/release-candidates/v1.0.0-rc.1`
- [ ] Expected: 全 cases PASS、coverage gap 0、review blocker 0。

**Review gate:** RC tag 相当の corpus を後から書き換えず、修正は次の RC directory に積む。

**Suggested commit message:** `test(messaging): prepare the v1.0.0 release candidate corpus`

---

### Task 16: Stable `v1.0.0` Conformance Corpus を Freeze する

**Files:**

- Create: `docai-messaging/fixtures/conformance/v1.0.0/`
- Create: `docai-messaging/tools/check-release-readiness.mjs`
- Modify: `docai-messaging/README.md` publication wording only after freeze approval
- Create: `docai-messaging/CHANGELOG.md`
- Create: `docai-messaging/RELEASE.md`

- [ ] reviewed final RC の source、valid sets、focused fixtures、checker expectations、evidence を byte-for-byte stable corpus へ固定する。
- [ ] docs-root-relative path が変わらないため full/compact set digests が final RC と一致することを確認する。
- [ ] stable files は restamp しない。final RC を byte-for-byte copy した後、stable root の `projection_digest` / `projection_id` / `set_digest` / `set_id` が final RC と一致する digest parity を read-only に検証する。
- [ ] stable `COVERAGE.md` が README §8 の Core/complete/future-minor requirements をすべて指すことを確認する。
- [ ] stable `SOURCE-TRACEABILITY.md` が全 source fact domain を覆うことを確認する。
- [ ] stable `REVIEW.md` の blocker、wording issue、open question が 0 であることを確認する。
- [ ] `check-release-readiness.mjs` に spec version、publication label、required files、checker pass、coverage gap、RC/stable digest parity を実装する。
- [ ] Run: `node --test docai-messaging/tools/tests/*.test.mjs`
- [ ] Expected: 全 test PASS。
- [ ] Run: `node docai-messaging/tools/check-conformance-fixtures.mjs docai-messaging/fixtures/conformance/v1.0.0`
- [ ] Expected: 全 cases PASS。
- [ ] Run: `node docai-messaging/tools/check-release-readiness.mjs`
- [ ] Expected: `DocAI Messaging v1.0.0 release readiness: PASS`。
- [ ] Run: `git diff --check`
- [ ] Expected: output なし、exit code 0。
- [ ] final preparation 中に normative behavior、fixture、checker expectation、compatibility boundary の変更が必要になった場合は stable 化を中止し、新しい RC へ戻る。
- [ ] tag、push、release publication はユーザーが明示的に実行する。agent は指示なしに Git state を変更しない。

**Exit criteria:** stable README、versioned conformance corpus、checker、source traceability、coverage、token evidence、review record が同じ contract boundary を示し、再現可能な全検証が PASS する。

**Suggested commit message:** `release(messaging): freeze the v1.0.0 conformance corpus`

---

## Final Review Checklist

- [ ] `docai-messaging/README.md` の各 normative section が rules.json の rule または明示的な non-machine-checkable review item に対応している。
- [ ] Core と complete surface の coverage を混同していない。
- [ ] valid fixture は README に対する新しい normative requirement を暗黙に追加していない。
- [ ] invalid fixture は primary rule を一つに絞り、expected rule ID が安定している。
- [ ] checker の parser、validator、corpus expectation が分離されている。
- [ ] source-aware validation と ordinary reader validation が分離されている。
- [ ] full/compact comparison が README §3.4 で許可された差だけを除外している。
- [ ] token evidence が README §6.2 の total-task accounting を満たす。
- [ ] RC 以降の corpus が immutable で、meaning-changing change は新しい version/RC に分離される。
- [ ] stable release gate が README、fixture、checker、evidence の同時 freeze を要求する。

## Implementation Handoff

Task 1 から順番に実行する。Task 1–7 は checker foundation、Task 8–10 は Compatibility Core、Task 11–14 は complete generator surface、Task 15 は RC hardening、Task 16 は stable freeze である。後段 task は前段の exit criteria を満たすまで開始しない。
