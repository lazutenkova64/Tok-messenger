param([string]$FilePath)
$content = Get-Content $FilePath -Raw -Encoding UTF8
$lines = $content -split "`n"

$inScript = $false
$depth = 0
$startLine = -1
$lastOpenLine = -1
$lastOpenDepth = 0

for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    
    if ($line -match '<script>' -and $line -notmatch 'src=') {
        $inScript = $true
        $startLine = $i
        continue
    }
    
    if ($inScript -and $line -match '</script>') {
        Write-Output "Final depth: $depth"
        if ($depth -ne 0) {
            Write-Output "Last open at line $($lastOpenLine+1) when depth was $($lastOpenDepth-1)"
            # Show context around last open
            $showStart = [Math]::Max(0, $lastOpenLine - 3)
            $showEnd = [Math]::Min($lines.Count - 1, $lastOpenLine + 10)
            for ($j = $showStart; $j -le $showEnd; $j++) {
                $marker = ""
                if ($j -eq $lastOpenLine) { $marker = " <-- LAST OPEN" }
                Write-Output "  $($j+1): $($lines[$j])$marker"
            }
        }
        break
    }
    
    if ($inScript) {
        $prevDepth = $depth
        foreach ($ch in $line.ToCharArray()) {
            if ($ch -eq '{') {
                $depth++
                if ($depth -gt $lastOpenDepth) {
                    $lastOpenLine = $i
                    $lastOpenDepth = $depth
                }
            }
            elseif ($ch -eq '}') { $depth-- }
        }
    }
}
