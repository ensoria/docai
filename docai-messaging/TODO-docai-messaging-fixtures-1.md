# DocAI Messaging Fixture 初版 — 進捗と残作業

**目的:** DocAI Messaging `0.17.1` のCompatibility Coreからcomplete generator surface、RC、stable `v1.0.0` の再現可能なconformance corpusへ進む。

**整理日:** 2026-10-24。ユーザー依頼により、完了済みcheckpointの設計・TDD・途中検証・reviewの詳細ログをGit履歴へ委ね、現在状態と残作業へ集約した。整理前の全文はcommit `184066d` から参照できる。この整理は仕様・実装・作業順序・承認状態を変更しない。

## 正本と作業ルール

- 規範仕様は[README](README.md)、Core coverageは[Core COVERAGE](fixtures/core/v0.17.1/COVERAGE.md)、candidateのfact別根拠と認定範囲は[Complete SOURCE-TRACEABILITY](fixtures/complete-candidates/v0.17.1/SOURCE-TRACEABILITY.md)。実装・期待値と衝突したらREADMEの意味を先に確認する。
- [リポジトリAGENTS](../AGENTS.md)を守り、Gitは読取り専用。add / commit / stash / checkout / reset / fetch / pull / push / tag / config / worktree変更は行わない。コミットはユーザーが行う。
- 一度に1つの完了成果物をcheckpointとして進めて停止する。2026-10-29のユーザー要望により、次回から関連する複数gate・tests・証跡・完了判定をまとめ、原則1コミット相当とする。設計・計画・実装・受入をそれぞれ必ず別コミットにする運用は要求しない。同じ責務としてreview可能な範囲を保ち、独立した不具合や異なるrelease段階は無理に混ぜない。実装はTDD（RED→GREEN）、具体的な順序・scope変更は実装前に確認。完了済みcheckpointを再実装しない。
- 判断が必要なら各案の利点・欠点・推奨理由を示す。変更量の少なさを推奨理由にせず、仕様・設計・品質を優先する。
- 設計・影響・実測・残件を本TODOへ簡潔に記録する。終了時は変更概要、検証結果、review観点、残件、1行commit案を提示する。
- all-channel / operation-index shard / 比較済み五Workflow contributorの実装・検証は完了。projector `1.0.5` snapshotのmetadata / retrieval実レビュー結果と、全17役割のMATRIX-003有限closure監査結果は2026-10-29にそれぞれユーザー受入済み。次scopeの実装へ自動で進まない。

## 現在の到達点

| 項目 | 状態 / 根拠 |
|---|---|
| 仕様 / 公開範囲 | `0.17.1` / Draft、Compatibility Core implementation target。complete-generator-ready / compatibility-stable / stableではない。 |
| Task 1–7: checker foundation | 完了。parser、metadata / table / path / sentence、exact media type / JSON、identity / closed root / mixed set、Core構造、不完全情報 / adapters / trust boundary。 |
| Task 8–9: Core source / set / focused corpus | 完了。264 cases（193 invalid / 71 valid）、one-invalidity 193/193、unused Core rules 0、coverage gaps 0。`R8-CORE-001`–`049`はcovered、Remaining Core Inventoryに適用可能な未対応clauseなし。古い埋込み計画の未チェックstepを再開しない。 |
| Task 10: Core publication gate | 完了。[PUBLICATION.json](fixtures/core/v0.17.1/PUBLICATION.json)と[PUBLICATION-REVIEW](fixtures/core/v0.17.1/PUBLICATION-REVIEW.md)でscope / manifest / adaptersをbindingし、read-only CLIと人手reviewを公開gateにした。 |
| Task 11: complete validators | 下記の機能は実装済み。元計画のcomplete-scope一括完了判定は未完了として保持し、整理だけでTask全体を完了へ変えない。 |
| Task 12: complete positive candidate | 完了（現candidateの有限scope）。両profile各17 paths、11 operations、5 Workflows、1 Reference。MATRIX-001–005の有限gate / reviewとsource traceabilityを完了。汎用generator・whole-source completenessや公開readinessの認定ではない。 |
| Task 13–16 | complete focused corpus、token evidence、RC、stable freezeは未完了。後掲checklistを使う。 |

### 最新の検証済みbaseline（2026-10-31、Binding Grammar / Source Comparison Closure）

- 全suite: `node --test docai-messaging/tools/tests/*.test.mjs` → 2194 tests / 2193 pass / 1既存skip / fail 0 / cancelled 0、329228.19825 ms（2026-10-31、Binding Grammar / Source Comparison Closure）。
- skip: `validates source-shard evidence with the declared minimum Python 3.9`、python3.9未導入。Python最小版での実行成功を認定していない。
- Core checker: 264 cases / 193 invalid / one-invalidity 193/193 / unused rules 0 / coverage gaps 0。
- Complete checker: 17 paths、full/compact equivalent。pair一致だけでsource completeness / readinessを認定しない。
- Candidate: source四files＋explicit manifest、projector `1.0.5`、publication policy `1.0.0`。[Workflow snapshot / SHA記録](fixtures/complete-candidates/v0.17.1/SOURCE-TRACEABILITY.md#workflow-contributor-snapshot--2026-10-29)のmetadata / retrieval実結果は2026-10-29にユーザー受入済み。受入済みの[operation-shard snapshot](fixtures/complete-candidates/v0.17.1/SOURCE-TRACEABILITY.md#operation-shard-contributor-snapshot--2026-10-27)・[projector 1.0.3 snapshot](fixtures/complete-candidates/v0.17.1/SOURCE-TRACEABILITY.md#refreshed-contributor-snapshot--2026-10-27)・[旧language/semantic snapshot](fixtures/complete-candidates/v0.17.1/SOURCE-TRACEABILITY.md#finite-language-and-semantic-review--2026-10-24)のH evidenceを自動継承しない。
- language/semantic結果は2026-10-24にユーザーが受入（`67cb116`）。一般generator・将来snapshot・本番business / Kafka / OAuth品質、token効率・配置最適性の認定ではない。content / policy変更時は再reviewする。

## 初版完成までの見通し — 2026-10-31暫定棚卸し

完成とは既存Task 11–16のexit criteriaを満たすstable `v1.0.0` conformance corpusであり、任意入力の汎用generator / converterや全将来機能の実装ではない。Coreは完了、complete validators / 回帰testsとpositive pairは既存。candidateにはまだversioned focused corpus / cases.json / COVERAGE.md / 総task token evidenceがなく、RC / stable corpus・conformance / release-readiness CLIも未作成。Task 13の未チェック機能群は全て未実装という意味ではなく、既存code / testsを再利用して公開可能な証跡へ対応させ、不足だけをTDDで補う。

| 残る成果物 | 暫定checkpoint数 | 主な不確実性 |
|---|---|---|
| Bindings grammar / source比較の既知境界 | 完了（残0） | Message / failure-shapeのASCII-space tableとReply Channelの末尾拡張・empty heading formsをordinary / source照合で検証。Task 11全体の判定は別。 |
| Task 13 complete / first-1.x compatibility corpus・coverage / checker統合 | 4–6 | §8対既存証跡の一対一inventoryで判明する実装不足 |
| Task 14 総task token測定・公平なbaseline・再現性 / regression証跡 | 2–3 | retrieval会計とbaselineの同一contract化 |
| Task 15 RC corpus・version移行・source / semantic / independent review | 1–2 | hardcoded version境界とreview blocker / 追加RC |
| Task 16 stable freeze・readiness gate・最終検証 / 公開文書 | 1 | final RCがblockerなしであること |

残り合計8–12のまとまったcheckpointを仮置きする（Bindings grammar / source比較を1成果物として完了し、前回9–13から更新。Headers新規範はTask 13 / 15のversion移行と統合）。1単位は関連する設計・実装・tests・review・証跡まで揃えた成果物で、返信回数や既存の細分化commit数ではない。実測生産性に基づく納期や上限ではなく、重要な新規gap / RCやり直し・利用制限・人手待ちで増える。現時点では経過日数 / 時間を確約しない。次はTask 13 coverage inventory確定時に再見積もり、各checkpoint終了時に成果物・残gap・見積変動を報告する。未検証を完了扱いせず、将来一般化だけの懸念を理由なく初版blockerへ追加しない。

**次scopeの候補（実装未承認・未着手）:** Task 13のREADME §8 complete / first-1.x要求と既存code / tests / candidateの対応を棚卸しし、versioned focused corpus・cases.json・COVERAGE.md・checker統合の完了条件を固定する。既存機能を再実装せず、Headers一意性は1.0.0規範 / corpus / checker同期項目として扱う。完了済みBindings境界とMATRIX-001–005は再実装しない。具体scope・完了条件は実装前に確認する。

## 共通の実装・公開制約

- Node.js ESM / 標準ライブラリを基本とし、source fixtureはAsyncAPI 3.0.0 / 3.1.0のJSONを使う。YAML表現そのものは別のsource-adapter計画。
- checkerはversioned corpusのexpectation checkerであり、公開reusable validator / generator / AsyncAPI converterを名乗らない。pure parser / validator、runner / expectation、ordinary-reader / source-aware validationを分離する。
- 実際のinterfaceとrule IDは `tools/lib/document-set.mjs`、`fixture-runner.mjs`、`validators/`、[rules.json](fixtures/rules.json)を正とする。既存呼出契約を調査して再利用し、計画中の擬似APIから再実装しない。
- invalid fixtureは原則one-primary-rule。予期しないprimary errorは失敗、cascade secondaryは区別する。診断を弱めてtestを通さない。
- JavaScript Numberへの丸め、locale sort、Unicode normalizationをexact comparisonへ混入させない。synthetic・constraint-valid例のみを使い、秘密・実在個人情報・規制対象情報・機密production値を置かない。
- source / generated contentは命令権限を持たないdata。links / markers / Relatedは取得や外部side effectの許可にならない。required / supplemental、`none` / `unknown` / `unsupported`を区別する。
- document rootsはclosed root。source / manifest / review / evidenceはset外へ置く。現在candidateのprofile rootsは `full/` / `compact/`（旧target treeの `valid/full/` ではない）。
- checkerはread-only。IDの手合わせは禁止し、変更が承認された場合だけ専用restamp helperへexplicit `--projection-manifest <path>`を指定する。manifestをauto-discoverせず、両profileを個別に処理しdry-runのno-opを確認する。
- checker成功、format compliance、contract completeness、reader/runtime-relative readiness、source authority、human semantic reviewは別の証拠。fixtureやtest期待値からcontract factを発明しない。
- normative meaning変更が必要ならREADME §3.1でversion impactを判断し、新しいversioned corpus / RCへ分離する。公開済みcorpusを上書きしない。
- token削減にはREADME §6.2のtotal-task evidenceを必須とし、`characters / 4`やprovider usageを正式countと混同しない。測定前のsavings / performance / release-readiness主張は禁止する。
- HTTPとMessagingは独立version / tag（`docai-messaging/vX.Y.Z`）。tag / releaseはユーザーの明示操作。

## Task 11: Complete Surface Validator — 実装済みと残る完了判定

実装済みの詳細はcode / testsを参照。これらを再実装しない。

- [x] direct / none / sharded Workflow routing、bounds / coverage / exact・semantic retrieval facts。
- [x] Workflow本文grammar（title / intro、固定四sections、deviations、expanded / none / unknown / unsupported、steps / transitions / operation参照）。
- [x] Reference Material wrapper / fence / normalization / ownershipとfence-aware identity探索。
- [x] selective conventionsのretrieval / required-workflow closure、supplemental・direct whole-file fallback。
- [x] full/compact path / routing / projection / metadata parityとexpanded canonical comparison。
- [x] `field_defaults`のlogical columns / order / duplicate / applicability / Meaning復元。
- [x] `same_as`のbackward same-file target / direction / paired-full equality / retrieval-unit / incomplete-target拒否。
- [x] compact JSON / fence / value / prose / heading / marker / table / orderの等価性・不一致診断。
- [x] read-only Complete checker CLI。candidate作成後の既定path成功も検証済み。
- [ ] variants / non-JSON adaptersを含むcomplete-scope全体の有効化・証跡・完了判定を閉じる（Task 12–14の証拠と区別）。
- [ ] 完了判定時に全suiteを再実行し、既存skipと未検証環境を明記する。

既修正: source-audit fenced headings、staged restampのfenced identity誤認、compact `field_defaults` / `same_as`のLF / CRLF / CR / mixed論理行復元。元bytesとhash / stamp境界を維持する。一般extension・writer crash consistency / concurrent racesまで認定した修正ではない。

## Task 12: Complete Candidate — source traceabilityを完了する

対象: `fixtures/complete-candidates/v0.17.1/`。現在の実配置・根拠はcandidate [README](fixtures/complete-candidates/v0.17.1/README.md)と[SOURCE-TRACEABILITY](fixtures/complete-candidates/v0.17.1/SOURCE-TRACEABILITY.md)。

- [x] overlapping Source / Operation Shards、false-positive / fallback retrieval、required / supplemental contexts。
- [x] 五Workflowのexpanded / none / unknown / unsupported四section状態。
- [x] Reference Materialのno-authority、minimal fence、BOM / 改行 / trailing blank保持、target制約。
- [x] 六representation（CSV publication adapter、original / reused JSON、opaque raw、tagged / untagged variants）。
- [x] 同pathsのfull / compact、one-line examples / defaults / reuse / selective conventions代表例。
- [x] 同explicit manifestでのsource SHA binding / identity / no-op restamp。
- [x] source-aware有限gate: source / operation inventory、context selection、purpose / Behavior / Reply / failures、十五CONVENTIONS、Message schema / descriptions / examples、local binding absence、Workflow states、Reference、representations、compact representative policy、convention dependencies。
- [x] MATRIX-001: 現candidateのwhole-operation inventoryとcontext selection。
- [x] MATRIX-002の旧snapshot: labels / Summary / 配置 / Relatedの有限gateと2026-10-24のhuman受入。projector `1.0.3`への六metadata訂正後のsnapshotは別証跡で2026-10-27に実結果をユーザー受入（旧H evidenceの自動継承ではない）。
- [x] MATRIX-003（現snapshot有限scope）: 現projector `1.0.5`の両profile全17役割を監査し、source / policy / gate対応とcatalog cell / marker・root集約の根拠を記録。現attribution mismatch・未対応emitted roleなしの実結果を2026-10-29にユーザー受入。root固定`all`のordinary検証をwhole-root semantic proofと扱わず、将来owner / source合成・source completenessは認定しない。
- [x] MATRIX-004: 二primary Channel ownerの実source Parametersは省略 / 空objectだけを既知不在とし、missing owner / 非空 / malformedを拒否。両profileのbounded none比較を実装・検証。
- [x] MATRIX-005: 現13 domains / 8 descriptors / versions / perspective / empty mappingsの有限契約と実target / encoding / binding整合を検証。既存policy gates・正当な更新・Unicode値・一次診断を保持し、一般conflict resolverとは区別。
- [x] MATRIX-001–005の有限証拠・既存human受入・最終独立reviewの修正結果を合わせ、現candidateのTask 12 source-traceabilityを完了。全source memberや将来入力の一般変換を認定しない。
- [x] 最終gateでCore / Complete checkerを再実行。Core 264 / 193 invalid / unused 0 / gaps 0、Complete 17 paths等価。Task 13のcoverage gaps 0とは扱わない。

既知の別残件（順序・scope変更時は先に確認）:

- 一般Headers Name一意性は2026-10-31に案Aをユーザー承認。初版1.0.0の明文規範・versioned corpus・checker適用開始を同version change setへ揃える公開前必須項目とする。現0.17.1の一般禁止を追加せず、candidate source inventory gateと区別する。
- binding `none`後の`x-` markerをordinary validatorが拒否するextension gap。version impactも別途検討する。
- Reference sourceのfinal LFなし正例・source consumer除去の単独mutationは本checkpointで追加済み。再実装しない。
- Reference structural escape / non-UTF-8のversioned focused corpus、任意schema / adapter / extensionの一般的網羅性は後続Task 13。

### Language / Semantic Review Implementation Plan — 2026-10-23

実行・独立review・ユーザー受入は完了。docs-only TDD例外を事前承認し、四sources / manifest / 両profile全34文書を読み、39 SHAと17 paired-path根拠をSOURCE-TRACEABILITYへ固定した。Critical / Important / Minor指摘なし。詳細設計・実行ログは `67cb116`、現在の認定範囲は同auditを参照。意味の自動回帰gateを追加したわけではなく、変更時の再reviewが必要。

## 完了checkpoint: Storefront Contributor Closure（`7a496bf`）

以下は `184066d` の設計原文。pending等は提案時点の表記で、現在の承認状態は上記と実行計画を参照。

> **Proposed short design (storefront contributor closure checkpoint, 2026-10-24; design approval pending):** 起点main / `67cb116`、worktree clean。ユーザーはMATRIX-003の次checkpointとして、storefront channelとCONVENTIONSの二役割に対しsourceから寄与集合を導出し、明示listと`all`の適否を検証する推奨案の設計化を承認した。目的は、fixture assertionだけでCLIが見逃す過少申告を防ぎ、過剰申告や根拠のない`all`も正確な来歴として認定しないこと。README §3の`source_refs`定義と§8 / §6.1のrouting-provenance closureを正とし、既存出力やtest期待値を寄与sourceのauthorityにしない。
>
> **Approaches / selected tradeoff:** 採用案は寄与集合の完全一致検証。最終読者がtask-scopedに解決するsource集合と実際の根拠を一致させられる一方、既存testの保守的`all`前提は修正が必要になる。代替の「必要sourceを含めば受理」は欠落を検出できるが余分なsourceや不適切な`all`を正当化できないため採用しない。`all`時に全sourceを取得するreaderの安全fallbackと、producerが`all`を正確な来歴として出せる条件を区別する。過去のTODO / matrixの保守的fallback記録は履歴として残し、このcheckpointの対象二役割ではREADMEの完全集合条件が優先することを明記する。
>
> **Derivation / role boundaries:** source registry / source bindingと既存source-to-output比較が成功した後、専用のcandidate-only helperが根拠を集約する。CONVENTIONSの寄与は、実際に比較済みの十五sectionのbehavior factsとAsyncAPI server / security / API identity / message-contract factsから`storefront-behavior`と`storefront-asyncapi-3.1.0`の和集合になる。storefront channelは固定`channels/orders.md`ではなく、source-owned二operationsの実際のrouting / definition owner pathsで選ぶ。各対象fileに同居する全operationについて、本文だけでなくTask / Summary / 両context列 / Conventions等の行factも集約する。storefront operationはAsyncAPIのrouting / Message / SummaryとbehaviorのTask / Behavior / context selection等の両source、context-source operationは`complete-contexts`、representation operationは`complete-representations`が寄与する。file内unionを取るため整合した移動・分割・混在にも追従する。manifest自体を第五sourceとせず、context参照先の本文sourceを「参照された」だけで自動的にchannelへ伝播させない（参照行factの根拠と別file本文の根拠を区別）。既存の有限source契約を超える未判定factは出力から推測して通さない。
>
> **Comparison / cases:** 導出unionをSources registryの完全集合と比較し、全件が寄与すればexact `all`、それ以外はexact ASCII順・comma-space区切りlistを要求する。現在の二役割は両storefront sourceだけなのでlist二件が正解であり、片方欠落・無関係source追加・根拠のない`all`は拒否する。対象channelへcontext / representation operationsを整合配置した場合は各ownerの寄与を加え、四sourceが実際に揃う混在fileでは`all`を受理し四ID明示listは拒否する。両profileとchannel整合移動 / 分割 / 混在、routing-only寄与、body / row union、checker read-only性をTDDの負例・正例で確認する。existing placement / context-selectionのtestが無条件に`all`へ置換している場合、既知のfixture根拠に合うexact refsへ補正し、source比較やplacement受理を弱めない。
>
> **Impact / non-goals:** 実装予定は新candidate helperとsource-auditへの合成、focused / CLI regression、TODO / SOURCE-TRACEABILITYの境界記録。repository source四files / SHA・manifest / policy / projector `1.0.2`・full / compact全34 files / identities・Core corpus / 公開grammar / ordinary validatorsは不変、repository restampなし（testのtemporary candidateは既存手順で再stampしてordinary-validな入力を作る）。これによりMATRIX-002受入snapshotは変えない。storefrontを含まないsynthetic-only channel、root / operation shards、Workflow等の残るsemantic contributor closureは本checkpointで認定せず、既存Source-shard / Reference gateも変更しない。MATRIX-003全体、MATRIX-004–005、Task 12 / 14 / readinessは未完了を維持する。公開仕様を変えて`all`を万能escapeにすること、一般provenance推論器を作ることはanti-goal。
>
> **Execution / approval boundary:** この短い設計の承認後に実行計画を作成する。実装時はRED→GREEN、focused / 全suite / Core / Complete検証と独立read-only review、repository bytes不変確認を行い、結果・影響・既存test補正をTODOへ記録して1コミット相当で停止する。Git書込み・別worktreeなし。helperのexact API / test名・診断統合箇所は実行計画で確定する。現段階はTODOへの設計記録のみで、実装・test追加・matrix状態変更なし。

---

### Storefront Contributor Closure Implementation Plan — 2026-10-24

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:executing-plans`（主担当実行）またはユーザーが選択した場合の`superpowers:subagent-driven-development`。単一task / 1コミット相当、下記checkboxを追跡する。

**Goal / Spec:** 直前のshort designとREADME §3 / §6.1 / §8どおり、CONVENTIONSとstorefrontを含むchannelのexact contributor refsをsource-aware CLIで検証する。

**Architecture / Tech Stack:** Node.js ESM / `node:test`。既存source binding・inventory・fact比較を通過した入力から専用helperで寄与unionを導出し、両profileへ適用する。出力metadataから期待集合を逆算せず、既存placementの整合移動を維持する。

**Global Constraints:** 起点main / `3a111b2`、開始時clean。Git read-only / 別worktreeなし。repository source四files / SHA、manifest / policy、projector `1.0.2`、全34 profile files / identities、Core / 公開grammar / ordinary validatorsは変更・restampしない。test temporary copiesだけ既存helperでrestampする。MATRIX-003全体 / MATRIX-004–005 / Task 12・14 / readinessはopen。

**Files:** Create `tools/lib/complete-storefront-contributor-audit.mjs`、`tools/tests/complete-storefront-contributor-audit.test.mjs`。Modify `tools/lib/complete-candidate-source-audit.mjs`、既存`tools/tests/complete-channel-placement.test.mjs`と`complete-context-placement.test.mjs`のrefs期待、candidate `SOURCE-TRACEABILITY.md`と本TODO。pathsはすべて`docai-messaging/`相対。既存大規模CLI test fileの再構成はしない。

**Interface:** `auditStorefrontContributorClosure(sources, sourceIds, documentSet, coreFacts) -> string[]`をexport。`sources`は既存のsource-ID→parsed JSON Map、`sourceIds`はbinding検証済みregistry ID配列、`coreFacts`は既存complete検証の`facts.core`、返値はprofile prefixを付ける前のcandidate audit issue文字列。`source_refs`への書込みなし。

**Review Focus:** (1) filename固定を残さず移動 / 分割を受理、(2) 混在fileの全ownerとrow-only factsもunion、(3) `all`のreader fallbackとproducer exactnessを混同しない、(4) 参照先context本文のsourceを自動伝播しない、(5) source / ordinary一次診断時に新auditが例外やcascadeを起こさない。すべて下記testと最終独立reviewで確認する。

- [x] **1. RED: 実CLIの見逃しを先に固定。** 新test fileに既存CLI testのtemporary-copy / explicit-manifest restamp / ordinary pair検証 / checker bytes snapshot手順を使う。両profileを同じ値へ改変したCONVENTIONSとstorefront channelについて、片方source欠落・無関係ID追加・根拠なし`all`をtable-drivenに検査する。ordinary-valid / fresh identityを確認してから、`assert.equal(result.status, 1)`と`assert.match(result.stderr, /source_refs.*contributors/i)`を要求。`node --test docai-messaging/tools/tests/complete-storefront-contributor-audit.test.mjs`で現CLIのexit 0によるREDを確認し、setup失敗はREDと数えない。
- [x] **2. GREEN: 導出とsource-audit合成。** 上記helperを実装。owner registryはcontexts.operations / representations.representations / asyncapi.operationsを使い、重複・不明owner / registry欠落を失敗とし、registry順には依存しない。CONVENTIONSは検証済みstorefront二source、対象channelは二storefront operationsの実owner pathsを起点に全同居ownerを集約。storefront→二storefront IDs、context→complete-contexts、representation→complete-representationsを加え、registry全件なら`all`、それ以外はASCII順exact listを比較する。source auditの既存全fact比較後、issuesがないときだけ両profileへ呼び、`full:` / `compact:`付きの既存`Complete source traceability:`経路で報告する。RED testを同じcommandでGREENにする。
- [x] **3. 境界testをRED→GREEN。** 同fileへhelper / CLI testsを追加し、baseline二ID受理、片方だけのprofile改変（pair診断を維持）、移動・storefront分割、整合したcontext / representation混在を検証する。既存同file-backward reuseを壊さないよう六representationは一群で移動する。混在三sourceはexact三IDのみ、全四sourceを含むfileは`all`のみ受理し、四ID list・欠落・余分IDを拒否する。Task / Summary等row factのsource改訂＋対応row更新＋source再bindingでもbody不変で寄与を落とせないこと、context参照追加だけではcontext本文sourceを追加しないことを固定する。新helperは成功時`assert.deepEqual(issues, [])`、失敗時は対象pathとcontributors診断を要求。invalid source registry / 未所有operationは一次診断を保ちcrashしない。全CLI正負例でordinary validity（pair不一致testを除く）とchecker実行前後bytes一致を確認する。
- [x] **4. 既存integration補正とfocused検証。** channel/context placement testsの無条件`source_refs: all`を、そのtest source / owner unionのexact refsへ直す。test内temporary fixtureだけ変更しproductionのsource / placement / context gateを弱めない。`node --test docai-messaging/tools/tests/complete-storefront-contributor-audit.test.mjs docai-messaging/tools/tests/complete-channel-placement.test.mjs docai-messaging/tools/tests/complete-context-placement.test.mjs docai-messaging/tools/tests/check-complete-fixtures.test.mjs` → fail 0を確認する。
- [x] **5. 全体検証・独立review・停止。** 全suite、Core checker、Complete checkerを本TODO記載commandで実行しfail 0、Core 264 / 193 / one-invalidity 193/193 / unused 0 / gaps 0、Complete 17 paths等価を確認。既知Python 3.9 skipは別記する。SOURCE-TRACEABILITYに二役割だけの新gateと残るMATRIX-003範囲、過去`all`fallback前提との区別を短く記録する。fresh reviewer一名が設計 / 全差分 / 五Review Focusをread-only確認。最終`git diff --check`とread-only bytes比較でrepository source / manifest / profiles / Core不変を確認し、TODOへ最終結果・影響・残件を短く記録して停止。commit案: `test(messaging): enforce storefront contributor provenance`。

**Plan self-review:** 単一helperと既存audit合成の一垂直slice。欠落 / 過剰 / `all`はStep 1–3、移動 / 混在 / row-only / context境界はStep 3–4、一次診断と不変性はStep 3 / 5が所有する。設計からのscope拡張なし。計画記録だけでtest / production / matrix状態は未変更。実行方式は主担当実行＋最後に独立reviewを推奨（他taskへ分割しない一貫した寄与導出を確認するため）。

**Execution ledger:** ユーザーが計画と主担当実装＋最終独立reviewを承認。開始main / `1d880b6`、clean。Pre-flight: 単一taskで共有interface conflictなし。承認済みGit read-only / canonical TODO運用を優先し別worktree / skill workspaceは作らない。まずordinary-validな両profileのrefs変異八件で実CLIの見逃しをRED確認する。

**TDD / impact:** 八つのordinary-valid・fresh-stamped refs変異が旧CLIのexit 0でRED→新helper合成後8/8 GREEN。pair metadata差の期待ruleを既存所有者`DM-PROFILE-001`へ補正後、新規36/36 GREEN。移動 / 分割 / 三・四source混在、routing-only Task、context link / malformed source境界を固定。旧placement二testsの無条件`all`をexact refsへ補正し、source / placement gateは緩めない。repository source / manifest / profiles / Core変更・restampなし、MATRIX-003全体はopen。

**Independent review:** fresh reviewer一名が新規二fileを含む全差分と五Review Focusを確認し、新規36/36を独立再実行。Critical / Important / Minor指摘なし、deferred minorなし、追加修正 / 再reviewなし。Rulings: (1) synthetic-only channels / root・operation shards / Workflowsの一般closureは未認定（有限二役割のscopeであり、全体へ外挿すると過剰認定）、(2) MATRIX-004–005 / Task 12・14 / readinessはopen（別証拠が必要）、(3) helperは検証済みsource / ordinary facts用の内部APIで任意JS値への公開API堅牢性を認定しない（直接の非契約入力には保証なし）、(4) 全suite / Core / Complete最終判定は主担当実測に置く（独立review成功だけでは全体回帰を証明しない）。

**Final verification (2026-10-24):** focused四filesは820/820、338788.444167 ms。全suiteは1746件 / 1745 pass / 1既存Python 3.9 skip / fail 0 / cancelled 0、326797.302083 ms、exit 0。Core checkerは264 / 193 / one-invalidity 193/193 / unused 0 / gaps 0、Complete checkerは17 paths等価、両exit 0。新規二fileを含む7 scoped filesのみ、`git diff --check`成功。source / manifest / 34 profiles / Core計606 tracked filesはHEAD `1d880b6`からbytes不変、identity / public grammar / ordinary validatorsも変更なし。二役割だけを完了としMATRIX-003全体・004–005 / Task 12・14 / readinessはopen。Git書込み・repository restampなし、この1コミット相当で停止。commit案: `test(messaging): enforce storefront contributor provenance`。

---

## 前checkpoint: All-Channel Contributor Closure（実装完了・snapshot受入済み）

**Human acceptance — 2026-10-27:** 実結果への受入確認に対するユーザーの「はい」を受け、下記設計・実行時のpendingを解消。受入記録前に新snapshotの39 SHAを再照合し39/39一致。今回の変更はTODO / candidate README / SOURCE-TRACEABILITYの承認状態だけで、code・source・manifest・両profileは不変。全suiteは前回実測を保持し再実行していない。MATRIX-003全体・004–005 / Task 12・14 / readinessを閉じず、次scopeの実装は開始しない。

**Intent / scope（2026-10-27）:** main / `7a496bf`、開始時clean。ユーザーは「既存寄与導出を全channelへ広げ、synthetic三channelのmetadataも訂正する」推奨案の設計化を承認した。README §3 / §6.1 / §8を正とし、MATRIX-003のchannel役割だけを閉じる。source fact / routing-only factの寄与unionを使い、既存出力をauthorityにしない。

**Approaches:** 採用案は検証拡張とcandidate訂正を同じ1コミット相当で行う。仕様と出力が一致する一方、metadata / identitiesとsnapshot証跡の更新が必要。代替の診断追加だけでは現positive candidateがchecker失敗状態になるため採用しない。producerのexact provenanceとreaderのload-all fallbackの区別は前checkpointから維持する。

**Derivation / cases:** 既存helperのsource-owned operation寄与Mapを再利用し、storefrontを含むfileだけという対象条件を取り除く。validated routing / definition / channel file集合の一致を確認して全channelごとに全同居ownerをunionし、全四sourceなら`all`、それ以外はASCII順exact listを要求する。CONVENTIONSの既存二source検証は維持。filename / alpha等の固定pathへ依存せず、synthetic-onlyの移動 / 分割 / 混在、representation-only、storefront混在、source宣言順序非依存を扱う。context参照先の本文sourceやCONVENTIONS本文sourceを参照だけで自動伝播させず、行のselection fact自体の寄与は保持する。missing / extra / 根拠なし`all` / 全四ID明示list、不明・重複owner / 未登録fileを拒否し、既存一次診断とread-only性を維持する。

**Candidate / identity impact:** full / compactの`channels/alpha.md`・`middle.md`・`zeta.md`の計六opening metadataだけを`source_refs: all`から`complete-contexts`へ訂正する。orders / representationsのrefsと全prose / contract bodies / source四files・SHA / Core / 公開仕様 / ordinary validatorsは不変。これは既存rendering承認の追加ではなくprojection metadataの訂正なのでprojectorを`1.0.2`→`1.0.3`にする提案。manifestの他のpolicy / precedence / adaptersとpublication-policy version `1.0.0`は変更しない（それらの規則変更ではないため）。新explicit manifestを指定して両profileを専用helperでrestampし、全34 filesの実identity trailers・root digests / IDsを更新、dry-run no-opとpair等価を確認する。手動hash調整は禁止。

**Evidence / acceptance boundary:** candidate README / SOURCE-TRACEABILITYとTODOへ投影訂正・版変更・実測を短く記録する。過去のlanguage/semantic snapshot表とhuman受入は歴史的証拠として保持し、新snapshotのhash / identities・六metadata以外のprose不変比較を別記する。新snapshotのmetadata / retrieval影響を独立reviewし、その結果をユーザーへ提示する。旧snapshotのH evidenceを新hashへ自動継承したり、今回の設計承認を未実施のreview結果への受入と扱ったりしない。root / operation shards / Workflowsの寄与closure、MATRIX-003全体、MATRIX-004–005、Task 12 / 14、token benefit / performance / release readinessは未完了を維持する。

**Execution / stop:** 設計本文承認後に実行計画を作る。実装時はsynthetic-onlyの不正refsを現CLIが通すREDと、訂正前candidateを新gateが拒否する証拠を先に確認し、helper一般化と六metadata訂正 / restampでGREENにする。focused / 全suite / Core / Complete checker、protected bytes比較、独立read-only reviewを行い1コミット相当で停止。Git書込み・別worktreeなし。helper名 / API・test配置・具体的commandは実行計画で確定する。今回は設計記録のみでcode / manifest / profile / matrix状態は変更しない。

---

### All-Channel Contributor Closure Implementation Plan — 2026-10-27

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:executing-plans`で主担当実行、最後に独立read-only review一名。委譲方式をユーザーが選ぶ場合だけ`superpowers:subagent-driven-development`。単一task / 1コミット相当。

**Goal / Spec:** 直前のall-channel short design（`58606e0`、ユーザー承認済み）を実装し、全channelのexact source contributor gateと正しいcandidate metadataを同時に成立させる。

**Architecture / Tech Stack:** Node.js ESM / `node:test`。source比較後の既存寄与Mapを全channelへ適用し、metadata訂正と専用writerによるidentity更新を分離する。既存storefront / CONVENTIONSの保証は維持し、新しいpublic validator API / source authorityは作らない。

**Global Constraints:** 起点main / `58606e0`、開始時clean。Git read-only / 別worktreeなし。source四files / SHA、Core、公開仕様、ordinary validators、全prose / contract bodiesは不変。candidate差分は六opening refs、manifestのgenerator.version `1.0.3`、全34実identity trailers（rootのfull digests含む）と証跡に限定する。publication-policy `1.0.0` / 他manifest fieldsは不変。MATRIX-003全体・004–005 / Task 12・14 / readinessを閉じず、新snapshotのH evidenceはユーザー受入までpending。

**Files / interface:** `tools/lib/complete-storefront-contributor-audit.mjs`を`complete-channel-contributor-audit.mjs`へ改名し、exportを`auditCompleteChannelContributorClosure(sources, sourceIds, documentSet, coreFacts) -> string[]`へ更新（入力・返値契約は既存と同じ）。source-auditのimport / callと既存`complete-storefront-contributor-audit.test.mjs`の直接importを更新しwrapperは残さない。新`tools/tests/complete-channel-contributor-audit.test.mjs`、必要な既存placement / candidate / CLI tests、candidate `source/projection-input-manifest.json`・`full/`・`compact/`・README / SOURCE-TRACEABILITYと本TODOが対象。rule catalog / 一般validatorを変更しない。

**Review Focus:** (1) synthetic-onlyもfilename非依存で全ownerを検証、(2) routing / definition / actual channel filesの閉包と一次診断、(3) refs以外の本文・source / policy不変、(4) explicit-manifest restampとprofile別identity / no-op、(5) 過去human受入と新metadata/retrievalレビューを混同しない。Step 1–4で各境界を検査し最終reviewでも確認する。

- [x] **1. RED: 不正refsを旧CLIが通すことを確認。** 新test fileでtemporary candidate copyの三context channelを一旦literal `complete-contexts`へ揃え、変更対象以外の根拠なし`all`が負例を偶然落とさないようにする。その後context-only / representation-onlyの各fileへ欠落・無関係ID・余分ID・`all`を両profile同値で与える。explicit manifestでfresh stampしordinary pair valid / checker bytes不変を確認後、`assert.equal(result.status, 1)`と対象pathを含む`/source_refs.*contributors/i`を要求。`node --test docai-messaging/tools/tests/complete-channel-contributor-audit.test.mjs`で旧CLI exit 0によるREDを確認し、setup例外をREDに数えない。
- [x] **2. GREENへの実装と負のbaseline確認。** helperを上記APIへ改名・一般化。inventory operationsと全routing / definitions、実`channels/` filesの閉包を確認し、不明 / duplicate owner、未登録 / 空fileを拒否。対象を全channelにし、source unionと既存CONVENTIONS比較を共有、既存source比較成功後だけ呼ぶ。新testに加え、訂正前repository candidateが新gateでalpha / middle / zetaのrefsを拒否することをread-only CLIで確認する。この一時的REDを記録してから次へ進む。
- [x] **3. Candidate訂正とidentity更新。** 六opening refsを`complete-contexts`にし、manifestはgenerator.versionだけ`1.0.3`へ変更。`node docai-messaging/tools/restamp-document-set.mjs --write --projection-manifest docai-messaging/fixtures/complete-candidates/v0.17.1/source/projection-input-manifest.json docai-messaging/fixtures/complete-candidates/v0.17.1/full`を実行し、最後のrootを`compact`に替えてもう一回実行する。`--write`なしの同commandが両方`restamp required: no`、Core / Complete checker成功、新test GREENを確認。repository restamp中はcandidate copyを作るtestsを並行実行しない。
- [x] **4. 境界testsと証跡更新。** context / representation-onlyの整合移動、representation分割（original / reuseは同じretrieval unit）、synthetic混在のexact二ID、storefront混在の三ID / 全四source `all`、宣言順序差を受理。不正union、四ID明示list、unowned operation / output-only file、片profile差の既存pair診断を拒否し、context / CONVENTIONS参照だけから本文sourceを伝播しないことを確認する。期待値はliteral、失敗時はpath / diagnostic / read-only性まで検証する。既存storefront36件を維持し、既存fixtureの無条件`all`は各ownerのexact refsへ訂正してgateを緩めない。新snapshotの39 file SHA / root identitiesを旧表とは別に記録し、HEAD比で四source bytes / SHA、manifestのversion以外、六openingと全trailer以外のprofile bytesが不変と確認する。新snapshotのmetadata / source retrieval影響とhuman acceptance pendingを別記し、旧SHA表を上書きしない。
- [x] **5. 全体検証・独立review・停止。** focusedは`node --test docai-messaging/tools/tests/complete-channel-contributor-audit.test.mjs docai-messaging/tools/tests/complete-storefront-contributor-audit.test.mjs docai-messaging/tools/tests/complete-channel-placement.test.mjs docai-messaging/tools/tests/complete-context-placement.test.mjs docai-messaging/tools/tests/check-complete-fixtures.test.mjs`。続けて全`tools/tests/*.test.mjs`、Core / Complete両checker、両profile no-op dry-run、`git diff --check`を実行しfail 0（既知Python 3.9 skipは別記）、Core 264 / 193 / one-invalidity 193/193 / unused 0 / gaps 0、Complete 17 paths等価を確認。fresh reviewer一名が全差分 / 五Review Focus / bytes比較をread-only確認し、結果・影響・残件をTODOへ短く記録する。新metadata / retrieval影響の実レビュー結果をユーザーへ提示して停止、Git書込みなし。commit案: `fix(messaging): enforce exact contributors for every channel`。

**Plan self-review / handoff:** 一つの寄与closure修正であり他役割へのscope拡張なし。五Review Focusは各stepのtest / bytes比較 / 証跡境界に対応する。現段階は計画記録のみ、実装・test・manifest / profile / matrix変更なし。主担当実装＋最後に独立reviewを推奨（gateと投影訂正・identity更新を一貫して照合できるため）。

**Execution ledger (2026-10-27):** 計画と主担当実装＋最終独立reviewをユーザー承認済み。開始main / `58606e0`、既存未コミット変更は承認済みTODO計画だけ。Pre-flight: 単一task、共有interface conflictなし。Git read-only / canonical TODOを優先してworktree / skill workspaceを作らない。test fixtureのcopy / restamp / read-only snapshot / regroup手順を共通test helperへ機械的に抽出し旧36casesのscenarioと期待を保持（新旧testのfixture構築を二重実装しないため、production scope変更なし）。

**TDD / impact:** 新16casesは旧CLI exit 0で全RED→全channel合成後16/16 GREEN。訂正前candidateのalpha / middle / zeta両profile六refsを新gateが拒否することを確認後、六metadata・generator `1.0.3`と34identityを更新。両dry-run no-op、Core / Complete成功。境界testsは新35＋旧36の71/71成功。二件のtest構築補正: 同channelを二shardの別subsectionへ置く不正fixtureを正規の一subsectionへ修正、output-only channelは既存source inventoryが先に拒否する期待へ訂正（productionを弱めず）。HEAD比で四source不変、manifestのversion以外不変、profileの六openingと実trailer以外bytes不変を確認。過去SHA表を保持し新39SHA / identitiesとmetadata / retrieval評価・受入pendingを別記。focused / 全suite / 独立reviewと最終結果は後記。

**Independent review:** fresh reviewer一名、新旧71/71再実行、五Review Focus・全差分・四source / manifest限定差分・六opening / 34実trailer限定・旧SHA表不変 / 新39SHAとroot identities・両no-opを独立確認。Critical / Important / Minorなし、deferred minorなし、再reviewなし。Rulings: root / operation shards / WorkflowsのclosureとMATRIX-004–005 / Task 12・14 / readinessは別証拠待ち（全体へ外挿すると過剰認定）；helperは検証済み内部facts向けで任意JS入力の公開API保証なし；測定なしにtoken / performance改善を認定しない；全suite / focused / Core最終結果は主担当実測を正としreview結果で代用しない；新snapshotのhuman受入はユーザーへ留保し旧H evidenceを転用しない。metadata訂正は既存contract / required-contextを保ち来歴を正確化するが、別loaded fileの`all`等によりtask全体のload削減を保証しない。

**Final verification (2026-10-27):** 新35＋既存36の71/71（reviewerも独立再実行）、focused五filesは855/855 / fail 0 / cancelled 0、292526.063458 ms。全suiteは1781件 / 1780 pass / 1既存skip（minimum Python 3.9、python3.9未導入）/ fail 0 / cancelled 0、301852.086875 ms、exit 0。Core checkerは264 / 193 / one-invalidity 193/193 / unused 0 / gaps 0、Completeは17 paths等価、両exit 0。両profileのexplicit-manifest dry-runは`restamp required: no`。HEAD `58606e0`比でsource四files / SHA・Core / 公開仕様 / rules / ordinary validators不変、manifestはgenerator.versionだけ、profileは六opening refsと全34実trailer以外bytes不変。新39SHA・root identities一致、旧SHA表保持、`git diff --check`成功。scope外・human acceptanceの境界は直前review記録どおり。Git書込みなし、この1コミット相当で停止。commit案: `fix(messaging): enforce exact contributors for every channel`。

---

## 前checkpoint: Operation-Index Shard Contributor Closure（実装完了・snapshot受入済み）

**Human acceptance — 2026-10-27:** 実レビュー結果への受入確認に対するユーザーの「はい。続きを進めてください」を受け、projector `1.0.4` snapshotの有限metadata / retrieval結果を受入済みと記録。main / `675da3f`、開始時clean、39 SHAと両root identitiesを再照合して一致。承認状態だけをTODO / README / SOURCE-TRACEABILITYへ記録し、code / source / manifest / profilesは不変、全suite再実行なし。下記実行時pendingを解消するが、残matrix・Task 12 / 14 / readinessは閉じない。次はWorkflowのsource所有元から寄与を導く有限gateを提案し、設計・実装は未着手。

**Intent / approaches（2026-10-27）:** main / `fbd900f`、開始時clean。ユーザーは次scopeとしてoperation-index shardを先に進める推奨案の設計化を承認した。Workflow先行案は直接取得文書の来歴を改善する一方、Workflow自身の事実と参照先operationの寄与境界の定義が必要。採用案は既存operation所有元とsource比較済みrouting factsを基にshardの寄与集合を導出し、channelのrouting-provenance closureと整合させる。既存出力のrefsやfilenameをauthorityにせず、README §3 / §3.2 / §6.1 / §8を正とする。

**Scope / design:** candidate-only source auditへoperation-index shardのexact contributor gateを追加する。source四種のregistry・inventory・operation所有元導出は既存channel gateと共有し、二重のowner規則を持たない。context operationの行は`complete-contexts`、representation operationの行は`complete-representations`、storefront行はAsyncAPIのrouting / Summary / MessageとbehaviorのTask / context selectionから`storefront-asyncapi-3.1.0`＋`storefront-behavior`が寄与する。source比較成功後、検証済みrowsの`indexPath`で各shardの行を集め、root shard routes・実operation-index files・非空の行集合・inventoryの一意な所属の閉包を確認する。各shardはその行に寄与するsourceのunionをASCII順のexact listとし、全四sourceの場合に限り`all`を要求する。channel file全体のrefsを転用せず、そのshardに属する行だけを対象にする。context / CONVENTIONS / channelへの参照は参照先本文のsourceを自動伝播しない。manifestの配置policyは配置のauthorityであり第五のSources行ではない。

**Root / non-goals:** root INDEXは仕様上固定の`all`を既存ordinary validatorが検証済みであり、同じ規則を再実装しない。本checkpointはrootの全semantic factsのsource照合を新たに認定しない。flat routingにshard gateを誤適用せず、既存candidateのsharded publication policyを緩めない。Workflow contributor closure、MATRIX-003全体、MATRIX-004–005、Task 12 / 14 / readiness、一般generator・任意JS入力の公開API・token / performance改善は対象外。

**Candidate / identity impact:** 現candidateでは両profileの`indexes/operations-middle.md`の二opening refsだけを`all`→`complete-contexts`へ訂正し、全四sourceの行があるbroad shardは`all`を維持する。投影metadata訂正としてprojector `1.0.3`→`1.0.4`を提案し、manifestの他fields・publication-policy `1.0.0`・source四files / SHA・全prose / contract bodies・Core / 公開仕様 / ordinary validatorsは不変。両profileを同一explicit manifest指定の専用writerでrestampし全34実identity trailersとroot digestsを更新する。手動hash調整はしない。新snapshotの39SHA / root identitiesとmetadata / retrieval評価を別記し、旧二snapshotのhuman受入を自動転用しない。§6.1はoperation shardのaggregate refsをtask-scoped provenanceのためだけには展開しないため、この訂正だけでtask全体のload削減を主張しない。

**TDD / verification:** ordinary-valid・fresh-stamped pairでcontext-only / representation-only / storefront-only / mixed shardの過少・過剰refs、根拠なし`all`を旧CLIが通すREDを確認してから実装する。exact一・二・三IDと全四sourceの`all`、移動 / 分割 / regrouping、同channelの行が別shardにある場合の非伝播、宣言順序差を検証する。不明owner・duplicate / missing / extra shard・片profile不一致等は既存一次診断を維持し、checker前後bytes不変を確認する。配置変更testsは対応するplacement / summary policyとroot routingも整合させ、別gateの失敗を新gateの証拠にしない。既存channel / storefront / catalog-placement tests、全suite、Core / Complete checker、両profile no-op dry-run、source / manifest / profile限定差分と新SHA照合、`git diff --check`で完了確認する。

**Review / stop boundary:** review観点は行単位のsource authority、routing / shard閉包、既存channel gateの非退行、二opening＋version＋実trailers以外のbytes不変、旧受入との分離。scope拡張や別の投影訂正が必要なら実装前に確認する。実装結果はTODO / candidate README / SOURCE-TRACEABILITYへ簡潔に記録し、新snapshotの実レビュー結果をユーザーへ提示して1コミット相当で停止する。Gitはread-only。今回はTODOへの設計記録だけで、設計承認後に実行計画へ進む。

---

### Operation-Index Shard Contributor Closure Implementation Plan — 2026-10-27

> **For agentic workers:** 実装時は `superpowers:executing-plans`（主担当実装）または `superpowers:subagent-driven-development` を使用する。ユーザーのGit read-only / canonical TODOを優先し、別worktreeや計画専用file・commitを作らない。実行方法は計画確認時に選択する。

**Goal / Spec:** 直前の短い設計（2026-10-27にユーザー承認）に従い、全operation-index shardの行単位exact contributor gateと正しいcandidate metadataを成立させる。

**Architecture / Tech Stack:** 既存Node.js ESM / `node:test`、source inventoryとvalidated core factsを使用する。operation所有元導出を共有helperへ抽出し、channelとshardの別auditが同じsource規則を使う。ordinary/source比較後に合成し、公開validatorや新dependencyは追加しない。

**Global Constraints:** HEAD `fbd900f`、既存差分は承認済みTODO設計だけ。Git read-only。source四files / SHA、Core / 公開仕様 / ordinary validators、全prose / contract bodiesは不変。candidate変更はmiddle両profileの二opening refs、manifest generator.version `1.0.4`、全34実identity trailersとroot digestsに限定する。他manifest fields / publication-policy `1.0.0`は不変。新snapshot受入は別途ユーザー判断、MATRIX-003全体・004–005 / Task 12・14 / readinessは閉じない。

**Files / Interfaces:** 新`tools/lib/complete-operation-contributors.mjs`の`collectCompleteOperationContributors(sources, sourceIds) -> { issues: string[], contributors: Map<string, string[]>, operations: string[] }`が四source registry / inventory / behavior所有元とoperationごとの寄与集合を提供する（失敗時issues非空、呼出側は集合を使わない）。既存`complete-channel-contributor-audit.mjs`はこのhelperを利用しexport/signatureと診断意図を保持。新`complete-operation-shard-contributor-audit.mjs`の`auditCompleteOperationShardContributorClosure(sources, sourceIds, documentSet, coreFacts) -> string[]`を`complete-candidate-source-audit.mjs`へ合成する。新testは`tools/tests/complete-operation-shard-contributor-audit.test.mjs`、既存fixture helperとcatalog-placement / channel / storefront / check-complete testsを必要に応じ調整。candidate manifest / 両profiles / README / SOURCE-TRACEABILITYと本TODOが証跡対象。

**Review Focus:** (1) channel aggregateでなくshard内の行だけを集計、(2) root routes / 実shard / 行所有の一意・非空閉包、(3) source比較・pair・placement一次診断と既存channel gateの維持、(4) 二opening＋version＋実trailer限定差分とno-op、(5) 旧human受入と新metadata/retrieval評価の分離。以下の境界test・bytes比較・証跡でそれぞれ確認する。

- [x] **1. REDを固定。** temporary candidateのmiddle refsをまずliteral `complete-contexts`へ正規化し、context-only shardの余分ID・wrong ID・`all`を両profile同値で設定する。`check(directory, 1, /operations-middle\.md.*source_refs.*contributors/i)`でordinary-valid / fresh stamp / checker read-onlyを要求。`node --test docai-messaging/tools/tests/complete-operation-shard-contributor-audit.test.mjs`が旧CLI exit 0で失敗することを確認する。単一IDの削除による空listはordinary-invalidなので新gateのREDに数えず、過少申告は複数source shardで検証する。
- [x] **2. GREENと共有化。** 上記共有helperを抽出し既存channel gateを移行、新shard auditを追加する。`coreFacts.operations.rows[].indexPath`、`operations.shards[].path`、実文書の標準root headingでshardを識別しfilenameに依存しない。非empty route集合でsharded formと判断し、flat formは既存ordinary/source/policy検証へ委ねる。source inventoryの全operationが一意に属し、route / 実file / rowsが一致することを確認し、行ownerのunionをexact listまたは全四sourceの`all`と比較する。source比較成功後、既存channel gateと同じ合成段階で実行する。新test GREENと旧channel / storefront tests成功を確認し、未訂正repository candidateは新gateがmiddle両refsを拒否することをread-onlyで確認する。
- [x] **3. 境界tests。** representation-onlyは`complete-representations`、storefront-onlyは`storefront-asyncapi-3.1.0, storefront-behavior`、context＋representationは`complete-contexts, complete-representations`、context＋storefrontは`complete-contexts, storefront-asyncapi-3.1.0, storefront-behavior`、全四sourceは`all`をliteral期待値とする。各missing / extra / wrong / 不適切allと全四ID明示listを拒否し、整合したrename / split / regrouping・宣言順序差は受理する。同channelのoperationを二shardへ分け、一方のみに他sourceの行を置き、channel aggregateを他方へ伝播しないことを検証する。配置・Summary policyとrootの実bounds / Tasksを整合させ、失敗が別gateの偶然でないことを確認。helper-levelでunknown owner / route-file-row不一致・flat非適用、CLIでduplicate / missing / extra shardと片profile差の既存一次診断を確認し、既存gateを弱めない。
- [x] **4. Candidate訂正・stamp・証跡。** middle両openingだけを訂正、manifest generator.versionだけを`1.0.4`へ変更。`node docai-messaging/tools/restamp-document-set.mjs --write --projection-manifest docai-messaging/fixtures/complete-candidates/v0.17.1/source/projection-input-manifest.json docai-messaging/fixtures/complete-candidates/v0.17.1/full`を実行し、最後のrootを`compact`に替えてもう一回実行する。同commandの`--write`なしで両方`restamp required: no`を確認。repository stamp中はcandidate copy testsを並行しない。旧snapshot表を保持し、新39 SHA / roots、限定bytes比較、§6.1 aggregate非展開とtoken効果非認定、新human受入pendingをREADME / SOURCE-TRACEABILITYへ記録する。既存temporary fixturesで整合移動後のrefs更新が必要なら正しい行unionへ修正し、不正期待を温存するためにgateを緩めない。
- [x] **5. 最終検証・review・停止。** focusedは`node --test docai-messaging/tools/tests/complete-operation-shard-contributor-audit.test.mjs docai-messaging/tools/tests/complete-channel-contributor-audit.test.mjs docai-messaging/tools/tests/complete-storefront-contributor-audit.test.mjs docai-messaging/tools/tests/complete-catalog-placement.test.mjs docai-messaging/tools/tests/check-complete-fixtures.test.mjs`。全suiteは`node --test docai-messaging/tools/tests/*.test.mjs`、Coreは`node docai-messaging/tools/check-core-fixtures.mjs`、Completeは`node docai-messaging/tools/check-complete-fixtures.mjs`。fail 0 / Core 264 cases・193 invalid・193/193 one-invalidity・unused 0・gaps 0 / Complete 17 paths等価を確認し、既存Python 3.9 skipは別記する。両no-op、新39SHAとroot identities、HEAD比の四source・他manifest fields・二openingと実trailer以外のprofile bytes不変、`git diff --check`を確認。五Review Focusと全差分をreviewし、実測 / 影響 / 残件を短くTODOへ記録、新snapshotの実結果をユーザーへ提示して停止。commit案: `fix(messaging): enforce exact operation shard contributors`。

**Self-review / handoff:** 単一のshard寄与closure修正として五stepへ集約。source集合APIと既存audit API、行pathとroute path、各Review Focusのtest / bytes確認を設計と照合済み。主担当実装＋最後に独立reviewを推奨（共有owner規則から投影訂正・identityまでの依存関係を一貫して確認できる）。taskごとの独立実装・review方式は各段階を別担当で検証できるが、同じhelper / fixture / candidateの引継ぎが増える。実行方法と本計画の確認待ち。今回の変更はTODOのみ、実装・test・stamp未実施。

**Execution ledger（2026-10-27）:** 本計画と主担当実装＋最終独立reviewをユーザー承認済み。開始main / `3b5ac4b`、clean。Git read-only / canonical TODOを優先して別worktree・skill作業dir・commitを作らない。Pre-flight: shared collectorの三fieldはchannel / shard両auditと整合、codeとcandidateの依存順は設計どおり。新3casesはordinary-valid / freshly stamped / read-onlyで旧CLI exit 0により全RED→共有化・shard合成後3/3 GREEN。未訂正candidateは新gateがmiddle両profileだけを拒否することを確認済み。境界testと以後の検証を実行中、未完了。

**Plan conflict / 解決済み:** 同channel fileの行を二shardへ分ける計画上の正常例は既存`DM-IDX-003`に反し、duplicate / missing / extra shardも専用writerが拒否する。ユーザーへ確認後、混在はchannel単位の整合移動、同channel二shardは既存一次拒否の負例へ変更し、writer拒否と未stamp CLI診断・read-onlyを分けた。productionは弱めず、承認済み修正は当初設計・step 3の該当test記述に優先する。

**Approved correction / progress:** 上記test計画修正をユーザー承認済み。混在はchannel単位とし、同channel二shardはwriter / ordinary CLIの`DM-IDX-003`負例へ変更。malformed casesのCLIはmanifest bindingを変えず一次routing診断へ到達させ、writer / checker bytes不変を別々に確認する（ordinary-invalid入力をfresh-stamped positiveと呼ばない）。新42/42成功。source owner導出は共有helper一か所、既存channel API保持。二opening refs / generator `1.0.4`と34identityを更新し、Core / Complete成功・両explicit-manifest dry-run no-op。HEAD `3b5ac4b`比で四source bytes / SHA、manifest version以外、二openingと実trailer以外のprofile bytes不変を確認し新39SHA / rootsを記録。focused / full suiteと一名の独立reviewを実行中、最終判定未完了。

**Independent review / rulings:** fresh reviewer一名が未追跡新3filesを含む全差分と五Review Focusをread-only検証。113/113、新39SHA / roots・四source / manifest限定差分・二openingと34実trailer限定・両no-opを独立確認。Critical / Important / Minorなし、deferred minorなし、再reviewなし。Declined項目への主担当判断: focused / 全suiteの最終判定は下記の主担当実測で行いreviewに代替させない；旧CLI REDは主担当が実際に観測した3casesとledgerを正とする；Python 3.9最小版成功は未認定；新snapshotのhuman受入はユーザーへ留保；Workflow / whole-root semantic proof / 残matrix / Task 12・14 / readinessは別証拠待ち；任意JS公開API・一般generator・本番business/Kafka/OAuth品質・token/performance/配置最適性は有限candidate監査から認定しない。各境界を越える外挿は過剰認定になるため採用しない。

**Final verification（2026-10-27）:** focused五filesは858/858 / fail 0 / cancelled 0 / skip 0、347702.351375 ms。全suiteは1823件 / 1822 pass / 1既存Python 3.9 skip / fail 0 / cancelled 0、338206.051334 ms、両exit 0。Coreは264 / 193 / one-invalidity 193/193 / unused 0 / gaps 0、Completeは17 paths等価。両explicit-manifest dry-run no-op。新39SHA / roots一致、旧二snapshotの78 SHA行を保持、HEAD `3b5ac4b`比のsource / manifest / profile限定差分とCore / 公開仕様 / rules / ordinary validators不変を確認。`git diff --check`成功。実装と技術reviewは完了、新metadata / retrieval実結果のhuman受入は未完了。Git書込みなし、1コミット相当で停止。commit案: `fix(messaging): enforce exact operation shard contributors`。

---

## 最新checkpoint: Workflow Contributor Closure（実装完了・snapshot受入済み）

**Human acceptance — 2026-10-29:** 実レビュー結果への受入確認に対するユーザーの「はい」を受け、projector `1.0.5` snapshotの有限metadata / retrieval結果を受入済みと記録。main / `fab548a`、開始時clean、39 SHAと両root identitiesを再照合して一致。今回の変更はTODO / candidate README / SOURCE-TRACEABILITYの承認状態だけで、code・source・manifest・両profileは不変。下記実行時pendingを解消するが、残matrix・Task 12 / 14 / readinessは閉じない。全suiteは前回実測を保持し再実行せず、次scopeの設計・実装にも進まない。

**Intent / approaches（2026-10-27）:** main / `675da3f`。開始時の既存差分は直前のprojector `1.0.4`受入記録三文書だけで、保持する。ユーザーはWorkflowのsource所有元と比較済み事実から寄与を導出する推奨案の設計化を承認した。別案のWorkflow別contributor宣言は複数source合成を明示できるが、宣言と実際のfact authorityの二重管理・乖離を検証する必要がある。採用案は既存のsource / 本文比較をauthorityにし、有限candidateで未導入の合成modelを先取りしない。README §3 / §5 / §6.1 / §8を正とする。

**Scope / authority:** candidate-only source auditへWorkflowのexact contributor gateを追加する。現在の五owner（`alpha-delivery` / `alpha-observability` / `state-none` / `state-unknown` / `state-unsupported`）はすべて`complete-contexts.workflows`がtitle / purpose / 各sectionの事実を供給し、既存auditがそれぞれsource比較済みであることを前提にする。`none`の非該当、unknownの必要入力、unsupportedのfeature / source locationもそのsourceの事実であり、未取得の仮想sourceを寄与集合へ加えない。現registryでは五filesすべてexact `complete-contexts`を要求し、他ID・余分ID・根拠のない`all`を拒否する。新たなcontributor宣言や第五のSources行は追加しない。未比較の新Workflow ownerや複数source合成を、このgateの所有元lookupだけで自動認定しない。

**Ownership / reference boundary:** 既存context-placement解決結果を再利用し、source ownerと配置path、Workflows routing、実file、検証済みdefinitionの一意・完全な対応を確認する。filename / display title / 出力refsからsourceを推測しない。Workflow sourceが明記するStepのaction / address / operation identityは同sourceからの入力であり、参照先channelの契約本文を自動合成したものではない。参照先operation / Related / CONVENTIONSやconvention-dependency edgeの存在だけで、その参照先本文の寄与元をWorkflowへ伝播しない。Step identityの整合性確認・source比較・dependency closureは引き続き各既存gateの責務。直接Workflow取得時のwhole-CONVENTIONS fallback、required / supplemental context、unknown / unsupportedの停止境界、trust / side-effect authorityは変更しない。

**Candidate / identity impact:** 五Workflowsのfull / compact、計十opening refsだけを`all`→`complete-contexts`へ訂正する。投影metadata訂正としてprojector `1.0.4`→`1.0.5`を提案し、manifestの他fields・publication-policy `1.0.0`・source四files / SHA・全prose / contract bodies・Core / 公開仕様 / ordinary validatorsは不変。両profileを同じexplicit manifest指定の専用writerでrestampし、全34実identity trailersとroot digests / IDsを更新する。手動hash調整は禁止。過去三snapshotのSHA表とhuman受入は保持し、新39 SHA / rootsとmetadata / retrieval評価を別記する。Workflowの無条件`all`が外れても、CONVENTIONS・source-indexのinclusive bounds / fixed-point・他loaded filesが必要sourceを決めるため、task全体のload / token削減を認定しない。

**TDD / verification:** temporary candidateでは他Workflowをexact refsへ正規化して負例を隔離し、五ownerの各wrong / extra / `all`がordinary-valid・fresh-stamped pairとして旧CLIを通るREDを確認してから実装する。単一IDを消した空listはordinary grammarの負例として分離する。十refs訂正前のrepository candidateを新gateが拒否することも確認する。整合したpath relocation、source宣言順序差、四sectionの各state、参照先channelが複数sourceを持つ場合とsourceで明記したcross-source Stepがある場合の非伝播、shadow Stepsの非採用を検証する。source本文変更やidentity不整合、片profile差、欠落 / duplicate / extra owner-pathの既存一次拒否を維持し、writerで拒否される不正構造をfresh-stamped positiveと扱わない。checkerはread-only。新testと既存contributor / context-placement / Workflow / candidate tests、全suite、Core / Complete、両no-op、限定bytes比較と新SHA / roots、`git diff --check`を確認する。

**Review / stop boundary:** review観点はsource比較済み五ownerの閉包、参照先本文の非伝播、incomplete state / 既存一次診断の維持、十opening＋version＋実trailers以外のbytes不変、旧human受入との分離。MATRIX-003のWorkflow役割だけを対象にし、whole-root semantic proof・MATRIX-003全体・004–005・Task 12 / 14 / readiness、一般generator / 公開API / 本番品質は認定しない。新owner対応や別の投影訂正・source / policy変更が必要なら実装前に確認する。TODO / candidate README / SOURCE-TRACEABILITYへ結果を簡潔に記録し、新metadata / retrieval実レビュー結果をユーザーへ提示して1コミット相当で停止する。Git read-only。今回はTODOへの短い設計記録だけで、設計承認後に実行計画へ進む。

---

### Workflow Contributor Closure Implementation Plan — 2026-10-29

> **For agentic workers:** 実装時は `superpowers:executing-plans`（主担当実装）または `superpowers:subagent-driven-development` を使用する。Git read-only / canonical TODOを優先し、別worktree・計画専用file・commitは作らない。実行方法と本計画の確認後に着手する。

**Goal / Spec:** 直前のWorkflow短い設計（2026-10-29ユーザー承認）に従い、比較済み五Workflowのexact source attributionと正しいcandidate metadataを成立させる。

**Architecture / Tech Stack:** Node.js ESM / `node:test`、既存source auditとcontext-placementの解決済みowner/path、validated complete factsを使う。source本文比較成功後の最終contributor段階へ有限Workflow gateを合成する。参照先の本文sourceやoperation contributor unionは取り込まず、既存channel / shard gate、ordinary validator、dependency closureを変更しない。新dependencyなし。

**Global Constraints:** 起点main / `870a809`、開始時clean。Git read-only。現五owner / 四source registryだけを認定し、未比較の新owner・複数source合成には拡張しない。source四files / SHA、Core / 公開仕様 / ordinary validators、全prose / contract bodiesは不変。candidate差分は五Workflows両profileの十opening refs、manifest generator.version `1.0.5`、全34実identity trailersとroot digestsに限定。他manifest fields / publication-policy `1.0.0`は不変。過去三snapshotのSHA / human受入は保持し、新metadata / retrieval実結果のhuman受入は別途ユーザー判断。MATRIX-003全体・004–005 / Task 12・14 / readinessは閉じない。

**Files / Interfaces:** 新`tools/lib/complete-workflow-contributor-audit.mjs`に`auditCompleteWorkflowContributorClosure(sources, sourceIds, contextPaths, documentSet, completeFacts) -> string[]`を作る。入力はsource auditでbinding済みの`Map<sourceId, parsed source>`とID列、既存`resolveCompleteContextPlacement`が返したpaths（`workflows: Map<ownerId, path>`）、loaded document set、`result.facts.complete`。返値はissue文字列列。新`tools/tests/complete-workflow-contributor-audit.test.mjs`は既存`tools/tests/helpers/complete-contributor-fixture.mjs`のcopy / source rebind / stamp / ordinary validation / read-only checkを再利用する。変更対象は`complete-candidate-source-audit.mjs`のimport / 最終合成、必要な既存context-placement / candidate tests、candidate manifest / 両profiles / README / SOURCE-TRACEABILITYと本TODO。一般validator・rule catalog・writerの改変なし。

**Review Focus:** (1) source比較済み五ownerとrouting / definition / 実file / pathの閉包、(2) Step参照やCONVENTIONS / dependencyから参照先本文sourceを伝播しないこと、(3) none / unknown / unsupported・片profile差・既存一次診断を維持、(4) 十opening＋version＋実trailer以外のbytes不変とno-op、(5) 新metadata / retrieval評価と過去human受入の分離。以下のtests / bytes確認 / 証跡にそれぞれ対応させる。

- [x] **1. REDを固定。** temporary copyの五Workflow両profileをliteral `complete-contexts`へ正規化し、ownerごとに対象だけ`complete-representations`、`complete-contexts, storefront-behavior`、`all`へ変える。`check(directory, 1, /workflows\/.*source_refs.*contributors/i)`でordinary-valid / freshly stamped / checker bytes不変を要求し、両profileと対象pathの診断をassertする。`node --test docai-messaging/tools/tests/complete-workflow-contributor-audit.test.mjs`が旧CLI exit 0で失敗することを確認。空listはordinary-invalidなのでこのREDへ混ぜない。
- [x] **2. GREENへの実装。** 上記APIで四source registry / owner authorityを確認し、`complete-contexts.workflows`のowner keysと既存比較済み五ID、解決済みpaths、`completeFacts.workflows.rows[].path`、`workflowDefinitions[].path`、実`workflows/` file pathsを重複も含めてexact比較する。未比較の追加owner・他sourceへのowner追加 / 移管は拒否し、filenameや同名titleで補完しない。各pathの唯一のfileにexact `complete-contexts`を要求する。既存source本文比較にissueがない場合だけ、既存channel / shardと同じ最終段階から呼ぶ。新test GREENと、未訂正repository candidateの十refsだけが新gateで拒否されるread-only結果を確認する。
- [x] **3. 境界と非退行tests。** 正規化済み五ownerを受理し、各ownerのpolicy / routing / 全参照 / fileを整合させたpath relocationとsource / placement宣言順序差も受理する。五ownerで四sectionのexpanded / none / unknown / unsupportedが既存どおり比較されること、state-ownerのshadow `steps`が実Steps扱いされないことを固定する。参照先channelを整合した複数sourceへregroupしてもWorkflow refsは`complete-contexts`、sourceへ明記したcross-source Step（例 `SEND orders.commands (sendCreateOrder)`）も同refsとする。cross-source変異は対応するsource Steps / annotations / transitions・出力・Related・convention選択を既存gateに合わせ、`mutateSource`でdigest再binding、fresh stamp / ordinary-validを確認したものだけを正例にする。stale source本文は先行source比較、片profile差は`DM-PROFILE-001`で拒否し、新gate診断で置き換えない。helper-levelでmissing / duplicate / extra owner-path・routing / definition / file差・未比較ownerを拒否する。ordinary-invalid構造や空refsはwriter拒否と未stamp CLI一次診断を分離し、checker前後bytes不変を確認する。
- [x] **4. Candidate訂正・stamp・証跡。** 五Workflowの十openingだけを`all`→`complete-contexts`、manifest generator.versionだけを`1.0.5`へ変更。`node docai-messaging/tools/restamp-document-set.mjs --write --projection-manifest docai-messaging/fixtures/complete-candidates/v0.17.1/source/projection-input-manifest.json docai-messaging/fixtures/complete-candidates/v0.17.1/full`と、最後のrootを`compact`に替えたcommandを実行する。repository stamp中はcandidate copy testsを並行実行しない。両commandの`--write`なしで`restamp required: no`を確認。新39SHA / roots、十opening＋version＋実trailer限定比較、直接Workflow取得のCONVENTIONS fallback不変・token効果非認定・新human受入pendingをREADME / SOURCE-TRACEABILITYへ短く記録し、過去三SHA表を保持する。既存temporary fixturesのrefs期待が必要なら実際のauthorityへ合わせ、source / policy gateは緩めない。
- [x] **5. 最終検証・review・停止。** focusedは`node --test docai-messaging/tools/tests/complete-workflow-contributor-audit.test.mjs docai-messaging/tools/tests/complete-context-placement.test.mjs docai-messaging/tools/tests/complete-workflow-body-validator.test.mjs docai-messaging/tools/tests/complete-channel-contributor-audit.test.mjs docai-messaging/tools/tests/complete-storefront-contributor-audit.test.mjs docai-messaging/tools/tests/complete-operation-shard-contributor-audit.test.mjs docai-messaging/tools/tests/check-complete-fixtures.test.mjs`。全suiteは`node --test docai-messaging/tools/tests/*.test.mjs`、Coreは`node docai-messaging/tools/check-core-fixtures.mjs`、Completeは`node docai-messaging/tools/check-complete-fixtures.mjs`。fail 0、Core 264 / 193 invalid / 193/193 one-invalidity / unused 0 / gaps 0、Complete 17 paths等価を確認し、既存Python 3.9 skipを別記。両no-op、新39SHA / roots、旧三表の117SHA行保持、HEAD比のsource四files / 他manifest fields / 十openingと実trailers以外のprofile bytes・Core / 公開仕様 / rules / validators不変、`git diff --check`を確認する。五Review Focusと全差分をreviewし、結果 / 影響 / 残件をTODOへ短く記録、新metadata / retrieval実レビュー結果をユーザーへ提示して1コミット相当で停止。Git書込みなし。commit案: `fix(messaging): enforce exact workflow contributors`。

**Self-review / handoff:** 五ownerのbody authorityと新helperの認定範囲、解決済みpaths / complete factsのAPI、五Review Focusのtest・bytes検証・受入境界を設計と照合済み。sourceを変更する境界testsはtemporary copyだけで、repository source不変と矛盾しない。新ownerや別の投影訂正・source / policy変更が必要なら実装前にユーザーへ確認する。単一gateと十metadata・identity更新の一貫した照合のため、主担当実装＋最後に独立reviewを推奨。段階別の別担当実装 / reviewも可能だが、同じcandidate / fixture構築の引継ぎが増える。計画と実行方法の確認待ち。今回はTODOのみ変更、実装・test・stamp未実施。

**Execution ledger（2026-10-29）:** 本計画と主担当実装＋最終独立reviewをユーザー承認済み。開始main / `870a809`、既存差分は承認済みTODO実行計画だけ。Git read-only / canonical TODOを優先して別worktree・skill作業dir・commitを作らない。Pre-flight: 解決済みcontextPathsのworkflow Mapとcomplete factsのrouting / definition配列は新helper APIと整合。五owner / 四sourceの有限scope以外を自動認定しない。新15負例はordinary-valid / freshly stamped / checker read-onlyで旧CLI exit 0により全RED。実装と以後の検証は未完了。

**Progress / Ruling:** 新15casesはgate合成後15/15 GREEN。訂正前candidateに対するread-only検証はalpha系二ownerの両profile、計四refsだけを拒否した。state系三ownerの六refsはHEADで既に`complete-contexts`のため保持する。計画の「十opening訂正」は実測の「五ownerを検証し四openingだけ訂正」へ件数を修正するもので、scope・最終refs・projector `1.0.5`・source不変・34identity更新の承認内容は変えない。既に正しいmetadataを変更したと記録すると過剰な差分主張になるため、以後のbytes証拠は四openingを基準にする。

**Implementation progress:** 新52/52成功。五ownerのclosed source scope / resolved path / routing / definition / 実fileを検証するhelperをsource比較後へ合成し、Step / Related / dependencyの参照先本文sourceを取り込まない。五ownerの各wrong / extra / all、全owner relocation、宣言順序差、shadow Steps、参照先multi-source channel、source-authored storefront Stepと整合Related、先行source / pair診断、registry / owner-path閉包、ordinary-invalid時のwriter / CLI拒否・bytes不変を固定。四openingとgenerator `1.0.5`・34identity更新後、Core / Complete成功。HEAD比の四source / SHA・manifest version以外・四openingと実trailer以外のprofile bytes不変を確認、新39SHA / rootsを旧三snapshotと別記。focused / 全suite実行中、最終独立review・human受入は未完了。

**Independent review / rulings:** fresh reviewer一名が新二filesを含む全差分と五Review Focusをread-only確認。新旧165/165、両no-op、四opening＋34実trailer限定、四source bytes / manifest version以外不変、新39SHA / roots一致・過去117SHA行保持を独立検証。Critical / Important / Minorなし、deferred minorなし、再reviewなし。Declined項目への判断: human受入はユーザーへ留保；focused / full suiteとCore最終集計は主担当の実測を正としreviewで代替しない；REDは主担当が実際に観測した15casesとledgerを正とする；whole-root / 残matrix / Task 12・14 / readinessは別証拠待ち；一般Workflow変換・新owner / 複数source合成・公開API / 本番品質は有限gateから認定しない；測定なしにtoken / task-load / performance改善を主張しない。これらを外挿すると過剰認定になるため境界を保持する。

**Final verification（2026-10-29）:** focused七filesは906/906 / fail 0 / cancelled 0 / skip 0、375478.192625 ms。全suiteは1875件 / 1874 pass / 1既存skip（minimum Python 3.9、python3.9未導入）/ fail 0 / cancelled 0、374427.129708 ms、両exit 0。Coreは264 / 193 invalid / one-invalidity 193/193 / unused 0 / gaps 0、Completeは17 paths等価。両explicit-manifest dry-run no-op、新39SHA / roots一致、旧三表の117 SHA行保持。HEAD `870a809`比で四source / SHA、manifest version以外、四openingと34実trailer以外のprofile bytes、Core / 公開仕様 / rules / ordinary validators不変を確認。`git diff --check`成功。実装と技術reviewは完了し、新metadata / retrieval実結果のhuman受入は未完了。Git書込みなし、この1コミット相当で停止。commit案: `fix(messaging): enforce exact workflow contributors`。

---

## 次checkpoint設計: MATRIX-003 Finite Closure Audit（2026-10-29設計・TDD例外承認済み）

**Intent / approaches（2026-10-29）:** main / `e9816e7`、開始時clean。ユーザーは、現candidateの全ファイル役割と既存gateの証拠を対応づけ、MATRIX-003を有限scopeで閉じられるか判定する監査案の設計化を承認した。別案のroot全体source-aware gate新設は集約事実の自動回帰を強化できるが、既存catalog / label / placement gateやMATRIX-005のpolicy責務との整理が必要。採用案はrootの規範的な固定`all`と非rootの事実寄与を区別し、残件を曖昧な「domains」のまま残したり、新しい検証責務を推測で増やしたりしない。README §3 / §3.2 / §5 / §6.1 / §8を正とする。

**Scope / evidence:** projector `1.0.5`の同一snapshotを対象とし、両profile各17 paths（root 1、CONVENTIONS 1、Source indexes 2、Operation indexes 2、channels 5、Workflows 5、Reference 1）を全件列挙する。SOURCE-TRACEABILITYへpath / file role / exact refs / 事実を供給するsourceまたは明示publication policy / 既存gate・test / 証拠境界を対応させる。四source inputs・manifest・全34profile文書と該当audit / ordinary validator / testsを照合し、出力refs同士の一致だけで正確さを認定しない。Source indexesは単なる行ID unionではなく現行catalog cells / markerの供給元を確認し、別sourceが寄与する可能性をCoreのflat例から否定しない。manifestのbinding / publication事実はSourcesの第五rowを作らないが、MATRIX-005全宣言検証の証拠には外挿しない。

**Root / boundary:** root INDEXの`source_refs: all`はREADMEの固定要件と既存`DM-SRC-005`で扱う。rootのSources / operation-shard / Workflow routingとaggregate状態については対応する既存source比較・publication policy・ordinary集約検証へtraceし、新たなwhole-root semantic proofを主張しない。MATRIX-003の判定対象は現17 filesの寄与元attributionだけで、source事実の欠落一般、未出力機能、root全意味の独立検証とは区別する。未出力のWorkflow / Unprojected shards、将来owner / source合成、任意schema / binding変換・一般generatorは対象外として明示する。Parameters known-absenceはMATRIX-004、残manifest policy / conflictはMATRIX-005、complete negative corpusはTask 13、token / retrieval効果はTask 14に残し、現在の寄与元gate成功からそれらを閉じない。

**Deliverable / acceptance:** 成果物はSOURCE-TRACEABILITYの有限role inventoryとclosure判定、candidate READMEとTODOの状態・残件更新だけ。各emitted roleのattributionに未解決の具体的factまたはgate不足があれば、path・fact・必要authorityを明示してMATRIX-003をopenのまま報告し、無条件の人手受入で誤ったrefsを正当化しない。全役割の証拠が揃った場合は「このsnapshotのemitted rolesに限定したclosure」を実結果として提示する。設計承認や既存snapshotのmetadata受入を、この新しい全役割closure判断へのhuman受入と扱わず、最終受入まではMATRIX-003の全体checkboxを自動完了にしない。Task 12全体・readinessはどちらの結果でも未完了。

**Impact / verification:** docs-only監査のため新規実装のRED→GREENは適用せず、TDD例外として設計承認を求める。code / tests / source四files / manifest / publication-policy `1.0.0` / projector `1.0.5` / 両profile全34 files / identities / Core / 公開仕様を変更しない。repository restamp writeは禁止し、既存writerのdry-runだけを使う。受入済みWorkflow snapshotの39SHAとroots・過去四snapshot表を保持し、監査対象bytes不変を確認する。既存寄与元・source traceabilityに関するtests、Core / Complete checker、両no-op、全17 paths対応・local link・差分checkをread-onlyで検証し、fresh結果と過去の全suite baselineを区別して記録する。codeまたは投影訂正が必要なら本checkpointで修正せず、実装前にscope変更を確認する。

**Review / stop boundary:** review観点は全17 pathsの漏れ / 重複、refsのauthorityが出力から循環していないこと、root固定`all`とsource completeness / policy検証の分離、snapshot bytes / 既存H evidenceの保持、closure範囲と対象外の正確さ。監査実行後の独立reviewで証拠対応と限定判定を確認し、その実結果へのユーザー受入を求めて1コミット相当で停止する。Git read-only。今回はTODOへの短い設計記録だけで、監査・MATRIX-003完了判定・新実装には着手していない。設計承認後に実行計画へ進む。

---

### MATRIX-003 Finite Closure Audit Execution Plan — 2026-10-29

> **For agentic workers:** `superpowers:executing-plans`（主担当監査）または `superpowers:subagent-driven-development` に従う。docs-only / TDD例外は承認済み。canonical TODOとGit read-onlyを優先し、別worktree・計画専用file・commitは作らない。本計画と実行方法の確認後に監査を開始する。

**Goal / Spec:** 直前の短い設計に基づき、projector `1.0.5`現snapshotの全17 emitted rolesについてMATRIX-003の有限attribution closureを判定し、根拠と対象外を固定する。実結果へのhuman受入前はMATRIX-003全体checkboxを完了にしない。

**Architecture / Tech Stack:** 既存Node.js ESM audit / ordinary validators / `node:test`とread-only検証を使う文書監査。新API・code・testsは作らない。各profileの同じpathを一行で表す17行のrole inventoryをSOURCE-TRACEABILITYへ追加し、authority・source比較・ordinary / fixture / human evidenceを分ける。source inputsとpolicyがauthorityであり、既存refsやtest literalだけから判定しない。

**Global Constraints / Files:** HEAD `e9816e7`、既存差分は承認済みTODO設計のみ。編集は本TODOと`fixtures/complete-candidates/v0.17.1/README.md` / `SOURCE-TRACEABILITY.md`の三文書に限定。source四files / SHA、manifest全bytes、publication-policy `1.0.0`、projector `1.0.5`、両profile全34 files / identities、Core / 公開仕様 / code / testsは不変。repository writer `--write`禁止（既存testsが自己所有temporary copyを作りstampすることは許可）。過去四snapshotの156SHA行・root identity記録と既存human受入は保持する。MATRIX-004–005 / Task 12・13・14 / readiness、未出力機能・一般generatorは閉じない。full suite baselineは過去1875 / 1874 pass / 1既存skipを保持し、今回のfresh実行と混同しない。

**Review Focus:** (1) 全17 paths / 両profileの漏れ・重複とrole数、(2) Source catalog cell / markerやrouting-only factの寄与を出力由来の循環で正当化しないこと、(3) root固定`all`とwhole-root semantics・MATRIX-004 / 005の分離、(4) 同一snapshot bytes / 既存H evidence保持、(5) finite closureの実結果とhuman受入・対象外の正確さ。各stepで対応する検査を行い、最後の独立reviewでも確認する。

- [x] **1. Snapshotと全roleを固定する。** 四source inputs・explicit manifest・両profile全34文書を読み、既存Workflow snapshotの39SHA / 両rootsを現在bytesと照合する。profile別path集合が一致し各17、role数がroot 1 / CONVENTIONS 1 / Source indexes 2 / Operation indexes 2 / channels 5 / Workflows 5 / Reference 1であることを確認。SOURCE-TRACEABILITYの新有限監査sectionに17行の`Path (both profiles) | Role / expected refs | Authority / contributing facts | Existing gate / test evidence | Boundary`表を作る。期待refsはsourceから手作業で導出し、同値なfull / compact出力のコピーをauthorityにしない。新hashを作り直さず受入済みWorkflow snapshotへlinkし、同一bytesの監査であることを記す。
- [x] **2. Authorityとgateの対応を全件監査する。** Source indexesはsource auditの`expectedSourceRows` / row比較 / exact refsとsource binding・各source metadataを照合し、API identity / version / revision / location / kind / specification・局所markerの供給元を明記する。現candidateの自source行だけの証拠を一般的なcross-source寄与否定にしない。CONVENTIONSは比較済み十五sectionsと両storefront source、channel / operation shardは共有operation contributor authorityとrouting/body / indexPath union、Workflowsは五source比較済みowner、ReferenceはrawContent / info / wrapper / sole-owner gateへtraceする。rootはREADME固定`all` / `DM-SRC-005`に加え、Sources・operation bounds / Tasks / Actions・Workflow labels・summary / placement / aggregate状態を各既存gateへ対応づける。manifest由来のpublication decisionsとsource由来のfactを分離し、全precedence / conflict対応とは呼ばない。具体的gapを発見した場合はpath / fact / authority / 不足evidenceを列記し、codeやprojectionは修正しない。
- [x] **3. Fresh検証と限定結論を記録する。** `node --test docai-messaging/tools/tests/complete-channel-contributor-audit.test.mjs docai-messaging/tools/tests/complete-storefront-contributor-audit.test.mjs docai-messaging/tools/tests/complete-operation-shard-contributor-audit.test.mjs docai-messaging/tools/tests/complete-workflow-contributor-audit.test.mjs docai-messaging/tools/tests/complete-candidate.test.mjs docai-messaging/tools/tests/complete-source-projection.test.mjs docai-messaging/tools/tests/complete-catalog-placement.test.mjs docai-messaging/tools/tests/complete-context-placement.test.mjs docai-messaging/tools/tests/complete-convention-retrieval.test.mjs`を実行しfail 0を確認。Source catalogのCLI証拠は`node --test --test-name-pattern='Sources|source_ref' docai-messaging/tools/tests/check-complete-fixtures.test.mjs`でfresh確認し、意図的なname-filter skipを未導入Python skipや全suite結果と区別する。Core / Completeは`node docai-messaging/tools/check-core-fixtures.mjs` / `node docai-messaging/tools/check-complete-fixtures.mjs`で264 / 193 invalid / 193/193 one-invalidity / unused 0 / gaps 0、17 paths等価を確認。両profileへ`node docai-messaging/tools/restamp-document-set.mjs --projection-manifest docai-messaging/fixtures/complete-candidates/v0.17.1/source/projection-input-manifest.json <fullまたはcompactの絶対path>`を実行し、両`restamp required: no`を確認。gapなしなら現17 roles限定のclosure finding、gapありならopen findingと不足を記し、どちらも新しいhuman受入はpendingとする。README / TODOとMATRIX-003 rowの説明を実結果に合わせ、checkboxは未完了を維持する。MATRIX-004–005 / Task 12全体を連動完了にしない。
- [x] **4. 独立review・最終差分確認・停止。** fresh reviewer一名が17行のcoverageとauthority、五Review Focus、限定結論と対象外、過去H evidenceの非転用をread-onlyで確認する。code / projection修正が必要な指摘はdocs-only scopeで実装せずユーザーへ確認。主担当はHEAD比の三文書限定差分、四source / manifest / 34profiles全bytes不変、新旧四表156SHA行保持と39SHA / roots一致、local links、`git diff --check`を確認する。TODOへ実測・review結果・影響・残件を短く記録し、実結果へのhuman受入を求めて停止。Git書込みなし。commit案: `docs(messaging): audit finite contributor closure`。

**Self-review / handoff:** 全17役割のauthority照合・Source catalog特例・root境界・same-snapshot証拠・gap時停止・human受入待ちの各設計条件をstep 1–4へ対応済み。read-only repository検証とtemporary-copy testsを区別し、docsへ新たなtestやREDを要求しない。主担当監査＋最後に独立reviewを推奨（横断するauthority対応を一つの表へ整合させ、最後に別視点で漏れを検査できるため）。role別の別担当監査も可能だが、共通のroot / policy境界の引継ぎが必要になる。本計画と実行方法の確認待ち。今回はTODOのみ変更、監査・tests・MATRIX-003完了判定は未実施。

**Execution ledger（2026-10-29）:** 本計画・主担当監査＋最終独立review・docs-only TDD例外をユーザー承認済み。開始main / `e9816e7`、既存差分は承認済みTODO設計・実行計画だけ。Git read-only / canonical TODOを優先し、別worktree・skill作業dir・commitを作らない。四inputs / manifest・両profile全34文書とrole別audit / root集約codeを読み、39SHA / roots・両17 paths・過去四表156SHA行を確認。Pre-flight: 表の17 pathとsource / policy / gate識別子に新APIや共有code変更なし。17行の有限inventoryを追加し、root fixed allと各leaf・catalog cell / markerのauthorityを分離した。現bytesのattribution mismatchは未検出、fresh検証・独立review・human受入は未完了。

**Fresh verification:** 計画の九test filesは341/341（43576.29575 ms）、Sources / source_ref絞込みは6/6（6133.808708 ms）、いずれもfail / cancelled / skip 0、exit 0。name対象外は未実行でPython skipとは別。Core 264 / 193 invalid / one-invalidity 193/193 / unused 0 / gaps 0、Complete 17 paths等価、両explicit-manifest dry-run no-op。現39SHA / roots・過去156SHA行 / root記録保持、両17 pathsとinventory一致、local file links・三文書限定差分・`git diff --check`を確認。code / tests / source / manifest / 全34profiles / Core / 公開仕様はHEADから不変。全suiteは再実行せず、過去1875 / 1874 pass / 1既存Python 3.9 skipをbaselineとして区別する。独立reviewと実結果human受入はpending。

**Final independent review / rulings:** fresh reviewer一名が五Review Focus・全差分・source / policy / gate対応をread-only確認。Critical / Important / Minorなし、deferred minorなし、修正pass・再reviewなし。39SHA / roots、156歴史SHA行、過去language review以降のH証拠bytes、34profiles不変、17役割・33local file links / 8anchors・三文書限定差分を独立確認。Declined九項目は全て境界を保持する判断: (1) 新human受入はユーザー判断（誤れば無断完了）、(2) whole-root全意味は独立証明でない（誤ればsemantic過大認定）、(3) primary Parameters前提はMATRIX-004（誤ればsource欠落見逃し）、(4) 残policy / conflictはMATRIX-005（誤れば未検証policy認定）、(5) cross-source Step testを将来Related寄与一般へ外挿しない（誤れば寄与漏れ）、(6) 将来owner / catalog identity・marker supplier / provenance chain / 一般converterは対象外（誤れば未比較入力の誤認定）、(7) source completeness・全assertion正確さは別（誤れば欠落・誤内容の見逃し）、(8) Task 12全体 / 13 / 14・production / readinessを閉じない（誤れば早すぎる公開）、(9) fresh全suite / Python 3.9成功・reviewerによる主担当検証再実行は未認定（誤れば実行証拠の過大表示）。主担当のfresh実測とreviewerの独立bytes検証を混同しない。

**Final result / stop:** 現projector `1.0.5`の全17役割・両profileに未解決attribution mismatch / 未対応emitted roleなしという有限closure findingを提出。成果物は三文書のみ、source / manifest / profile / identity / code / tests不変、Git書込み・restamp writeなし。docs-only TDD例外を維持。実結果human受入待ちのためMATRIX-003全体checkboxはopen、MATRIX-004–005 / Task 12–14 / readinessも未完了のまま、この1コミット相当で停止する。commit案: `docs(messaging): audit finite contributor closure`。

**Human acceptance / batching request — 2026-10-29:** 上記実結果への問いにユーザーが「はい」と回答。受入記録前のmain / `7872b8b`はcleanで、現39SHA / 両rootsを再確認。MATRIX-003を現17役割・同snapshotに限定して完了とし、設計承認 / 過去Hの自動継承ではなく今回の実結果への受入として三文書へ記録。MATRIX-004–005 / Task 12–16全体・readinessは閉じない。ユーザーは品質を維持しつつ次回以降の作業・commit単位拡大と完成見通しを要求したため、冒頭に暫定棚卸し / 推奨単位を追加。具体的な次scopeは提案のみで実装・tests・stamp未実施、全suite baselineは過去実測のまま。Git書込みなし。

---

## Candidate Source / Manifest Contract Closure — 2026-10-29（設計・連続実行承認済み）

**Intent / unit:** 起点main / `85dfe27`、開始時clean。前回の成果物単位拡大の提案に対する「続きを進めてください」を受け、MATRIX-004と005の具体scopeをまとめて設計する。目的は現candidateのsource / manifest契約に残る穴を塞ぎ、TDD・回帰検証・証跡更新・Task 12 source-traceability完了判断までを1つの実装checkpointとすること。今回は設計のみで、実装開始や完了扱いの承認ではない。設計だけの別コミットは必須とせず、承認後の実行計画・実装・証跡と一つの成果物へまとめられる。

**Approaches / recommendation:** 推奨はcandidate固有の有限契約gate。sourceの不在条件と、既存auditが実際に採用するmanifestのauthority / settingsを検証し、未知の設定を検証済みと扱わない。manifest全bytesの固定hash照合だけなら宣言と実装の対応を証明できず、整合したsource更新やplacement変更も拒否する。汎用precedence / counterpart / adapter変換器を新設する案は一般入力への対応力を増すが、現在のpositive candidateのsource traceabilityとは異なる責務・公開契約になるため採らない。二gateは一緒に統合・reviewするが、failure原因とmodule責務は分離する。

**MATRIX-004 / primary Parameters:** `sendCreateOrder` / `receiveOrderCreated`のsource operationが参照する実Channel ownerを確認し、`parameters`の省略または空objectだけを既知の不在とする。missing owner / unresolved referenceやnull / 配列 / scalarを不在と解釈せず、非空objectはaddressがstaticでも拒否する。両profileの対応operationのprimary ChannelでParametersが`none`であることを確認し、collapsed / headedの規範的に同値な形と既存のowner移動を維持する。file名やemitted addressからsourceの不在を導出しない。既存exact JSON / bounded section / ordinary validationを再利用し、一般parameter変換やReply Channel既存gateの再実装はしない。

**MATRIX-005 / finite manifest contract:** 対象は現`manifestVersion: 1.0.0`、DocAI `0.17.1`、projector `docai-messaging-complete-fixture-projector@1.0.5`、publication `docai-messaging-complete-fixture-publication@1.0.0`。code-ownedの認定契約として、下記13 domainsの一意性・exact `sourceOrder`、現8 adapter descriptorsのclass / target / ruleVersionの一意な集合、carry-through perspective、空counterpartMappings / stableNameOverridesを検証する。現四sourceのbindingは既存digest / metadata比較へ接続する。privateな`source` / `behavior-source` descriptorsを規範の四adapter classesと混同しない。adapters / precedence / sourcesの宣言順序やJSON member順は意味のない差として許容する一方、domain内部のsourceOrderは意味を持つ。missing / duplicate / extra / malformed / unknown source ID / wrong order / wrong rule-versionを拒否し、非対応versionや設定を一般的なDocAI非準拠と呼ばず、このcandidateの認定契約外と診断する。

| Fact domain | Exact authority order (C=contexts, R=representations, A=AsyncAPI, B=behavior) | 実際のfact比較 / 解決境界 |
|---|---|---|
| api-identity | A, B | Aのid / versionとB schemaEvolutionの明示corroboration、Sources / CONVENTIONS比較。一般fallback engineではない |
| authorization | A, B | A security scheme / scopesとB authorization / Behaviorの整合 |
| behavior-and-failure-handling | B | purpose / Behavior / failures / Reply behavior |
| complete-contexts | C | synthetic operation / Workflow / Referenceのsource facts |
| convention-dependencies | C, R | source owner別dependencyとrequired closure、既存gate維持 |
| conventions | B, A | 十五sectionのbehavior事実と選択されたnative事実の比較 |
| environment-and-protocol | A, B | selected server / host / protocol / versionとbehavior選択の整合 |
| message-contracts-and-examples | R, A | representationとstorefrontのowner別contract / examples比較 |
| operation-routing-and-message-selection | C, R, A | owner registry・routing / definition inventoryと選択Message比較 |
| operation-summaries | C, R, A | owner別Summary、既存label gate維持 |
| operation-tasks | C, R, B | owner別Task、既存label gate維持 |
| storefront-context-selection | B | 二ownerの明示required / supplemental arrays |
| workflow-labels | C | 五ownerのname / summary / displayTitle |

**Settings / no circular authority:** manifestの10 top-level fieldsと既知nested resolution fieldsをclosedなcandidate契約として扱う。未知のoutput-affecting設定をdigest一致だけで黙認せず、未解釈keyを拒否する（private manifestへruntimeの`x-`文法を自動適用しない）。既存catalog summaries / placement / context paths / Related policyは各gateのsemantic authorityに残し、それらの値を現pathやproseへ全固定しない。8 adapter descriptorsは現behavior-source三件、source一件、header-encoding一件、payload-wire二件、schema一件の認定されたexact targets / rule versionsを定義し、CSV実解釈は既存trusted helperに残す。`perspective.mode`はsource-application-carry-through、application / sourceApplication / B.perspectiveは同一の非空値、各file perspectiveは同値とし、source actionを反転しない。整合したapplicationラベル変更は受理し、API titleやAPI idからapplicationを推測しない。別application向けconversion・nonempty mapping / override・新descriptorは新しい認定契約が必要で、本gateは生成器ではなく拒否証拠を提供する。

**Adapter / binding cross-check:** descriptorsが現manifestのliteral集合に一致するだけでは十分でなく、sourceの実native version・有効schema / wire target・header encodingと適用中のcode-owned ruleへ対応させる。representation側のexact schemaFormat / mediaType / CSV mapping比較は既存gate、storefront側の選択Message / local bindings / protocol比較は既存gateを使い、未比較のsource adapter target（例: source AsyncAPI versionだけを変更しdescriptorを据置く）やbinding type / specificationの食違いは今回のguardで拒否する。一般的なschema keyword / native source全体のvalidationへ広げず、未対応targetはこのcandidate契約外とする。

**Conflicts / diagnostics:** authority source同士のidentity/version・authorization・protocol・Reply等の現corroborationが矛盾すれば、両profileを一致させfresh stampしても既存source比較または新contract gateで拒否する。非authorityなshadow Task / Summaryの相違は既存どおり正当なauthoritative値で受理し、「値が異なるものを全拒否」にしない。未解決conflictをunknown / unsupportedに置換したまま合格させない。owner partition・必須のcorroboration・非authority shadowを区別し、13宣言一致を任意入力のfallback / equal-priority conflict解決能力と称さない。ordinary-invalid pair / CSV adapter解釈不能 / stale source digest等の既存一次診断を保ち、malformed contractを偶発TypeErrorで処理しない。generic pair（candidate manifestなし）の既存CLI用途とordinary readerの責務は変更しない。

**Implementation boundary:** source比較本体と`complete-storefront-message-audit.mjs`に接続するcandidate-only helpers / testsを追加または拡張する。新manifest preflightは構造の安全確認とbinding後のsource整合を分け、existing source / policy / contributor gatesを置換・弱体化しない。schema / adapterの一般converter、公開rule追加、ordinary validator / writer変更は対象外。必要なら別scopeとして確認する。既存helperのtemporary copy / source rebind / explicit-manifest stamp / ordinary validation / checker bytes snapshotを再利用し、source mutationとrepository更新を区別する。

**TDD / evidence contract:** 二primary ownerそれぞれの非空・malformed Parameters、sourceとmanifest perspectiveの矛盾、未検証precedence domainの欠落 / 重複 / order変更、non-CSV adapter descriptor変更、mapping / override追加等について、ordinary-valid・freshly stampedなtemporary pairを旧checkerが受理するREDを先に観測する。既存gateが既に拒否するケースは新REDと偽らず継続regressionとする。全13 domains / 8 descriptorsの表駆動missing・duplicate・extra・malformed変異、内部sourceOrder差と宣言順差、局所corroboration conflictとnon-authority shadow、両profile出力の一致した不正変更を固定する。新pure helperのmissing/null境界、source / ordinary / CSV一次診断、checker read-onlyも確認する。正例はrepository unchanged、空Parameters object、headed none、source / manifest宣言順差、同じauthorityからの整合fact更新、applicationラベル変更、既存channel / shard / Workflow / Referenceの整合relocationを含む。

**Verification / bytes / review:** 実行計画で関連CLI・source projection・example adapter・全contributors・placement・context・profile testsを指定し、RED→GREEN後に全suite、Core / Complete、両explicit-manifest dry-runを実行する。既存Python 3.9 skipは別記。repository四sources / manifest / 全34profiles / identities / Core / 公開仕様はHEAD比で全bytes不変、current39SHA / roots・歴史156SHA行 / H evidence保持を要求する。projection訂正やrestamp writeは不要という設計で、必要になれば実装前にscope変更確認。source audit / new gateの最終独立reviewで、Parameters owner不在との区別、全manifest domain / settingsのauthority対応、正当な変更の非退行、一次診断・read-only、有限closureの過大認定なしを確認する。

**Completion / estimate:** M004 / M005の証拠と、既存M001–003・source fact matrixの有限scopeをまとめてTask 12 source-traceabilityを判定する。Referenceのfinal-LFなし正例・consumer除去の単独mutationという既存branch候補も今回の有限candidate比較の仕上げに含める。一般Headers duplicate / binding none後のx-marker不具合は別のvalidator checkpoint、versioned complete / first-1.x corpusはTask 13、token証拠はTask 14に残し、Task 11–16全体 / readinessは閉じない。新human semantic / metadata受入はsource / snapshot不変から捏造せず、新gateの技術結果と現在scopeでのTask 12完了判断を提示する。残10–15の暫定見通しは据置き、本成果物完了後に再見積もる。Git read-only、主担当実装＋最終独立reviewを推奨。設計の実装者視点check後にユーザー承認を求め、承認後は実行計画からTDD・最終検証までを同じcheckpointとして進める。commit案（実装までまとめる場合）: `test(messaging): close candidate source and manifest contracts`。

**Design check / verification:** freshな実装者視点check一名から、計画化前に回答が必要な重要質問なし。主担当はadapter宣言とsourceの実targetを照合する責務も明記し、宣言literal一致だけの証明と区別した。Core checker 264 / 193 invalid / one-invalidity 193/193 / unused 0 / gaps 0、Complete checker 17 paths等価で成功。今回はTODOの設計だけを変更し、code / tests / source / manifest / profiles / identities・既存受入 / 完了checkboxは不変。全suite・新RED / GREENは実行していない。M004 / M005の実装scopeとしてこの設計の承認待ち。

---

### Source / Manifest Contract Closure Implementation Plan

> **For agentic workers:** `superpowers:executing-plans`で主担当実装＋最終独立review。Specは直前の承認済み設計。ユーザーの「実行計画からTDD・全suite・独立review・完了判断まで同checkpoint」への承認を受領し、scope内は途中の独立commit / 確認待ちを挟まず実行する。

**Goal / Architecture / Tech Stack:** source Parameters absenceとfinite manifest契約をcandidate専用Node ESM helpersで検証し、既存source / pair gatesに合成する。公的なgrammar / ordinary validatorを変更しない。

**Global Constraints:** 起点main / `85dfe27`、開始差分は承認済みTODO設計だけ。Git read-only、別worktree / skill作業dir / commitなし。repository四sources・manifest全bytes・projector `1.0.5` / publication `1.0.0`・全34profiles / identities・Core / 公開仕様不変、repository writer write禁止。temporary test copiesのみ既存helperでstamp可。既存Hは保持、一般generator / Task 11・13–16 / readinessを認定しない。

**Files / Interfaces:** 新`tools/lib/complete-manifest-contract.mjs`から`auditCompleteManifestShape(manifest) -> string[]`と`auditCompleteManifestSources(manifest, sources: Map<string,object>) -> string[]`をexport。shapeはsource binding前、sourcesはbinding後に`complete-candidate-source-audit.mjs`へ合成。前者はclosed shapes / 13 ordered authorities / 8 exact descriptors / versions / empty settings、後者はnative version / binding metadata / perspective等のsource整合を扱う。`complete-storefront-message-audit.mjs`へ`auditStorefrontPrimaryParameters(source: exactJsonMap, set, core, check)`を追加してsource比較へ合成。新`tools/tests/complete-candidate-contract.test.mjs`は既存contributor fixture helperのcopy / mutateSource / checkを使う。candidate README / SOURCE-TRACEABILITY / 本TODOの有限証拠・完了状態を更新する。

**Review Focus:** (1) missing ownerやmalformed Parametersを不在扱いしない、(2) 13 domains / 8 descriptorsとsource実target・code ruleの対応をdigest一致で代替しない、(3) 既存のsource更新 / relocation / non-authority shadowの正当性を保持、(4) ordinary / CSV / source一次診断とchecker read-only、(5) 同一snapshot / H evidence保持とTask 12限定完了・Task 13以降との分離。

- [x] **1. RED:** 新CLI testsで二primary owner × nonempty / null / array / scalar Parameters、未検証authority domain変更、non-CSV descriptor変更、mode / sourceApplication / B.perspective不整合、mapping / override・unknown field追加をordinary-valid / freshly stampedで作り、`check(dir, 1, /Parameters|manifest contract/i)`。`node --test docai-messaging/tools/tests/complete-candidate-contract.test.mjs`が旧CLI exit 0で失敗することを観測。既存拒否ケースは別regressionにする。
- [x] **2. GREEN:** 上記三APIを実装しsource auditへ合成、RED command成功。manifest shapeは10root fieldsと既知nested shapesをclosedにし、publication paths / summariesの値は各既存gateへ残す。sourceOrder内部のみ順序依存、descriptor / declaration順は無関係。Parametersは実owner＋省略/空Mapとbounded出力noneを比較する。
- [x] **3. 境界・非退行:** 13 domains / 8 descriptorsのmissing / duplicate / extra / malformed・order差、closed settings各shape、source metadata / adapter target差、helper null入力を固定。正例は空Map / headed none・宣言順差・整合application変更・正当なsource fact変更・全既存relocation、負例はcorroboration conflict、source/ordinary/CSV一次診断。Reference final LFなし正例とsole consumer除去負例を追加。各CLIでfresh stamp / ordinary-valid / bytes不変、ordinary-invalidは先行診断を区別する。
- [x] **4. 全検証・証跡:** focusedは新testと`check-complete-fixtures` / `complete-source-projection` / `complete-example-adapters` / `complete-context-placement` / `complete-profile-pair` / 四contributor files / catalog・channel placement tests。全suiteは`node --test docai-messaging/tools/tests/*.test.mjs`、Core / Complete checker、両explicit-manifest dry-runを実行。fail 0、既存Python 3.9 skip別記、no-op、39SHA / roots・歴史156SHA / H保持、source / manifest / profiles / Core / 公開仕様不変・diffcheckを確認。三docsへM004/005・Task 12有限完了結果と残件を記録する。
- [x] **5. 独立review・停止:** fresh reviewer一名へ承認設計・本計画・全差分と五Review Focusを渡す。Critical / Importantは一回のTDD修正pass、Minorは記録、declined項目は判断と理由を記録。再reviewなし。最終bytes / 差分確認、Task 12結果と見積更新を提示し1成果物で停止。Git書込みなし。commit案: `test(messaging): close candidate source and manifest contracts`。

**Self-review / execution ledger:** 設計の二gate・全manifest domains・source target整合・Reference二branch・五Review Focusをstep 1–5へ対応。shape→binding→source整合→既存semantic比較の依存があり、manifest shapeがsource registryのnull / arrayを先に拒否する必要があるためAPIを二段に分離した。source helpersは既存exact Map / plain parsed sourceの役割を維持する。scope・実行方法はユーザー承認済み。主担当実装中、RED以降は未完了。

**Execution progress:** 旧CLIが受理したordinary-valid / freshly stampedな29負例をRED観測し、二primary ownerのParametersとmanifest shape / source整合gateを合成して初回139/139 GREEN。追加の非文字列domain / null manifest境界もRED→GREEN、UTF-8 descriptorを据置いたままsourceと出力をbase64へ一致変更するCLI負例とheader rule三helper負例もRED→GREENにした。headed ParametersはBindingsもheadedにする規範形へ、Reference final LFなし正例は元sourceの末尾空行を保持したままと誤認せず新sourceに合う出力へfixtureを補正した。production grammar・既存診断を緩めない。175/175成功後、null manifestとmissing owner / reference境界を加えた最終新test・既存focused・全suiteを実行中。Core 264 / 193 / one-invalidity 193/193 / unused 0 / gaps 0、Complete 17 paths等価、両explicit-manifest dry-run no-op。独立reviewとTask 12最終判断は未完了。

**Independent review / one fix pass:** reviewer一名が全差分・五Review Focusをread-only確認。Critical / Minorなし、Important二件（storefront payload-wireのsource target / encoding照合不足、Unicode edge whitespaceの過剰拒否）を採用。新CLI四件でRED観測し、selected Messageだけのeffective target / UTF-8 contract確認とASCII edge判定へ修正。新190/190（20495.287 ms）・一次診断 / Serialization focused10/10（3450.388292 ms）、fail / cancelled / skip 0でGREEN。初回focusedの既知設定block欠落 / convention診断の退行は、既存testsを変更せず各gateへ責務を戻して解消。修正前の全suite runは中断し、post-review全suiteで最終証拠を採る。再reviewなし、deferred minorなし。

**Final review rulings（declined九項目）:** (1) post-fix全suite / Core / Complete結果は主担当実測を正とする（誤れば未検証成功表示）；(2) 初回RED履歴は主担当観測を正とし独立再実行と称さない（誤れば証拠の水増し）；(3) Python 3.9は未導入skipで成功未認定（誤れば環境保証）；(4) 一般converter / 任意precedence・fallback / future formatsは認定外（誤れば未対応入力の誤処理）；(5) helperはinternal parsed-source APIで任意hostile JS object対応を公称しない（誤れば公開API誤認）；(6) whole-source全memberの意味 / completenessは別で、無効なMessage-level schemaFormat keyの推測を有効target差と扱わない（誤れば過大認定または架空blocker）；(7) 新human semantic / metadata受入を技術reviewから捏造しない（誤れば無断承認）；(8) Task 11全体 / 13–16 / readiness / token・performanceは未完了（誤れば早すぎる公開）；(9) 最終docsは修正後検証を受けて現candidateのTask 12 traceabilityだけ完了とする（誤れば認定範囲拡大）。この順序で境界を保持する。

**Final verification / result:** post-review全suiteは2065件 / 2064 pass / 1既存Python 3.9 skip / fail 0 / cancelled 0、312904.712583 ms、exit 0。新190/190・focused10/10もfail 0。Core 264 / 193 invalid / one-invalidity 193/193 / unused 0 / gaps 0、Complete 17 paths等価、両explicit-manifest dry-run no-op。現39SHA / 両roots・歴史156SHA行 / root記録とlanguage review以降のH証拠全文をHEAD `85dfe27`比で保持。repository source / manifest / profiles / Core / 公開仕様 / ordinary validators / writerは不変。新二filesを含む七scoped filesだけ、local links / anchorsと`git diff --check`を確認。M004 / M005・Reference二branch・Task 12有限traceabilityを1成果物として完了し、残見通しを9–14へ更新。一般validator gaps・Task 11全体 / 13–16・readinessは残す。Git書込みなし、この1コミット相当で停止。commit案: `test(messaging): close candidate source and manifest contracts`。

---

## Ordinary Validator Boundaries — 2026-10-30調査（案A承認済み）

**Preflight / scope:** main / `4c165d7`、開始時clean。AGENTS全文・status / log・TODO残件・Core Remaining Inventory・README §3.1 / §3.5 / §3.6 / §4.1 / §8の現境界を確認。Task 12 / MATRIX-001–005はcommit済みで再実装しない。既知二件を一つの仕上げ候補として調査したが、Headersについて仕様判断が必要と判明したため実装前で停止する。

**Read-only reproduction:** Core full setをloadし、独立したmemory copyのcontent / bytes / identityLineだけを変更して`validateCoreDocumentSet`を実行。baseline診断0、同名同値Header行の追加はRECEIVE / SEND / Replyの三箇所とも診断0。Operation Bindings・primary Message Bindings・reply Message Bindings・collapsed Channel Bindingsの`none`後に`**x-audit**: non-contract note`を置く四例は、それぞれ`DM-OP-004` / `DM-MSG-002` / `DM-MSG-002` / `DM-OP-004`で拒否された。repository files不変、identity再計算を伴うCLI成功やsource-aware証拠ではない。

**Cause / normative distinction:** Headersのdirection table検証にはName重複検査がない。一方READMEはlogical header mapを述べるものの、一般Headersの行Name一意性・同値重複・比較scopeを明示していないため、checker厳格化だけで既存仕様の修正と断定できない。`none`後の拡張拒否は、state readerがmarkerをcore行として数えるため。こちらは既存§3.1の「required content後のx-markerを無視する」規則との明確な不一致で、新規規範の追加とは区別できる。

**案A（推奨・承認済み）:** 現`0.17.1`では既存の拡張規則との整合修正を先に一成果物で行い、Headers一意性は初版`1.0.0`の明示規範・versioned invalid corpus・checker拒否を同じversion change setで必須化する。既存publicationの契約と新制約の適用開始を明確に分離できる。欠点は一般Headers拒否の有効化がその段階まで残ること。初版外へ落とすbacklogではなく、Task 13 / 15で必ず閉じる公開前項目として追跡する。

**案B（未承認）:** Headers一意性を今のdraftで明文規範として追加し、意味変更なら§3.1に従う次minorと新versioned corpus / identities / reviewを伴って一般validatorを厳格化する。次draftから明確な一意性契約を検証できるが、現`0.17.1`の修正とは別のversion移行・証跡受入が必要になる。単にcodeだけを変えて同値重複まで禁止し、version影響を曖昧にする案は採らない。

**Next / impact:** どちらの案でもHeadersの比較はlogical Name cellのASCII-space trim / table-level pipe decode後のexact値・同一table内を基本候補とし、case-fold / Unicode normalization・別Message間の名前禁止を勝手に導入しない。拡張修正は合法な末尾markerと早過ぎる / coreを分割するmarkerを分け、post-table marker orderingと既存一次診断を保持する範囲を設計する。今回は本TODOの調査・選択肢だけを記録し、code / tests / README / corpus / source / manifest / profiles / identity / 既存完了状態は不変。全suite再実行なし、2065 / 2064 pass / 1 skipは前回実測。残9–14は暫定のまま、案Bの場合はversion移行量を確認して再見積もる。Git read-only。

---

## Trailing Binding Extensions — 2026-10-31（設計・連続実行承認済み）

**Intent / approaches:** main / `4c165d7`、開始差分は前回TODO調査だけ。ユーザーは案Aを選択した。既存§3.1の拡張規則との不一致を0.17.1で修正し、Headers Name一意性の新制約は初版1.0.0の規範・corpus・checkerと同期して導入する。案Bは次draftから一意性を明確にできるが、今のpublicationとは別のversion移行・証跡が必要。codeのみで現0.17.1を厳格化する案は採らない。今回は同一責務の小規模bugfix設計であり、Task 12の再実装や初版の範囲縮小ではない。

**Goal / scope:** Operation Bindings、primary / reply Channel Bindings（headed / collapsed）、primary / reply Message Bindings、共通 / inline failure-shapeのBindingsについて、既存のcore stateが完了した後の一行`x-` markerを無視し、元のBindings stateとcontract factsを変えない。`core-operations.mjs` / `core-messages.mjs`のbounded state readerを対象にし、共有処理の切り方は実行計画で固定する。Headersの重複拒否、Headers / Parameters / Payload一般のextension処理、x-heading / multi-line extensionの新対応、全未知構造の一括除去は対象外。共有Message grammarを使うfailure-shapeへの効果は含める。

**Boundary / algorithm:** marker認識は既存`postTableMarkerKind`のextension判定を再利用し、新しい名前文法やUnicode変換を発明しない。none / unknown / replacement-unsupportedでは、先行deviationと必須core contentが既存grammarで完了した後のmarker suffixだけを対象にする。unknownのkey-local marker隣接、replacement unit名・scope、次標準subsection境界、leading-empty collapseと実line位置を維持し、早過ぎるmarker・coreを分割するmarker・marker後の追加standard contentを受理しない。expanded tableは既存post-table marker群の連続性 / 順序 / unknown対応を保持し、suffix除去で違反を隠さない。non-table extensionにpost-table専用の並替え・一意性を追加しない。collapsed Channel末尾はChannel全required content完了とBindingsの境界を区別する。

**TDD / verification:** まず現checkerで拒否される合法な末尾markerをREDとして固定し、各Bindings scope / 既存core states・collapsed / headed・複数markerを検証する。対になる負例は先行marker、unknown immediate sequenceの分断、missing core、scope違いのreplacement、extension後のstandard content、post-table order / adjacency違反。CoreとCompleteのordinary validationを対象とし、既存source-aware gateを弱めない。temporary copiesではfresh stamp / whole-set検証・checker前後bytes不変も確認する。全suite、Core / Complete checker、candidate両explicit-manifest dry-run、現39SHA / roots・歴史156SHA / H証拠保持、diffcheckで締める。既存Python 3.9 skipは別記し、versioned corpus / coverageの未達をtest件数で代替しない。

**Impact / review / stop:** repository source / manifest / profiles / identities・Core corpus / PUBLICATION・READMEの意味 / version・rulesの意味は変えず、新regression testsと必要なvalidator修正・TODO等の証跡更新を一成果物にまとめる。新しい規範や投影訂正が必要なら実装前に確認する。主担当TDD＋最終独立review一名を採用し、review重点はsuffixの所有scope、必須contentを消さないこと、非tableとpost-tableの区別、failure-shape共有効果、source-aware / ordinary / bytes境界。HeadersはTask 13 / 15の明示checklistに移し、初版公開前に必ず実装・検証する。設計時点ではcode / 新tests未着手、実行結果は下記ledgerを正とする。Git read-only、commit案: `fix(messaging): preserve trailing extensions in binding sections`。

---

**Execution plan / ledger:** 承認済み短設計を実装・最終検証まで連続実行する。① `tools/tests/core-binding-extensions.test.mjs`で全Bindings scopeのfixed state / suffixと対になる不正配置を先にRED確認。② 新internal helper `bindingCoreLines(lines)`を`core-binding-extensions.mjs`へ置き、非tableの末尾extensionだけを除く。Operation / Message / reply ChannelのBindings state readerに限定適用し、collapsed Channelの末尾も必須内容を保持して検査。Parameters / Headersとtable marker検証には適用しない。③ 共有failure-shape tests、Complete temporary copyのfresh stamp / pair / read-only CLIをGREEN確認。④ `node --test docai-messaging/tools/tests/*.test.mjs`、Core / Complete CLI、両explicit-manifest dry-run、Git diff / byte保持を確認し、五重点の最終独立review一名で締める。Expected: focused全成功、全suite fail / cancelled 0（既存Python 3.9 skip別記）、Core264 / invalid193 / gaps0、Complete17 paths等価・dry-run no-op。Pre-flight: shared helperはline object / line座標を保持し、table readerと非table readerの契約を分離する。既存TODOを計画・ledgerとして使い、Git書込み・別worktree・別plan commitは作らない。

**TDD progress:** valid core単体が診断0となるmetadata / exact replacement unitを確認してから、65件中17件の期待RED（合法suffix16件とcollapsed reply Channelの余剰core見逃し）を観測。共通 / inline headed failure-shape二件もRED→GREEN、collapsed failure-shape余剰core二件を追加RED→GREEN。共有helperは非table末尾だけを除き、全scopeの先行 / 分断 / missing / wrong-scope / table order・adjacency負例を保持。focused77/77、failure-shape4/4成功。

**Ruling: source-aware Reply Channel比較は本checkpointで変更しない** — 承認済み範囲はordinary state readerであり、有限candidateのsource comparatorはcanonical Reply Channel textを要求する。全8Bindings箇所に拡張したtemp full / compactはfresh stamp・ordinary pairを通り、この一点だけsource gateで拒否することを固定。reply Channelのmarkerだけ外した7箇所版はsource-aware CLI成功・前後bytes不変。投影比較の訂正は次の設計判断として残す。誤りなら合法拡張を含むreply ChannelがComplete source-aware gateで引き続き拒否される（ordinary修正をsource-aware完了と公称しない）。Headers新制約はTask 13 / 15必須のまま。

**Final review / fix pass:** 独立review一名がtracked / untracked全差分と五重点をread-only確認。Critical / Minorなし、Important一件を採用。helperのraw先頭`|`判定がtable parserのASCII-space許容と不一致で、Operation / primary Channel / reply Channelのspace付きtableのmarker順序・隣接違反を隠す。六件のREDを主担当で再現し、ASCII spaceだけを除いた先頭判定へ修正。対になるordered-table valid三件を含めfocused90/90 GREEN。修正前全suite runは中断し、修正後の全suiteで最終証拠を採る。再reviewなし、deferred minorなし。

**Final review rulings（declined五項目）:** (1) source-aware Reply Channelの合法拡張拒否は上記既知制約として次設計へ残す（誤れば合法input拒否が続く）；(2) Headers / Parameters / Payload一般・x-heading / multi-line extensionは今回認定外（誤れば対応範囲の過大表示）；(3) Headers Name一意性は初版1.0.0の規範 / corpus / checkerと同期して必須化（誤れば公開時の制約漏れ）；(4) Message / failure-shapeのspace付きBindings table拒否は既存の別gapとしてTask 13棚卸しへ渡し、今回のtable-tail退行修正と混同しない（誤れば合法table拒否が残る）；(5) versioned corpus全体 / release readinessは未完了（誤れば早過ぎる公開）。最終実測は主担当が確認し、reviewerによる全suite再実行とは称さない。

**Verification follow-up:** 修正後全suite初回は2159件 / pass2157 / fail1 / 既存skip1、322277.401958 ms。唯一の失敗は既存Task 6 rule/test対応監査で、新failure-shape四test名のrule ID欠落が原因。挙動testsの失敗ではないが完了とは扱わず、既存wrapperの命名契約に合わせ各名へ`DM-FAIL-003` / `DM-CONV-004`を付けた。failure-shape＋Task 6対応監査focusedを再実行してから全suiteを再実行する。validator / 期待診断を弱めず、review fix passは全suite GREENまで未完了。

**Final verification / complete:** post-review・rule/test対応修正後の全suiteは2159件 / 2158 pass / 既存Python 3.9 skip1 / fail0 / cancelled0、328389.372833 ms、exit0。focused90/90、failure-shape＋Task 6対応監査11/11成功。Core264 / invalid193 / one-invalidity193/193 / unused0 / gaps0、Complete17 paths等価、両explicit-manifest dry-run no-op。現39SHA / 両rootsを実測照合し、全156SHA行とH reviewを含むSOURCE-TRACEABILITY全文・source / manifest / profiles / identities / Core / 公開READMEはHEAD `4c165d7`比で不変。TODO local link targets13件・`git diff --check`成功。tracked四files＋新helper / tests二filesの計六filesのみ。今回のordinary Bindings末尾拡張修正を1成果物として完了し、Git書込みなしで停止。source-aware Reply Channel比較と既存Message / failure-shape space付きtable gap、Headers新規範、Task 11全体 / 13–16・readinessは残る。残9–13は暫定、次coverage棚卸しで更新。commit案: `fix(messaging): preserve trailing extensions in binding sections`。

## Binding Grammar / Source Comparison Closure — 2026-10-31（案A・連続実行承認済み）

**Short design / approaches:** 起点main / `c5ce52e`、clean。前checkpointはcommit済み。ユーザーは既存parser / 正規化処理へ揃える案Aを選択し、短設計・TDD・全suite・最終独立reviewを一成果物で連続実行することを承認。案Aはordinary構文gateとsource契約照合の責務を保てるが、正規化が契約差を隠さない負例が必要。案B（Core公開factsの追加とsource照合からの参照）は構文解釈を集約できる一方、facts APIと既存consumersへの影響を伴う。今回は前回残した二境界を閉じ、前回の末尾marker処理を再実装しない。

**Goal / constraints:** primary / reply Messageと共通 / inline failure-shapeのBindings tableについて、ASCII space付き行を既存`parsePipeTable`のgrammarで扱う。Headers等へ新しい受理規則を広げず、table後markerの隣接・順序・unknown対応と実line座標を保持。finite candidateのReply Channelは、ordinary-validなheaded / collapsed empty Parameters / Bindingsと合法な末尾一行extensionをsource照合でも扱い、source側のparameter / binding不在と投影側の`none`を引き続き要求する。新Core facts API、任意source binding投影、一般extension対応、Headers一意性の新制約、normative / version変更は対象外。source四files / manifest / profile34files / identities・Core corpus / README・H review evidenceは不変。Git read-only、既存TODOを計画・ledgerに使い、別worktree / plan commitなし。

**Implementation plan（主担当inline / 単一task）:**
- [x] RED: `tools/tests/core-binding-extensions.test.mjs`でprimary / reply Messageのspace付きtable valid、既存table-tail negative、ASCII以外のwhitespace / malformed tableを固定。既存Complete temp testのreply extension版をCLI成功へ変更してRED確認し、両profile同時・片側だけの合法extension、headed / collapsed formsを加える。`document-set.test.mjs`へrule ID付きfailure-shape table正負例を追加。Expected: 現実装で合法table / Reply extensionが期待診断で失敗、setup失敗は数えない。
- [x] GREEN: `validators/core-messages.mjs`の`canonicalUnitState`でBindingsだけを`parsePipeTable`へ委譲し、Headersの前提は保持。`complete-candidate-source-audit.mjs`はbounded Reply Channelに既存`canonicalRepresentationView(file,startLine,endLine)`を使い、空subsectionの合法heading表記だけを同じnone契約として照合する。未知standard text・table / unknown / replacement / 追加coreはnoneと同一視しない。新関数を要する場合もcandidate内部のbounded helperに留める。
- [x] Verification: focused両filesとrule/test対応監査を先にGREEN確認。temp candidateはexplicit-manifest fresh stamp→ordinary pair→source-aware CLI、checker前後bytes不変を検証し、source側にparameter / bindingを加えたordinary-valid例は拒否を維持。全suite `node --test docai-messaging/tools/tests/*.test.mjs`、Core / Complete CLI、両explicit-manifest dry-run、39SHA / 両roots・全156SHA行 / H review全文、diffcheck / linksを確認。Expected: fail / cancelled0、既存Python3.9 skip別記、Core264 / invalid193 / gaps0、Complete17 paths等価、dry-run no-op。
- [x] Final: 一名のfresh reviewerが全差分をread-only確認。Important / Criticalは一回のTDD修正＋全suite、Minorとdeclined判断はledger / finalへ記録。Review Focus: (1) ASCII spaceのみのtable grammar、(2) marker order / adjacency / unknownの保持、(3) empty subsectionのscope / missing content、(4) sourceの既知契約差をextensionで隠さない、(5) ordinary / source-aware / byte証跡の分離。完了後停止し、Task 13棚卸しを次候補にする。commit案: `fix(messaging): align binding syntax and source comparison`。

**Pre-flight / ledger:** APIは既存table parserとcanonical viewのみ、Core facts API変更なし。source normalizerはordinary成功後に使う既存gateを維持し、normalizerで構文不正を救済しない。HEAD / cleanとCore Remaining Inventory空、README §3.1 / §8と前回TODOの未認定境界を再確認。短設計とplanをself-reviewし、二修正は同じBindings grammar整合のcheckpointにまとめる。

**TDD / progress:** 初回focusedで8件RED、追加後115件中11件RED（space付きMessage / SEND / reply Message table、unknown correspondence、Reply末尾拡張・四headed組合せ・full-only拡張）、共通 / inline failure-shape table valid四件もRED。いずれも既存の期待diagnosticで拒否されることを確認し、setup失敗はなし。Bindingsだけ既存table parserへ委譲、bounded Reply Channelをcanonical viewで比較してGREEN。Core scoped117/117、failure-shape＋Task 6 rule/test監査19/19成功。ASCII以外のindent・malformed / wrong-column / missing unknown marker・table marker order / adjacencyは拒否を維持。temp両profilesはfresh stamp / ordinary pairを経由し、source parameter / binding追加、投影Reply / Message binding追加はsource gateで拒否、全CLI前後bytes不変。次は全suiteと最終独立review。

**Final independent review:** 一名が五files全差分とparser / normalizer / section extraction / CLI prerequisite / marker ordering / failure-shape callersをread-only確認しapprove。Critical / Important / Minor / declined-to-judgeは全てなし、修正pass / 再reviewなし。独立memory probeでheaded / collapsed validを受理、missing Parameters / Bindings・wrong scope・extra core・reordered subsections・early extensionをordinary `DM-REPLY-002`で拒否し、source auditの前提との分担を確認した。reviewerは全suiteを重複実行せず、主担当の最終結果を正とする。

**Final verification / complete:** 全suite2194件 / 2193 pass / 既存Python3.9 skip1 / fail0 / cancelled0、329228.19825 ms、exit0。focused117/117、failure-shape＋Task 6対応監査19/19成功。Core264 / invalid193 / one-invalidity193/193 / unused0 / gaps0、Complete17 paths等価、両explicit-manifest dry-run no-op。現39SHA / 両root identity照合、全156SHA行 / H reviewを含むtraceability全文、source / manifest / profile34files / Core / READMEのHEAD `c5ce52e`比bytes保持を確認。TODO local links13件・diffcheck成功。変更はvalidator / source audit二files・tests二files・本TODOの計五files、repository restamp / Git書込みなし。既知二境界を一成果物として完了し、残見通し8–12へ更新。Task 11全体 / 13–16・Headers新規範・公開readinessは未完了のまま、このcheckpointで停止。commit案: `fix(messaging): align binding syntax and source comparison`。

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
- [ ] 初版1.0.0のHeaders Name一意性について、同一logical table内の同名同値 / 矛盾行、SEND / RECEIVE / Reply / failure-shape・compact復元、別Message同名許可とexact比較のvalid / invalid証拠を用意する。適用開始versionを明示し、現0.17.1へ新しい一般禁止を混入させない（2026-10-31案A承認、Task 15で規範 / checkerと同期して有効化）。
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
- [ ] 案AのHeaders Name一意性を初版1.0.0の明文規範・version-aware checker・Task 13のversioned casesと同change setで有効化し、一般Headers拒否の未実装を公開前blockerとして解消する。比較scope / normalizationは規範に明示し、旧0.17.1のexpectationを黙って上書きしない。
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

## 再開手順と記録方針

1. AGENTSを読み、Git status / logと正本の最新状態を確認する。完了済みTask 1–10へ戻らない。
2. contributor checkpoint / MATRIX-001–005 / Reference追加branchを再実装しない。projector `1.0.5` snapshotと全17役割の寄与元監査は受入済み、Task 12有限traceabilityは完了。次は冒頭の成果物単位 / 暫定見通しで既知ordinary validator gapsとTask 13 coverageの具体scopeを確認する。root固定`all`の再実装はしない。順序変更は先に確認する。
3. Task 11–14はcomplete surface、Task 15はRC、Task 16はstable。前段のexit criteriaを満たさず後段の完了を宣言しない。
4. 今後の各checkpoint記録は「変更・影響・最終検証・残件・commit案」の短い要約とし、途中runや解決済み試行錯誤を累積しない。詳しい根拠はcode / tests / versioned auditとGit履歴へ委ねる。

**今回の整理:** TODOのみを書換え。完了済み詳細ログ、古いtarget tree / 擬似API / test snippets、重複した過去状態を削除し、現在状態と未完了checklistへ集約。承認待ち設計は原文保持、Task 13–16とFinal Review Checklistは維持した。実装・source・manifest・profiles・coverage・承認状態は変更しない。

**整理の検証:** 承認待ち設計とTask 13–16 / Final Review Checklistの原文一致、local links 10件の存在、TODO以外に差分がないこと、`git diff --check`成功を確認。文書整理のみのため全suite / fixture checkerは再実行せず、上のbaselineは過去実測として保持する。
