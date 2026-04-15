# Ensure-NodeJS.ps1 - 确保 Node.js 可用，可被任意脚本 dot-source
# 用法：. "$PSScriptRoot\Ensure-NodeJS.ps1"
# 效果：若 Node.js 已就绪则直接返回；若未就绪则自动下载安装，完成后刷新 Env.ps1

# 先加载公共环境（幂等，重复 dot-source 无副作用）
. "$PSScriptRoot\Env.ps1"

if ($Global:OC_NODE_READY) {
    Write-Host "  ✓ Node.js $Global:OC_NODE_VER 已就绪" -ForegroundColor DarkGray
    return
}

Write-Host ""
Write-Host "  未检测到 Node.js，开始自动安装..." -ForegroundColor Yellow
Write-Host ""

# ============ 内部函数 ============

function _OC_GetLatestLtsVersion {
    $indexUrl = "https://npmmirror.com/mirrors/node/index.json"
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Write-Host "  [1/3] 查询最新 LTS 版本..." -ForegroundColor Cyan
    try {
        $json = Invoke-RestMethod -Uri $indexUrl -UseBasicParsing
    } catch {
        Write-Host "  主镜像失败，切换清华源..." -ForegroundColor Yellow
        $script:_nodeMirror = "https://mirrors.tuna.tsinghua.edu.cn/nodejs-release"
        $json = Invoke-RestMethod -Uri "$script:_nodeMirror/index.json" -UseBasicParsing
    }
    $lts = $json | Where-Object { $_.lts -and $_.lts -ne $false } | Select-Object -First 1
    if (-not $lts) { throw "无法获取 Node.js LTS 版本信息" }
    return $lts.version
}

function _OC_DownloadNode {
    param([string]$version, [string]$destDir)
    $mirror = if ($script:_nodeMirror) { $script:_nodeMirror } else { "https://npmmirror.com/mirrors/node" }
    $arch   = if ([Environment]::Is64BitOperatingSystem) { "win-x64" } else { "win-x86" }
    $zip    = "node-$version-$arch.zip"
    $url    = "$mirror/$version/$zip"
    $dest   = Join-Path $destDir $zip

    Write-Host "  [2/3] 下载 $zip ..." -ForegroundColor Cyan
    Write-Host "        $url" -ForegroundColor DarkGray

    $downloaded = $false

    # 优先用带进度的 HttpWebRequest 下载
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $req  = [Net.HttpWebRequest]::Create($url)
        $req.Timeout = 120000
        $resp = $req.GetResponse()
        $total = $resp.ContentLength
        $stream = $resp.GetResponseStream()
        $outStream = [IO.File]::Create($dest)
        $buf = New-Object byte[] 65536
        $received = 0
        while ($true) {
            $read = $stream.Read($buf, 0, $buf.Length)
            if ($read -le 0) { break }
            $outStream.Write($buf, 0, $read)
            $received += $read
            if ($total -gt 0) {
                $pct = [math]::Round($received / $total * 100)
                $mb  = [math]::Round($received / 1MB, 1)
                $tot = [math]::Round($total / 1MB, 1)
                Write-Host -NoNewline "`r        $pct% ($mb/$tot MB)  "
            }
        }
        $outStream.Close()
        $stream.Close()
        Write-Host ""
        $downloaded = $true
    } catch {
        if ($outStream) { $outStream.Close() }
        Write-Host ""
        Write-Host "  HttpWebRequest 失败，切换 WebClient..." -ForegroundColor Yellow
        if (Test-Path $dest) { Remove-Item $dest -Force }
    }

    # fallback 1: WebClient
    if (-not $downloaded) {
        try {
            (New-Object System.Net.WebClient).DownloadFile($url, $dest)
            $downloaded = $true
        } catch {
            Write-Host "  WebClient 失败，切换 Invoke-WebRequest..." -ForegroundColor Yellow
        }
    }
    # fallback 2: Invoke-WebRequest
    if (-not $downloaded) {
        Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
        $downloaded = $true
    }

    if (-not (Test-Path $dest)) { throw "下载失败：$dest 不存在" }
    $mb = [math]::Round((Get-Item $dest).Length / 1MB, 1)
    Write-Host "        下载完成 ($mb MB)" -ForegroundColor Green

    Write-Host "  [3/3] 解压到 $destDir ..." -ForegroundColor Cyan
    Expand-Archive -Path $dest -DestinationPath $destDir -Force
    Remove-Item $dest -Force
    Write-Host "        解压完成" -ForegroundColor Green
}

# ============ 执行安装 ============

$script:_nodeMirror = $null
$ver = _OC_GetLatestLtsVersion
Write-Host "        最新 LTS: $ver" -ForegroundColor Green
_OC_DownloadNode -version $ver -destDir $Global:OC_ROOT

# 重新加载 Env.ps1 刷新全局变量
. "$PSScriptRoot\Env.ps1"

if ($Global:OC_NODE_READY) {
    Write-Host ""
    Write-Host "  ✓ Node.js $Global:OC_NODE_VER 安装完成" -ForegroundColor Green
    OC-Log "Node.js $Global:OC_NODE_VER 安装完成"
} else {
    throw "Node.js 安装后仍未检测到，请检查目录结构。"
}
