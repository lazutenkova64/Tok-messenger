param([string]$FilePath)
$content = Get-Content $FilePath -Raw -Encoding UTF8
$lines = $content -split "`n"

$startLine = -1
$braceDepth = 0

for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    
    if ($line -match 'function sendMessage') {
        $startLine = $i
        Write-Output "=== Starting sendMessage at line $($i+1) ==="
    }
    
    if ($startLine -ge 0) {
        $prevDepth = $braceDepth
        foreach ($ch in $line.ToCharArray()) {
            if ($ch -eq '{') { $braceDepth++ }
            elseif ($ch -eq '}') { $braceDepth-- }
        }
        
        if ($braceDepth -lt $prevDepth) {
            Write-Output "Line $($i+1) [depth: $($prevDepth)->$braceDepth]: $line"
        } elseif ($braceDepth -gt $prevDepth) {
            Write-Output "Line $($i+1) [depth: $($prevDepth)->$braceDepth]: $line"
        }
        
        if ($braceDepth -eq 0 -and $i -gt $startLine) {
            Write-Output "=== Function ends at line $($i+1) ==="
            break
        }
    }
}

if ($startLine -ge 0) {
    Write-Output "Final depth: $braceDepth"
    if ($braceDepth -ne 0) {
        Write-Output "ERROR: Function never closed! Depth=$braceDepth"
    }
}
