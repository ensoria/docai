# DocAI Messaging Fixture 初版 — 進捗と残作業

**目的:** DocAI Messaging `0.17.1` のCompatibility Coreからcomplete generator surface、RC、stable `v1.0.0` の再現可能なconformance corpusへ進む。

**整理日:** 2026-10-24。ユーザー依頼により、完了済みcheckpointの設計・TDD・途中検証・reviewの詳細ログをGit履歴へ委ね、現在状態と残作業へ集約した。整理前の全文はcommit `184066d` から参照できる。この整理は仕様・実装・作業順序・承認状態を変更しない。

## 正本と作業ルール

- 規範仕様は[README](README.md)、Core coverageは[Core COVERAGE](fixtures/core/v0.17.1/COVERAGE.md)、candidateのfact別根拠と認定範囲は[Complete SOURCE-TRACEABILITY](fixtures/complete-candidates/v0.17.1/SOURCE-TRACEABILITY.md)。実装・期待値と衝突したらREADMEの意味を先に確認する。
- [リポジトリAGENTS](../AGENTS.md)を守り、Gitは読取り専用。add / commit / stash / checkout / reset / fetch / pull / push / tag / config / worktree変更は行わない。コミットはユーザーが行う。
- 一度に1コミット相当のcheckpointだけ進めて停止する。実装はTDD（RED→GREEN）、順序・scope変更は実装前に確認。完了済みcheckpointを再実装しない。
- 判断が必要なら各案の利点・欠点・推奨理由を示す。変更量の少なさを推奨理由にせず、仕様・設計・品質を優先する。
- 設計・影響・実測・残件を本TODOへ簡潔に記録する。終了時は変更概要、検証結果、review観点、残件、1行commit案を提示する。
- all-channel / operation-index shard / 比較済み五Workflow contributorの実装・検証は完了。projector `1.0.5` snapshotのmetadata / retrieval実レビュー結果は2026-10-29にユーザー受入済み。次scopeへ自動で進まない。

## 現在の到達点

| 項目 | 状態 / 根拠 |
|---|---|
| 仕様 / 公開範囲 | `0.17.1` / Draft、Compatibility Core implementation target。complete-generator-ready / compatibility-stable / stableではない。 |
| Task 1–7: checker foundation | 完了。parser、metadata / table / path / sentence、exact media type / JSON、identity / closed root / mixed set、Core構造、不完全情報 / adapters / trust boundary。 |
| Task 8–9: Core source / set / focused corpus | 完了。264 cases（193 invalid / 71 valid）、one-invalidity 193/193、unused Core rules 0、coverage gaps 0。`R8-CORE-001`–`049`はcovered、Remaining Core Inventoryに適用可能な未対応clauseなし。古い埋込み計画の未チェックstepを再開しない。 |
| Task 10: Core publication gate | 完了。[PUBLICATION.json](fixtures/core/v0.17.1/PUBLICATION.json)と[PUBLICATION-REVIEW](fixtures/core/v0.17.1/PUBLICATION-REVIEW.md)でscope / manifest / adaptersをbindingし、read-only CLIと人手reviewを公開gateにした。 |
| Task 11: complete validators | 下記の機能は実装済み。元計画のcomplete-scope一括完了判定は未完了として保持し、整理だけでTask全体を完了へ変えない。 |
| Task 12: complete positive candidate | 両profile各17 paths、11 operations、5 Workflows、1 Reference。positive advanced structuresは作成済み。source traceability全体はMATRIX-003–005が残る。 |
| Task 13–16 | complete focused corpus、token evidence、RC、stable freezeは未完了。後掲checklistを使う。 |

### 最新の検証済みbaseline（過去実測、今回の整理で再実行した結果ではない）

- 全suite: `node --test docai-messaging/tools/tests/*.test.mjs` → 1875 tests / 1874 pass / 1既存skip / fail 0 / cancelled 0、374427.129708 ms（2026-10-29、Workflow contributor checkpoint時）。
- skip: `validates source-shard evidence with the declared minimum Python 3.9`、python3.9未導入。Python最小版での実行成功を認定していない。
- Core checker: 264 cases / 193 invalid / one-invalidity 193/193 / unused rules 0 / coverage gaps 0。
- Complete checker: 17 paths、full/compact equivalent。pair一致だけでsource completeness / readinessを認定しない。
- Candidate: source四files＋explicit manifest、projector `1.0.5`、publication policy `1.0.0`。[Workflow snapshot / SHA記録](fixtures/complete-candidates/v0.17.1/SOURCE-TRACEABILITY.md#workflow-contributor-snapshot--2026-10-29)のmetadata / retrieval実結果は2026-10-29にユーザー受入済み。受入済みの[operation-shard snapshot](fixtures/complete-candidates/v0.17.1/SOURCE-TRACEABILITY.md#operation-shard-contributor-snapshot--2026-10-27)・[projector 1.0.3 snapshot](fixtures/complete-candidates/v0.17.1/SOURCE-TRACEABILITY.md#refreshed-contributor-snapshot--2026-10-27)・[旧language/semantic snapshot](fixtures/complete-candidates/v0.17.1/SOURCE-TRACEABILITY.md#finite-language-and-semantic-review--2026-10-24)のH evidenceを自動継承しない。
- language/semantic結果は2026-10-24にユーザーが受入（`67cb116`）。一般generator・将来snapshot・本番business / Kafka / OAuth品質、token効率・配置最適性の認定ではない。content / policy変更時は再reviewする。

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
- [ ] MATRIX-003全体: Source shards / Reference / CONVENTIONS / 全channel / operation-index shard / source比較済み五Workflowのexact contributor gateまで実装。rootの固定`all`は既存ordinary検証のみでwhole-root semantic proofの追加ではない。残るsemantic contributor domainsは別判断とし、一般Workflow合成や新ownerを認定しない。
- [ ] MATRIX-004: storefront primary Channel Parametersのsource known-absence前提（不正 / unexpected declarations含む）。static emitted addressだけからsource欠落を推測しない。
- [ ] MATRIX-005: 残るfinite manifest precedence / perspective / adaptersの契約・conflict / mismatch拒否証拠。digest bindingと個別policy gateから全宣言検証を推論しない。
- [ ] 残るmatrixを証拠または正当化した明示受入で解決し、Task 12 source-traceability全体を完了判定する。
- [ ] 最終gateでCore / Complete checkerを再実行する。positive pairの成功だけでTask 13のcoverage gaps 0と扱わない。

既知の別残件（順序・scope変更時は先に確認）:

- 一般Headers validatorのduplicate name gap。candidate storefront inventory gateの拒否は一般validatorの修正ではない。
- binding `none`後の`x-` markerをordinary validatorが拒否するextension gap。version impactも別途検討する。
- Reference sourceのfinal LFなし正例、source consumer除去の単独mutationという追加branch-evidence候補。
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

## 再開手順と記録方針

1. AGENTSを読み、Git status / logと正本の最新状態を確認する。完了済みTask 1–10へ戻らない。
2. storefront / all-channel / operation-index shard / 五Workflow contributor checkpointを再実装しない。projector `1.0.5` snapshotの実結果は受入済み。次は残るMATRIX-003の認定境界等から次scopeを確認する。root固定`all`の再実装はしない。順序変更は先に確認する。
3. Task 11–14はcomplete surface、Task 15はRC、Task 16はstable。前段のexit criteriaを満たさず後段の完了を宣言しない。
4. 今後の各checkpoint記録は「変更・影響・最終検証・残件・commit案」の短い要約とし、途中runや解決済み試行錯誤を累積しない。詳しい根拠はcode / tests / versioned auditとGit履歴へ委ねる。

**今回の整理:** TODOのみを書換え。完了済み詳細ログ、古いtarget tree / 擬似API / test snippets、重複した過去状態を削除し、現在状態と未完了checklistへ集約。承認待ち設計は原文保持、Task 13–16とFinal Review Checklistは維持した。実装・source・manifest・profiles・coverage・承認状態は変更しない。

**整理の検証:** 承認待ち設計とTask 13–16 / Final Review Checklistの原文一致、local links 10件の存在、TODO以外に差分がないこと、`git diff --check`成功を確認。文書整理のみのため全suite / fixture checkerは再実行せず、上のbaselineは過去実測として保持する。
