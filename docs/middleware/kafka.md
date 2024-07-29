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

### 重置偏移量
```sh
	* offset重置到头 bin/kafka-consumer-grous.sh --bootstrap-server 127.0.0.1:9092 --group 消费者组 --topic 主题 --reset-offsets --to-earliest --excute
	* offset重置到尾 bin/kafka-consumer-grous.sh --bootstrap-server 127.0.0.1:9092 --group 消费者组 --topic 主题 --reset-offsets --to-latest --excute
```

## spring集成kafka
请看本站的另一个spring栏目

## kafka 概念
### 副本Replica
在创建主题时，**`--replication-factor` 就是指定副本数量 最小为1 最大不超过节点数量**  
只有一个副本时，就只有主副本即主节点。 多个副本时，读写也是操作主节点，从副本（从节点）只用于备份主节点数据。  
当主节点挂掉时，从节点顶上成为主节点。
```sh
	* 新建一个名为"Hello-Kafka"的主题： `bin/kafka-topics.sh --create --zookeeper localhost:2181 --replication-factor 1 --partitions 1 --topic Hello-Kafka`
```

### kafka事件数据的储存  

#### 数据文件保存
查看kafka的配置文件： server.properties 之 log.dirs
kafka的所有事件都是以日志文件的方式来保存的。格式 topicId-partitionId 
例如 : test-topic-0
000000000000000000000000.index 消息索引文件
000000000000000000000000.log 消息数据文件
000000000000000000000000.timeindex 消息的时间戳索引文件
000000000000000000000001.snapshot 快照文件，生产者发生故障或者重启时能够恢复并继续之前的操作
leader-epoch-checkpoint 记录每个分区当前领导者的epoch以及领导者开始写入消息时的起始偏移量
partition.metadata 存储关于特定分区的元数据信息

#### `consumer_offsets  `

1. 作用
`__consumer_offsets `是一个特殊的内部主题，用于存储消费者组的偏移量信息。主要作用是记录每个消费者组中消费者的偏移量，确保消费者发生故障或重启时能够从上次提交的偏移量继续消费，避免数据丢失或重复消费。

2. 结构和分区
分区数：`__consumer_offsets` 主题默认有 50 个分区。这是为了支持高并发和大规模的消费者组。
键和值：每条记录的键是一个由消费者组 ID、主题和分区组成的复合键；值是消费者的偏移量和元数据（如提交的时间戳）。
3. 记录格式
键（Key）：
消费者组 ID：消费者组的唯一标识符。
主题：消费者正在消费的主题。
分区：消费者正在消费的主题分区。  

值（Value）：
偏移量：消费者在该分区上提交的最新偏移量。
元数据：一些额外的信息，如提交的时间戳。

4. 示例
假设有一个消费者组 ID 为 group1，正在消费主题 topic1 的分区 partition0，当前偏移量为 100。在 `__consumer_offsets `主题中，可能存储的记录如下：
  
键：
消费者组 ID：group1
主题：topic1
分区：partition0
  
值：
偏移量：100
元数据：如时间戳 1620000000000

5. 读取和监控 `__consumer_offsets`
可以使用 Kafka 提供的工具来查看和监控 `__consumer_offsets` 主题的数据。例如，可以使用 kafka-consumer-groups.sh 工具来查看消费者组的偏移量信息。
```sh
bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --group group1 --describe

# group topic       partition  current-offset          log-end-offset     lag 
 group1 test-topic  0          10                          15              5
 消费组  主题        分区号     当前分区消费者offset   当前分区生产者offset   可读取消息数
```
这个命令将显示消费者组 group1 在各个分区上的偏移量、日志末尾偏移量以及滞后量。
  
6. 内部机制
当消费者提交偏移量时，Kafka 会将该信息写入到 `__consumer_offsets` 主题中。提交过程如下：  
消费者消费消息：消费者从主题的某个分区消费消息。
提交偏移量：消费者定期提交消费到的偏移量到 `__consumer_offsets` 主题。
写入日志：提交的偏移量作为一条记录写入 `__consumer_offsets` 主题的相应分区。
从偏移量恢复：如果消费者发生故障或重新启动，它将从 `__consumer_offsets` 主题中读取最后一次提交的偏移量，继续消费。

7. 数据保留
`__consumer_offsets` 主题的数据保留策略通常设置为较长的时间，以确保可以在较长时间内恢复消费者的状态。可以通过以下参数配置：
offsets.retention.minutes：指定偏移量保留的时间，默认是 7 天。
offsets.retention.check.interval.ms：指定检查过期偏移量的间隔时间。
配置示例
在 Kafka 配置文件（server.properties）中，可以配置这些参数：
```properties
offsets.retention.minutes=10080  # 7 天
offsets.retention.check.interval.ms=600000  # 10 分钟
```  

8. 总结
`__consumer_offsets` 主题是 Kafka 用于管理消费者组偏移量的核心组件。它确保消费者能够从故障中恢复，并避免数据丢失或重复消费。通过理解其工作机制和配置选项，可以更好地管理和监控 Kafka 消费者组的行为。