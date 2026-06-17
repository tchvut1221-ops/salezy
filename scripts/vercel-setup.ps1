param([string]$Token)

$h = @{ Authorization = "Bearer $Token"; "Content-Type" = "application/json" }
$pid = "prj_Hek0TSK1wRlGEotxPCGxAUMdn0jY"

# Read env vars from .env.local
$env = Get-Content ".env.local" | Where-Object { $_ -match "^[A-Z]" }
$parsed = @{}
foreach ($line in $env) {
    $parts = $line -split "=", 2
    $parsed[$parts[0].Trim()] = $parts[1].Trim()
}

$t = @("production","preview","development")
$vars = @(
    @{key="NEXT_PUBLIC_SUPABASE_URL";      value=$parsed["NEXT_PUBLIC_SUPABASE_URL"];      type="plain";     target=$t}
    @{key="NEXT_PUBLIC_SUPABASE_ANON_KEY"; value=$parsed["NEXT_PUBLIC_SUPABASE_ANON_KEY"]; type="plain";     target=$t}
    @{key="SUPABASE_SERVICE_KEY";          value=$parsed["SUPABASE_SERVICE_KEY"];           type="encrypted"; target=$t}
    @{key="OPENAI_API_KEY";                value=$parsed["OPENAI_API_KEY"];                 type="encrypted"; target=$t}
    @{key="INNGEST_EVENT_KEY";             value=$parsed["INNGEST_EVENT_KEY"];              type="encrypted"; target=$t}
    @{key="INNGEST_SIGNING_KEY";           value=$parsed["INNGEST_SIGNING_KEY"];            type="encrypted"; target=$t}
)

$r = Invoke-RestMethod -Uri "https://api.vercel.com/v10/projects/$pid/env" -Method POST -Headers $h -Body (ConvertTo-Json $vars -Depth 5)
Write-Host "Env vars added: $($r.created.Count)"
$r.created | ForEach-Object { Write-Host "  v $($_.key)" }

# Now trigger deployment from GitHub
$depBody = @{
    name = "salezy"
    gitSource = @{
        type = "github"
        repoId = "tchvut1221-ops/salezy"
        ref = "main"
    }
    projectId = $pid
    target = "production"
} | ConvertTo-Json -Depth 5

$dep = Invoke-RestMethod -Uri "https://api.vercel.com/v13/deployments" -Method POST -Headers $h -Body $depBody
Write-Host "Deployment started: $($dep.url)"
