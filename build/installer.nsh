; NSIS 安装程序额外配置
; FlowBoard Windows 安装程序

!macro customInstall
  ; 创建快捷方式
  CreateDirectory "$SMPROGRAMS\FlowBoard"
  CreateShortcut "$SMPROGRAMS\FlowBoard\FlowBoard.lnk" "$INSTDIR\FlowBoard.exe"
  CreateShortcut "$SMPROGRAMS\FlowBoard\卸载.lnk" "$INSTDIR\Uninstall FlowBoard.exe"
  
  ; 创建桌面快捷方式
  CreateShortcut "$DESKTOP\FlowBoard.lnk" "$INSTDIR\FlowBoard.exe"
!macroend

!macro customUnInstall
  ; 删除快捷方式
  Delete "$SMPROGRAMS\FlowBoard\FlowBoard.lnk"
  Delete "$SMPROGRAMS\FlowBoard\卸载.lnk"
  Delete "$DESKTOP\FlowBoard.lnk"
  RMDir "$SMPROGRAMS\FlowBoard"
  
  ; 清理用户数据（可选）
  ; MessageBox MB_YESNO "是否删除所有用户数据？" /SD IDNO IDNO SkipDataRemoval
  ; RMDir /r "$LOCALAPPDATA\flowboard"
  ; SkipDataRemoval:
!macroend
