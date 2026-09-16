> 2026-09-16 运行恢复更新：见 [AUTOMATION_GUARD.md](AUTOMATION_GUARD.md)，补充 09:00 前 Codex 启动保障、延迟任务处理及免费模型错误分类。

# 临时 Mac 运行器

GitHub管理代码、定时与运行日志；Mac执行项目任务；现有云端网站保存数据、AI解读与PDF。自托管不消耗GitHub托管分钟额度，不新增付费服务。

运行器：GitHub官方actions/runner v2.337.0，macOS ARM64，SHA256 `5a2cd92908a93d7276a194e1de6008099f3e7946f3f8e14aa7a1a7b4a31fdec2`。独立目录 `~/.local/share/web3-data-center/runner`，用户LaunchAgent。该目录包含运行器凭据，禁止加入Git或公开日志；放在Documents以外以避免要求系统全盘访问权限。

仓库变量 `WEB3_RUNNER=mac` 选择 `[self-hosted,macOS,ARM64,web3-data-center]`；其他值选择 `ubuntu-latest`。仅指定私有仓库main可以启动任务。checkout不持久化Git凭据。服务端继续校验签名、仓库/所有者ID、私有可见性、main、指定workflow和请求内容哈希；仅允许github-hosted/self-hosted两个执行环境。

安装验收状态：专用运行器已注册并以用户服务运行，仓库变量已切换至Mac。窗口保活已安装；系统08:25自动唤醒仍待用户在终端完成管理员认证。没有将待认证步骤记作完成。

## 每日香港时间

- 08:25：系统定时唤醒；用户LaunchAgent在接电且08:25–10:15窗口内使用caffeinate防止空闲睡眠。
- 08:37、08:52：采集并暂存9点前数据。
- 09:07：冻结AI解读、生成PDF、原子发布。
- 09:32：补救；10:00为监控目标，不是GitHub/API的SLA。
- 每个自然日执行；周末和香港假日照常生成。设备需开机、联网、用户已登录；重启后登录前及合盖状态不保证运行。

macOS设置系统唤醒需要管理员认证。执行前检查 `pmset -g sched`，不覆盖已有用户重复计划。本机核查时无重复计划。批准的命令为 `sudo pmset repeat wakeorpoweron MTWRFSU 08:25:00`。唤醒设置与窗口内保活缺一不可，单独LaunchAgent不能唤醒已睡眠的Mac。

## 回切

1. GitHub托管额度恢复后，根据实际运行耗时评估所有仓库共享额度是否足够。
2. 清空WEB3_RUNNER变量，手动执行并验证云端完整日报。
3. 成功后在运行器目录执行 `./svc.sh stop`，再注销项目运行器；保留所需日志。
4. 移除本项目保活LaunchAgent；若确认为本项目唯一的重复唤醒计划再取消该计划，不更改其他电源配置。

晚于9点的恢复执行只能使用已经存储的截止前数据。新增来源在首次合规晨间采集前继续显示暂缺，验证样本不得倒填成当天9点数据。
