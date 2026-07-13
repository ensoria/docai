# Live LLM 評価手順

このドキュメントは、DocAI HTTP の complete-candidate corpus に対して Live LLM 評価を実行する手順を説明します。

これは保守者向けのガイドであり、仕様上の規範的な情報源ではありません。DocAI HTTP のフォーマット規則については `README.md` が引き続き authoritative です。また、現在の task packet、target list、prompt export、result records、local metrics については `fixtures/complete-candidates/v0.11.0/evaluations/` が source of truth です。

## 目的

Live LLM 評価は、Markdown fixture が構文的に妥当であることだけでなく、complete-candidate corpus がモデル reader による現実的な task execution を支えられるかを確認します。

評価 evidence は、次の問いに答えるためのものです。

- モデルは、選択された `INDEX.md`、`CONVENTIONS.md`、resource file から正しい request を構築できるか。
- モデルは、response、response header、body presence、関連 workflow/webhook 参照、error behavior を解釈できるか。
- モデルは workflow state を追跡し、step 間で値を保持し、webhook delivery を reconcile できるか。
- compact profile は、task に必要な behavior を取り除かずに loaded context を削減できているか。
- モデルが失敗した場合、その原因は model behavior、retrieval context の不足、矛盾した documentation、または fixture/specification gap のどれか。

Live result は、すべての target model が成功することを証明する必要はありません。ただし、publication label を現在の Compatibility Core claim より先に進める前に、失敗が DocAI HTTP documentation の不足や矛盾によって起きていないことを示す必要があります。

## 入力と Evidence Files

現在の complete-candidate evaluation では、次のファイルを使用します。

- `fixtures/complete-candidates/v0.11.0/evaluations/tasks.json`: task group、task prompt、expected outcome、context file、evidence string。
- `fixtures/complete-candidates/v0.11.0/evaluations/targets.json`: required target model と optional target model。
- `tools/build-complete-evaluation-prompts.mjs`: deterministic JSONL prompt export。
- `fixtures/complete-candidates/v0.11.0/evaluations/runs/*.jsonl`: live result record。
- `tools/check-complete-evaluations.mjs`: task packet、target list、result record、local metric、request construction、response handling、error handling の automated grading check。
- `fixtures/complete-candidates/v0.11.0/evaluations/RESULTS.md`: 人が読める status summary。

各 live run の前に、provider 公式の model page と pricing page を再確認してください。Model availability、alias、context limit、pricing、usage accounting は provider 側が管理しており、DocAI HTTP の変更なしに変わる可能性があります。

## Required Targets

現在の required target set は次のとおりです。

| Target ID | Provider | Model | Role |
|---|---|---|---|
| `openai-frontier` | OpenAI | `gpt-5.6-sol` | Frontier reasoning and coding baseline. |
| `anthropic-balanced` | Anthropic | `claude-sonnet-5` | Balanced cross-provider long-context baseline. |
| `google-stable-agentic` | Google | `gemini-3.5-flash` | Stable agentic and coding baseline. |

現在の optional target set は次のとおりです。

| Target ID | Provider | Model | Role |
|---|---|---|---|
| `openai-cost` | OpenAI | `gpt-5.6-luna` | Cost-sensitive OpenAI comparison. |
| `anthropic-fast` | Anthropic | `claude-haiku-4-5` | Fast Anthropic comparison. |
| `google-cost` | Google | `gemini-3.1-flash-lite` | Cost-sensitive Google comparison. |

Publication gate に必要なのは required target だけです。Optional target は、required target の evidence が完了した後で、cost、speed、robustness を比較するために有用です。

## 推奨実行順

すべての provider とすべての task group を一度に実行するのではなく、小さな gate に分けて実行します。

### Gate 1: Required Request Construction

`request_construction` task を required target のみに対して実行します。

推奨 provider order:

1. `google-stable-agentic`
2. `anthropic-balanced`
3. `openai-frontier`

根拠:

- Request construction は、現時点で最も明確な automated grading support を持っています。
- 1つの required target から始めることで、cost を抑えつつ、prompt、fixture、result-record の問題を早期に発見できます。
- stable かつ cost-conscious な required target を先に実行すると、frontier baseline に費用を使う前に documentation gap を見つけやすくなります。
- Anthropic を2番目に実行することで、最高能力の frontier baseline を使う前に cross-provider signal を得られます。
- OpenAI frontier を最後に実行すると、残った失敗が model-specific なのか fixture/specification issue なのかを確認しやすくなります。

実行:

```sh
node docai-http/tools/build-complete-evaluation-prompts.mjs request_construction
```

Prompt export を確認した後、各 required target を直接実行する場合は provider-specific command を実行します。

```sh
node docai-http/tools/run-google-complete-evaluation.mjs request_construction --target google-stable-agentic
node docai-http/tools/run-anthropic-complete-evaluation.mjs request_construction --target anthropic-balanced
node docai-http/tools/run-openai-complete-evaluation.mjs request_construction --target openai-frontier
```

これらの command には、それぞれ `GOOGLE_API_KEY`、`ANTHROPIC_API_KEY`、または `OPENAI_API_KEY` が必要であり、選択された evaluation prompt と context を対応する外部 model provider API に送信します。

Google runner は設定された `temperature` 値を送信します。Anthropic と OpenAI の runner は、現在の required target model がその parameter を reject するため、`temperature` を送信しません。これらの provider では、固定 prompt packet、tools disabled、review 済み JSON result record、request-construction grader を repeatability control として扱います。

Codex managed environment が repository-derived prompt と fixture context の provider への export を block する場合は、影響を受ける run を `blocked` として記録します。その後、maintainer が managed environment の外側で同じ provider command をローカル実行し、review 済みの provider result で blocked record を置き換えます。

Target/task result ごとに1行の JSONL を次の場所に記録します。

```text
fixtures/complete-candidates/v0.11.0/evaluations/runs/request-construction.jsonl
```

その後、次を実行します。

```sh
node docai-http/tools/check-complete-evaluations.mjs
```

Request-construction record から fixture gap、矛盾した documentation、不足している context、または prompt/export の問題が見つかった場合は、後続 gate に進まないでください。

### Gate 2: Required Response Handling

`response_handling` task を required target に対して実行します。

Provider が blocked または unavailable でない限り、Gate 1 と同じ provider order を使用します。Response handling は request construction の後に実行します。Response の解釈は、同じ retrieval path と convention loading behavior に依存するためです。

選択された file に status、body field、response header、関連 workflow、または webhook を解釈するための十分な情報がないことを failure が示している場合は、停止します。

### Gate 3: Required Error Handling

`error_handling` task を required target に対して実行します。

Error handling は response handling の後に実行します。Common error、inline error、retryability、caller action、field-level behavior に依存するためです。この gate の failure は、missing common-error link や ambiguous endpoint-specific error row を見つけるうえで特に有用です。

Failure が missing error-shape context、矛盾した retry guidance、または不完全な caller-action documentation を示している場合は、停止します。

### Gate 4: Required Workflow Completion

`workflow_completion` task を required target に対して実行します。

Workflow completion は request、response、error task の後に実行します。Endpoint call、state transition、recovery branch、webhook reconciliation を組み合わせるため、前の task group より integration 的な性質が強いからです。

Failure が missing workflow link、missing value-passing guidance、不明瞭な recovery behavior、または曖昧な webhook reconciliation を示している場合は、停止します。

### Gate 5: Token-Load And Usage Recording

Task/model/profile combination ごとに token-load measurement を記録します。

公開しても安全で、full/compact tradeoff の評価に十分役立つ場合は、provider-reported usage を使用します。`check-complete-evaluations.mjs` の local context metric は、deterministic baseline evidence として保持します。

Tokenizer と accounting method が文書化されていない限り、provider 間で token count を完全に比較可能なものとして扱わないでください。Universal measurement ではなく、各 target model に対する practical evidence として使います。

### Gate 6: Optional Target Comparison

Optional target は、すべての required target gate が完了した後、または documented reason 付きで明示的に blocked とされた後にのみ実行します。

Optional target は、より限定的な問いに答えるために使います。

- Cost-sensitive model は同じ retrieval path を扱えるか。
- Faster model は予測可能な形で失敗するか。
- Compact output は lower-cost または lower-latency model に対しても利用可能なままか。
- Failure は特定の provider family または task group に集中しているか。

Optional target は、required evidence の不足を補うものではありません。

## 判断基準

### Proceed

次の gate に進む条件:

- 現在の gate について、すべての required target record が存在する。
- `node docai-http/tools/check-complete-evaluations.mjs` が pass する。
- Failure がある場合でも、それらが model-specific であり、DocAI HTTP documentation の不足や矛盾を示していない。
- `RESULTS.md` が、reviewer が publication impact を理解できる程度に gate status を明確に要約している。

### Stop And Fix Fixtures

次の場合は live evaluation を停止し、corpus を修正します。

- いずれかの result が `review.fixture_gap` を `true` にしている。
- モデルが必要とした fact が selected context に存在しなかった。
- Result が resource file と `CONVENTIONS.md` の間の矛盾した guidance を明らかにした。
- Result が missing `Related` link、missing convention、missing error shape、または不十分な workflow/webhook retrieval path を明らかにした。
- Prompt exporter が必要な context を省略した、または expected outcome を漏洩した。

修正後は、影響を受けた gate を最初から、すべての required target に対して再実行します。

### Record As Blocked

次の場合、黙って skip するのではなく `blocked` run として記録します。

- Provider API key が利用できない。
- Provider が model ID を拒否した。
- Run が quota または budget を超えた。
- Provider が停止している、または予定した evaluation window を超えて rate-limited されている。
- Safety、policy、または account control により call が妨げられた。

Required target が blocked になった場合、`targets.json`、rationale、`RESULTS.md` を更新せずに別の model に置き換えないでください。

## Authentication And Secret Handling

Provider API key を repository に含めないでください。

推奨する扱い:

- Environment variable または local secret manager を使用する。
- Key、bearer token、account ID、raw HTTP authorization header を `runs/*.jsonl` に書かない。
- Commit するのは review 済みで公開可能な result record のみにする。
- Raw provider log が debugging に有用な場合は repository 外に置き、result record には安全な field のみを要約する。

実行前に、どの provider key が利用可能か、誰が spend を負担するかを決めます。利用可能な provider key が1つだけの場合、その provider で smoke test を始めても構いませんが、complete publication evidence として扱わないでください。

## Cost Controls

Spend を抑えるため、小さな gate を使います。

1. まず `--summary` で prompt record を生成する。
2. 拡張する前に、1つの target と1つの task group を実行する。
3. 次の provider を実行する前に JSONL を review し、check する。
4. Fixture gap が見つかったら即座に停止する。
5. Optional target は、required evidence が有用になった後にのみ実行する。

Provider call なしで dry run する場合:

```sh
node docai-http/tools/build-complete-evaluation-prompts.mjs request_construction --summary
```

Required-only の full prompt export:

```sh
node docai-http/tools/build-complete-evaluation-prompts.mjs request_construction
```

Required と optional を含む prompt export:

```sh
node docai-http/tools/build-complete-evaluation-prompts.mjs request_construction --include-optional
```

## Result Record Review

各 live result record は次を含む必要があります。

- `run_id`
- `target_id`
- `task_id`
- `provider`
- `model`
- `executed_at`
- `status`
- `review.fixture_gap`
- `review.notes`
- Non-blocked run では `review.matches_expected_outcome`
- Non-blocked run では `response`、blocked run では `blocked_reason`

Request-construction、response-handling、error-handling record については、`check-complete-evaluations.mjs` が `review.matches_expected_outcome` と対応する automated grader の一致も検証します。Error-handling grader は、`common:` reference prefix の有無が異なる common shape label を同等として扱い、caller-visible behavior が揃っている error case が `endpoint_errors` と `common_errors` のどちらに出ていても許容します。

## Publication Impact

次の条件を満たすまで、README publication label を変更しないでください。

- すべての required target が実行済みである、または required block が明示的に記録され、maintainer によって許容可能と判断されている。
- すべての required task group に result evidence がある。
- Live run によって見つかった fixture gap が修正され、再実行されている。
- `RESULTS.md` が pass/fail/blocked count、fixture gap、model-specific failure、publication impact を要約している。
- Complete-candidate checker と evaluation checker が pass している。

Optional target の成功は比較 evidence として有用ですが、required target coverage の代替にはなりません。
