# Surls Versioning Policy

Current Version: 1.12.2

Surls follows Semantic Versioning (SemVer):

MAJOR.MINOR.PATCH

Examples:

* 1.4.4
* 1.4.5
* 1.5.0
* 2.0.0

## Versioning Rules

### PATCH

Use for:

* Bug fixes
* Security fixes
* Dependency updates
* Refactoring without user-facing changes
* Performance improvements
* Small UI fixes

Example:
1.4.4 → 1.4.5

### MINOR

Use for:

* New user-facing features
* New admin tools
* New analytics
* New settings
* New authentication options
* New pages
* New API endpoints

When MINOR increases, PATCH resets to 0.

Example:
1.4.4 → 1.5.0

### MAJOR

Use for:

* Breaking changes
* Removed functionality
* Incompatible configuration changes
* Destructive migrations
* Breaking API changes
* Manual upgrade requirements

When MAJOR increases, MINOR and PATCH reset to 0.

Example:
1.4.4 → 2.0.0

## Release Workflow

For every future task:

1. Read VERSIONING.md before making version decisions.
2. Complete the requested changes.
3. Review the final git diff.
4. Compare changes against the latest release tag.
5. Determine whether the change is PATCH, MINOR, MAJOR, or NO VERSION CHANGE.
6. Explain the reasoning.
7. Only update version numbers if a bump is justified.
8. Update CHANGELOG.md when creating a release.
9. Generate GitHub Release notes.

Never bump versions automatically.
Never invent changes.
Always explain why a version change is or is not required.

## GitHub Release Notes Format

🚀 Surls vX.Y.Z

✨ What’s New

* User-facing change
* User-facing change
* User-facing change

🛠 Fixes

* Bug fix
* Bug fix

📦 Upgrade Notes

No manual upgrade steps required.

Version Info

* Previous: X.Y.Z
* Current: X.Y.Z
* Release Type: PATCH | MINOR | MAJOR

Release note rules:

* Keep notes short and easy to scan.
* Use friendly language.
* Focus on what users care about.
* Do not include raw commit messages.
* Do not invent changes.
