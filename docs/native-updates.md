# 更新插件，无需卸载

安装地址为 `https://github.com/JackLee992/USER_HOUSE`，正式更新跟随 `main`。

已安装这个 fork 的用户可以在酒馆「扩展管理」更新玩伴小屋，然后刷新酒馆页面。新版本也提供小屋「设置」中的检查／更新入口和「刷新生效」按钮。无需先卸载，也不要为了更新清理浏览器数据。

更新只通过酒馆原生 Git 更新接口替换扩展文件。游戏存档、最高分、宠物与设置仍使用原来的 `wanbanXiaowu_*` 浏览器存储键，弹球导入素材仍使用原来的 IndexedDB。更新和刷新之前会调用游戏保存、刷新待保存进度和设置保存，不调用扩展删除／重新安装接口。

如果早期安装选用了 `feature/classic-games-via`，新的内置更新入口会在点击更新后通过酒馆原生分支接口切换到 `main`。检查更新本身不会切换分支。初次升级时，旧版入口仍按它原有逻辑运行；也可先在酒馆扩展管理中切到 `main` 再更新。

内置入口识别实际扩展目录和个人／全局安装。它只更新 `JackLee992/USER_HOUSE` 这个来源；`manifest.homePage` 只是项目链接，不会改变已有 Git 安装的 `origin`。从其他作者仓库安装的副本不会被此按钮自动改源。非 Git 目录、权限错误、拉取失败或更新后仍落后都会显示错误，不会显示“已是最新”。

## 验证与接口依据

接口依据为 [SillyTavern 官方扩展路由](https://github.com/SillyTavern/SillyTavern/blob/8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8/src/endpoints/extensions.js)：

- `GET /api/extensions/discover` 确认安装目录及 local/global。
- `POST /api/extensions/version` 获取实际 Git 分支、提交、更新状态和远端来源。
- 需要迁移旧分支时调用 `/branches` 和 `/switch`（返回204），然后调用 `/update`。
- `/update` 的 `isUpToDate` 是拉取之前的状态，所以完成后必须再次调用 `/version`，确认已在 `main` 且为最新提交。

自动回归 `node --test tests/extension-update.test.mjs` 覆盖7种情形：改名全局安装、旧分支迁移、来源不符、非 Git 副本、拉取后验证失败、更新错误，以及已最新的主分支。

另用 `tests/manual/native-extension-update.mjs` 在隔离目录加载上述官方路由代码，保留全部端点逻辑，通过真实 simple-git 操作 `https://github.com/JackLee992/USER_HOUSE.git`。只替换酒馆服务启动与测试用户目录配置，不伪造更新接口返回。验证过：从旧功能分支提交 `3b13bbf` 切换至主分支 `4324766`，实际工作区 HEAD 与真实 `origin/main` 完全一致。该运行验证的是发布前现有远端提交；不是对尚未推送版本的预先成功声明。

还验证了已在 `main` 但提交落后的安装：官方 `/update` 实际执行 Git pull，从 `3b13bbf` 前进到 `4324766`，随后的 `/version` 与工作区 HEAD 一致。原始记录：[旧分支迁移](evidence/native-update-branch-switch.json)、[主分支原地更新](evidence/native-update-main-pull.json)。

重跑时需准备命名包含 `native-update-fixture` 的可丢弃目录，内含名为 `USER_HOUSE` 的实际 Git 克隆；确保它的 origin 是此 fork。在独立 npm 目录安装 `express`、`simple-git`、`sanitize-filename`，并准备官方酒馆源码，然后执行：

```
node tests/manual/native-extension-update.mjs /path/to/SillyTavern /path/to/dependencies /path/to/native-update-fixture /path/to/evidence.json
```

这个手动工具会真实切分支／拉取其指定的测试克隆，不能指向正在使用的酒馆安装。报告记录前后提交、真实接口顺序、最终工作区 manifest 版本和保存调用。浏览器页面表现及游戏存档继续由 Via 回归负责。

## 发布后更新验证

3.9.0 发布后再次使用官方酒馆路由，已将真实安装从 main@4324766（3.8.0）原地拉取到 main@955ae37（3.9.0），返回版本、实际HEAD和origin/main完全一致；没有调用卸载或安装接口。记录见 [3.8 → 3.9 实际更新](evidence/native-update-to-3.9.json)。
