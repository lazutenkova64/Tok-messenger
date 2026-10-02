$lines = Get-Content 'F:\Tok-messenger-new\index.html' -Encoding UTF8
$depth = 0
$openLines = @()
$startLine = 2775

for ($i = $startLine; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    $idx = $line.IndexOf('//')
    if ($idx -ge 0) { $line = $line.Substring(0, $idx) }
    
    for ($j = 0; $j -lt $line.Length; $j++) {
        $ch = $line[$j]
        if ($ch -eq '{') {
            $depth++
            $openLines += $i + 1
        }
        elseif ($ch -eq '}') {
            if ($depth -gt 0) {
                $depth--
                if ($openLines.Count -gt 0) { $openLines = $openLines[1..($openLines.Count-1)] }
            }
        }
    }
}

Write-Host "Final brace depth: $depth"
if ($depth -gt 0) {
    Write-Host "Unclosed braces ($($openLines.Count)):"
    foreach ($ln in $openLines) {
        Write-Host "  Line $ln"
    }
}
