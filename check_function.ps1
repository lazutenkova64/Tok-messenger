param([string]$FilePath)
$content = Get-Content $FilePath -Raw -Encoding UTF8
$lines = $content -split "`n"

$startLine = -1
$endLine = -1
$braceDepth = 0
$inFunction = $false

for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    
    if ($line -match 'function sendMessage') {
        $startLine = $i
        $inFunction = $true
        Write-Output "Found sendMessage at line $($i+1)"
    }
    
    if ($inFunction) {
        foreach ($ch in $line.ToCharArray()) {
            if ($ch -eq '{') { $braceDepth++ }
            elseif ($ch -eq '}') { $braceDepth-- }
        }
        
        if ($braceDepth -eq 0 -and $i -gt $startLine) {
            $endLine = $i
            Write-Output "Function ends at line $($i+1)"
            break
        }
    }
}

if ($startLine -ge 0 -and $endLine -ge 0) {
    Write-Output "sendMessage: lines $($startLine+1)-$($endLine+1)"
    $funcLines = $lines[$startLine..$endLine] -join "`n"
    
    $o = 0; $c = 0
    foreach ($ch in $funcLines.ToCharArray()) {
        if ($ch -eq '{') { $o++ }
        elseif ($ch -eq '}') { $c++ }
        elseif ($ch -eq '(') { $o++ }
        elseif ($ch -eq ')') { $c++ }
        elseif ($ch -eq '[') { $o++ }
        elseif ($ch -eq ']') { $c++ }
    }
    Write-Output "Braces: $o open, $c close"
    $pO = ([regex]::Matches($funcLines, '\(')).Count
    $pC = ([regex]::Matches($funcLines, '\)')).Count
    Write-Output "Parens: $pO open, $pC close"
    $bO = ([regex]::Matches($funcLines, '\[')).Count
    $bC = ([regex]::Matches($funcLines, '\]')).Count
    Write-Output "Brackets: $bO open, $bC close"
    if ($o -eq $c -and $pO -eq $pC -and $bO -eq $bC) {
        Write-Output 'BALANCED'
    } else {
        Write-Output 'MISMATCH'
    }
} else {
    Write-Output 'Function not found or no end found'
}
