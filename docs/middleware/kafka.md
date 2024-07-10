# kafka
## 下载安装
### 官网下载
官网下载解压即可：https://kafka.apache.org/downloads  

### docker下载
docker pull apache/kafka:[version] 
例如：
```sh
docker pull apache/kafka:3.7.0 
```
注意：docker 需要代理才能拉镜像，可参考本网站的docker篇章

### docker外部机器连接不上
**docker容器的kafka有三种配置启动方式** 
  详情可看 docker文档：https://github.com/apache/kafka/blob/trunk/docker/examples/README.md
1. 默认配置：外部连不上  
2. 文件输入：提供本地配置文件，替换掉docker中默认配置  
```sh
# 进去kafka容器
# 进去容器配置文件 /etc/kafka/docker/server.properties 不能编辑是只读的，并且这个修改只针对该容器，而不是apache/kafka镜像。所以要将配置文件放在宿主机。
docker exec -it kafka-container-id /bin/bash

# 将配置文件复制出宿主机
docker cp kafka-container-id:/etc/kafka/docker/server.properties /opt/kafka/docker/
# 将配置编辑如下
```
[!pic](/middleware/kafka-01.png)  
修改完配置后，将配置挂载
```sh
# docker run --volume（或简称 -v） 是 Docker 命令中用于挂载卷（volume）的选项。卷是 Docker 用来持久化和共享数据的一种机制，可以在容器之间共享数据，或者将数据持久化到主机文件系统中。使用卷可以确保即使容器被删除，数据也不会丢失。
# 将刚才修改的配置挂载进 kafka 容器中，启动后外部可以连接
docker run --volume /opt/kafka/docker/:/mnt/shared/config -p 9092:9092 apache/kafka:3.7.0
```

3. 环境变量：  


## 使用官方脚本

### 启动/退出：
```sh
// 使用zookeeper 启动
1. zookeeper
	* 启动： `bin/zookeeper-server-start.sh -daemon config/zookeeper.properties`
	* 关闭： `bin/zookeeper-server-stop.sh -daemon config/zookeeper.properties`
2. kafka
	* 启动： `bin/kafka-server-start.sh -daemon config/server.properties`
	* 关闭： `bin/kafka-server-stop.sh -daemon config/server.properties`

// 使用 KRaft启动 （bin目录下）
1. 生成集群id
./kafka-storage.sh random-uuid # 输出82vqfbdSTO2QzS_M0Su1Bw
2. 配置元数据（集群下每台机器都要配置）
./kafka-storage.sh format -t 82vqfbdSTO2QzS_M0Su1Bw -c config/kraft/server.properties
3. 启动集群
./kafka-server-start.sh -daemon ../config/kraft/server.properties # 当全部节点都出现 Kafka Server started，集群启动成功
4. 关闭集群
./kafka-server-stop.sh -c ../config/kraft/server.properties
```
### 主题
**使用 bin/kafka-topics.sh 不传参可以查看帮助**

创建主题(topic)：
```sh
	* 新建一个名为"Hello-Kafka"的主题： `bin/kafka-topics.sh --create --zookeeper localhost:2181 --replication-factor 1 --partitions 1 --topic Hello-Kafka`
	* 新建一个名为"hello"的主题（简易版）: `bin/kafka-topics.sh --create --topic hello --bootstrap-server localhost:9092`
```

删除主题(topic)：
```sh
	* 删除一个名为"hello"的主题（简易版）: `bin/kafka-topics.sh --delete --topic  hello --bootstrap-server localhost:9092`
```

查看主题(topic):
```sh
	* 查看主题 zookeeper： `bin/kafka-topics.sh --list --zookeeper localhost:2181`
	* 查看主题： `bin/kafka-topics.sh --list --bootstrap-server localhost:9092`
```

显示主题详细(topic):
```sh
	* `bin/kafka-topics.sh --describe --topic hello --bootstrap-server localhost:9092`
```

改变主题(topic):
```sh
	* 修改分区数： `bin/kafka-topics.sh --alert --topic hello  --partition 5 --bootstrap-server localhost:9092`
```

### 收发消息
**使用bin/kafka-console-producer.sh 和 bin/kafka-console-consumer.sh**
```sh
# 发送消息
	* 向"Hello-Kafka"发送消息： bin/kafka-console-producer.sh --topic Hello-Kafka --bootstrap-server localhost:9092
```

```sh
# 监听主题
	* 监听"Hello-Kafka" : bin/kafka-console-consumer.sh --topic Hello-Kafka --bootstrap-server localhost:9092 --from-beginning #从头开始读
```


## spring继承kafka
请看本站的另一个spring栏目