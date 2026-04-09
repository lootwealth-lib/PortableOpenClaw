# 需求文档

## 简介

OpenClaw 一键便捷启动工具是一个跨平台的命令行工具集，旨在简化 OpenClaw 网关的安装、配置、启动、停止和升级操作。该工具通过 Node.js 脚本实现核心逻辑，并通过平台专属的启动脚本（Windows 批处理 / Linux Bash）拉起对应的 JS 模块，支持 Windows 11 和 Ubuntu 两个平台。

## 词汇表

- **Launcher**：OpenClaw 启动工具，本系统的总称
- **Gateway**：OpenClaw 网关进程，由 Launcher 负责启动和停止
- **Node_Checker**：Node.js 可执行性检测模块，在每个 JS 脚本运行前执行
- **Installer**：安装/修复模块，负责自动安装和修复 OpenClaw 运行环境
- **Cleaner**：清除模块，负责删除配置文件和用户数据
- **Upgrader**：升级模块，负责检查并下载 OpenClaw 最新版本
- **Config_Dir**：配置目录，位于当前工作目录下的 `openclaw-config/` 子目录
- **Win_Dir**：Windows 核心文件目录，位于 `win/` 子目录
- **Linux_Dir**：Ubuntu 核心文件目录，位于 `linux/` 子目录
- **Token**：OpenClaw 网关的访问令牌，启动后显示在控制界面

## 需求

### 需求 1：Node.js 环境检测

**用户故事：** 作为用户，我希望工具在运行前自动检测 Node.js 环境，以便在环境缺失时能自动修复，而不是直接报错退出。

#### 验收标准

1. WHEN 任意 JS 脚本被启动脚本调用时，THE Node_Checker SHALL 检测当前系统中 Node.js（24 LTS）是否可执行
2. WHEN Node.js 不可执行或版本不符合要求时，THE Node_Checker SHALL 自动触发 Node.js 的下载和安装流程
3. WHEN Node.js 下载安装完成后，THE Node_Checker SHALL 重新验证 Node.js 可执行性并继续执行原始脚本
4. IF Node.js 下载或安装失败，THEN THE Node_Checker SHALL 输出明确的错误信息并以非零状态码退出
5. THE Node_Checker SHALL 将检测结果和安装过程记录到 Config_Dir 下的日志文件中

---

### 需求 2：一键安装/修复

**用户故事：** 作为用户，我希望通过一个命令自动完成 OpenClaw 环境的安装和修复，以便在全新环境或损坏环境中快速恢复正常运行。

#### 验收标准

1. WHEN 用户执行安装/修复命令时，THE Installer SHALL 检测 OpenClaw 所需的所有依赖项是否已正确安装
2. WHEN 依赖项缺失或损坏时，THE Installer SHALL 自动下载并安装缺失的依赖项
3. WHEN 安装过程中发生错误时，THE Installer SHALL 输出具体的错误描述并提供修复建议
4. WHEN 安装成功完成时，THE Installer SHALL 输出安装成功的确认信息
5. THE Installer SHALL 将所有安装步骤和结果记录到 Config_Dir 下的日志文件中
6. WHERE 运行平台为 Windows 11，THE Installer SHALL 使用 Win_Dir 下的平台专属安装逻辑
7. WHERE 运行平台为 Ubuntu，THE Installer SHALL 使用 Linux_Dir 下的平台专属安装逻辑

---

### 需求 3：一键清除隐私数据和配置

**用户故事：** 作为用户，我希望通过一个命令删除所有配置文件和用户数据，以便将工具恢复到初始状态或保护隐私。

#### 验收标准

1. WHEN 用户执行清除命令时，THE Cleaner SHALL 在执行删除前向用户显示确认提示，说明将被删除的内容
2. WHEN 用户确认清除操作时，THE Cleaner SHALL 删除 Config_Dir 目录下的所有配置文件、日志文件和缓存文件
3. WHEN 用户取消清除操作时，THE Cleaner SHALL 不执行任何删除操作并退出
4. WHEN 清除操作完成时，THE Cleaner SHALL 输出已删除文件的数量和路径摘要
5. IF 某个文件无法被删除（如权限不足），THEN THE Cleaner SHALL 记录该文件的路径和错误原因，并继续清除其他文件
6. WHEN 清除完成后，THE Cleaner SHALL 验证 Config_Dir 目录已被清空或不存在

---

### 需求 4：启动网关

**用户故事：** 作为用户，我希望通过一个命令启动 OpenClaw 网关并查看控制信息，以便快速开始使用网关服务。

#### 验收标准

1. WHEN 用户执行启动命令时，THE Launcher SHALL 检测 Gateway 进程是否已在运行
2. IF Gateway 进程已在运行，THEN THE Launcher SHALL 提示用户网关已启动并显示当前 Token
3. WHEN Gateway 进程未运行时，THE Launcher SHALL 启动 Gateway 进程
4. WHEN Gateway 成功启动后，THE Launcher SHALL 在控制界面显示 Gateway 的运行状态和 Token
5. IF Gateway 启动失败，THEN THE Launcher SHALL 输出具体的错误信息并记录到日志文件
6. THE Launcher SHALL 将 Gateway 的进程 ID（PID）记录到 Config_Dir 下的状态文件中

---

### 需求 5：停止网关

**用户故事：** 作为用户，我希望通过一个命令停止 OpenClaw 网关，以便在不需要时释放系统资源。

#### 验收标准

1. WHEN 用户执行停止命令时，THE Launcher SHALL 读取 Config_Dir 下的状态文件以获取 Gateway 的 PID
2. WHEN 找到有效 PID 时，THE Launcher SHALL 向 Gateway 进程发送终止信号
3. WHEN Gateway 进程成功停止后，THE Launcher SHALL 清除 Config_Dir 下的状态文件中的 PID 记录
4. IF Gateway 进程未在运行，THEN THE Launcher SHALL 提示用户网关当前未运行
5. IF 进程终止超时（超过 10 秒），THEN THE Launcher SHALL 强制终止该进程并记录警告日志
6. WHEN 停止操作完成时，THE Launcher SHALL 输出网关已停止的确认信息

---

### 需求 6：升级 OpenClaw

**用户故事：** 作为用户，我希望通过一个命令检查并升级 OpenClaw 到最新版本，以便获得最新功能和安全修复。

#### 验收标准

1. WHEN 用户执行升级命令时，THE Upgrader SHALL 从官方源检查 OpenClaw 的最新可用版本
2. WHEN 检测到新版本时，THE Upgrader SHALL 向用户显示当前版本和最新版本信息，并请求确认
3. WHEN 用户确认升级时，THE Upgrader SHALL 下载最新版本的 OpenClaw 安装包
4. WHEN 下载完成后，THE Upgrader SHALL 验证下载文件的完整性（校验和）
5. WHEN 文件完整性验证通过后，THE Upgrader SHALL 替换旧版本文件并完成升级
6. WHEN 当前版本已是最新版本时，THE Upgrader SHALL 提示用户无需升级
7. IF 下载过程中发生网络错误，THEN THE Upgrader SHALL 输出错误信息并保留旧版本文件不变
8. IF 文件完整性验证失败，THEN THE Upgrader SHALL 删除损坏的下载文件并提示用户重试
9. THE Upgrader SHALL 将升级过程记录到 Config_Dir 下的日志文件中

---

### 需求 7：跨平台兼容性

**用户故事：** 作为用户，我希望工具在 Windows 11 和 Ubuntu 上都能正常运行，以便在不同操作系统环境中使用。

#### 验收标准

1. WHERE 运行平台为 Windows 11，THE Launcher SHALL 通过 Win_Dir 下的 `.bat` 批处理脚本拉起对应的 JS 模块
2. WHERE 运行平台为 Ubuntu，THE Launcher SHALL 通过 Linux_Dir 下的 `.sh` Bash 脚本拉起对应的 JS 模块
3. THE Launcher SHALL 使用 Node.js 的 `path` 模块处理所有文件路径，避免硬编码路径分隔符
4. THE Launcher SHALL 将所有文件和日志存储在当前工作目录下，不依赖绝对路径
5. WHERE 运行平台为 Windows 11，THE Launcher SHALL 正确处理 Windows 的文件权限和访问控制
6. WHERE 运行平台为 Ubuntu，THE Launcher SHALL 正确处理 Linux 的文件权限（chmod）和访问控制

---

### 需求 8：日志和调试

**用户故事：** 作为开发者或高级用户，我希望工具提供详细的日志记录，以便在出现问题时进行调试和排查。

#### 验收标准

1. THE Launcher SHALL 使用 winston 日志库管理所有日志输出
2. THE Launcher SHALL 将日志文件存储在 Config_Dir 目录下
3. WHEN 日志文件大小超过 10MB 时，THE Launcher SHALL 自动轮转日志文件
4. THE Launcher SHALL 支持至少两个日志级别：INFO（常规操作）和 ERROR（错误信息）
5. WHEN 用户以调试模式运行时，THE Launcher SHALL 输出 DEBUG 级别的详细日志
6. THE Launcher SHALL 在每条日志记录中包含时间戳、日志级别和操作模块名称



By Kiro
