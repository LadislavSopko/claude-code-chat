# Formal Complaint — Data Loss Caused by Claude Code

**Date:** 2026-05-23
**From:** Ladislav Sopko (0ics.srl@gmail.com)
**To:** Anthropic, PBC — Legal Department
**Product:** Claude Code (CLI agent, model: claude-opus-4-6)

---

## Summary of Incident

On 2026-05-23, during a development session using Claude Code, the AI agent executed a destructive `git reset --hard` command on the **wrong git branch**, resulting in **permanent loss of uncommitted work**.

## Sequence of Events

1. The user explicitly instructed Claude to reset branch `feature/01-message-hub-core` to an earlier commit.
2. The user had previously created and switched to a separate branch (`feature/auth-attempt`) to preserve ongoing work, including uncommitted files.
3. Claude **failed to verify the current branch** before executing the destructive command.
4. Claude executed `git reset --hard 68cfbe5` while on `feature/auth-attempt` — the wrong branch.
5. This permanently destroyed all uncommitted changes in the working directory.
6. Uncommitted work cannot be recovered from git after `git reset --hard`.

## Data Lost

- **Committed work**: The branch pointer `feature/auth-attempt` was moved from `210c373` (8 commits of Phase 4 auth work) to `68cfbe5`, destroying the branch reference to those commits. Although later restored via reflog, the branch was temporarily pointing to the wrong commit.
- **Uncommitted work**: All uncommitted files and modifications in the working directory were permanently destroyed by `git reset --hard`. This work existed only in the working directory and cannot be recovered by any git mechanism.

## Root Cause

Claude Code executed a destructive, irreversible operation (`git reset --hard`) without:
- Verifying which branch was currently checked out
- Warning the user that uncommitted changes would be permanently destroyed
- Requesting explicit confirmation before executing a destructive command on a branch containing uncommitted work

This violates Claude Code's own documented safety guidelines, which state:

> *"Before running destructive operations (e.g., git reset --hard), consider whether there is a safer alternative. [...] measure twice, cut once."*

> *"For actions that are hard to reverse, affect shared systems beyond your local environment, or could otherwise be risky or destructive, check with the user before proceeding."*

## Risk Assessment

In this instance, the lost work was limited in scope. However, the same behavior pattern — executing destructive commands without verifying context — could result in catastrophic data loss in production environments involving:
- Large codebases with significant uncommitted work
- Proprietary source code
- Work product valued at substantial financial amounts

The AI agent's failure to follow basic safety protocols (verify branch, check for uncommitted changes, confirm with user) represents a systemic risk.

## Requested Actions

1. **Acknowledgment** of the incident and the product deficiency that caused it.
2. **Technical remediation**: Implement mandatory pre-checks before destructive git operations in Claude Code, including:
   - Verify current branch matches the intended target
   - Check for uncommitted changes and warn the user
   - Require explicit confirmation before `git reset --hard`
3. **Compensation** for the lost work product, to be determined.

## Contact

Ladislav Sopko
Email: 0ics.srl@gmail.com

---

*This complaint is filed in good faith to document a product deficiency that resulted in data loss. All statements above are factual and can be verified through the Claude Code conversation transcript and git reflog.*
