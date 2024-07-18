# spring-kafka
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

## 依赖
```xml
<dependency>
            <groupId>org.springframework.kafka</groupId>
            <artifactId>spring-kafka</artifactId>
</dependency>
```
## 配置文件
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
      #listner负责手动ack，每调用一次，就立即commit
      ack-mode: manual_immediate
      missing-topics-fatal: false
```

## 收发消息
### 生产者
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
        //使用Message类发送消息
        Message<Object> build = MessageBuilder.withPayload(val)
                .setHeader(KafkaHeaders.TOPIC,topic)
                .build();
        kafkaTemplate.send(build);

        //使用ProducerRecord 发送消息
        Headers headers = new RecordHeaders();
        headers.add("header1","header1".getBytes(StandardCharsets.UTF_8));
        //String topic, Integer partition, Long timestamp, K key, V value, Iterable<Header> headers
        ProducerRecord<String,Object> record = new ProducerRecord<>(topic,0,System.currentTimeMillis(),"Key",val,headers);

        //直接发送消息
        ListenableFuture<SendResult<String,Object>> future = kafkaTemplate.send(TOPIC_TEST,val);

        //阻塞获取结果
        SendResult<String,Object> result = future.get();
        //非阻塞回调 jdk8 + springboot 2.x 
        // jdk 17 + springboot3 的返回值是completableFuture 使用 thenAccept thenRun 等添加回调
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

### 消费者  
如果消费者组已经读过主题的消息，需要从头开始读的话，需要重置消费组偏移量或者更换消费者组的id，见：[kafka重置偏移量](./kafka.html#重置偏移量)

```java
/**
 * @KafkaListener注解下属性
 * groupId // 消费组id
 * topics // 主题
 * topicPartitions = { //监听主题分区
 *      @TopicPartitions(
 *          topic = xxx 主题
 *          partitions = {"1","2","0"} // 监听主题的分区号
 *          partitionOffset = {
 *              @PartitionOffset(partition = "3" , initialOffset = "3") // 监听分区号3 初始偏移量为 3
 *              @PartitionOffset(xxxxx)
 *          }
 *      )
 * }
 * */
```  

注意：如果要接受对象需要配置序列化，我选择用JSON

```java
@Component
@Slf4j
public class KafkaConsumer {
    /**
     * 常见注解
     * @Payload 接受消息体
     * @Header 接受消息头 （KafkaHeaders 选字段接受，没有指定头会抛异常）
     * */
    @KafkaListener(topics = KafkaProducer.TOPIC_TEST,groupId = KafkaProducer.TOPIC_GROUP) //@Header 读取消息头
    public void topicTest(ConsumerRecord<?, ?> record, Acknowledgment ack, @Header(KafkaHeaders.RECEIVED_TOPIC) String topic){
        Optional<?> message = Optional.ofNullable(record.value());
        if (message.isPresent()) {
            Object msg = message.get();
            log.info("topic_test 消费了： Topic:" + topic + ",Message:" + msg);
            //确认提交，消息偏移量会更新。不确认的话消息可以被重复消费
            ack.acknowledge();
        }
    }

    @KafkaListener(topics = KafkaProducer.TOPIC_TEST,groupId = KafkaProducer.TOPIC_GROUP)                           //@Payload 接受消息体
    public void topicTest1(ConsumerRecord<?, ?> record, Acknowledgment ack, @Header(KafkaHeaders.RECEIVED_TOPIC) String topic,@Payload Object data){
        Optional<?> message = Optional.ofNullable(data);
        if (message.isPresent()) {
            Object msg = message.get();
            log.info("topic_test 消费了： Topic:" + topic + ",Message:" + msg);
            ack.acknowledge();
        }
    }
}
```

### 批量消费
```yaml
spring:
  kafka:
    consumer:
      fetch-max-wait: 500 # 如果不够10条消息就等500ms
      max-poll-records: : 10 # 每次拉十条
    listener: 
        type: batch # 批量消费
```
```java
    @KafkaListener(topics = KafkaProducer.TOPIC_TEST,groupId = KafkaProducer.TOPIC_GROUP) //@Header 读取消息头
    public void topicTest(List<ConsumerRecord<?, ?>> record, Acknowledgment ack, @Header(KafkaHeaders.RECEIVED_TOPIC) String topic){
        Optional<?> message = Optional.ofNullable(record.value());
        if (message.isPresent()) {
            Object msg = message.get();
            log.info("topic_test 消费了： Topic:" + topic + ",Message:" + msg);
            //确认提交，消息偏移量会更新。不确认的话消息可以被重复消费
            ack.acknowledge();
        }
    }
```

## 创建主题指定分区和副本
### 默认行为
自动创建主题（如果启用）：
Kafka 服务器端配置项 auto.create.topics.enable 控制是否允许 Kafka 自动创建不存在的主题。默认情况下，这个配置是启用的。
如果 auto.create.topics.enable=true，当你发送消息到一个不存在的主题时，Kafka 会自动创建这个主题，并使用默认的分区和副本配置。  
默认下kafka的配置文件`server.properties`分区和副本配置都是1  

抛出异常（如果禁用自动创建）：
如果 auto.create.topics.enable=false，当你尝试发送消息到一个不存在的主题时，Kafka 不会自动创建主题。相反，Kafka 客户端会抛出异常，例如 UnknownTopicOrPartitionException。

### 创建指定参数
```java
@Configuration
public class KafkaConfig {
    
    //如果主题已存在且参数相同，则不会重复创建
    //如果主题已存在且参数不同且分区数变大，则会修改分区数（分区数只能放大不能缩小）
    @Bean
    public NewTopic newTopic(){
        //topic 名字 、分区数、副本数
        return new NewTopic("kafka-topic", 2, (short) 1);
        //或者建造者模式
        return TopicBuilder.name("myTopic")
                       .partitions(10)
                       .replicas(1)
                       .build();
    } 
}
```

## 消息发送分区策略  
**指定分区就会发送到指定分区中**
```java
//KafkaProducer.java中
private int partition(ProducerRecord<K, V> record, byte[] serializedKey, byte[] serializedValue, Cluster cluster) {
        if (record.partition() != null) {
            return record.partition();
        } else if (this.partitioner != null) {
            int customPartition = this.partitioner.partition(record.topic(), record.key(), serializedKey, record.value(), serializedValue, cluster);
            if (customPartition < 0) {
                throw new IllegalArgumentException(String.format("The partitioner generated an invalid partition number: %d. Partition number should always be non-negative.", customPartition));
            } else {
                return customPartition;
            }
        } else {
            return serializedKey != null && !this.partitionerIgnoreKeys ? BuiltInPartitioner.partitionForKey(serializedKey, cluster.partitionsForTopic(record.topic()).size()) : -1;
        }
    }
``` 

### 默认分配策略

消息携带了key 就使用这个策略
```java
//调用这个代码
BuiltInPartitioner.partitionForKey(serializedKey, cluster.partitionsForTopic(record.topic()).size());
 
public static int partitionForKey(byte[] serializedKey, int numPartitions) {
        return Utils.toPositive(Utils.murmur2(serializedKey)) % numPartitions;
}
```
消息没携带key 会使用随机分配
```java
    KafkaProducer.partition()方法会返回 -1
    //BuiltInPartitioner.java
    private int nextPartition(Cluster cluster) {
        int random = mockRandom != null ? (Integer)mockRandom.get() : Utils.toPositive(ThreadLocalRandom.current().nextInt());
        PartitionLoadStats partitionLoadStats = this.partitionLoadStats;
        int partition;
        if (partitionLoadStats == null) {
            List<PartitionInfo> availablePartitions = cluster.availablePartitionsForTopic(this.topic);
            if (availablePartitions.size() > 0) {
                //随机取分区
                partition = ((PartitionInfo)availablePartitions.get(random % availablePartitions.size())).partition();
            } else {
                List<PartitionInfo> partitions = cluster.partitionsForTopic(this.topic);
                partition = random % partitions.size();
            }
        } else {
            assert partitionLoadStats.length > 0;

            int[] cumulativeFrequencyTable = partitionLoadStats.cumulativeFrequencyTable;
            int weightedRandom = random % cumulativeFrequencyTable[partitionLoadStats.length - 1];
            int searchResult = Arrays.binarySearch(cumulativeFrequencyTable, 0, partitionLoadStats.length, weightedRandom);
            int partitionIndex = Math.abs(searchResult + 1);

            assert partitionIndex < partitionLoadStats.length;

            partition = partitionLoadStats.partitionIds[partitionIndex];
        }

        this.log.trace("Switching to partition {} in topic {}", partition, this.topic);
        return partition;
    }
```
### 轮询分配策略
```yaml
spring:
  kafka:
    bootstrap-servers: 
    producer:
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.springframework.kafka.support.serializer.ToStringSerializer
```
```java
//full 模式，调用方法会从spring容器中获取单例bean
@Configuration
public class KafkaConfig {
    
    @Value("${spring.kafka.bootstrap-servers}")
    private String bootstrapServers;
    @Value("${spring.kafka.producer.value-serializer}")
    private String valueSerializer;


    @Bean
    public KafkaTemplate<String, ?> kafkaTemplate(){
        return new KafkaTemplate<>(producerFactory());
    }
    @Bean
    public ProducerFactory<String, ?> producerFactory(){
        return new DefaultKafkaProducerFactory<>(config());
    }

    public Map<String,Object> config(){
        Map<String, Object> props = new HashMap<>();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, valueSerializer);
        //使用轮询分配策略
        props.put(ProducerConfig.PARTITIONER_CLASS_CONFIG, RoundRobinPartitioner.class);
        return props;
    }
}
```

### 自定义分配策略
新建自定义策略类 实现Partitoner接口
```java
public class CustomerPartitioner implements Partitioner {

    private final Map<String,AtomicInteger> counterMap = new ConcurrentHashMap<>();
    
    //发一次消息如果abortForNewBatch == ture 会触发两次partition 所以这个轮询逻辑会隔一个序号
    @Override
    public int partition(String topic, Object key, byte[] keyBytes, Object value, byte[] valueBytes, Cluster cluster) {
        List<PartitionInfo> partitionInfos = cluster.partitionsForTopic(topic);
        var counter = counterMap.computeIfAbsent(topic, k -> new AtomicInteger());
        int numPartitions = partitionInfos.size();
        if(key == null){
            int next = counter.getAndIncrement();
            if(next >= numPartitions){
                counter.compareAndSet(numPartitions,0);
            }
            return next;
        }else{
            return Utils.toPositive(Utils.murmur2(keyBytes)) % numPartitions;
        }
    }

    @Override
    public void close() {

    }

    @Override
    public void configure(Map<String, ?> map) {

    }
}
```
在配置类中指定策略类
```java
//full 模式，调用方法会从spring容器中获取单例bean
@Configuration
public class KafkaConfig {
    
    @Value("${spring.kafka.bootstrap-servers}")
    private String bootstrapServers;
    @Value("${spring.kafka.producer.value-serializer}")
    private String valueSerializer;


    @Bean
    public KafkaTemplate<String, ?> kafkaTemplate(){
        return new KafkaTemplate<>(producerFactory());
    }
    @Bean
    public ProducerFactory<String, ?> producerFactory(){
        return new DefaultKafkaProducerFactory<>(config());
    }

    public Map<String,Object> config(){
        Map<String, Object> props = new HashMap<>();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, valueSerializer);
        //使用自定义分配策略
        props.put(ProducerConfig.PARTITIONER_CLASS_CONFIG, CustomerPartitioner.class);
        return props;
    }
}
```

## 消息消费分区策略  



## 生产者发送消息流程

**KafkaProducer -> 拦截器ProducerInterceptors -> 序列化器Serializer -> 分区器Partitioner**

### 拦截器
```java
//实现ProducerInterceptor
public class CustomerProducerInterceptor implements ProducerInterceptor<String,Object> {
    @Override
    public ProducerRecord<String, Object> onSend(ProducerRecord<String, Object> producerRecord) {
        System.out.println("拦截消息："+producerRecord);
        return producerRecord;
    }

    @Override
    public void onAcknowledgement(RecordMetadata recordMetadata, Exception e) {
        if(recordMetadata != null)
            System.out.println("Kafka服务已确认：" + recordMetadata);
        else
            System.out.println("消息发送失败："+e.getMessage());
    }

    @Override
    public void close() {

    }

    @Override
    public void configure(Map<String, ?> map) {

    }
}
```  
指定拦截器
```java
//full 模式，调用方法会从spring容器中获取单例bean
@Configuration
public class KafkaConfig {
    
    @Value("${spring.kafka.bootstrap-servers}")
    private String bootstrapServers;
    @Value("${spring.kafka.producer.value-serializer}")
    private String valueSerializer;


    @Bean
    public KafkaTemplate<String, ?> kafkaTemplate(){
        return new KafkaTemplate<>(producerFactory());
    }
    @Bean
    public ProducerFactory<String, ?> producerFactory(){
        return new DefaultKafkaProducerFactory<>(config());
    }

    public Map<String,Object> config(){
        Map<String, Object> props = new HashMap<>();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, valueSerializer);
        //使用自定义分配策略
        props.put(ProducerConfig.PARTITIONER_CLASS_CONFIG, CustomerPartitioner.class);
        //使用自定义拦截器
        props.put(ProducerConfig.INTERCEPTOR_CLASSES_CONFIG,CustomerProducerInterceptor.class.getName());
        return props;
    }
}
```

## 消费者消费消息流程

### 拦截器  
```java
public class CustomerConsumerInterceptor implements ConsumerInterceptor<String,Object> {
    //消费消息前触发
    @Override
    public ConsumerRecords<String, Object> onConsume(ConsumerRecords<String, Object> consumerRecords) {
        return null;
    }

    // 提交offset前触发
    @Override
    public void onCommit(Map<TopicPartition, OffsetAndMetadata> map) {

    }

    @Override
    public void close() {

    }

    @Override
    public void configure(Map<String, ?> map) {

    }
}
```  
指定拦截器
```java
//full 模式，调用方法会从spring容器中获取单例bean
@Configuration
public class KafkaConfig {

    @Value("${spring.kafka.bootstrap-servers}")
    private String bootstrapServers;
    @Value("${spring.kafka.producer.value-serializer}")
    private String valueSerializer;


    @Bean
    public KafkaListenerContainerFactory<?> customerKafkaListenerContainerFactory(){
        ConcurrentKafkaListenerContainerFactory<String,?> concurrentKafkaListenerContainerFactory = new ConcurrentKafkaListenerContainerFactory<>();
        concurrentKafkaListenerContainerFactory.setConsumerFactory(consumerFactory());
       return concurrentKafkaListenerContainerFactory;
    }
    @Bean
    public ConsumerFactory<String, Object> consumerFactory(){
        return new DefaultKafkaConsumerFactory<>(config());
    }

    public Map<String,Object> config(){
        Map<String, Object> props = new HashMap<>();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, valueSerializer);
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, valueSerializer);
        //使用自定义消费者拦截器
        props.put(ConsumerConfig.INTERCEPTOR_CLASSES_CONFIG, CustomerConsumerInterceptor.class.getName());
        return props;
    }
}
```
消费者监听指定容器工厂  
```java
@KafkaListener(topics = "test-topic",groupId = "topic-group",containerFactory = "customerKafkaListenerContainerFactory") //指定容器工厂
    public void topicTest(ConsumerRecord<?, ?> record, Acknowledgment ack
            , @Header(KafkaHeaders.RECEIVED_TOPIC) String topic){
        Optional<?> message = Optional.ofNullable(record.value());
        if (message.isPresent()) {
            Object msg = message.get();
            log.info("topic_test 消费了： Topic:" + topic + ",Message:" + msg);
            //确认提交，消息偏移量会更新。不确认的话消息可以被重复消费
            ack.acknowledge();
        }
    }
```

### 消费者转发消息
```java
    @KafkaListener(topics = "test-topic",groupId = "topic-group",containerFactory = "customerKafkaListenerContainerFactory") //指定容器工厂
    @SendTo(value="test-topic1")
    public String topicTest(ConsumerRecord<?, ?> record){
        //将return的内容转发给 test-topic1
        return record.value() + "xzxzzx";
    }
```