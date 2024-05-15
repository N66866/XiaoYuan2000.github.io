# Springboot 内嵌activeMQ artemis
## 情况描述
近期，我司售卖产品至上海某三甲医院，安装实施时，医院信息科拒绝安装MQ，表明MQ不安全，不准安装，并且无视我们的沟通解释...
最后我司架构师表示：我们偷龙转凤，搞个Springboot项目内嵌一个MQ，瞒天过海。这项任务就交到我手上了...

## 引入依赖
创建一个maven项目后，引入依赖，这里使用Springboot 2.7.x，虽然新版本已经是3.x，但是3.x不支持jdk8（公司部署的项目使用的是8） 且 我还没用过，只能使用旧版本。
为了找到要用哪些依赖，查了小半个小时资料...
```xml
<parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>2.7.12</version>
        <relativePath/> <!-- lookup parent from repository -->
</parent>
<dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter</artifactId>
        </dependency>
        <!-- https://mvnrepository.com/artifact/org.springframework.boot/spring-boot-starter-artemis -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-artemis</artifactId>
        </dependency>
        <!-- https://mvnrepository.com/artifact/org.apache.activemq/artemis-jms-server -->
        <dependency>
            <groupId>org.apache.activemq</groupId>
            <artifactId>artemis-jms-server</artifactId>
        </dependency>
        <dependency>
            <groupId>org.apache.activemq</groupId>
            <artifactId>artemis-server</artifactId>
        </dependency>
    </dependencies>
```

## 配置
### ActiveMQServer 监听配置
**代码解释看注释就好了**
```java
import org.apache.activemq.artemis.core.config.Configuration;
import org.apache.activemq.artemis.core.config.impl.ConfigurationImpl;
import org.apache.activemq.artemis.core.server.ActiveMQServer;
import org.apache.activemq.artemis.core.server.ActiveMQServers;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;

@org.springframework.context.annotation.Configuration
public class ArtemisConfig {
    private static final Logger logger = LoggerFactory.getLogger(ArtemisConfig.class);

    @Bean
    public ActiveMQServer activeMQServer() throws Exception {
        Configuration configuration = new ConfigurationImpl()
        		//关闭持久化
                .setPersistenceEnabled(false)
                .setJournalDirectory("target/data/journal")
                .setSecurityEnabled(false)
                //添加acceptor监听端口 格式：名字,监听uri
                .addAcceptorConfiguration("client", "tcp://0.0.0.0:8083")
                .addAcceptorConfiguration("server", "tcp://0.0.0.0:11883");

        ActiveMQServer server = ActiveMQServers.newActiveMQServer(configuration);
        //一定要start，没start就等于白干。
        server.start();
        return server;
    }
}
```  

### 新建客户端配置测试
```java
//注册bean
@Configuration
@EnableJms
public class JmsConfig {

    @Bean
    public JmsTemplate jmsTemplate(@Qualifier("jmsConnectionFactory") ConnectionFactory connectionFactory) {
        JmsTemplate jmsTemplate = new JmsTemplate(connectionFactory);
     //   jmsTemplate.setPubSubDomain(false); // 如果你使用队列而不是主题
        return jmsTemplate;
    }
}
```

监听主题
```java
@Component
public class JmsMessageListener {
    @JmsListener(destination = "yourQueueName")
    public void receiveMessage(String message) {
        System.out.println("Received message: " + message);
    }
}
```

```java
@SpringBootApplication
@EnableJms
public class ArtemisApplication
{

    public static void main( String[] args )
    {
        ConfigurableApplicationContext run = SpringApplication.run(ArtemisApplication.class, args);
        JmsTemplate jmsTemplate = run.getBean(JmsTemplate.class);
        jmsTemplate.convertAndSend("yourQueueName","{111:222}");
    }
}
```
启动项目就可以看到 `JmsMessageListener` 中的 `receiveMessage` 已经接受到了`{111:222}` 这条消息，证明没问题。测试完成后可以将这些bean和测试项删除，保持简洁。

## 继承我司项目使用问题排查
### websocket问题
在我司客户端软件上使用js websocket连接MQ时报错：`Error during WebSocket handshake: Sent non-empty 'Sec-WebSocket-Protocol' header but no response was received`
在控制台上看到，websocket 握手时，Sec-WebSocket-Protocol 为 `mqtt`

查看服务端监听时没指定`protocol`，添加上去：
```java

    @Bean
    public ActiveMQServer activeMQServer() throws Exception {
        Configuration configuration = new ConfigurationImpl()
        		//关闭持久化
                .setPersistenceEnabled(false)
                .setJournalDirectory("target/data/journal")
                .setSecurityEnabled(false)
                // 改了这里
                .addAcceptorConfiguration("client", "tcp://0.0.0.0:8083?tcpSendBufferSize=1048576;tcpReceiveBufferSize=1048576;protocols=MQTT;useEpoll=true")
                .addAcceptorConfiguration("server", "tcp://0.0.0.0:11883");

        ActiveMQServer server = ActiveMQServers.newActiveMQServer(configuration);
        //一定要start，没start就等于白干。
        server.start();
        return server;
    }
```
然后启动项目，服务端警告：
`Classpath lacks a protocol-manager for protocol MQTT, Protocol being ignored on acceptor TransportConfiguration`，
提示缺少mqtt协议支持，查询资料后得知要添加协议依赖，再到maven官方仓库查找对应依赖，之后添加到pom上
```xml
        <!-- https://mvnrepository.com/artifact/org.apache.activemq/artemis-mqtt-protocol -->
        <dependency>
            <groupId>org.apache.activemq</groupId>
            <artifactId>artemis-mqtt-protocol</artifactId>
            <version>2.19.1</version>
        </dependency>
```

最后启动项目，再使用客户端与该内嵌artemis MQ通信，发现没问题。至此问题解决。

## 总结
有些甲方仗势凌人，无论怎么解释他都要展现自己的权利权威硬是打压你一下。
最后该Springboot内置Artemis MQ完成，通信没问题，如果有其他需求可根据我的思路完成自己的任务。(ps:我司架构师给了5天时间，我搞了2个小时就完成嘿嘿)