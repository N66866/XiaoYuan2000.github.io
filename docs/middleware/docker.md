# docker
## 下载安装

## 配置代理
### 1. 创建或编辑Docker服务的systemd conf文件
首先，创建一个名为http-proxy.conf的文件在/etc/systemd/system/docker.service.d/目录中。如果目录不存在，则需要创建它：
```sh
mkdir -p /etc/systemd/system/docker.service.d
```
然后编辑
```sh
vi /etc/systemd/system/docker.service.d/http-proxy.conf
```

### 2. 添加代理配置
注意 这个ip:port 填写你拥有代理的那台机子的。 并且要打开允许局域网访问！ 还有保证通信正常（防火墙之类的）
```sh
[Service]
Environment="HTTP_PROXY=http://192.168.72.10:7890/"
Environment="HTTPS_PROXY=http://192.168.72.10:7890/"
```

如果你的网络环境中存在一些不需要通过代理访问的内部或本地地址，你还可以添加一个NO_PROXY环境变量：
```sh
Environment="NO_PROXY=localhost,127.0.0.1,::1,192.168.131.0/22"
```

### 3. 重新加载并重启Docker服务
```sh
systemctl daemon-reload
systemctl restart docker
```

### 4. 验证配置
为了验证代理配置是否已正确应用到Docker服务，你可以查看Docker服务的环境变量：
```sh
systemctl show --property=Environment docker
```
输出内容如下，证明已经设置成 可以开始正常拉镜像
```sh
[root@localhost docker.service.d]# systemctl show --property=Environment docker
Environment=HTTP_PROXY=http://192.168.72.1:7890/ HTTPS_PROXY=http://192.168.72.1:7890/
```
测试拉镜像成功
```sh
docker pull apache/kafka:3.7.0
```
