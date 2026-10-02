param([string]$FilePath)
$content = Get-Content $FilePath -Raw -Encoding UTF8
$scriptMatch = [regex]::Match($content, '(?s)<script>\s*(.*?)\s*</script>')
if (-not $scriptMatch.Success) { Write-Output 'No script found'; exit }
$js = $scriptMatch.Groups[1].Value

$depth = 0
$lineNum = 1
$firstBad = -1
$lastGood = -1
$lines = $js -split "`n"

for ($i = 0; $i -lt $js.Length; $i++) {
    $ch = $js[$i]
    if ($ch -eq "`n") { $lineNum++ }
    if ($ch -eq '{') { $depth++ }
    elseif ($ch -eq '}') { $depth-- }
    elseif ($ch -eq '(') { $depth++ }
    elseif ($ch -eq ')') { $depth-- }
    elseif ($ch -eq '[') { $depth++ }
    elseif ($ch -eq ']') { $depth-- }
    
    if ($depth -lt 0 -and $firstBad -eq -1) {
        $firstBad = $lineNum
        Write-Output "FIRST NEGATIVE at line $lineNum, depth=$depth"
        # Show context
        $start = [Math]::Max(0, $i - 80)
        $end = [Math]::Min($js.Length, $i + 80)
        $ctx = $js.Substring($start, $end - $start)
        Write-Output "Context: ...$ctx..."
        break
    }
    $lastGood = $lineNum
}

if ($depth -ne 0 -and $firstBad -eq -1) {
    Write-Output "FINAL depth=$depth (not zero), last good line=$lastGood"
    # Show last 20 lines
    $totalLines = $lines.Count
    $startLine = [Math]::Max(0, $totalLines - 20)
    Write-Output "Last 20 lines:"
    for ($i = $startLine; $i -lt $totalLines; $i++) {
        Write-Output "$($i+1): $($lines[$i])"
    }
} elseif ($firstBad -eq -1) {
    Write-Output "All balanced, final depth=$depth"
}
