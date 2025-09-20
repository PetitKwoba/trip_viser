# Requires GitHub CLI (gh) authenticated.
param(
  [string]$Repo = "",
  [string]$ProjectName = "Roadmap",
  [switch]$CreateIssues,
  [string]$Token
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

# Try REST API via token first (GH_TOKEN/GITHUB_TOKEN or -Token), else fallback to gh CLI
$Token = $Token -or $env:GH_TOKEN -or $env:GITHUB_TOKEN

function Get-RepoFromGit {
  try {
    $remote = git config --get remote.origin.url 2>$null
    if (-not $remote) { return $null }
    # https://github.com/owner/repo.git or git@github.com:owner/repo.git
    if ($remote -match 'github.com[:/](?<owner>[^/]+)/(?<repo>[^\.]+)') {
      return "$($Matches['owner'])/$($Matches['repo'])"
    }
    return $null
  } catch { return $null }
}

if (-not $Repo -or $Repo.Trim() -eq "") {
  $Repo = Get-RepoFromGit
  if (-not $Repo) {
    Write-Error "Could not determine repo. Pass -Repo 'owner/repo' or run inside a git repo with an 'origin' remote pointing to GitHub."
    exit 1
  }
}

$owner,$name = $Repo.Split('/')

function New-GitHubIssue {
  param(
    [string]$owner,
    [string]$repo,
    [string]$title,
    [string]$body,
    [string[]]$labels
  )
  if ($Token) {
    $uri = "https://api.github.com/repos/$owner/$repo/issues"
    $headers = @{ Authorization = "Bearer $Token"; Accept = 'application/vnd.github+json' }
    $payload = @{ title = $title; body = $body; labels = $labels } | ConvertTo-Json -Depth 5
    try {
      $resp = Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -Body $payload -ContentType 'application/json'
      Write-Host "Created issue #$($resp.number): $title"
    } catch {
      Write-Error "Failed to create issue via REST: $title => $_"
    }
  } else {
    try {
      gh issue create --repo "$owner/$repo" --title $title --body $body --label ($labels -join ',') | Out-Null
      Write-Host "Created issue: $title (via gh)"
    } catch {
      Write-Error "GitHub CLI 'gh' not installed or not authenticated. Install from https://cli.github.com/ and run 'gh auth login' or set GH_TOKEN/GITHUB_TOKEN."
      exit 1
    }
  }
}

function Ensure-GitHubLabel {
  param(
    [string]$owner,
    [string]$repo,
    [string]$name,
    [string]$color = "6a737d",
    [string]$description = ""
  )
  if ($Token) {
    $base = "https://api.github.com/repos/$owner/$repo/labels"
    $headers = @{ Authorization = "Bearer $Token"; Accept = 'application/vnd.github+json' }
    try {
      Invoke-RestMethod -Method Get -Uri ("$base/" + [System.Web.HttpUtility]::UrlEncode($name)) -Headers $headers -ErrorAction Stop | Out-Null
      return
    } catch {
      # Create label
      $payload = @{ name = $name; color = $color; description = $description } | ConvertTo-Json -Depth 5
      try {
        Invoke-RestMethod -Method Post -Uri $base -Headers $headers -Body $payload -ContentType 'application/json' | Out-Null
        Write-Host "Created label '$name'"
      } catch { Write-Warning "Failed to create label '$name': $_" }
    }
  } else {
    try {
      # 'gh label create' fails if exists; suppress errors
      gh label create $name -R "$owner/$repo" -c $color -d $description 2>$null | Out-Null
    } catch { }
  }
}

# Seed issues
if ($CreateIssues) {
  # Ensure labels exist first
  Ensure-GitHubLabel -owner $owner -repo $name -name 'chore' -color '6a737d' -description 'Chores and maintenance'
  Ensure-GitHubLabel -owner $owner -repo $name -name 'deployment' -color '0e8a16' -description 'Deployment related tasks'
  Ensure-GitHubLabel -owner $owner -repo $name -name 'documentation' -color '0075ca' -description 'Docs and README'

  New-GitHubIssue -owner $owner -repo $name -title "Setup: Protect main & enable CI gates" -body "Protect main branch; require PR + passing checks (backend-tests, frontend-build)." -labels @('chore')
  New-GitHubIssue -owner $owner -repo $name -title "Deploy: Render (backend)" -body "Set SECRET_KEY, DATABASE_URL, ALLOWED_HOSTS, CORS_ALLOWED_ORIGINS. Enable auto-deploy from main." -labels @('deployment')
  New-GitHubIssue -owner $owner -repo $name -title "Deploy: Vercel (frontend)" -body "Set REACT_APP_API_BASE, Node 18, CRA build. Link to backend URL." -labels @('deployment')
  New-GitHubIssue -owner $owner -repo $name -title "Docs: Add live URLs to README" -body "Add Vercel site and Render API to README and GitHub About." -labels @('documentation')
}

Write-Host "Seed complete."