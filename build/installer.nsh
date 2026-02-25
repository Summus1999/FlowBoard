; NSIS 安装程序额外配置
; FlowBoard Windows 安装程序
; 注意: 桌面快捷方式和开始菜单快捷方式由 electron-builder 自动创建
; 请勿在此手动创建，否则会覆盖带图标的快捷方式

!macro customInstall
  ; electron-builder 会自动创建带图标的快捷方式
  ; 此处可添加其他自定义安装逻辑
!macroend

!macro customUnInstall
  ; electron-builder 会自动处理快捷方式删除
  ; 此处可添加其他自定义卸载逻辑
  
  ; 清理用户数据（可选）
  ; MessageBox MB_YESNO "是否删除所有用户数据？" /SD IDNO IDNO SkipDataRemoval
  ; RMDir /r "$LOCALAPPDATA\flowboard"
  ; SkipDataRemoval:
!macroend
