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

- [ ] **Step 5: Reply grammar を RED→GREEN で実装する**
  - Reply の `none` / whole-section `unknown` / replacement `unsupported` / expanded state、channel/correlation/timeout keys、static/dynamic channel を検証する。
  - reply message set/address/selection fallback、direction reversal、reply INDEX entries の一致を検証する。
  - `DM-REPLY-001`〜`DM-REPLY-003` を state、keys/channel、selection/routing に割り当てる。

- [ ] **Step 6: Failure Handling と common/inline shape を RED→GREEN で実装する**
  - Failure Handling の core states、canonical leading deviation、`Failure | Signal | Condition | Action` table、Action recovery state を検証する。
  - `common:<label>` / `inline:<label>` の exact whole-cell reference と unique resolution、expanded/replacement shape、Message subsection collapse を共有 grammar で検証する。
  - `DM-FAIL-001`〜`DM-FAIL-003` を state/deviation、table/reference、inline shape、`DM-CONV-004` を common shape に割り当てる。

- [ ] **Step 7: Task 6 integration と rule correspondence を確認する**
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

**Files:**

- Modify: `docai-messaging/tools/lib/validators/core.mjs`
- Modify: `docai-messaging/fixtures/rules.json`
- Test: `docai-messaging/tools/tests/document-set.test.mjs`

- [ ] **Step 1: `none` / `unknown` / `unsupported` / conflict matrix を test 化する**
  - missing knowledge、known unrepresentable、known absence、equally authoritative conflict を別結果にする。
  - file/root coverage と knowledge propagation、unrelated marker の selected-operation non-blocking behavior を検証する。

- [ ] **Step 2: partial unnamed collection cases を test 化する**
  - named siblings retained、collection-level marker、no synthetic row、canonical example omissionを検証する。
  - no-sibling Headers/Parameters と representation-local payload form を区別する。

- [ ] **Step 3: perspective/counterpart cases を test 化する**
  - same-application carry-through、complete counterpart mapping、missing mapping、conflicting mapping、action-only inversion rejection を検証する。

- [ ] **Step 4: direct adapter boundary cases を test 化する**
  - AsyncAPI 3.0.0 / 3.1.0 schemaFormat default、registered aliases、JSON Schema Draft 07、parameterless JSON/+json wire、parameterized/unregistered wire unsupported を検証する。
  - header encoding/exposure と protocol binding mapping の有無を source-aware expectation として記録する。

- [ ] **Step 5: trust/publication-safety cases を test 化する**
  - prose、example、URL、schema string、metadata-like line、identity-like line、profile link、key list、fixed value、`x-` structure の escape attempt を含める。
  - known sensitive fact は non-disclosing `unsupported`、real credential/PII fixture は corpus 自体へ保存せず synthetic sentinel で拒否条件を表す。

- [ ] **Step 6: test を RED→GREEN で実装する**
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

- [ ] **Step 1: contract-complete source scenario を固定する**
  - storefront service perspective で SEND command、RECEIVE event、explicit reply を含む。
  - at-least-once、deduplication、ordering、ack/nack、failure recovery、authorization を behavior input に明記する。
  - main source は representable JSON payload/header schema と必要な behavior facts をすべて持ち、root `coverage: complete` / `knowledge: complete` を成立させる。
  - recursion、missing knowledge、zero-message selection は `source/focused/` の別 input に置き、contract-complete main set の projection manifest には含めない。

- [ ] **Step 2: AsyncAPI 3.0.0 と 3.1.0 selection source を main source から分離する**
  - operation `messages` explicit/omitted/empty と reply `messages` explicit/omitted/empty を source-level fixture に含める。
  - 同じ論理 API を表す場合も source ID、specification version、revision を別々に記録する。

- [ ] **Step 3: deterministic projection-input manifest を作る**
  - source exact SHA-256、perspective、precedence、counterpart mapping、adapter versions、stable-name overrides、publication policy identity を sorted-key JSON と LF で記録する。
  - manifest 自体の canonical serialization rule を fixture README に記載する。

- [ ] **Step 4: minimal-but-representative contract-complete full set を手作業で作る**
  - `INDEX.md`、全 convention headings、SEND/RECEIVE/reply/failure operation を作る。
  - source facts を projection し、推測で completeness を上げない。
  - main full set には `unknown` / `unsupported` を含めない。これらは別の focused document-set case に置き、root completeness の positive/negative 判定を独立させる。

- [ ] **Step 5: identity を helper で計算して固定する**
  - Run: `node docai-messaging/tools/restamp-document-set.mjs --write --projection-manifest docai-messaging/fixtures/core/v0.17.1/source/projection-input-manifest.json docai-messaging/fixtures/core/v0.17.1/valid/full`
  - Expected: projection digest、set digest、short IDs を更新する。
  - Run: `node docai-messaging/tools/restamp-document-set.mjs --projection-manifest docai-messaging/fixtures/core/v0.17.1/source/projection-input-manifest.json docai-messaging/fixtures/core/v0.17.1/valid/full`
  - Expected: `restamp required: no`、exit code 0。

- [ ] **Step 6: source traceability を全 fact domain で記録する**
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

- [ ] Metadata、extension name/order/escape、unknown non-`x-` key、sentence grammar。
- [ ] Identity trailer、set/projection digest、closed root、mixed set、task-scoped identity check。
- [ ] Direct/sharded Sources、unknown API identity/version、Revision none、overlap、fixed-point、cycle。
- [ ] Flat/hierarchical Operations、bounds、semantic load-all、false positive、path parity。
- [ ] Required/supplemental context、eligible/forbidden target、separator/order、`none` sentinel collision。
- [ ] Direct/sharded Unprojected Operations、multibyte identity、group collision、sensitive withholding。
- [ ] Same-application action、counterpart mapping complete/missing/conflicting。
- [ ] AsyncAPI 3.0.0/3.1.0 operation message explicit/omitted/empty selection。
- [ ] AsyncAPI 3.0.0/3.1.0 reply message explicit/omitted/empty selectionと INDEX omission。
- [ ] CONVENTIONS whole-section states、format semantics catalog、common/replacement failure shapes。
- [ ] Behavior six keys、delivery tokens、exactly-once qualification、unknown facts。
- [ ] Operation/channel/message/reply/failure binding scopes。
- [ ] SEND Required、RECEIVE Presence optional/condition/unknown、Nullable、nested ancestor semantics。
- [ ] whole payload unknown、representation-local field collection、partial named siblings、example omission。
- [ ] `$` root rows、root scalar/array/map/object、object openness、recursive unsupported。
- [ ] exact JSON constraint/equality、default_annotation/default、recognized/custom format behavior。
- [ ] parameterless JSON/+json、parameterized/unregistered wire、raw binary boundary、header encoding。
- [ ] Reply static/dynamic channel、correlation、timeout、whole-Reply fallback、no synthetic operation。
- [ ] Failure core states、deviations、common/inline shapes、receive malformed/unknown/handler errors。
- [ ] publication safety、unsafe mandatory value failure、instruction structural escape。
- [ ] canonical marker order、deviation placement、deprecated marker、single prose language、English structure。
- [ ] implementation readiness cases: same contract under different reader/runtime/adapter capabilities。

- [ ] **Step: one-invalidity audit を行う**
  - 各 invalid fixture に `expected_rule_ids` が一つの primary concern を示すことを確認する。
  - 複数の独立違反がある fixture は分割する。

- [ ] **Step: Core coverage matrix を完成させる**
  - README §8 の Core corpus 要件を一行ずつ `COVERAGE.md` に写し、source、valid fixture、invalid fixture、rule ID、checker test を対応付ける。

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
