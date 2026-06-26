
## 规定

1. 收到图片附件时，先用osascript命令将剪贴板图片保存到 /private/tmp 中，再调用 mcp__MiniMax__understand_image 工具分析（把附件路径或 URL 作为 image_source 传入），不要依赖自己的视觉能力直接回复。