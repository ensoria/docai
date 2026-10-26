# DocAI Messaging Fixture 初版 — 進捗と残作業

**目的:** DocAI Messaging `0.17.1` のCompatibility Coreからcomplete generator surface、RC、stable `v1.0.0` の再現可能なconformance corpusへ進む。

**整理日:** 2026-10-24。ユーザー依頼により、完了済みcheckpointの設計・TDD・途中検証・reviewの詳細ログをGit履歴へ委ね、現在状態と残作業へ集約した。整理前の全文はcommit `184066d` から参照できる。この整理は仕様・実装・作業順序・承認状態を変更しない。

## 正本と作業ルール

- 規範仕様は[README](README.md)、Core coverageは[Core COVERAGE](fixtures/core/v0.17.1/COVERAGE.md)、candidateのfact別根拠と認定範囲は[Complete SOURCE-TRACEABILITY](fixtures/complete-candidates/v0.17.1/SOURCE-TRACEABILITY.md)。実装・期待値と衝突したらREADMEの意味を先に確認する。
- [リポジトリAGENTS](../AGENTS.md)を守り、Gitは読取り専用。add / commit / stash / checkout / reset / fetch / pull / push / tag / config / worktree変更は行わない。コミットはユーザーが行う。
- 一度に1コミット相当のcheckpointだけ進めて停止する。実装はTDD（RED→GREEN）、順序・scope変更は実装前に確認。完了済みcheckpointを再実装しない。
- 判断が必要なら各案の利点・欠点・推奨理由を示す。変更量の少なさを推奨理由にせず、仕様・設計・品質を優先する。
- 設計・影響・実測・残件を本TODOへ簡潔に記録する。終了時は変更概要、検証結果、review観点、残件、1行commit案を提示する。
- storefront contributor closureは`7a496bf`でコミット済み。次は下記all-channel contributor設計の本文承認待ちで、実装は未開始。

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

- 全suite: `node --test docai-messaging/tools/tests/*.test.mjs` → 1746 tests / 1745 pass / 1既存skip / fail 0 / cancelled 0、326797.302083 ms（2026-10-24、storefront contributor checkpoint時）。
- skip: `validates source-shard evidence with the declared minimum Python 3.9`、python3.9未導入。Python最小版での実行成功を認定していない。
- Core checker: 264 cases / 193 invalid / one-invalidity 193/193 / unused rules 0 / coverage gaps 0。
- Complete checker: 17 paths、full/compact equivalent。pair一致だけでsource completeness / readinessを認定しない。
- Candidate: source四files＋explicit manifest、projector `1.0.2`、publication policy `1.0.0`。[有限reviewのsnapshot / SHA記録](fixtures/complete-candidates/v0.17.1/SOURCE-TRACEABILITY.md#finite-language-and-semantic-review--2026-10-24)を参照。
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
- [x] MATRIX-002: Operation / Workflow labels、四shard Summary、catalog / channel / context配置、Relatedの有限policy gate＋実結果へのhuman language/semantic受入。
- [ ] MATRIX-003全体: Source shards / Referenceに加え、CONVENTIONSとstorefront-containing channelのexact contributor gateは実装済み。synthetic-only channels、root / operation shards、Workflows等のsemantic contributor closureは未完了。
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

## 次checkpoint: All-Channel Contributor Closure（設計本文の承認待ち）

**Intent / scope（2026-10-27）:** main / `7a496bf`、開始時clean。ユーザーは「既存寄与導出を全channelへ広げ、synthetic三channelのmetadataも訂正する」推奨案の設計化を承認した。README §3 / §6.1 / §8を正とし、MATRIX-003のchannel役割だけを閉じる。source fact / routing-only factの寄与unionを使い、既存出力をauthorityにしない。

**Approaches:** 採用案は検証拡張とcandidate訂正を同じ1コミット相当で行う。仕様と出力が一致する一方、metadata / identitiesとsnapshot証跡の更新が必要。代替の診断追加だけでは現positive candidateがchecker失敗状態になるため採用しない。producerのexact provenanceとreaderのload-all fallbackの区別は前checkpointから維持する。

**Derivation / cases:** 既存helperのsource-owned operation寄与Mapを再利用し、storefrontを含むfileだけという対象条件を取り除く。validated routing / definition / channel file集合の一致を確認して全channelごとに全同居ownerをunionし、全四sourceなら`all`、それ以外はASCII順exact listを要求する。CONVENTIONSの既存二source検証は維持。filename / alpha等の固定pathへ依存せず、synthetic-onlyの移動 / 分割 / 混在、representation-only、storefront混在、source宣言順序非依存を扱う。context参照先の本文sourceやCONVENTIONS本文sourceを参照だけで自動伝播させず、行のselection fact自体の寄与は保持する。missing / extra / 根拠なし`all` / 全四ID明示list、不明・重複owner / 未登録fileを拒否し、既存一次診断とread-only性を維持する。

**Candidate / identity impact:** full / compactの`channels/alpha.md`・`middle.md`・`zeta.md`の計六opening metadataだけを`source_refs: all`から`complete-contexts`へ訂正する。orders / representationsのrefsと全prose / contract bodies / source四files・SHA / Core / 公開仕様 / ordinary validatorsは不変。これは既存rendering承認の追加ではなくprojection metadataの訂正なのでprojectorを`1.0.2`→`1.0.3`にする提案。manifestの他のpolicy / precedence / adaptersとpublication-policy version `1.0.0`は変更しない（それらの規則変更ではないため）。新explicit manifestを指定して両profileを専用helperでrestampし、全34 filesの実identity trailers・root digests / IDsを更新、dry-run no-opとpair等価を確認する。手動hash調整は禁止。

**Evidence / acceptance boundary:** candidate README / SOURCE-TRACEABILITYとTODOへ投影訂正・版変更・実測を短く記録する。過去のlanguage/semantic snapshot表とhuman受入は歴史的証拠として保持し、新snapshotのhash / identities・六metadata以外のprose不変比較を別記する。新snapshotのmetadata / retrieval影響を独立reviewし、その結果をユーザーへ提示する。旧snapshotのH evidenceを新hashへ自動継承したり、今回の設計承認を未実施のreview結果への受入と扱ったりしない。root / operation shards / Workflowsの寄与closure、MATRIX-003全体、MATRIX-004–005、Task 12 / 14、token benefit / performance / release readinessは未完了を維持する。

**Execution / stop:** 設計本文承認後に実行計画を作る。実装時はsynthetic-onlyの不正refsを現CLIが通すREDと、訂正前candidateを新gateが拒否する証拠を先に確認し、helper一般化と六metadata訂正 / restampでGREENにする。focused / 全suite / Core / Complete checker、protected bytes比較、独立read-only reviewを行い1コミット相当で停止。Git書込み・別worktreeなし。helper名 / API・test配置・具体的commandは実行計画で確定する。今回は設計記録のみでcode / manifest / profile / matrix状態は変更しない。

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
2. storefront contributor checkpointを再実装しない。次は上記all-channel contributor設計本文の承認、続いて実行計画の作成・確認を経て1checkpointだけ実装する。順序変更は先に確認する。
3. Task 11–14はcomplete surface、Task 15はRC、Task 16はstable。前段のexit criteriaを満たさず後段の完了を宣言しない。
4. 今後の各checkpoint記録は「変更・影響・最終検証・残件・commit案」の短い要約とし、途中runや解決済み試行錯誤を累積しない。詳しい根拠はcode / tests / versioned auditとGit履歴へ委ねる。

**今回の整理:** TODOのみを書換え。完了済み詳細ログ、古いtarget tree / 擬似API / test snippets、重複した過去状態を削除し、現在状態と未完了checklistへ集約。承認待ち設計は原文保持、Task 13–16とFinal Review Checklistは維持した。実装・source・manifest・profiles・coverage・承認状態は変更しない。

**整理の検証:** 承認待ち設計とTask 13–16 / Final Review Checklistの原文一致、local links 10件の存在、TODO以外に差分がないこと、`git diff --check`成功を確認。文書整理のみのため全suite / fixture checkerは再実行せず、上のbaselineは過去実測として保持する。
