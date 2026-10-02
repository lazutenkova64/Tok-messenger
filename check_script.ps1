param([string]$FilePath)
$content = Get-Content $FilePath -Raw -Encoding UTF8
$lines = $content -split "`n"

$inScript = $false
$depth = 0
$startLine = -1

for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    
    if ($line -match '<script>' -and $line -notmatch 'src=') {
        $inScript = $true
        $startLine = $i
        Write-Output "=== Starting script at line $($i+1) ==="
        continue
    }
    
    if ($inScript -and $line -match '</script>') {
        Write-Output "=== Ending script at line $($i+1) ==="
        Write-Output "Final depth: $depth"
        if ($depth -ne 0) {
            Write-Output "ERROR: $depth unclosed braces!"
        }
        break
    }
    
    if ($inScript) {
        $prevDepth = $depth
        foreach ($ch in $line.ToCharArray()) {
            if ($ch -eq '{') { $depth++ }
            elseif ($ch -eq '}') { $depth-- }
        }
        
        if ($depth -lt 0) {
            Write-Output "NEGATIVE depth at line $($i+1): $depth"
            Write-Output "  Line: $line"
        }
        
        if ($depth -gt 0 -and $depth -lt $prevDepth) {
            # Write-Output "Line $($i+1) [depth: $($prevDepth)->$depth]: $line"
        }
    }
}
