param([string]$FilePath, [int]$StartLine, [int]$Count)
$lines = Get-Content $FilePath -Encoding UTF8
for ($i = $StartLine - 1; $i -lt $StartLine + $Count - 1; $i++) {
    $line = $lines[$i]
    $spaces = 0
    foreach ($ch in $line.ToCharArray()) {
        if ($ch -eq ' ') { $spaces++ } else { break }
    }
    Write-Output "Line $($i+1): $spaces spaces | $line"
}
