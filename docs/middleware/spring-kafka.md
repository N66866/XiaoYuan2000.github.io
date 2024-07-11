# kafka
## 服务器安装
### 下载
官网下载：https://kafka.apache.org/downloads  

由于是学习阶段，使用的版本久一点，这里我们使用2.8.0
使用centos作为操作系统，
1. 首先使用`wget https://archive.apache.org/dist/kafka/2.8.0/kafka_2.13-2.8.0.tgz` 下载文件
2. 再使用 `tar -zxvf kafka_2.13-2.8.0.tgz 解压出来`  

### 使用
1. zookeeper
	* 启动： `bin/zookeeper-server-start.sh -daemon config/zookeeper.properties`
	* 关闭： `bin/zookeeper-server-stop.sh -daemon config/zookeeper.properties`
2. kafka
	* 启动： `bin/kafka-server-start.sh -daemon config/server.properties`
	* 关闭： `bin/kafka-server-stop.sh -daemon config/server.properties`
3. 主题
	* 新建一个名为"Hello-Kafka"的主题： `bin/kafka-topics.sh --create --zookeeper localhost:2181 --replication-factor 1 --partitions 1 --topic Hello-Kafka`
	* 查看主题： `bin/kafka-topics.sh --list --zookeeper localhost:2181`
4. 消息
	* 向 "Hello-Kafka" 发送消息： `bin/kafka-console-producer.sh --broker-list localhost:9092 --topic Hello-Kafka`
	* 监听 "Hello-Kafka" 消息： `bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic Hello-Kafka --from-beginning`

**注意，需要先启动zookeeper过三五秒再启动kafka，不然kafka会启动失败报错**  

### 非本机访问配置
如果需要其他机器访问安装的kafka，则需要修改配置
```
监听端口 允许外部ip访问
# listeners=PLAINTEXT://:9092
listeners=PLAINTEXT://0.0.0.0:9092

对外服务ip
# advertised.listeners=PLAINTEXT://your.host.name:9092
advertised.listeners=PLAINTEXT://安装的机器ip:9092
```

## spring-kafka
### 依赖
```xml
<dependency>
            <groupId>org.springframework.kafka</groupId>
            <artifactId>spring-kafka</artifactId>
</dependency>
```
### 配置文件
```yaml
spring:
  kafka:
  	# 需要配置外部机器访问，看前面的章节，否则会连不上
    bootstrap-servers: 安装kafka的机器ip:9092
    producer:
      # 发生错误后，消息重发的次数。
      retries: 1
      #当有多个消息需要被发送到同一个分区时，生产者会把它们放在同一个批次里。该参数指定了一个批次可以使用的内存大小，按照字节数计算。
      batch-size: 16384
      # 设置生产者内存缓冲区的大小。
      buffer-memory: 33554432
      # 键的序列化方式
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      # 值的序列化方式
      value-serializer: org.apache.kafka.common.serialization.StringSerializer
      # acks=0 ： 生产者在成功写入消息之前不会等待任何来自服务器的响应。
      # acks=1 ： 只要集群的首领节点收到消息，生产者就会收到一个来自服务器成功响应。
      # acks=all ：只有当所有参与复制的节点全部收到消息时，生产者才会收到一个来自服务器的成功响应。
      acks: 1
    consumer:
      # 自动提交的时间间隔 在spring boot 2.X 版本中这里采用的是值的类型为Duration 需要符合特定的格式，如1S,1M,2H,5D
      auto-commit-interval: 1S
      # 该属性指定了消费者组在读取一个没有偏移量的分区或者偏移量无效的情况下该作何处理：
      # latest（默认值）在偏移量无效的情况下，消费者将从最新的记录开始读取数据（在消费者启动之后生成的记录）
      # earliest ：在偏移量无效的情况下，消费者将从起始位置读取分区的记录
      auto-offset-reset: earliest
      # 是否自动提交偏移量，默认值是true,为了避免出现重复数据和数据丢失，可以把它设置为false,然后手动提交偏移量
      enable-auto-commit: false
      # 键的反序列化方式
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      # 值的反序列化方式
      value-deserializer: org.apache.kafka.common.serialization.StringDeserializer
    listener:
      # 在侦听器容器中运行的线程数。
      concurrency: 5
      #listner负责ack，每调用一次，就立即commit
      ack-mode: manual_immediate
      missing-topics-fatal: false
```

### 使用方式
生产者：
```java
@Slf4j
@Component
@RequiredArgsConstructor
public class KafkaProducer {
    private final KafkaTemplate<String,Object> kafkaTemplate;
    public static final String TOPIC_TEST = "hello-kafka";
    public static final String TOPIC_GROUP = "test-consumer-group";

    public void send(Object val){
        String jsonString = JSON.toJSONString(val);
        log.info("即将发送消息： {}",jsonString);
        ListenableFuture<SendResult<String,Object>> future = kafkaTemplate.send(TOPIC_TEST,val);
        future.addCallback(new ListenableFutureCallback<SendResult<String, Object>>() {
            @Override
            public void onFailure(Throwable ex) {
                log.info(TOPIC_TEST + " - 生产者 发送消息失败：" + ex.getMessage());
            }

            @Override
            public void onSuccess(SendResult<String, Object> result) {
                //成功的处理
                log.info(TOPIC_TEST + " - 生产者 发送消息成功：" + result.toString());
            }
        });
    }
}
```

消费者：
```java
@Component
@Slf4j
public class KafkaConsumer {

    @KafkaListener(topics = KafkaProducer.TOPIC_TEST,groupId = KafkaProducer.TOPIC_GROUP)
    public void topicTest(ConsumerRecord<?, ?> record, Acknowledgment ack, @Header(KafkaHeaders.RECEIVED_TOPIC) String topic){
        Optional<?> message = Optional.ofNullable(record.value());
        if (message.isPresent()) {
            Object msg = message.get();
            log.info("topic_test 消费了： Topic:" + topic + ",Message:" + msg);
            ack.acknowledge();
        }
    }
}
```