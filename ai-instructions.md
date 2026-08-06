## What to Include After Code Fixes or Implementation

After making changes, please always include the key points to review. Also mention anything else that caught your attention while modifying the code, as well as any areas where the correctness of the implementation should be verified.

If the changes are extremely minor, you do not need to include review points. Instead, simply provide a brief summary of what changed.

Please also provide a concise, one-line Git commit message.

## When I Need to Make a Decision

When I need to choose among several options, please explain the factors I should consider, along with the advantages and disadvantages of each option.

When recommending an option, do not treat a smaller scope or a lower volume of changes as an advantage or use the amount of required modification as a primary decision factor.

In general, prioritize the option that results in better specifications, design, and code quality, even if it requires broader or more extensive changes.

Consider compatibility loss a disadvantage only when the proposed changes would cause significant compatibility issues. Compatibility should be taken into account only when the current version is `v1.0.0` or later.

## Git Operations

Git may be used only for read-only inspection of the repository.

You may run commands that inspect the current state, differences, or history, such as:

* `git status`
* `git diff`
* `git log`
* `git show`
* `git blame`
* `git branch --show-current`

Do not perform any Git operation that modifies the working tree, staging area, branches, tags, repository history, remotes, or Git configuration.

In particular, do not run commands such as:

* `git add`, `git commit`, or `git stash`
* `git checkout`, `git switch`, or `git restore`
* `git reset`, `git revert`, `git merge`, or `git rebase`
* `git branch`, `git tag`, or commands that create, rename, or delete references
* `git push`, `git pull`, or `git fetch`
* `git config`
* Any command that modifies files under the `.git` directory

Do not create commits or otherwise change Git state unless the user explicitly instructs you to do so.

## Git Tagging Scheme

In this repository, DocAI HTTP and DocAI Messaging are versioned and released independently.

Therefore, tags are managed separately for each component, as shown below:

```text
docai-http/v1.0.0
docai-http/v1.0.1
docai-http/v1.1.0

docai-messaging/v0.4.0
docai-messaging/v0.5.0
docai-messaging/v1.0.0
```
