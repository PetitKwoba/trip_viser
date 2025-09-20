# Requires GitHub CLI (gh) authenticated.
param(
  [string]$Repo = "",
  [string]$ProjectName = "Roadmap",
  [switch]$CreateIssues
)

if (-not $Repo) {
  # Try to infer from git remote
  $remote = git config --get remote.origin.url
  if ($remote -match 'github.com[:/](?<owner>[^/]+)/(?<repo>[^/.]+)') {
    $Repo = "$($Matches['owner'])/$($Matches['repo'])"
  } else {
    Write-Error "Could not infer repo. Pass -Repo owner/name."
    exit 1
  }
}

Write-Host "Using repo: $Repo"

# Create project board (classic) if not exists
try {
  gh project list --owner ($Repo.Split('/')[0]) --format json | Out-Null
} catch {
  Write-Error "GitHub CLI 'gh' not installed or not authenticated. Install from https://cli.github.com/ and run 'gh auth login'."
  exit 1
}

# Create a classic project via web is easier; here we seed issues instead.
if ($CreateIssues) {
  gh issue create --repo $Repo --title "Setup: Protect main & enable CI gates" --body "Protect main branch; require PR + passing checks (backend-tests, frontend-build)." --label chore
  gh issue create --repo $Repo --title "Deploy: Render (backend)" --body "Set SECRET_KEY, DATABASE_URL, ALLOWED_HOSTS, CORS_ALLOWED_ORIGINS. Enable auto-deploy from main." --label deployment
  gh issue create --repo $Repo --title "Deploy: Vercel (frontend)" --body "Set REACT_APP_API_BASE, Node 18, CRA build. Link to backend URL." --label deployment
  gh issue create --repo $Repo --title "Docs: Add live URLs to README" --body "Add Vercel site and Render API to README and GitHub About." --label documentation
}

Write-Host "Seed complete."