# New Repository and Two-person Workflow

All PowerShell commands in this document run in the starter folder, NEVER D:\Hackathon itself. That root belongs to FormulaRescue.

The starter currently sits inside the old workspace as a staging folder. Recommended isolation: use Windows File Explorer to COPY `D:\Hackathon\hackathon-starter` to `D:\hackathon-team-starter`, then open that new folder alone in VS Code. Do not copy FormulaRescue's `.git`. Only the starter content is needed. Copy is outside the assistant writable workspace and is a manual user step.

## A. GitHub browser

1. Open https://github.com/new while logged into your own account.
2. Name: `hackathon-team-starter` (or agreed name). Choose Private for preparation unless rules require Public.
3. Leave Initialize README, .gitignore, and license unchecked because files already exist locally. Click Create repository. Decide licensing separately based on data/model/code rights.

Expected: an empty repository page with its HTTPS URL.

## B. First upload (after creating the empty remote)

Terminal in the new isolated folder:

```powershell
cd D:\hackathon-team-starter
git init -b main
git status --short
git add .
git commit -m "Add hackathon collaboration starter"
```

Purpose: create separate history and save initial template. Verify git status contains only starter files. Do not run git add from the old workspace.

Replace YOUR_USERNAME/REPOSITORY below with the URL of your NEW repository, not formula-rescue:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/REPOSITORY.git
git push -u origin main
```

Expected: browser authentication may open; then `main -> main`. Never paste tokens/passwords into chat. Confirm files appear on the new GitHub page.

If Git reports dubious ownership, verify this exact new folder is trusted before adding only its path as safe.directory. Do not use wildcard exceptions or move .git.

## C. Invite teammate

Repository page -> Settings -> Collaborators -> Add people -> enter friend's GitHub username -> send invitation. Friend must accept. Use separate accounts; do not share credentials.

Friend's own terminal:

```powershell
git clone https://github.com/YOUR_USERNAME/REPOSITORY.git
cd REPOSITORY
git switch -c feat/frontend
```

Expected: a separate local copy and task branch. You can use feat/backend or feat/model in your copy.

## D. Task to review

```powershell
git status --short
git add PATH_TO_CHANGED_FILE
git commit -m "Describe completed task"
git push -u origin YOUR_TASK_BRANCH
```

Replace placeholders before running. Create a pull request in GitHub -> teammate reviews -> merge -> both synchronize when working trees are clean:

```powershell
git switch main
git pull --ff-only
```

If changes/conflicts exist, stop and share git status/error. Never discard the other person's changes or force-push to fix them.

## References

- Creating repo: https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository
- Collaborators: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration
