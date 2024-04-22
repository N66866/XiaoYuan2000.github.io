# 设备断网排查
## 问题描述
设备名：xface
设备与服务器之间网络不通：放置一段时间后，xface设备与服务器之间互相测试网络连通都失败。
* 本机和局域网内其他设备连接正常，xface和局域网未连接过的服务器连接正常，连接过的连接失败（推测ARP问题）。
* xface与网关连接正常
* 使用其他服务器（同网段）测试与本机的连接一切正常（ping和http访问接口）
* 使用其他服务器（同网段且未连接过的服务器）测试与xface设备的连接正常
* 使用其他服务器（同网段且连接过的服务器）测试与xface设备的连接不正常
* 使用其他服务器（不同网段）测试与本机的连接一切正常（ping和http访问接口）
* 使用其他服务器（不同网段且连接过的服务器）测试与xface设备的连接不正常（ping 1次后会重新请求初始化接口，然后无反应。再ping 第2次后，网络连通恢复正常）
* 使用其他服务器（不同网段且未连接过的服务器）测试与xface设备的连接正常
解决方案：重新开关xface的DHCP后，连通恢复正常（xface的ip没有切换）

## 问题排查
### wireshark 抓包
等到xface设备断网时，wireshark数据包如下图，在进行最后一次对xface服务器请求并挥手后，xface设备发起DHCP请求。然后xface设备就断网了
![pic](/cannot-understand/xface-01.png)
![pic](/cannot-understand/xface-02.png)
猜测是这边网络DHCP环境与设备不兼容
抓包发现DHCP续期请求网关全部都是拒绝NAK，而设备被拒绝2次后就会释放IP，而局域网内其他设备是一直发，发到同意为止。

---
### 模拟DHCP过程
[DHCP过程解读博客](https://www.cnblogs.com/Wendy-r/p/12679241.html)  

1. 使用wireshark开始捕获
2. 使用ipconfig /release “指定网卡名” 释放ip
![pic](/cannot-understand/xface-03.png)
3.使用 ipconfig /renew “指定网卡名” 重新获取ip
![pic](/cannot-understand/xface-04.png)
重新获取ip完成后，使用wireshark停止捕获并使用 bootp过滤包
![pic](/cannot-understand/xface-05.png)
DHCP服务器没问题，可以支持获取ip
![pic](/cannot-understand/xface-06.png)
![pic](/cannot-understand/xface-07.png)

## 解决方案
进入路由器网关绑定静态DHCP和静态ARP后，问题解决。暂时测试3天无断网现象