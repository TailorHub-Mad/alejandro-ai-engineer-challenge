# Run from this checkout: pwsh -File scripts/publish.ps1 -DryRun
[CmdletBinding()]
param([switch]$DryRun)

$ErrorActionPreference = 'Stop'
function Checked([string]$program, [string[]]$arguments) {
    & $program @arguments
    if ($LASTEXITCODE -ne 0) { throw "$program failed (exit $LASTEXITCODE)." }
}

$repoName = 'taylor-case'
$stamp = 'Public-Snapshot: taylor-case-v1'
$description = 'Taylor case study: source-grounded cargo hold inspection assistant'
$published = $false
$root = Split-Path $PSScriptRoot -Parent
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\', '/')
$scratch = Join-Path $tempRoot ('taylor-public-' + [guid]::NewGuid())
$vars = @('GH_HOST','GIT_INDEX_FILE','GIT_OBJECT_DIRECTORY','GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'GIT_AUTHOR_NAME','GIT_AUTHOR_EMAIL','GIT_COMMITTER_NAME','GIT_COMMITTER_EMAIL')
$saved = @{}
foreach ($key in $vars) { $saved[$key] = [Environment]::GetEnvironmentVariable($key) }

Push-Location -LiteralPath $root
try {
    $top = Checked git @('rev-parse','--show-toplevel')
    if ([IO.Path]::GetFullPath($top) -ne [IO.Path]::GetFullPath($root)) {
        throw 'Run this script from the taylor-case checkout.'
    }
    $objects = Checked git @('rev-parse','--path-format=absolute','--git-path','objects')
    $null = New-Item -ItemType Directory -Path (Join-Path $scratch 'objects') -Force
    $env:GIT_INDEX_FILE = Join-Path $scratch 'index'
    $env:GIT_ALTERNATE_OBJECT_DIRECTORIES = $objects
    $env:GIT_OBJECT_DIRECTORY = Join-Path $scratch 'objects'
    Checked git @('read-tree','--empty')

    # The public tree is an allowlist. Never seed this index from local HEAD.
    $files = @('.env.example','.gitignore','.dockerignore','Dockerfile','compose.yaml','README.md','ideas.md','requirements.txt',
        'frontend/index.html','frontend/styles.css','frontend/app.js','frontend/atlas/index.html',
        'frontend/assets/inter-tight-latin.woff2','frontend/assets/inter-tight-OFL.txt',
        'scripts/atlas-layout.html','scripts/build_atlas_page.ps1','scripts/build_atlas_data.py','scripts/publish.ps1',
        'eval/run.py','eval/rankings.py','eval/cases.json','eval/results.json','eval/fixtures/ranking-baseline.json',
        'docs/challenge/README.md','docs/challenge/INSTRUCTIONS.md','docs/challenge/ACCEPTANCE_CRITERIA.md',
        'docs/challenge/PUBLIC_SOURCES.md')
    foreach ($name in '__main__','acquire','answer','app','evidence','index','models','source','trace') {
        $files += "backend/$name.py"
    }
    foreach ($name in 'acquire','citation_pdf','eval','evidence','launcher','models','rankings','trace') {
        $files += "tests/test_$name.py"
    }
    foreach ($name in 'app.js','atlas.css','core.js','data.js','labs.js','lessons.js','reference.js') {
        $files += "frontend/atlas/assets/$name"
    }
    foreach ($name in 'eval/live-results.json','eval/ranking-comparison.json') {
        if (Test-Path -LiteralPath $name -PathType Leaf) { $files += $name }
    }
    Checked git (@('-c','core.autocrlf=input','-c','core.safecrlf=false','add','--') + $files)
    $entries = @(Checked git @('ls-files','--stage'))
    if ($entries.Count -ne $files.Count -or ($entries -match '^(?!100(644|755) )')) {
        throw 'The staged snapshot must contain exactly the allowlisted regular files.'
    }
    if ((Checked git @('show',':.env.example')) -match '^\s*[A-Za-z0-9_]*KEY\s*=\s*\S') {
        throw 'The public environment template contains a nonempty key field.'
    }
    $secret = 'sk-(or-v1-|proj-|svcacct-)?[A-Za-z0-9_-]{22,}|vck_[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{25,}|(AKIA|ASIA)[A-Z0-9]{16}|-----BEGIN ([A-Z ]+ )?PRIVATE KEY-----|https?://[a-zA-Z0-9_%+.-]+:[^/@[:space:]]+@'
    $matchesIn = @(git grep --cached -I -l -E -e $secret --)
    if ($LASTEXITCODE -eq 0) { throw "Possible secret in public content: $($matchesIn -join ', ')" }
    if ($LASTEXITCODE -ne 1) { throw 'Could not scan the staged snapshot.' }
    $tree = Checked git @('write-tree')
    if ($DryRun) {
        Checked git @('ls-files')
        Write-Output "Dry run: $($files.Count) files, tree $tree. No GitHub changes."
        return
    }

    $env:GH_HOST = 'github.com'
    $query = '{ viewer { login databaseId repository(name: "taylor-case") { nameWithOwner description isPrivate isEmpty isArchived isFork  } } }'
    $viewer = ((Checked gh @('api','graphql','-f',"query=$query")) | ConvertFrom-Json).data.viewer
    if (-not $viewer.login -or -not $viewer.databaseId) { throw 'Sign in with gh auth login and retry.' }
    $owner = $viewer.login
    $slug = "$owner/$repoName"
    $url = "https://github.com/$slug.git"
    $repo = $viewer.repository
    $remotes = @(Checked git @('remote'))
    foreach ($remote in $remotes) {
        $addresses = @(Checked git @('remote','get-url','--all',$remote))
        $addresses += @(Checked git @('remote','get-url','--push','--all',$remote))
        $accepted = @($url,"https://github.com/$slug","git@github.com:$slug.git","ssh://git@github.com/$slug.git")
        foreach ($address in $addresses) {
            if ($address -notin $accepted) { throw "Local remote '$remote' points to a different destination." }
        }
    }
    $auth = @('-c','credential.helper=','-c','credential.helper=!gh auth git-credential')
    $tip = $null
    $tipTree = $null
    if ($repo -and ($repo.isArchived -or $repo.isFork)) {
        throw "The destination $slug is a fork or an archive. Check the repository name."
    }
    if ($repo -and -not $repo.isEmpty) {
        $head = (Checked gh @('api',"repos/$slug/commits/main")) | ConvertFrom-Json
        $tip = $head.sha
        $tipTree = $head.commit.tree.sha
        if ($repo.isPrivate) {
            # Changing visibility exposes all refs and ancestors, including any old PDFs.
            $refs = @(Checked git ($auth + @('ls-remote','--refs',$url)))
            if ($refs.Count -ne 1 -or $head.parents.Count -ne 0 -or $tipTree -ne $tree) {
                throw 'The private repository has other content or history. Review it before making it public.'
            }
        }
        if ($tipTree -ne $tree) {
            $tracking = git rev-parse --verify --quiet refs/remotes/origin/main
            if ($tracking -ne $tip -or $head.commit.message -notlike "*$stamp*") {
                throw 'The public main branch contains edits outside this snapshot. Integrate them before publishing.'
            }
        }
    }

    $env:GIT_AUTHOR_NAME = $env:GIT_COMMITTER_NAME = $owner
    $env:GIT_AUTHOR_EMAIL = $env:GIT_COMMITTER_EMAIL = "$($viewer.databaseId)+$owner@users.noreply.github.com"
    if (-not $repo) { Checked gh @('repo','create',$slug,'--public','--description',$description) }
    $commit = $tip
    if ($tipTree -ne $tree) {
        $commitArgs = @('commit-tree',$tree,'-m','Publish taylor-case','-m',$stamp)
        if ($tip) { $commitArgs += @('-p',$tip) }
        $commit = Checked git $commitArgs
        Checked git ($auth + @('push',$url,"${commit}:refs/heads/main"))
    }
    $refs = @(Checked git ($auth + @('ls-remote','--refs',$url)))
    if ($refs -notcontains "$commit`trefs/heads/main" -or ($repo.isPrivate -and $refs.Count -ne 1)) {
        throw 'The remote refs differ from the reviewed snapshot. Check them on GitHub.'
    }
    if ($repo -and $repo.isPrivate) {
        Checked gh @('repo','edit',$slug,'--visibility','public','--accept-visibility-change-consequences')
    }
    $visibility = Checked gh @('repo','view',$slug,'--json','visibility','--jq','.visibility')
    if ($visibility -ne 'PUBLIC') { throw 'Could not verify public visibility.' }
    $published = $true
    Write-Output "Published $commit to https://github.com/$slug"
} finally {
    foreach ($key in $vars) {
        if ($null -eq $saved[$key]) { Remove-Item -LiteralPath "Env:$key" -ErrorAction SilentlyContinue }
        else { [Environment]::SetEnvironmentVariable($key, $saved[$key]) }
    }
    Pop-Location
    if (Test-Path -LiteralPath $scratch) {
        $resolved = (Resolve-Path -LiteralPath $scratch).Path
        if ((Split-Path $resolved -Parent) -eq $tempRoot -and $resolved -eq $scratch) {
            Remove-Item -LiteralPath $resolved -Recurse -Force
        }
    }
}
if ($published) {
    try {
        if ($remotes -notcontains 'origin') { Checked git @('-C',$root,'remote','add','origin',$url) }
        Checked git ($auth + @('-C',$root,'fetch','--quiet','--no-tags','--no-write-fetch-head','origin',
            'refs/heads/main:refs/remotes/origin/main'))
    } catch {
        Write-Warning 'The snapshot is public. Local origin tracking could not be updated.'
    }
}
