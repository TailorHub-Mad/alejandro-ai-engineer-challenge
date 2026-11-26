# Build the same portable page used by the local server and the offline download.
# Requires PowerShell 7 for its bundled Markdown renderer.
#requires -Version 7.0
$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
$atlas = Join-Path $project 'frontend/atlas'
$assets = Join-Path $atlas 'assets'
$files = [ordered]@{
    instructions = 'INSTRUCTIONS.md'
    criteria = 'ACCEPTANCE_CRITERIA.md'
    sources = 'PUBLIC_SOURCES.md'
}
$documents = foreach ($entry in $files.GetEnumerator()) {
    $file = Join-Path $project "docs/challenge/$($entry.Value)"
    $content = (ConvertFrom-Markdown -LiteralPath $file).Html
    foreach ($link in $files.GetEnumerator()) {
        $content = $content.Replace(('href="{0}"' -f $link.Value), ('href="#assignment/{0}"' -f $link.Key))
    }
    '<article class="original-doc" id="assignment/{0}">{1}</article>' -f $entry.Key,$content
}
$scripts = foreach ($name in 'data','lessons','reference','core','labs','app') {
    $js = [IO.File]::ReadAllText((Join-Path $assets "$name.js"))
    '<script>' + ($js -replace '(?i)</script','<\/script') + '</script>'
}
$page = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'atlas-layout.html'))
$styles = [IO.File]::ReadAllText((Join-Path $assets 'atlas.css'))
$fontAssets = Join-Path $project 'frontend/assets'
$font = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $fontAssets 'inter-tight-latin.woff2')))
$fontLicense = [IO.File]::ReadAllText((Join-Path $fontAssets 'inter-tight-OFL.txt'))
$styles = "/* $fontLicense */`n" + $styles.Replace('../assets/inter-tight-latin.woff2', "data:font/woff2;base64,$font")
$page = $page.Replace('@@STYLES@@',$styles).Replace('@@DOCUMENTS@@',($documents -join "`n")).Replace('@@SCRIPTS@@',($scripts -join "`n"))
$destination = Join-Path $atlas 'index.html'
$temporary = Join-Path $atlas ([IO.Path]::GetRandomFileName())
try {
    [IO.File]::WriteAllText($temporary,$page,[Text.UTF8Encoding]::new($false))
    [IO.File]::Move($temporary,$destination,$true)
} finally {
    [IO.File]::Delete($temporary)
}
